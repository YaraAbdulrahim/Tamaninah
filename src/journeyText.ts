/**
 * Pure helpers for the staged journey. They only ever CUT the verified text (at spaces, or at the
 * exact substrings the server curated) — never add to it, drop from it or retype it: joined, the
 * pieces always equal the source string.
 */
import type { VerifiedContent, VerifiedStory } from "../shared/experience/guidance";

export type Piece = { text: string; lit?: boolean };

const filled = (s: string | null | undefined): s is string => typeof s === "string" && s.trim() !== "";

/** Qur'anic pause marks (ۖ ۗ ۘ ۙ ۚ ۛ ۜ): a verse may be cut after one of them. */
const WAQF = /[ۖ-ۜ]/;

/**
 * Short runs of one āyah for a gradual reveal: a run ends after a pause mark; a run that is still
 * long is cut evenly at spaces. Never inside a word. Joined, the runs equal `text`.
 */
export function verseRuns(text: string, max = 7): string[] {
  const lead = /^\s*/.exec(text)?.[0] ?? "";
  const words = text.slice(lead.length).match(/\S+\s*/g) ?? [];
  if (!words.length) return text ? [text] : [];
  const clauses: string[][] = [[]];
  for (const w of words) {
    clauses[clauses.length - 1].push(w);
    if (WAQF.test(w)) clauses.push([]);
  }
  const runs: string[] = [];
  for (const c of clauses.filter((c) => c.length)) {
    const k = Math.ceil(c.length / max);
    const size = Math.ceil(c.length / k);
    for (let i = 0; i < c.length; i += size) runs.push(c.slice(i, i + size).join(""));
  }
  runs[0] = lead + runs[0];
  return runs;
}

/** Moves the spaces at either end of a lit piece outside it, so the light hugs the words. */
function tidy(pieces: Piece[]): Piece[] {
  const out: Piece[] = [];
  for (const p of pieces) {
    if (!p.lit) {
      out.push(p);
      continue;
    }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(p.text)!;
    if (m[1]) out.push({ text: m[1] });
    if (m[2]) out.push({ text: m[2], lit: true });
    if (m[3]) out.push({ text: m[3] });
  }
  return out;
}

/**
 * Marks the first occurrence of each needle (an exact substring; a needle that is missing or would
 * overlap an earlier one is ignored). Joined, the pieces equal `text`.
 */
export function markPieces(text: string, needles: readonly (string | null | undefined)[] = []): Piece[] {
  const ranges: [number, number][] = [];
  for (const n of needles) {
    if (!filled(n)) continue;
    const at = text.indexOf(n);
    if (at < 0) continue;
    const r: [number, number] = [at, at + n.length];
    if (ranges.some(([a, b]) => r[0] < b && a < r[1])) continue;
    ranges.push(r);
  }
  ranges.sort((x, y) => x[0] - y[0]);
  const out: Piece[] = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a > pos) out.push({ text: text.slice(pos, a) });
    out.push({ text: text.slice(a, b), lit: true });
    pos = b;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return tidy(out);
}

/** Lights `needle` (its first occurrence in the joined runs) across however many runs it spans. */
export function litRuns(runs: readonly string[], needle: string | null | undefined): Piece[][] {
  const whole = runs.join("");
  const at = filled(needle) ? whole.indexOf(needle) : -1;
  const range = at >= 0 ? [at, at + needle!.length] : null;
  let o = 0;
  return runs.map((r) => {
    const a = o;
    const b = o + r.length;
    o = b;
    if (!range || range[1] <= a || range[0] >= b) return [{ text: r }];
    const s = Math.max(range[0], a) - a;
    const e = Math.min(range[1], b) - a;
    return tidy([{ text: r.slice(0, s) }, { text: r.slice(s, e), lit: true }, { text: r.slice(e) }].filter((p) => p.text));
  });
}

/** The curated opening of a tafsir excerpt, when it is a real, shorter prefix of it. */
export function leadOf(c: VerifiedContent): string | undefined {
  const lead = c.lead?.trim();
  const full = c.arabic.trim();
  return lead && lead !== full && full.startsWith(lead) ? lead : undefined;
}

/** The curated focal line of a verse or hadith, when it is really inside the text. */
export const highlightOf = (c: VerifiedContent): string | undefined =>
  filled(c.highlight) && c.arabic.includes(c.highlight) ? c.highlight : undefined;

/**
 * The Seerah passage as scenes: the curated beats when, joined with single spaces, they reproduce
 * the passage exactly; otherwise the passage's own paragraphs.
 */
export function storyBeats(s: VerifiedStory): string[] {
  const body = (s.body ?? []).filter(filled);
  const beats = (s.beats ?? []).filter(filled);
  if (beats.length && beats.join(" ") === body.join(" ")) return beats;
  return body;
}

/* ───────── source chips: short, honest labels built from the payload's own source fields ───────── */

/** «صحيح البخاري (ط. السلطانية) — المكتبة الشاملة» → «صحيح البخاري». */
export const shortName = (name: string | undefined) =>
  (name ?? "").split(" — ")[0].replace(/\s*\([^)]*\)\s*$/, "").trim();

/** «2:286 · ج6 ص131» → «ج6 ص131». */
const locator = (reference: string | undefined) => {
  const parts = (reference ?? "").split(" · ").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" · ") : undefined;
};

const only = (parts: (string | undefined | false)[]) => parts.filter((p): p is string => filled(p || undefined)).map((p) => p.trim());

/** Any other catalog text: its source and reference («شرح تجريبي · ج2 ص40»), without repeating the name. */
export function contentChip(c: VerifiedContent): string[] {
  const name = shortName(c.source?.name);
  const ref = (c.reference || c.source?.reference || "").trim();
  return only(ref && name && ref.startsWith(name) ? [ref] : [name, ref]);
}

/** «البقرة 2:286 · Quranpedia» */
export function verseChip(c: VerifiedContent): string[] {
  const surah = (c.place ?? "").replace(/^(سورة|Sūrah|Surah)\s+/i, "").trim();
  return only([[surah, c.reference].filter(filled).join(" "), shortName(c.source?.name)]);
}

/** «تفسير الطبري، ت. أحمد شاكر · ج6 ص131» */
export function tafsirChip(c: VerifiedContent): string[] {
  const t = c.provenance?.tafsir;
  const name = shortName(c.source?.name) || shortName(c.place);
  const book = t?.editor ? `${name}، ت. ${t.editor}` : name;
  const where = t?.volume && t.pages?.length ? `ج${t.volume} ص${t.pages.join("–")}` : locator(c.reference);
  return only([book, where ?? c.reference]);
}

/** «صحيح البخاري · 5641» */
export function hadithChip(c: VerifiedContent): string[] {
  const h = c.provenance?.hadith;
  if (h?.collection) return only([h.collection, String(h.number ?? h.hadithReference ?? "")]);
  return only([c.reference || shortName(c.source?.name)]);
}

/** «صحيح البخاري · 2916», or «سيرة ابن هشام · ج1 ص236». */
export function seerahChip(s: VerifiedStory): string[] {
  const se = s.provenance?.seerah;
  if (se?.sourceKind === "sahih") {
    const book = se.book || s.provenance?.hadith?.collection;
    const n = se.number ?? s.provenance?.hadith?.number;
    if (book && n !== undefined) return only([book, String(n)]);
  }
  if (se?.book) {
    const where = se.volume && se.page ? `ج${se.volume} ص${se.page}` : se.page ? `ص${se.page}` : undefined;
    return only([shortName(se.book), where ?? (se.sourceReference !== se.book ? se.sourceReference : undefined)]);
  }
  const name = shortName(s.source?.name);
  const ref = s.source?.reference?.trim();
  return only(ref && name && ref.startsWith(name) ? [ref] : [name, ref]);
}
