/**
 * Which al-Jamhara entries feed the "learn more" lessons, which of their printed sections are used,
 * and which journey topic each entry serves. Reviewed by hand against the live pages; the text itself
 * only ever comes from the committed snapshot (snapshots/lessons.published.json), written by
 * server/scripts/snapshotLessons.ts.
 *
 * Source: «موسوعة مفردات المحتوى الإسلامي: الجمهرة» (islamic-content.com) — named by sources.pdf
 * («الموضوعات الدعوية والمحتوى الإسلامي» row) as a comprehensive approved reference for da'wah topics
 * and terminology.
 */
import type { LessonAspect, TopicId } from "../../../shared/experience/guidance";

export const JAMHARA_SOURCE_ID = "tmn-src-jamhara-encyclopedia";
export const JAMHARA_SOURCE_NAME = "موسوعة مفردات المحتوى الإسلامي: الجمهرة";
export const JAMHARA_BASE = "https://islamic-content.com";

export function jamharaEntryUrl(entryId: number): string {
  return `${JAMHARA_BASE}/t/${entryId}`;
}

export type LessonSectionAnchor = {
  /** Printed card heading (h4) — "" for the first card of a lesson-plan page. */
  card: string;
  /** Printed sub-heading — "" when the card prints its text directly. */
  sub: string;
  aspect: LessonAspect;
  /** Our English label for the heading (UI only). */
  title_en: string;
};

export type LessonEntryAnchor = {
  entryId: number;
  /** The page's printed title (h1) — the snapshot is refused if the live page differs. */
  title: string;
  /** "concept" = encyclopedia term page (المصطلحات); "lesson" = da'wah lesson plan (المحتوى الدعوي). */
  pageKind: "concept" | "lesson";
  sections: LessonSectionAnchor[];
};

/** Template-21 concept pages share the same printed card names. */
const CONCEPT_SECTIONS: LessonSectionAnchor[] = [
  { card: "التعريف", sub: "التعريف اصطلاحًا", aspect: "meaning", title_en: "Definition (as a term)" },
  { card: "التعريف", sub: "التعريف لغة", aspect: "meaning", title_en: "Definition (in language)" },
  { card: "الفضل", sub: "", aspect: "virtues", title_en: "Its virtue" },
  { card: "وسائل الاكتساب", sub: "", aspect: "how", title_en: "How to attain it" },
  { card: "الفوائد والمصالح", sub: "", aspect: "fruits", title_en: "Its fruits and benefits" },
  { card: "الأدلة", sub: "القرآن الكريم", aspect: "evidence", title_en: "Evidence — the Qur'an" },
  { card: "الأدلة", sub: "السنة النبوية", aspect: "evidence", title_en: "Evidence — the Sunnah" },
  { card: "الصور", sub: "", aspect: "types", title_en: "Its forms" },
  { card: "نماذج وقصص", sub: "", aspect: "examples", title_en: "Examples and stories" },
];

export const JAMHARA_LESSON_ENTRIES: readonly LessonEntryAnchor[] = [
  { entryId: 641, title: "الصبر", pageKind: "concept", sections: CONCEPT_SECTIONS },
  { entryId: 642, title: "الشكر", pageKind: "concept", sections: CONCEPT_SECTIONS },
  { entryId: 644, title: "الرجاء", pageKind: "concept", sections: CONCEPT_SECTIONS },
  { entryId: 646, title: "التوكل", pageKind: "concept", sections: CONCEPT_SECTIONS },
  { entryId: 650, title: "الرضا", pageKind: "concept", sections: CONCEPT_SECTIONS },
  { entryId: 656, title: "الإنابة", pageKind: "concept", sections: CONCEPT_SECTIONS },
  {
    // «آداب الذكر والدعاء» — only the supplication parts are used (the dhikr parts lead the other cards).
    entryId: 2366,
    title: "آداب الذكر والدعاء",
    pageKind: "concept",
    sections: [
      { card: "الآداب", sub: "ثانيًا- آداب الدعاء:", aspect: "etiquette", title_en: "Etiquette of supplication" },
      { card: "التعريف", sub: "التعريف اصطلاحًا", aspect: "meaning", title_en: "Definition (as a term)" },
    ],
  },
  {
    entryId: 80974,
    title: "الأمانة",
    pageKind: "lesson",
    sections: [
      { card: "", sub: "المقدمة", aspect: "virtues", title_en: "Its standing" },
      { card: "", sub: "ماذا نفعل بعد ذلك", aspect: "how", title_en: "What to do next" },
    ],
  },
  {
    entryId: 81045,
    title: "العزم",
    pageKind: "lesson",
    sections: [{ card: "", sub: "ماذا نفعل بعد ذلك", aspect: "how", title_en: "What to do next" }],
  },
];

/**
 * How an entry relates to a journey topic:
 * - "topic":   the entry IS the topic's concept (الصبر for patience) — every aspect applies.
 * - "related": a neighbouring concept that the topic's journey leans on (الرضا for loss). Its
 *              definitions are never offered — they define another word than the one asked about.
 * - "subject": used only when the person's own words name that subject (الدعاء on the nearness
 *              journey, whose verse 2:186 is about answering supplication); then every aspect applies.
 */
export type TopicLessonSource = {
  entryId: number;
  relation: "topic" | "related" | "subject";
  /** For "subject": the person's message must match this (normalized Arabic / lowercase English). */
  subject?: RegExp;
};

/** Normalized-Arabic cue for supplication (دعا، أدعو، أدعي، الدعاء، دعائي…) or English "dua/supplication". */
export const DUA_SUBJECT = /(?:^|\s)(?:و|ف|ب|ل)?(?:ال)?(?:دعا|دعاء|دعايي|دعوه|دعوات|ادعو|ادعي|ندعو|ندعي|يدعو|تدعو|ادعيه|الادعيه)(?:\s|$)|\bdu'?a'?s?\b|\bsupplicat/;

export const TOPIC_LESSON_SOURCES: Readonly<Record<TopicId, readonly TopicLessonSource[]>> = {
  patience: [{ entryId: 641, relation: "topic" }],
  grief: [{ entryId: 641, relation: "related" }],
  anxiety: [{ entryId: 646, relation: "related" }],
  hope: [{ entryId: 644, relation: "topic" }],
  tawakkul: [{ entryId: 646, relation: "topic" }],
  loss: [{ entryId: 650, relation: "related" }],
  effort: [{ entryId: 81045, relation: "related" }],
  nearness: [
    { entryId: 2366, relation: "subject", subject: DUA_SUBJECT },
    { entryId: 656, relation: "related" },
  ],
  amanah: [{ entryId: 80974, relation: "topic" }],
  gratitude: [{ entryId: 642, relation: "topic" }],
};

/** Canonical order (also the selection priority when several aspects are asked for). */
export const ASPECT_ORDER: readonly LessonAspect[] = [
  "meaning",
  "how",
  "etiquette",
  "virtues",
  "fruits",
  "evidence",
  "types",
  "examples",
];

/**
 * Which stored aspects answer a requested aspect, best first. "How do I make du'a?" is answered by
 * the printed etiquette of du'a when no separate how-to section exists; virtue and fruits stand in
 * for each other (the encyclopedia prints «الفضل» on some pages and only «الفوائد» on others).
 */
export const ASPECT_ANSWERED_BY: Readonly<Record<LessonAspect, readonly LessonAspect[]>> = {
  meaning: ["meaning"],
  how: ["how", "etiquette"],
  etiquette: ["etiquette"],
  virtues: ["virtues", "fruits"],
  fruits: ["fruits", "virtues"],
  evidence: ["evidence"],
  types: ["types"],
  examples: ["examples"],
};

export const MAX_LESSON_CHARS = 1200;
export const MAX_PARTS_PER_SECTION = 3;
export const MAX_LESSONS_PER_JOURNEY = 3;
