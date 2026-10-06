/**
 * Fetch, verify and snapshot the "learn more" lessons from al-Jamhara (islamic-content.com).
 * Zero runtime network: the app only reads the committed snapshot.
 *
 *   npx vite-node server/scripts/snapshotLessons.ts            # fetch twice, compare, write
 *   npx vite-node server/scripts/snapshotLessons.ts --verify   # re-fetch and compare with the committed snapshot (no write)
 *
 * Only islamic-content.com/t/{id} is contacted, sequentially, at most one request per ~1.2 s.
 *
 * For every anchored entry (server/content/lessons/lessonAnchors.ts): pass 1 fetches the page and
 * extracts the anchored sections verbatim (server/content/lessons/jamharaExtract.ts); pass 2 fetches
 * the page again and must reproduce the identical section text. A section with any garbled part is not
 * stored; a long section is cut into at most 3 parts at the page's own line breaks, list markers or
 * sentence ends (each part ≤ 1200 characters, verbatim).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractJamharaPage, itemUnits, lessonTextProblem, splitLessonBody, type JamharaPage } from "../content/lessons/jamharaExtract";
import {
  JAMHARA_LESSON_ENTRIES,
  JAMHARA_SOURCE_ID,
  JAMHARA_SOURCE_NAME,
  MAX_LESSON_CHARS,
  MAX_PARTS_PER_SECTION,
  jamharaEntryUrl,
  type LessonEntryAnchor,
  type LessonSectionAnchor,
} from "../content/lessons/lessonAnchors";
import {
  LESSON_SNAPSHOT_KIND,
  LESSON_SNAPSHOT_SCHEMA,
  type LessonSnapshotEntry,
  type LessonSnapshotFile,
  type LessonSnapshotRecord,
} from "../content/lessons/lessonFormat";
import { lessonRecordId, lessonTitleAr, ungradedHadithProblem } from "../content/lessons/lessonRepository";

const here = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(here, "../content/snapshots/lessons.published.json");
const VERIFY_ONLY = process.argv.includes("--verify");
const USER_AGENT = "tamaninah-content-snapshot/1.0 (low-volume verbatim excerpt check)";
const MIN_INTERVAL_MS = 1200;

let lastRequestAt = 0;
async function politeFetch(url: string): Promise<string> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": USER_AGENT, "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

type SectionParts = {
  anchor: LessonSectionAnchor;
  ordinal: number;
  section: string;
  parts: string[];
  complete: boolean;
  /** Parts are runs of clean printed list items (some items were left out). */
  itemRuns: boolean;
};

function sectionsOf(entry: LessonEntryAnchor, page: JamharaPage, skipped: LessonSnapshotEntry["skipped"]): SectionParts[] {
  if (page.title !== entry.title) throw new Error(`entry ${entry.entryId}: title «${page.title}» ≠ anchor «${entry.title}»`);
  const out: SectionParts[] = [];
  const ordinals = new Map<string, number>();
  for (const anchor of entry.sections) {
    const ordinal = (ordinals.get(anchor.aspect) ?? 0) + 1;
    ordinals.set(anchor.aspect, ordinal);
    const found = page.sections.find((s) => s.card === anchor.card && s.sub === anchor.sub);
    if (!found) {
      const dropped = page.dropped.find((d) => d.card === anchor.card && d.sub === anchor.sub);
      skipped.push({ card: anchor.card, sub: anchor.sub, reason: dropped ? `garbled: ${dropped.reason}` : "section not on the page" });
      continue;
    }
    const split = splitLessonBody(found.text, MAX_LESSON_CHARS, MAX_PARTS_PER_SECTION);
    if (!split) {
      skipped.push({ card: anchor.card, sub: anchor.sub, reason: "first sentence longer than the part limit" });
      continue;
    }
    // Every stored part must be clean on its own: balanced brackets, and (sources.pdf «لا ينسب حديث دون
    // مصدر وحكم معتمد») no hadith unless every one it cites is in al-Bukhari or Muslim.
    const clean = split.parts.every((part) => !partProblem(part));
    if (clean) {
      out.push({ anchor, ordinal, section: found.text, parts: split.parts, complete: split.complete, itemRuns: false });
      continue;
    }
    // Otherwise keep only runs of consecutive printed list items that are clean on their own (an item that
    // quotes an ungraded hadith is left out whole); prose without list markers is dropped.
    const runs = cleanItemRuns(found.text);
    for (const r of runs.rejected) skipped.push({ card: anchor.card, sub: `${anchor.sub} (item «${r.head}…»)`, reason: r.reason });
    if (!runs.parts.length) {
      skipped.push({ card: anchor.card, sub: anchor.sub, reason: "no clean part left after the hadith/shape checks" });
      continue;
    }
    out.push({ anchor, ordinal, section: found.text, parts: runs.parts, complete: false, itemRuns: true });
  }
  return out;
}

function partProblem(text: string): string | null {
  return lessonTextProblem(text) ?? ungradedHadithProblem(text);
}

/** Consecutive clean list items packed into ≤ MAX_PARTS_PER_SECTION parts of ≤ MAX_LESSON_CHARS (verbatim slices). */
function cleanItemRuns(section: string): { parts: string[]; rejected: { head: string; reason: string }[] } {
  const units: { text: string; joiner: string }[] = [];
  section.split("\n").forEach((line, lineIndex) =>
    itemUnits(line).forEach((u, i) => units.push({ text: u, joiner: i === 0 && lineIndex > 0 ? "\n" : " " })),
  );
  const parts: string[] = [];
  const rejected: { head: string; reason: string }[] = [];
  let current = "";
  const flush = () => {
    if (current && !partProblem(current) && parts.length < MAX_PARTS_PER_SECTION) parts.push(current);
    current = "";
  };
  for (const unit of units) {
    const problem = unit.text.length > MAX_LESSON_CHARS ? "item longer than the part limit" : partProblem(unit.text);
    if (problem) {
      rejected.push({ head: unit.text.slice(0, 24), reason: problem });
      flush();
      continue;
    }
    const next = current ? current + unit.joiner + unit.text : unit.text;
    if (next.length > MAX_LESSON_CHARS) {
      flush();
      current = unit.text;
    } else current = next;
  }
  flush();
  return { parts, rejected };
}

async function snapshotEntry(entry: LessonEntryAnchor): Promise<{ entry: LessonSnapshotEntry; records: LessonSnapshotRecord[] }> {
  const url = jamharaEntryUrl(entry.entryId);
  const fetchedAt = new Date().toISOString();
  const skipped: LessonSnapshotEntry["skipped"] = [];
  const first = sectionsOf(entry, extractJamharaPage(await politeFetch(url)), skipped);
  const verifiedAt = new Date().toISOString();
  const second = sectionsOf(entry, extractJamharaPage(await politeFetch(url)), []);

  const records: LessonSnapshotRecord[] = [];
  for (const s of first) {
    const again = second.find((x) => x.anchor === s.anchor);
    if (!again || again.section !== s.section || again.parts.join("\u0001") !== s.parts.join("\u0001")) {
      skipped.push({ card: s.anchor.card, sub: s.anchor.sub, reason: "second fetch did not reproduce the identical text" });
      continue;
    }
    s.parts.forEach((body, i) => {
      const parts = s.parts.length;
      records.push({
        id: lessonRecordId(entry.entryId, s.anchor.aspect, s.ordinal, i + 1),
        entryId: entry.entryId,
        entryTitle: entry.title,
        url,
        card: s.anchor.card,
        sub: s.anchor.sub,
        title_ar: lessonTitleAr(s.anchor.card, s.anchor.sub),
        title_en: parts > 1 ? `${s.anchor.title_en} (${i + 1}/${parts})` : s.anchor.title_en,
        aspect: s.anchor.aspect,
        part: i + 1,
        parts,
        sectionComplete: s.complete,
        body_ar: body,
        bodySha256: sha256(body),
        sectionSha256: sha256(s.section),
        fetchedAt,
        verifiedAt,
        requests: [url, url],
        verification_note:
          `Fetched ${url} twice (independent requests, no cache); both passes extracted the identical section «${lessonTitleAr(s.anchor.card, s.anchor.sub)}». ` +
          "Text is verbatim: tags stripped, HTML entities decoded, honorific glyph spans kept as their printed text, tashkeel/﴿﴾/[سورة: آية] untouched" +
          (s.itemRuns
            ? "; stored as runs of consecutive printed list items — items quoting a hadith outside al-Bukhari/Muslim (or with no citation) are left out whole, per sources.pdf «لا ينسب حديث دون مصدر وحكم معتمد»."
            : (parts > 1 ? `; cut into ${parts} parts at the page's own line breaks, list markers or sentence ends` : "") +
              (s.complete ? "." : "; the printed section continues on the page after the stored parts.")),
      });
    });
  }
  return { entry: { entryId: entry.entryId, title: entry.title, url, fetchedAt, verifiedAt, skipped }, records };
}

async function verifyCommitted(): Promise<number> {
  const committed = JSON.parse(readFileSync(TARGET, "utf8")) as LessonSnapshotFile;
  let mismatches = 0;
  for (const entry of JAMHARA_LESSON_ENTRIES) {
    const page = extractJamharaPage(await politeFetch(jamharaEntryUrl(entry.entryId)));
    const live = sectionsOf(entry, page, []);
    for (const record of committed.records.filter((r) => r.entryId === entry.entryId)) {
      const s = live.find((x) => x.anchor.card === record.card && x.anchor.sub === record.sub && x.anchor.aspect === record.aspect);
      const body = s?.parts[record.part - 1];
      const ok = body === record.body_ar && sha256(body ?? "") === record.bodySha256;
      if (!ok) mismatches += 1;
      console.log(`${ok ? "OK  " : "DIFF"} ${record.id}`);
    }
  }
  return mismatches;
}

async function main() {
  if (VERIFY_ONLY) {
    const mismatches = await verifyCommitted();
    console.log(mismatches ? `${mismatches} record(s) differ from the live pages` : "All committed lessons match the live pages.");
    process.exit(mismatches ? 1 : 0);
  }
  const entries: LessonSnapshotEntry[] = [];
  const records: LessonSnapshotRecord[] = [];
  for (const anchor of JAMHARA_LESSON_ENTRIES) {
    const result = await snapshotEntry(anchor);
    entries.push(result.entry);
    records.push(...result.records);
    console.log(
      `${anchor.entryId} ${anchor.title}: ${result.records.length} part(s)` +
        (result.entry.skipped.length ? `; skipped ${result.entry.skipped.map((s) => `${s.card}/${s.sub} (${s.reason})`).join("; ")}` : ""),
    );
  }
  const file: LessonSnapshotFile = {
    kind: LESSON_SNAPSHOT_KIND,
    schema: LESSON_SNAPSHOT_SCHEMA,
    source: `${JAMHARA_SOURCE_NAME} — islamic-content.com`,
    sourceId: JAMHARA_SOURCE_ID,
    generatedAt: new Date().toISOString(),
    generator: "server/scripts/snapshotLessons.ts",
    notes:
      "Verbatim sections of al-Jamhara concept pages used as optional 'learn more' lessons on top of a journey. " +
      "Each page fetched twice; only sections reproduced identically and free of garbling are stored. Never hand-edit body_ar.",
    entries,
    records,
  };
  writeFileSync(TARGET, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log(`Wrote ${records.length} lesson parts from ${entries.length} entries → ${TARGET}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
