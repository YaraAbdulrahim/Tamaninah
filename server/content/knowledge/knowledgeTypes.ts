/**
 * Shapes of the curated knowledge files (authored by the knowledge curator, read-only here):
 * - `sourcesPdf.ts` — transcription of sources.pdf («المرجعية والحزمة العلمية والبيانات»)
 * - `data/bayyinat.index.json` — question index of «بينات: أسئلة وأجوبة عن الإسلام»
 * - `data/bayyinat.answers.json` — reviewed verbatim excerpts for a subset of those questions
 *
 * The engine (`knowledgeBase.ts`) takes these as plain data so tests can inject fixtures.
 */
import type { KnowledgeDomain } from "../../../shared/experience/api";
import type { ContentLevel } from "../../../shared/experience/guidance";

export const KNOWLEDGE_DOMAINS: readonly KnowledgeDomain[] = [
  "dawah",
  "quran",
  "tafseer",
  "hadith",
  "aqeeda",
  "fiqh",
  "seerah",
  "shubuhat",
  "terminology",
];

export function asKnowledgeDomain(value: unknown): KnowledgeDomain | null {
  return typeof value === "string" && (KNOWLEDGE_DOMAINS as readonly string[]).includes(value)
    ? (value as KnowledgeDomain)
    : null;
}

export function asContentLevel(value: unknown): ContentLevel | null {
  return value === "A" || value === "B" || value === "C" || value === "D" ? value : null;
}

/** One row of the PDF's «المرجعية العلمية المعتمدة» table. */
export type ApprovedSourceRow = {
  domain: KnowledgeDomain | string;
  label_ar: string;
  label_en: string;
  content_ar: string;
  /** «قاعدة الاستخدام», verbatim. */
  rule_ar: string;
  sources: { name: string; url: string }[];
};

/** One row of the PDF's «نماذج لقاموس المصطلحات الأساسية» (p. 8). */
export type GlossaryRow = {
  id: string;
  term_ar: string;
  term_en: string;
  /** «ضابط الاستخدام», verbatim. */
  usage_ar: string;
  page: number;
};

export type SafetyTestCaseRow = {
  id: string;
  question_ar: string;
  expected_ar: string;
  expected_level: string;
  expected_route: string;
};

export type BayyinatSource = {
  name: string;
  publisher?: string;
  year?: string | number;
  url: string;
  file_url?: string;
};

export type BayyinatIndexEntry = {
  id: string;
  number: number;
  part_ar?: string;
  section_ar?: string;
  question_ar: string;
  /** Printed page number. */
  page: number;
  /** Page index inside the PDF file (for `#page=` links). */
  pdf_page?: number;
};

export type BayyinatIndexFile = {
  source: BayyinatSource;
  entries: BayyinatIndexEntry[];
};

export type BayyinatAnswerEntry = {
  id: string;
  number?: number;
  question_ar: string;
  excerpt_ar: string;
  page_start: number;
  page_end?: number;
  pdf_page_start?: number;
  domain?: string;
  level?: string;
  keywords_ar?: string[];
  keywords_en?: string[];
  verified: boolean;
  verification_note?: string;
};

export type BayyinatAnswersFile = {
  entries: BayyinatAnswerEntry[];
};

/** Everything the knowledge engine needs. Missing parts degrade to "no candidates" / "no pointer". */
export type KnowledgeSourceData = {
  /** Title of sources.pdf as cited to users. */
  referenceTitleAr?: string;
  approvedSources: readonly ApprovedSourceRow[];
  glossary: readonly GlossaryRow[];
  bayyinatIndex: BayyinatIndexFile | null;
  bayyinatAnswers: BayyinatAnswersFile | null;
  /** PDF wording for prompts (shape owned by the curator; rendered as JSON). */
  levels?: unknown;
  scope?: unknown;
};
