/**
 * Presentation metadata for the staged journey (highlight / lead / beats / key quotes).
 *
 * Curated per anchor as short locators (matched without tashkeel); the value shown is always the
 * exact slice of the stored source text, computed at load. If a locator no longer matches, or a
 * cut is not at a sentence/clause boundary, the *field* is dropped — never the record, and nothing
 * is retyped. Locators are routing hints for the slicer only; they are never displayed.
 */
import { arabicSkeleton } from "./sourceText";

export type Span = { start: string; end: string };

const DIACRITIC = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/;
const SENTENCE_END = /[.؟!»")]$/;
/** A beat may start after punctuation, or with a clause-opening word. */
const CLAUSE_PUNCT = /[.،,؛;:؟?!»")﴾]$/;
const CLAUSE_OPENERS = new Set(["ثم", "حتى", "منذ", "إذ", "إذا", "لما", "قال", "قالت", "قلت", "أما"]);

function skeletonOf(text: string): string {
  return arabicSkeleton(text.replace(/\s+/g, " ").trim()).skeleton;
}

/** Original-text bounds of the first `start…end` occurrence (diacritic-insensitive), or null. */
export function findSpan(text: string, span: Span, from = 0): { start: number; end: number } | null {
  const { skeleton, map } = arabicSkeleton(text);
  const startSk = skeletonOf(span.start);
  const endSk = skeletonOf(span.end);
  if (!startSk || !endSk) return null;
  let fromSk = 0;
  while (fromSk < map.length && map[fromSk]! < from) fromSk += 1;
  const s = skeleton.indexOf(startSk, fromSk);
  if (s === -1) return null;
  const e = skeleton.indexOf(endSk, s);
  if (e === -1) return null;
  const start = map[s]!;
  let end = map[e + endSk.length - 1]! + 1;
  while (end < text.length && DIACRITIC.test(text[end]!)) end += 1;
  return { start, end };
}

export function sliceSpan(text: string, span: Span | undefined): string | undefined {
  if (!span) return undefined;
  const at = findSpan(text, span);
  if (!at) return undefined;
  const value = text.slice(at.start, at.end).trim();
  return value && text.includes(value) ? value : undefined;
}

/** Prefix of `text` ending with the `endLocator` match, only if it ends a sentence. */
export function leadFrom(text: string, endLocator: string | undefined): string | undefined {
  if (!endLocator) return undefined;
  const firstWords = text.trim().split(/\s+/).slice(0, 2).join(" ");
  const at = findSpan(text, { start: firstWords, end: endLocator });
  if (!at || at.start !== text.indexOf(text.trim())) return undefined;
  const lead = text.slice(0, at.end).trim();
  return lead && SENTENCE_END.test(lead) && text.startsWith(lead) ? lead : undefined;
}

/**
 * Split `body` before each `beatStarts` locator (in order). Valid only if there are 2–4 beats, each
 * cut falls on a single space after punctuation or before a clause-opening word, and the beats
 * joined with single spaces reproduce `body` exactly.
 */
export function beatsFrom(body: string, beatStarts: readonly string[] | undefined): string[] | undefined {
  if (!beatStarts?.length) return undefined;
  const cuts: number[] = [];
  let from = 1;
  for (const locator of beatStarts) {
    const at = findSpan(body, { start: locator, end: locator }, from);
    if (!at || body[at.start - 1] !== " ") return undefined;
    cuts.push(at.start);
    from = at.start + 1;
  }
  const beats: string[] = [];
  let prev = 0;
  for (const cut of cuts) {
    beats.push(body.slice(prev, cut - 1));
    prev = cut;
  }
  beats.push(body.slice(prev));
  if (beats.length < 2 || beats.length > 4 || beats.some((b) => !b.trim() || b !== b.trim())) return undefined;
  for (let i = 1; i < beats.length; i += 1) {
    const before = beats[i - 1]!;
    const firstWord = skeletonOf(beats[i]!.split(" ")[0]!).replace(/[^ء-ي]/g, "");
    const opensClause = /^[فو]/.test(firstWord) || CLAUSE_OPENERS.has(firstWord);
    if (!CLAUSE_PUNCT.test(before) && !opensClause) return undefined;
  }
  return beats.join(" ") === body ? beats : undefined;
}

export function keyQuotesFrom(body: string, spans: readonly Span[] | undefined): string[] | undefined {
  const quotes = (spans ?? []).map((s) => sliceSpan(body, s)).filter((q): q is string => Boolean(q));
  return quotes.length ? quotes.slice(0, 2) : undefined;
}
