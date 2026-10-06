/**
 * Pure helpers for turning an approved source page into plain text and locating a verbatim
 * excerpt in it. Used by the snapshot script (server/scripts/snapshotContent.ts) and by tests.
 *
 * Rules: tags are removed, HTML entities decoded, whitespace collapsed, and only *non-text
 * apparatus* is dropped (Quranpedia footnote blocks, Shamela copy buttons / footnote (hamesh)
 * blocks / printed-page markers ⦗…⦘). Words, letters and tashkeel are never changed. An excerpt is
 * always a contiguous slice of the cleaned page text; if it cannot be located exactly once, or if
 * it still carries a footnote marker, extraction fails (fail closed).
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  zwnj: "‌",
  zwj: "‍",
  rlm: "‏",
  lrm: "‎",
};

export class SourceTextError extends Error {}

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code)) throw new SourceTextError(`bad numeric entity ${match}`);
      return String.fromCodePoint(code);
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    if (named === undefined) throw new SourceTextError(`unknown entity ${match}`);
    return named;
  });
}

function collapseInline(line: string): string {
  return line.replace(/[ \t \r\f\v]+/g, " ").trim();
}

/** Arabic harakat / Quranic annotation marks / tatweel — ignored only when *locating* text. */
const DIACRITIC = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/;

/** Diacritic-insensitive view of `text` with an index map back to the original. */
export function arabicSkeleton(text: string): { skeleton: string; map: number[] } {
  let skeleton = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (DIACRITIC.test(ch)) continue;
    skeleton += ch;
    map.push(i);
  }
  return { skeleton, map };
}

function skeletonOf(locator: string): string {
  return arabicSkeleton(collapseInline(locator)).skeleton;
}

function countOccurrences(haystack: string, needle: string): number {
  let n = 0;
  let at = haystack.indexOf(needle);
  while (at !== -1) {
    n += 1;
    at = haystack.indexOf(needle, at + 1);
  }
  return n;
}

export type ExcerptLocation = { start: number; end: number; text: string };

/**
 * Find the excerpt that begins with `startLocator` and ends with `endLocator` (both matched
 * diacritic-insensitively) and return the *original* slice, tashkeel included.
 * `from` / `until` bound the search to one region (e.g. a single hadith entry).
 */
export function locateExcerpt(
  text: string,
  startLocator: string,
  endLocator: string,
  bounds: { from?: number; until?: number } = {},
): ExcerptLocation {
  const { skeleton, map } = arabicSkeleton(text);
  const toSkeletonIndex = (orig: number) => {
    let lo = 0;
    let hi = map.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (map[mid]! < orig) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const from = toSkeletonIndex(bounds.from ?? 0);
  const until = bounds.until === undefined ? skeleton.length : toSkeletonIndex(bounds.until);
  const region = skeleton.slice(from, until);

  const startSk = skeletonOf(startLocator);
  const endSk = skeletonOf(endLocator);
  if (!startSk || !endSk) throw new SourceTextError("empty locator");
  const starts = countOccurrences(region, startSk);
  if (starts !== 1) throw new SourceTextError(`start locator found ${starts} times`);
  const s = from + region.indexOf(startSk);
  const e = skeleton.indexOf(endSk, s);
  if (e === -1 || e + endSk.length > until) throw new SourceTextError("end locator not found after start");

  const origStart = map[s]!;
  let origEnd = map[e + endSk.length - 1]! + 1;
  // Keep the tashkeel that sits on the excerpt's last letter.
  while (origEnd < text.length && DIACRITIC.test(text[origEnd]!)) origEnd += 1;
  return { start: origStart, end: origEnd, text: text.slice(origStart, origEnd) };
}

/**
 * A parenthesised number outside ﴿…﴾ is a footnote marker in the Shakir / Sahihayn editions; Ibn
 * Hisham's (al-Saqqa) edition marks footnotes as [١].
 */
export function hasFootnoteMarker(excerpt: string): boolean {
  const outsideAyat = excerpt.replace(/﴿[^﴾]*﴾/g, "");
  return /\(\s*[0-9٠-٩]+\s*\)|\[\s*[0-9٠-٩]+\s*\]/.test(outsideAyat);
}

export type QuranpediaBookPage = { text: string; part: string | number; page: number; ayahs?: string };

/**
 * Quranpedia `/v1/ayah/{s}/{a}/book/{id}` → plain text. Pages are ordered (part, page) and
 * de-duplicated; each page's `<div class="foot-notes">` apparatus is removed; a trailing line
 * break at a page end is treated as the page edge (the paragraph may continue on the next page).
 * Paragraph breaks become "\n".
 */
export function cleanQuranpediaBookPages(pages: readonly QuranpediaBookPage[]): {
  text: string;
  pages: { part: number; page: number }[];
} {
  const seen = new Set<string>();
  const ordered = [...pages]
    .map((p) => ({ ...p, part: Number(String(p.part).trim()), page: Number(p.page) }))
    .filter((p) => {
      const key = `${p.part}/${p.page}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.part - b.part || a.page - b.page);

  const joined = ordered
    .map((p) =>
      p.text
        .replace(/<div class="foot-notes">[\s\S]*?<\/div>/g, "")
        .replace(/(?:\s|<br\s*\/?>)+$/g, ""),
    )
    .join(" ");
  const withBreaks = joined.replace(/<br\s*\/?>|<\/?h\d[^>]*>|<\/?p[^>]*>|<\/?div[^>]*>/gi, "\n");
  const stripped = decodeEntities(withBreaks.replace(/<[^>]+>/g, ""));
  const text = stripped
    .split("\n")
    .map(collapseInline)
    .filter(Boolean)
    .join("\n");
  return { text, pages: ordered.map((p) => ({ part: p.part, page: p.page })) };
}

/**
 * Shamela page `nass` HTML → one line of text. Removes copy buttons, anchors, the hamesh
 * (editor's footnote block after <hr>) and printed-page markers ⦗١٢٣⦘. Shamela splits a page into
 * <p> layout lines (a hadith may run across them), so lines are joined with a single space.
 */
export function cleanShamelaNass(nass: string): string {
  const body = nass
    .replace(/<a [^>]*class="btn_tag[^"]*"[^>]*>[\s\S]*?<\/a>/g, "")
    .replace(/<p class="hamesh">[\s\S]*?<\/p>/g, "")
    .replace(/<hr\s*\/?>/g, " ")
    .replace(/<\/p>\s*<p[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(body)
    .replace(/⦗[0-9٠-٩]+⦘/g, " ")
    .split("\n")
    .map(collapseInline)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function toArabicIndicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]!);
}
