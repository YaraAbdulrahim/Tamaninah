/**
 * Fetch, verify and snapshot the topic tafsir excerpts and Sahihayn hadith (zero runtime network).
 *
 *   npx vite-node server/scripts/snapshotContent.ts            # fetch twice, compare, write
 *   npx vite-node server/scripts/snapshotContent.ts --verify   # re-fetch and compare with the committed snapshots (no write)
 *   ... --allow-partial                                        # write even if some items failed (they are left out)
 *   ... --only=seerah   (or tafsir / hadith, comma-separated)  # fetch and write only those sections
 *
 * Sources (only these hosts are contacted):
 *   - api.quranpedia.net  /v1/ayah/{s}/{a}/book/4 — Tafsir al-Tabari (جامع البيان), ed. Ahmad Shakir
 *   - quranpedia.net      embed page (human-viewable link, checked for HTTP 200 + book title)
 *   - shamela.ws          /ajax/specialnumber2id, /book/{id}/{page} (HTML), /ajax/pageContent (JSON), /book/{id} (card)
 *                         — Sahih al-Bukhari 1681, Sahih Muslim 1727, Sirat Ibn Hisham 23833 (Seerah slot)
 *
 * For every item: pass 1 fetches the source and slices the excerpt between the anchor's locators
 * (server/content/topicSourceAnchors.ts); pass 2 fetches again (for Shamela, through the other
 * endpoint) and must reproduce the identical excerpt. Only then is the record written, with
 * fetchedAt / verifiedAt / requests / sha256 / verification_note.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HADITH_SNAPSHOT_KIND,
  SEERAH_SNAPSHOT_KIND,
  SOURCE_SNAPSHOT_SCHEMA,
  TAFSIR_SNAPSHOT_KIND,
  type HadithSnapshotFile,
  type HadithSnapshotRecord,
  type SeerahSnapshotFile,
  type SeerahSnapshotRecord,
  type TafsirSnapshotFile,
  type TafsirSnapshotRecord,
} from "../content/sourceSnapshotFormat";
import {
  HADITH_COLLECTIONS,
  SAHIHAYN_GRADE,
  SEERAH_SOURCES,
  TAFSIR_SOURCE_ID,
  hadithSourceReference,
  quranpediaTafsirApiUrl,
  quranpediaTafsirViewUrl,
  sahihaynGradeBasis,
  seerahSourceReference,
  shamelaNumberToPageUrl,
  shamelaPageContentUrl,
  shamelaPageUrl,
  sourceSnapshotFingerprint,
  tafsirSourceReference,
  SHAMELA_BASE,
} from "../content/sourceSnapshotRefs";
import {
  SourceTextError,
  arabicSkeleton,
  cleanQuranpediaBookPages,
  cleanShamelaNass,
  decodeEntities,
  hasFootnoteMarker,
  locateExcerpt,
  toArabicIndicDigits,
  type QuranpediaBookPage,
} from "../content/sourceText";
import {
  TOPIC_HADITH_SOURCE_ANCHORS,
  TOPIC_TAFSIR_ANCHORS,
  tafsirMatchesQuranAnchor,
  type TopicHadithSourceAnchor,
  type TopicTafsirAnchor,
} from "../content/topicSourceAnchors";
import { TOPIC_SEERAH_ANCHORS, type TopicSeerahAnchor } from "../content/topicSeerahAnchors";

const here = dirname(fileURLToPath(import.meta.url));
const TAFSIR_TARGET = resolve(here, "../content/snapshots/tafsir.published.json");
const HADITH_TARGET = resolve(here, "../content/snapshots/hadith.published.json");
const SEERAH_TARGET = resolve(here, "../content/snapshots/seerah.published.json");

const VERIFY_ONLY = process.argv.includes("--verify");
const ALLOW_PARTIAL = process.argv.includes("--allow-partial");
const ONLY = new Set(
  (process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? "tafsir,hadith,seerah")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
);
const USER_AGENT = "tamaninah-content-snapshot/1.0 (low-volume verbatim excerpt check)";
const MIN_INTERVAL_MS = 450;
const MAX_EXCERPT_CHARS = 1200;
const MAX_PARAGRAPHS = 3;

let lastRequestAt = 0;
async function politeFetch(url: string, accept: string): Promise<string> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const res = await fetch(url, { headers: { Accept: accept, "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
const getJson = async <T>(url: string): Promise<T> => JSON.parse(await politeFetch(url, "application/json")) as T;
const getHtml = (url: string) => politeFetch(url, "text/html");

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

function assertExcerptShape(excerpt: string): void {
  if (!excerpt.trim()) throw new SourceTextError("empty excerpt");
  if (excerpt.length > MAX_EXCERPT_CHARS) throw new SourceTextError(`excerpt too long (${excerpt.length})`);
  if (excerpt.split("\n").length > MAX_PARAGRAPHS) throw new SourceTextError("more than 3 paragraphs");
  if (hasFootnoteMarker(excerpt)) throw new SourceTextError("footnote marker inside excerpt");
  if (/[<>]/.test(excerpt)) throw new SourceTextError("markup left in excerpt");
  if (!/[.؟!»")]$/.test(excerpt)) throw new SourceTextError("excerpt does not end at a sentence boundary");
}

/* ───────────────────────── tafsir (Quranpedia API) ───────────────────────── */

type QuranpediaBookResponse = {
  book: {
    id: number;
    name: string;
    short_name: string | null;
    edition: string | null;
    nasher: string | null;
    mohaqeq: string | null;
    author: { ar_name: string; full_name: string } | null;
  };
  content: QuranpediaBookPage[];
};

type TafsirExtraction = {
  excerpt: string;
  offset: number;
  sourceText: string;
  book: QuranpediaBookResponse["book"];
  volume: number;
  pages: number[];
  requests: string[];
  paragraphs: number;
};

function flat(text: string): string {
  return arabicSkeleton(text.replace(/\s+/g, " ")).skeleton;
}

async function extractTafsir(anchor: TopicTafsirAnchor): Promise<TafsirExtraction> {
  const requests = anchor.fetchAyat.map(([s, a]) => quranpediaTafsirApiUrl(s, a, anchor.bookId));
  const responses: QuranpediaBookResponse[] = [];
  for (const url of requests) responses.push(await getJson<QuranpediaBookResponse>(url));
  const book = responses[0]!.book;
  if (book.id !== anchor.bookId) throw new SourceTextError(`unexpected book id ${book.id}`);
  const rawPages = responses.flatMap((r) => r.content);
  const cleaned = cleanQuranpediaBookPages(rawPages);
  const loc = locateExcerpt(cleaned.text, anchor.startLocator, anchor.endLocator);
  assertExcerptShape(loc.text);

  // Which printed pages does the excerpt span? Match its head and tail page by page.
  const head = flat(loc.text).slice(0, 24);
  const tail = flat(loc.text).slice(-24);
  const perPage = cleaned.pages.map((p) => {
    const raw = rawPages.find((r) => Number(String(r.part).trim()) === p.part && Number(r.page) === p.page)!;
    return { ...p, flat: flat(cleanQuranpediaBookPages([raw]).text) };
  });
  const first = perPage.findIndex((p) => p.flat.includes(head));
  const lastFromEnd = [...perPage].reverse().findIndex((p) => p.flat.includes(tail));
  if (first === -1 || lastFromEnd === -1) throw new SourceTextError("could not map excerpt to printed pages");
  const last = perPage.length - 1 - lastFromEnd;
  if (last < first) throw new SourceTextError("excerpt page range inverted");
  const span = perPage.slice(first, last + 1);
  if (new Set(span.map((p) => p.part)).size !== 1) throw new SourceTextError("excerpt spans two volumes");

  return {
    excerpt: loc.text,
    offset: loc.start,
    sourceText: cleaned.text,
    book,
    volume: span[0]!.part,
    pages: span.map((p) => p.page),
    requests,
    paragraphs: loc.text.split("\n").length,
  };
}

async function snapshotTafsir(anchor: TopicTafsirAnchor): Promise<TafsirSnapshotRecord> {
  if (!tafsirMatchesQuranAnchor(anchor)) throw new SourceTextError("tafsir anchor does not explain the topic's quran anchor");
  const fetchedAt = new Date().toISOString();
  const first = await extractTafsir(anchor);
  const verifiedAt = new Date().toISOString();
  const second = await extractTafsir(anchor);
  if (second.excerpt !== first.excerpt || second.offset !== first.offset) {
    throw new SourceTextError("second fetch produced a different excerpt");
  }

  const url = quranpediaTafsirViewUrl(anchor.surah, anchor.ayah, anchor.bookId);
  const viewHtml = await getHtml(url);
  const viewOk = viewHtml.includes(first.book.name);

  const reference = tafsirSourceReference({ surah: anchor.surah, ayah: anchor.ayah, volume: first.volume, pages: first.pages });
  const excerptSha = sha256(first.excerpt);
  const note = [
    `Pass 1 ${fetchedAt}: GET ${first.requests.join(" + ")} (Quranpedia API, book ${anchor.bookId}).`,
    `Pass 2 ${verifiedAt}: same request(s) re-fetched; excerpt byte-identical (sha256 ${excerptSha}).`,
    `Cleaning: page <div class="foot-notes"> blocks removed, tags stripped, entities decoded, whitespace collapsed, pages joined in (part, page) order; no letter or tashkeel changed.`,
    `Excerpt = contiguous slice located by start/end locators (diacritic-insensitive), ${first.paragraphs} paragraph(s), ends at a sentence boundary, no footnote markers; printed ج${first.volume} ص${first.pages.join("–")}.`,
    `View page ${viewOk ? "returned HTTP 200 and names the book" : "returned HTTP 200 but the book title was not found in it"}.`,
  ].join(" ");

  return {
    contentId: anchor.contentId,
    topicId: anchor.topicId,
    sourceId: TAFSIR_SOURCE_ID,
    surah: anchor.surah,
    ayah: anchor.ayah,
    bookId: anchor.bookId,
    bookName: first.book.name,
    author: first.book.author?.full_name ?? "",
    authorShort: first.book.author?.ar_name ?? first.book.short_name ?? "",
    editor: first.book.mohaqeq,
    publisher: first.book.nasher,
    edition: first.book.edition,
    volume: first.volume,
    pages: first.pages,
    arabic: first.excerpt,
    url,
    fetchedAt,
    verifiedAt,
    requests: [...first.requests, ...second.requests, url],
    excerptSha256: excerptSha,
    sourceTextSha256: sha256(first.sourceText),
    excerptOffset: first.offset,
    verification_note: note,
    textFingerprint: sourceSnapshotFingerprint(first.excerpt, reference, url),
  };
}

/* ───────────────────────── hadith (shamela.ws) ───────────────────────── */

const editionCache = new Map<number, string>();

function htmlToText(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

async function shamelaEdition(bookId: number): Promise<string> {
  const cached = editionCache.get(bookId);
  if (cached) return cached;
  const html = await getHtml(`${SHAMELA_BASE}/book/${bookId}`);
  const cardStart = html.indexOf("بطاقة الكتاب");
  const cardEnd = html.indexOf("عدد الأجزاء", cardStart);
  if (cardStart === -1 || cardEnd === -1) throw new SourceTextError(`book card not found on Shamela book ${bookId}`);
  const card = htmlToText(`${html.slice(cardStart, cardEnd)} عدد الأجزاء`);
  // Edition statement as printed on the card: from the editor / edition line up to «عدد الأجزاء».
  const m = /((?:تحقيق|المحقق|الطبعة):.+?)\s*عدد الأجزاء/.exec(card);
  if (!m) throw new SourceTextError(`edition statement not found on Shamela book ${bookId}`);
  editionCache.set(bookId, m[1]!);
  return m[1]!;
}

function entryBounds(text: string, anchor: TopicHadithSourceAnchor): { from: number; until: number } {
  const n = toArabicIndicDigits(anchor.number);
  const marker =
    anchor.collection === "bukhari"
      ? new RegExp(`(?:^|\\s)${n} - (?:[٠-٩]+ - )*`)
      : new RegExp(`(?:^|\\s)[٠-٩]+ - \\(${n}\\)`);
  const m = marker.exec(text);
  if (!m) throw new SourceTextError(`hadith number ${anchor.number} not printed on the page`);
  const from = m.index + m[0].length;
  const next = (anchor.collection === "bukhari" ? /[٠-٩]+ - / : /[٠-٩]+ - \(/).exec(text.slice(from));
  return { from, until: next ? from + next.index : text.length };
}

type HadithPagePass = { excerpt: string; offset: number; sourceText: string };

function sliceHadith(text: string, anchor: TopicHadithSourceAnchor): HadithPagePass {
  const bounds = entryBounds(text, anchor);
  const loc = locateExcerpt(text, anchor.startLocator, anchor.endLocator, bounds);
  assertExcerptShape(loc.text);
  return { excerpt: loc.text, offset: loc.start, sourceText: text };
}

async function snapshotHadith(anchor: TopicHadithSourceAnchor): Promise<HadithSnapshotRecord> {
  const meta = HADITH_COLLECTIONS[anchor.collection];
  const requests: string[] = [];

  const mapUrl = shamelaNumberToPageUrl(meta.shamelaBookId, anchor.number);
  requests.push(mapUrl);
  const pageId = Number((await politeFetch(mapUrl, "text/plain")).trim());
  if (pageId !== anchor.shamelaPageId) {
    throw new SourceTextError(`hadith ${anchor.number} now resolves to page ${pageId}, anchor pins ${anchor.shamelaPageId}`);
  }

  // Pass 1 — the public HTML page (this is the URL shown to the user).
  const fetchedAt = new Date().toISOString();
  const url = shamelaPageUrl(meta.shamelaBookId, pageId);
  requests.push(url);
  const html = await getHtml(url);
  const nassMatch = /<div class="nass[^"]*"[^>]*data-page-id="(\d+)"[^>]*>([\s\S]*?)<\/div>\s*<div id="appended_pages">/.exec(html);
  if (!nassMatch || Number(nassMatch[1]) !== pageId) throw new SourceTextError("page text block not found");
  const pass1 = sliceHadith(cleanShamelaNass(nassMatch[2]!), anchor);

  const pathStart = html.indexOf("مسار الصفحة الحالية");
  const pathEnd = html.indexOf('<div class="nomargin">', pathStart);
  if (pathStart === -1 || pathEnd === -1) throw new SourceTextError("page path (كتاب/باب) not found");
  const crumbs = [...html.slice(pathStart, pathEnd).matchAll(/<span class="text-black">([^<]*)<\/span>/g)].map((m) =>
    htmlToText(m[1]!),
  );
  if (crumbs.length < 3) throw new SourceTextError(`unexpected page path: ${crumbs.join(" > ")}`);
  const kitab = crumbs[1]!;
  const bab = crumbs[crumbs.length - 1]!;
  const part = Number(/id="fld_part_(?:top|bottom)" value="(\d+)"/.exec(html)?.[1]);
  const printedPage = Number(/id="fld_goto_(?:top|bottom)" value="(\d+)"/.exec(html)?.[1]);
  if (!part || !printedPage) throw new SourceTextError("volume/page not found");

  // Pass 2 — the JSON page-content endpoint, independently cleaned.
  const verifiedAt = new Date().toISOString();
  const contentUrl = shamelaPageContentUrl(meta.shamelaBookId, pageId);
  requests.push(contentUrl);
  const json = await getJson<{ nass: string; part: string; pageNum: number; pageId: number; title: string }>(contentUrl);
  if (Number(json.pageId) !== pageId) throw new SourceTextError("page-content id mismatch");
  const pass2 = sliceHadith(cleanShamelaNass(json.nass), anchor);
  if (pass2.excerpt !== pass1.excerpt) throw new SourceTextError("HTML page and page-content JSON disagree on the text");
  if (Number(json.part) !== part || Number(json.pageNum) !== printedPage) {
    throw new SourceTextError("HTML page and page-content JSON disagree on volume/page");
  }

  const edition = await shamelaEdition(meta.shamelaBookId);
  requests.push(`${SHAMELA_BASE}/book/${meta.shamelaBookId}`);
  const reference = hadithSourceReference({ collection: meta.collection, number: anchor.number });
  const excerptSha = sha256(pass1.excerpt);
  const note = [
    `Number ${anchor.number} → Shamela page ${pageId} via ${mapUrl}.`,
    `Pass 1 ${fetchedAt}: GET ${url} (HTML page text block).`,
    `Pass 2 ${verifiedAt}: GET ${contentUrl} (page-content JSON); excerpt byte-identical (sha256 ${excerptSha}); volume/page agree (ج${part} ص${printedPage}).`,
    `Cleaning: copy buttons, anchors, hamesh (editor's notes) and printed-page markers ⦗…⦘ removed, tags stripped, entities decoded, whitespace collapsed; letters, tashkeel and honorific glyphs kept as printed.`,
    `Excerpt = contiguous slice of hadith ${anchor.number}'s entry from the Companion to the end of the matn; isnad above the Companion omitted.`,
    `Grade ${SAHIHAYN_GRADE}: in ${meta.collection} (sources.pdf hadith row: «الأحاديث الصحيحة من الصحيحين»).`,
  ].join(" ");

  return {
    contentId: anchor.contentId,
    topicId: anchor.topicId,
    sourceId: meta.sourceId,
    collection: meta.collection,
    shamelaBookId: meta.shamelaBookId,
    shamelaPageId: pageId,
    number: anchor.number,
    kitab,
    bab,
    part,
    printedPage,
    edition,
    grade: SAHIHAYN_GRADE,
    gradeBasis: sahihaynGradeBasis(meta.collection),
    arabic: pass1.excerpt,
    url,
    fetchedAt,
    verifiedAt,
    requests,
    excerptSha256: excerptSha,
    sourceTextSha256: sha256(pass1.sourceText),
    excerptOffset: pass1.offset,
    verification_note: note,
    textFingerprint: sourceSnapshotFingerprint(pass1.excerpt, reference, url),
  };
}


/* ───────────────────────── seerah (shamela.ws: Sahih al-Bukhari / Sirat Ibn Hisham) ───────────────────────── */

const SEERAH_MAX_CHARS = 1700;

/** Story passages must stand alone: balanced quotation marks, no poetry hemistichs («...»). */
function assertSeerahShape(excerpt: string): void {
  if (excerpt.length > SEERAH_MAX_CHARS) throw new SourceTextError(`passage too long (${excerpt.length})`);
  if (hasFootnoteMarker(excerpt)) throw new SourceTextError("footnote marker inside passage");
  if (/[<>]/.test(excerpt)) throw new SourceTextError("markup left in passage");
  if (excerpt.includes(" ... ")) throw new SourceTextError("poetry (hemistich separator) inside passage");
  if (!/[.؟!»")]$/.test(excerpt)) throw new SourceTextError("passage does not end at a sentence boundary");
  const count = (ch: string) => excerpt.split(ch).length - 1;
  if (count("«") !== count("»") || count("﴿") !== count("﴾")) throw new SourceTextError("unbalanced quotation marks");
}

type ShamelaPass = { text: string; part: number | null; printedPage: number };

async function shamelaHtmlPass(bookId: number, pageId: number): Promise<ShamelaPass & { crumbs: string[]; url: string }> {
  const url = shamelaPageUrl(bookId, pageId);
  const html = await getHtml(url);
  const nassMatch = /<div class="nass[^"]*"[^>]*data-page-id="(\d+)"[^>]*>([\s\S]*?)<\/div>\s*<div id="appended_pages">/.exec(html);
  if (!nassMatch || Number(nassMatch[1]) !== pageId) throw new SourceTextError("page text block not found");
  const pathStart = html.indexOf("مسار الصفحة الحالية");
  const pathEnd = html.indexOf('<div class="nomargin">', pathStart);
  if (pathStart === -1 || pathEnd === -1) throw new SourceTextError("page path not found");
  // Page-path headings as printed, minus footnote markers ([١]) — metadata, never displayed as text.
  const crumbs = [...html.slice(pathStart, pathEnd).matchAll(/<span class="text-black">([^<]*)<\/span>/g)].map((m) =>
    htmlToText(m[1]!).replace(/\s*\[[0-9٠-٩]+\]/g, ""),
  );
  if (crumbs.length < 2) throw new SourceTextError(`unexpected page path: ${crumbs.join(" > ")}`);
  const part = Number(/id="fld_part_(?:top|bottom)" value="(\d+)"/.exec(html)?.[1]) || null;
  const printedPage = Number(/id="fld_goto_(?:top|bottom)" value="(\d+)"/.exec(html)?.[1]);
  if (!printedPage) throw new SourceTextError("printed page not found");
  return { text: cleanShamelaNass(nassMatch[2]!), part, printedPage, crumbs, url };
}

async function shamelaJsonPass(bookId: number, pageId: number): Promise<ShamelaPass & { url: string }> {
  const url = shamelaPageContentUrl(bookId, pageId);
  const json = await getJson<{ nass: string; part?: string; pageNum: number; pageId: number | string }>(url);
  if (Number(json.pageId) !== pageId) throw new SourceTextError("page-content id mismatch");
  return { text: cleanShamelaNass(json.nass), part: json.part ? Number(json.part) : null, printedPage: Number(json.pageNum), url };
}

function sliceSeerah(text: string, anchor: TopicSeerahAnchor): { excerpt: string; offset: number } {
  const bounds =
    anchor.source === "bukhari" && anchor.number
      ? entryBounds(text, {
          topicId: anchor.topicId,
          contentId: anchor.storyId,
          collection: "bukhari",
          number: anchor.number,
          shamelaPageId: anchor.shamelaPageId,
          startLocator: anchor.startLocator,
          endLocator: anchor.endLocator,
          rationale: anchor.rationale,
        })
      : {};
  const loc = locateExcerpt(text, anchor.startLocator, anchor.endLocator, bounds);
  assertSeerahShape(loc.text);
  return { excerpt: loc.text, offset: loc.start };
}

async function snapshotSeerah(anchor: TopicSeerahAnchor): Promise<SeerahSnapshotRecord> {
  const meta = SEERAH_SOURCES[anchor.source];
  const requests: string[] = [];
  if (anchor.number) {
    const mapUrl = shamelaNumberToPageUrl(meta.shamelaBookId, anchor.number);
    requests.push(mapUrl);
    const pageId = Number((await politeFetch(mapUrl, "text/plain")).trim());
    if (pageId !== anchor.shamelaPageId) {
      throw new SourceTextError(`hadith ${anchor.number} now resolves to page ${pageId}, anchor pins ${anchor.shamelaPageId}`);
    }
  }

  const fetchedAt = new Date().toISOString();
  const page = await shamelaHtmlPass(meta.shamelaBookId, anchor.shamelaPageId);
  requests.push(page.url);
  const pass1 = sliceSeerah(page.text, anchor);

  const verifiedAt = new Date().toISOString();
  const json = await shamelaJsonPass(meta.shamelaBookId, anchor.shamelaPageId);
  requests.push(json.url);
  const pass2 = sliceSeerah(json.text, anchor);
  if (pass2.excerpt !== pass1.excerpt) throw new SourceTextError("HTML page and page-content JSON disagree on the text");
  if (json.printedPage !== page.printedPage || (json.part !== null && page.part !== null && json.part !== page.part)) {
    throw new SourceTextError("HTML page and page-content JSON disagree on volume/page");
  }
  const part = page.part ?? json.part;
  if (!part) throw new SourceTextError("volume not found");

  const edition = await shamelaEdition(meta.shamelaBookId);
  requests.push(`${SHAMELA_BASE}/book/${meta.shamelaBookId}`);
  const kitab = page.crumbs[1]!;
  const bab = page.crumbs[page.crumbs.length - 1]!;
  const sahih = meta.kind === "sahih";
  const reference = seerahSourceReference({
    sourceKind: meta.kind,
    book: meta.book,
    number: anchor.number ?? null,
    part,
    printedPage: page.printedPage,
  });
  const excerptSha = sha256(pass1.excerpt);
  const note = [
    anchor.number ? `Number ${anchor.number} → Shamela page ${anchor.shamelaPageId}.` : `Shamela book ${meta.shamelaBookId}, page ${anchor.shamelaPageId}.`,
    `Pass 1 ${fetchedAt}: GET ${page.url} (HTML page text block).`,
    `Pass 2 ${verifiedAt}: GET ${json.url} (page-content JSON); passage byte-identical (sha256 ${excerptSha}); ج${part} ص${page.printedPage}.`,
    `Cleaning: copy buttons, anchors, hamesh and printed-page markers removed, tags stripped, entities decoded, whitespace collapsed; letters and tashkeel kept as printed.`,
    sahih
      ? `Passage = contiguous slice of hadith ${anchor.number}'s entry about the event (isnad above the narrating Companion omitted). Grade ${SAHIHAYN_GRADE}: in ${meta.book}.`
      : `Passage = contiguous prose slice of the Seerah section «${bab}»; no poetry, no footnote markers. Seerah book — no hadith grade asserted.`,
  ].join(" ");

  return {
    storyId: anchor.storyId,
    topicId: anchor.topicId,
    sourceId: meta.sourceId,
    sourceKind: meta.kind,
    title: anchor.title,
    titleEn: anchor.titleEn,
    book: meta.book,
    shamelaBookId: meta.shamelaBookId,
    shamelaPageId: anchor.shamelaPageId,
    number: anchor.number ?? null,
    kitab,
    bab,
    part,
    printedPage: page.printedPage,
    edition,
    grade: sahih ? SAHIHAYN_GRADE : null,
    gradeBasis: sahih ? sahihaynGradeBasis(meta.book) : null,
    arabic: pass1.excerpt,
    url: page.url,
    fetchedAt,
    verifiedAt,
    requests,
    excerptSha256: excerptSha,
    sourceTextSha256: sha256(page.text),
    excerptOffset: pass1.offset,
    verification_note: note,
    textFingerprint: sourceSnapshotFingerprint(pass1.excerpt, reference, page.url),
  };
}

/* ───────────────────────── main ───────────────────────── */

async function collect<A extends { contentId: string } | { storyId: string }, R>(
  label: string,
  anchors: readonly A[],
  run: (a: A) => Promise<R>,
): Promise<{ records: R[]; failures: string[] }> {
  const records: R[] = [];
  const failures: string[] = [];
  if (!ONLY.has(label)) return { records, failures };
  for (const anchor of anchors) {
    const id = "contentId" in anchor ? anchor.contentId : anchor.storyId;
    try {
      records.push(await run(anchor));
      console.info(`[content] ${label} ${id} ok`);
    } catch (error) {
      const msg = `${id}: ${error instanceof Error ? error.message : String(error)}`;
      failures.push(msg);
      console.error(`[content] ${label} FAILED ${msg}`);
    }
  }
  return { records, failures };
}

function compareWithCommitted<R extends { arabic: string }>(
  path: string,
  fresh: R[],
  idOf: (r: R) => string = (r) => (r as unknown as { contentId: string }).contentId,
): string[] {
  if (!existsSync(path)) return [`${path} does not exist`];
  const committed = JSON.parse(readFileSync(path, "utf8")) as { records: R[] };
  const problems: string[] = [];
  for (const row of committed.records) {
    const now = fresh.find((r) => idOf(r) === idOf(row));
    if (!now) problems.push(`${idOf(row)}: could not be re-fetched`);
    else if (now.arabic !== row.arabic) problems.push(`${idOf(row)}: source text differs from the snapshot`);
  }
  return problems;
}

async function main() {
  const tafsir = await collect("tafsir", TOPIC_TAFSIR_ANCHORS, snapshotTafsir);
  const hadith = await collect("hadith", TOPIC_HADITH_SOURCE_ANCHORS, snapshotHadith);
  const seerah = await collect("seerah", TOPIC_SEERAH_ANCHORS, snapshotSeerah);
  const failures = [...tafsir.failures, ...hadith.failures, ...seerah.failures];

  if (VERIFY_ONLY) {
    const problems = [
      ...(ONLY.has("tafsir") ? compareWithCommitted(TAFSIR_TARGET, tafsir.records as TafsirSnapshotRecord[]) : []),
      ...(ONLY.has("hadith") ? compareWithCommitted(HADITH_TARGET, hadith.records as HadithSnapshotRecord[]) : []),
      ...(ONLY.has("seerah")
        ? compareWithCommitted(SEERAH_TARGET, seerah.records as SeerahSnapshotRecord[], (r) => r.storyId)
        : []),
    ];
    if (problems.length) {
      console.error(`[content] verify FAILED:\n  ${problems.join("\n  ")}`);
      process.exitCode = 1;
    } else {
      console.info("[content] verify ok — committed snapshots match the live sources");
    }
    return;
  }

  if (failures.length && !ALLOW_PARTIAL) {
    console.error(`[content] ${failures.length} item(s) failed; nothing written (use --allow-partial to write the verified rest).`);
    process.exitCode = 1;
    return;
  }

  const generatedAt = new Date().toISOString();
  const generator = "npx vite-node server/scripts/snapshotContent.ts";
  const tafsirFile: TafsirSnapshotFile = {
    kind: TAFSIR_SNAPSHOT_KIND,
    schema: SOURCE_SNAPSHOT_SCHEMA,
    source: "Quranpedia API v1 — جامع البيان في تأويل آي القرآن (الطبري), book 4",
    generatedAt,
    generator,
    notes:
      "Verbatim excerpts of Tafsir al-Tabari for each topic's anchor verse, fetched twice and compared. " +
      "Loaded synchronously at server start (zero runtime network). Do not hand-edit: a record whose text " +
      "no longer matches its fingerprint is dropped at load.",
    records: tafsir.records,
  };
  const hadithFile: HadithSnapshotFile = {
    kind: HADITH_SNAPSHOT_KIND,
    schema: SOURCE_SNAPSHOT_SCHEMA,
    source: "shamela.ws — صحيح البخاري (ط السلطانية، كتاب 1681) و صحيح مسلم (ت عبد الباقي، كتاب 1727)",
    generatedAt,
    generator,
    notes:
      "Verbatim hadith text (from the Companion to the end of the matn) for each topic, fetched from the " +
      "public page and the page-content JSON and compared. Grade صحيح = in the Sahihayn (sources.pdf). " +
      "Do not hand-edit: a record whose text no longer matches its fingerprint is dropped at load.",
    records: hadith.records,
  };

  const seerahFile: SeerahSnapshotFile = {
    kind: SEERAH_SNAPSHOT_KIND,
    schema: SOURCE_SNAPSHOT_SCHEMA,
    source: "shamela.ws — صحيح البخاري (ط السلطانية، كتاب 1681) و السيرة النبوية لابن هشام (ت السقا ورفاقه، كتاب 23833)",
    generatedAt,
    generator,
    notes:
      "«موقف من السيرة»: one verbatim passage per topic about a Seerah event, fetched from the public page and " +
      "the page-content JSON and compared. Sahih al-Bukhari narrations carry grade صحيح (Sahihayn); Ibn Hisham " +
      "passages carry no grade. Do not hand-edit: a record whose text no longer matches its fingerprint is dropped at load.",
    records: seerah.records,
  };

  mkdirSync(dirname(TAFSIR_TARGET), { recursive: true });
  if (ONLY.has("tafsir")) {
    writeFileSync(TAFSIR_TARGET, `${JSON.stringify(tafsirFile, null, 2)}\n`, "utf8");
    console.info(`[content] wrote ${tafsir.records.length} tafsir → ${TAFSIR_TARGET}`);
  }
  if (ONLY.has("hadith")) {
    writeFileSync(HADITH_TARGET, `${JSON.stringify(hadithFile, null, 2)}\n`, "utf8");
    console.info(`[content] wrote ${hadith.records.length} hadith → ${HADITH_TARGET}`);
  }
  if (ONLY.has("seerah")) {
    writeFileSync(SEERAH_TARGET, `${JSON.stringify(seerahFile, null, 2)}\n`, "utf8");
    console.info(`[content] wrote ${seerah.records.length} seerah → ${SEERAH_TARGET}`);
  }
  if (failures.length) {
    console.warn(`[content] left out (not verified):\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[content] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
