/**
 * Context-relevant Seerah: pick the topic's Seerah passage whose routing tags best match what the
 * person wrote — deterministic and model-free. No match → the topic's default scene.
 *
 * Matching is on whole words after normalization (no tashkeel, unified alef/ya/ta marbuta, lower
 * case), allowing the common attached prefixes (و ف ب ل ك ال) and pronoun/plural suffixes, so
 * «والديون» matches «ديون» and «قروضي» matches «قروض». English tags match the word or its plural.
 */
import { listTopicSeerahAnchors, type TopicSeerahAnchor } from "./topicSeerahAnchors";

const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function normalizeForRouting(text: string): string {
  return text
    .normalize("NFKC")
    .replace(AR_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const PREFIXES = ["وبال", "وال", "بال", "فال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك"];
const SUFFIXES = new Set(["", "ي", "ك", "ه", "ها", "نا", "هم", "كم", "هن", "ات", "ين", "ون", "تي", "تك", "ته"]);
const ARABIC = /[ء-ي]/;

function stems(token: string): string[] {
  const out = [token];
  for (const p of PREFIXES) {
    if (token.startsWith(p) && token.length - p.length >= 2) out.push(token.slice(p.length));
  }
  return out;
}

function tokenMatchesTag(token: string, tag: string): boolean {
  if (!ARABIC.test(tag)) return token === tag || token === `${tag}s` || token === `${tag}es`;
  return stems(token).some((stem) => stem === tag || (stem.startsWith(tag) && SUFFIXES.has(stem.slice(tag.length))));
}

/** Number of distinct tags present in the message. */
export function tagScore(message: string, tags: readonly string[] | undefined): number {
  if (!tags?.length) return 0;
  const tokens = normalizeForRouting(message).split(" ").filter(Boolean);
  const normTags = [...new Set(tags.map(normalizeForRouting).filter(Boolean))];
  return normTags.filter((tag) => tokens.some((t) => tokenMatchesTag(t, tag))).length;
}

/** The context passage whose tags match best (ties: anchor order), else the default. */
export function selectSeerahAnchor(topicId: string, message?: string | null): TopicSeerahAnchor | null {
  const anchors = listTopicSeerahAnchors(topicId);
  const fallback = anchors.find((a) => a.role === "default") ?? null;
  if (!message?.trim()) return fallback;
  let best: TopicSeerahAnchor | null = null;
  let bestScore = 0;
  for (const anchor of anchors) {
    if (anchor.role !== "context") continue;
    const score = tagScore(message, anchor.tags);
    if (score > bestScore) {
      best = anchor;
      bestScore = score;
    }
  }
  return best ?? fallback;
}
