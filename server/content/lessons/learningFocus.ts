/**
 * Deterministic "I want to learn more" cues (Arabic, Gulf/MSA, and English). They make sure an obvious
 * learning request always sets `learning_focus`, whatever the model returned. Matching runs on
 * normalized Arabic (tashkeel stripped, أإآ→ا، ة→ه، ى→ي، ئ→ي) and lowercase English.
 *
 * - «كيف أدعي؟» / "how do I…"                        → how
 * - «وش معنى…» / «تعريف…» / "what does … mean"      → meaning
 * - «فضل…» / «أجر…» / "virtue of…"                   → virtues
 * - «ثمرات… / فوائد…» / "benefits of…"               → fruits
 * - «آداب…» / "etiquette"                            → etiquette
 * - «أنواع… / أقسام…» / "types of…"                  → types
 * - «أدلة… / دليل…» / "evidence"                      → evidence
 * - «أمثلة… / قصص… / نماذج…» / "examples, stories"  → examples
 * - «علمني / أتعلم / اشرح / أفهم / أعرف أكثر» / "teach, learn, explain, understand"
 *                                                    → meaning + how (only when no specific aspect is named)
 */
import type { LessonAspect } from "../../../shared/experience/guidance";
import { normalizeArabic } from "../knowledge/arabicText";
import { ASPECT_ORDER } from "./lessonAnchors";

const P = "(?:^|\\s)(?:و|ف)?"; // token start, optional conjunction
const E = "(?=\\s|$)";

const AR_CUES: { aspect: LessonAspect; re: RegExp }[] = [
  { aspect: "how", re: new RegExp(`${P}(?:كيف(?!\\s+(?:حال|الحال))|كيفيه|طريقه|طرق|خطوات|وسايل)${E}`) },
  { aspect: "meaning", re: new RegExp(`${P}(?:ب|ال)?(?:معني|تعريف|مفهوم)${E}|${P}(?:وش|ايش|شو|ماذا)\\s+يعني${E}|${P}يعني\\s+(?:وش|ايش|شو)${E}`) },
  { aspect: "virtues", re: new RegExp(`${P}(?:ب|ل)?(?:ال)?(?:فضل|فضايل|فضيله|اجر|ثواب)${E}`) },
  { aspect: "fruits", re: new RegExp(`${P}(?:ب|ل)?(?:ال)?(?:ثمرات|ثمره|ثمار|فوايد|فايده|اثار)${E}`) },
  { aspect: "etiquette", re: new RegExp(`${P}(?:ب|ل)?(?:ال)?(?:اداب|ادابه|ادابها)${E}`) },
  { aspect: "types", re: new RegExp(`${P}(?:ب|ل)?(?:ال)?(?:انواع|اقسام|انواعه|اقسامه)${E}`) },
  { aspect: "evidence", re: new RegExp(`${P}(?:ب|ل)?(?:ال)?(?:ادله|دليل|دلايل)${E}`) },
  { aspect: "examples", re: new RegExp(`${P}(?:ب|ل)?(?:ال)?(?:امثله|مثال|قصص|نماذج)${E}`) },
];

const EN_CUES: { aspect: LessonAspect; re: RegExp }[] = [
  { aspect: "how", re: /\bhow\s+(?:to|do|can|should|does|would)\b(?!\s+you\s+do\b)|\bways?\s+to\b|\bsteps\s+(?:to|for)\b/ },
  { aspect: "meaning", re: /\bmeaning\b|\bdefin(?:e|ition)\b|\bwhat\s+(?:is|does)\b[^?]*\bmean\b|\bwhat\s+is\s+(?:tawakkul|sabr|shukr|patience|gratitude|hope|dua|du'a|supplication|trust)/ },
  { aspect: "virtues", re: /\bvirtues?\b|\bmerits?\b|\brewards?\s+(?:of|for)\b/ },
  { aspect: "fruits", re: /\bbenefits?\b|\bfruits?\s+of\b/ },
  { aspect: "etiquette", re: /\betiquette\b|\bmanners\b|\badab\b/ },
  { aspect: "types", re: /\btypes?\s+of\b|\bkinds?\s+of\b/ },
  { aspect: "evidence", re: /\bevidences?\b|\bproofs?\b/ },
  { aspect: "examples", re: /\bexamples?\b|\bstories\b|\bstory\s+of\b/ },
];

/** General "teach me / I want to learn / explain / help me understand / know more". */
const AR_GENERAL = new RegExp(
  `${P}(?:ا|ن)?(?:تعلم|اتعلم|نتعلم|علمني|علمنا|تعلمني|اشرح|اشرحلي|اشرحي|اشرحو|شرح|افهم|نفهم|فهمني|افهمني|تفهمني)${E}|اعرف\\s+(?:اكثر|عن|زياده)|معرفه\\s+اكثر|المزيد\\s+عن|ازيد\\s+عن`,
);
const EN_GENERAL = /\b(?:teach|learn|explain|understand)\b|\btell\s+me\s+(?:more\s+)?about\b|\bknow\s+more\b/;

/** «ما أفهم ليش…» / «ما أعرف…» is a feeling, not a request to learn. */
const AR_NEGATED = /(?:^|\s)(?:ما|لا|مو|مب|مش)\s+(?:ا|ن)?(?:فهم|عرف|اعرف|افهم)\S*/g;
const EN_NEGATED = /\b(?:don'?t|do not|can'?t|cannot)\s+(?:understand|know)\b/g;

export function detectLearningFocus(message: string): LessonAspect[] {
  const ar = normalizeArabic(message).replace(AR_NEGATED, " ");
  const en = message.toLowerCase().replace(EN_NEGATED, " ");
  const found = new Set<LessonAspect>();
  for (const cue of AR_CUES) if (cue.re.test(ar)) found.add(cue.aspect);
  for (const cue of EN_CUES) if (cue.re.test(en)) found.add(cue.aspect);
  if (!found.size && (AR_GENERAL.test(ar) || EN_GENERAL.test(en))) {
    found.add("meaning");
    found.add("how");
  }
  return ASPECT_ORDER.filter((a) => found.has(a));
}

/**
 * Final focus for a message: the deterministic cues first, then the model's aspects, at most 3, in
 * canonical order.
 */
export function mergeLearningFocus(cues: readonly LessonAspect[], model: readonly LessonAspect[] | undefined): LessonAspect[] {
  const merged: LessonAspect[] = [];
  for (const a of [...cues, ...(model ?? [])]) if (!merged.includes(a) && merged.length < 3) merged.push(a);
  return ASPECT_ORDER.filter((a) => merged.includes(a));
}
