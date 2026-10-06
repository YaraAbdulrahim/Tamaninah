/**
 * Arabic text normalization for lexical lookup (never for display).
 *
 * - strips tashkeel, Quranic annotation marks, tatweel, and bidi/zero-width marks
 * - unifies alef forms (أ إ آ ٱ → ا), alef maqsura (ى → ي), ta marbuta (ة → ه),
 *   hamza carriers (ؤ → و, ئ → ي)
 * - maps Arabic-Indic digits to ASCII, lowercases Latin, drops punctuation
 */
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;
const TATWEEL = /ـ/g;
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;
const EXT_ARABIC_INDIC_DIGITS = /[۰-۹]/g;

export function normalizeArabic(input: string): string {
  return input
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXT_ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Function words that carry no topical signal (normalized spelling). */
const STOPWORDS = new Set(
  [
    "هل", "ما", "ماذا", "لماذا", "لما", "كيف", "متي", "اين", "من", "في", "علي", "الي", "عن",
    "ان", "او", "ام", "ثم", "و", "لا", "لم", "لن", "ليس", "قد", "هذا", "هذه", "ذلك", "تلك",
    "الذي", "التي", "الذين", "هو", "هي", "هم", "هن", "انا", "انت", "انتم", "نحن", "كان",
    "كانت", "يكون", "تكون", "مع", "عند", "بين", "اذا", "لو", "اي", "كل", "بعض", "غير", "حتي",
    "منذ", "اذ", "ايضا", "جدا", "يا", "به", "بها", "له", "لها", "فيه", "فيها", "منه", "منها",
    "عليه", "عليها", "انه", "انها", "لان", "لكن", "بل", "الا", "فقط", "مثل", "شيء", "اريد",
    "ابي", "ابغي", "ممكن", "هناك", "هنا", "اعرف", "وش", "ايش", "شو", "يعني", "عندي", "لي",
    "لك", "بعد", "قبل", "حول", "تعالي", "سبحانه", "صلي", "الله", "عليه", "وسلم", "ص",
    "the", "a", "an", "is", "are", "was", "of", "in", "on", "to", "and", "or", "do", "does",
    "did", "what", "why", "how", "who", "which", "can", "i", "me", "my", "you", "it", "this",
    "that", "for", "with", "about", "be", "as", "at", "by", "from", "islam", "muslim", "muslims",
  ].map((w) => normalizeArabic(w)),
);

const PREFIXES = ["وبال", "وال", "فال", "بال", "كال", "لل", "ال"];
const SUFFIXES = ["هما", "كما", "تين", "ها", "هم", "هن", "كم", "نا", "ات", "ون", "ين", "ان", "يه", "ه", "ي"];

/** Very light Arabic stemmer: definite-article/clitic prefixes and common suffixes. */
export function stemArabic(token: string): string {
  let t = token;
  if (!/[؀-ۿ]/.test(t)) return t;
  let stripped = false;
  for (const p of PREFIXES) {
    if (t.startsWith(p) && t.length - p.length >= 2) {
      t = t.slice(p.length);
      stripped = true;
      break;
    }
  }
  if (!stripped && t.length >= 5 && /^[وفبل]/.test(t)) t = t.slice(1);
  for (const s of SUFFIXES) {
    if (t.endsWith(s) && t.length - s.length >= 3) {
      t = t.slice(0, -s.length);
      break;
    }
  }
  return t;
}

/** Normalized, stemmed content tokens (stopwords removed). */
export function contentTokens(input: string): string[] {
  const out: string[] = [];
  for (const raw of normalizeArabic(input).split(" ")) {
    if (!raw || STOPWORDS.has(raw)) continue;
    if (/^\d+$/.test(raw)) continue;
    const stem = stemArabic(raw);
    if (stem.length < 2 || STOPWORDS.has(stem)) continue;
    out.push(stem);
  }
  return out;
}

/** Two stems match when equal, or when one extends the other by ≤2 letters (both ≥4 long). */
export function stemsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.length - short.length <= 2 && long.startsWith(short);
}

/** True when `phrase` (normalized) occurs in `text` (normalized) on word boundaries. */
export function containsPhrase(normalizedText: string, phrase: string): boolean {
  const p = normalizeArabic(phrase);
  if (!p) return false;
  return ` ${normalizedText} `.includes(` ${p} `);
}

/**
 * Query expansion for common ways people phrase the same doubt (search recall only — never
 * shown to users). Keys and values are normalized stems; a match through an expansion scores
 * lower than a direct match.
 */
const EXPANSION_GROUPS: string[][] = [
  ["تاليف", "مولف", "الف", "اخترع", "اختلق", "صنع", "كتب", "مصدر", "بشر", "وضع", "author", "wrote", "invent"],
  ["سيف", "قوه", "اكراه", "اجبار", "انتشر", "انتشار", "حرب", "sword", "force", "spread"],
  ["يعبد", "عباد", "عبد", "worship"],
  ["كعب", "حجر", "اسود", "kaaba", "kaba"],
  ["محمد", "نبي", "رسول", "prophet", "muhammad"],
  ["قران", "مصحف", "quran", "koran"],
  ["خلاف", "اختلاف", "يختلف", "اختلف", "مختلف", "اجتهاد", "مذاهب", "اجماع", "يتفق", "اتفاق", "disagree", "differ", "consensus"],
  ["مراه", "نساء", "امراه", "women", "woman"],
  ["حريه", "حر", "freedom", "liberty"],
  ["ارهاب", "عنف", "terror", "violence"],
  ["جهاد", "قتال", "jihad"],
  ["تعدد", "زوجات", "polygamy"],
  ["حجاب", "نقاب", "hijab", "veil"],
  ["خلق", "خالق", "creator", "created"],
  ["شر", "الم", "معانا", "evil", "suffering"],
  ["عيسي", "مسيح", "jesus", "christ"],
];

const EXPANSIONS = new Map<string, string[]>();
for (const group of EXPANSION_GROUPS) {
  const stems = group.map((w) => stemArabic(normalizeArabic(w)));
  for (const stem of stems) {
    const others = stems.filter((s) => s !== stem);
    EXPANSIONS.set(stem, [...new Set([...(EXPANSIONS.get(stem) ?? []), ...others])]);
  }
}

/** Related stems for recall (excluding the stem itself). */
export function expandStem(stem: string): string[] {
  const direct = EXPANSIONS.get(stem);
  if (direct) return direct;
  for (const [key, values] of EXPANSIONS) {
    if (stemsMatch(key, stem)) return values;
  }
  return [];
}
