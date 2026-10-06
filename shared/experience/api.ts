/**
 * Wire contract for POST /api/understand — shared by the browser and the server.
 *
 * Knowledge rule (from sources.pdf, «المرجعية والحزمة العلمية والبيانات»): every religious
 * text, explanation, term, or reference the user sees comes from the approved catalog built
 * from the sources the PDF names. The model only understands the message, picks a level,
 * and routes. When the catalog has nothing that fits, the answer is an honest
 * "insufficient reference" plus a pointer to the approved source for that domain.
 */
import type { AnalyzeResult, ContentLevel, GuidancePayload, Lang, LessonAspect, ReferralPayload } from "./guidance";

/** Domains exactly as the PDF's «المرجعية العلمية المعتمدة» table lists them. */
export type KnowledgeDomain =
  | "dawah" // الموضوعات الدعوية والمحتوى الإسلامي
  | "quran" // القرآن الكريم
  | "tafseer" // التفسير
  | "hadith" // الحديث النبوي
  | "aqeeda" // العقيدة والتعريف بالإسلام
  | "fiqh" // الفقه العام
  | "seerah" // السيرة والتاريخ
  | "shubuhat" // الشبهات والأسئلة المتكررة
  | "terminology"; // الترجمة والمصطلحات

/** Where the PDF says to look for a domain — shown when the catalog cannot answer. */
export type SourcePointer = {
  domain: KnowledgeDomain;
  label_ar: string;
  label_en: string;
  /** The PDF's «قاعدة الاستخدام» for this domain, verbatim Arabic. */
  rule_ar: string;
  sources: { name: string; url: string }[];
};

/** A citable answer taken verbatim from an approved source (the PDF glossary, or a reviewed Q&A excerpt). */
export type KnowledgeAnswer = {
  kind: "glossary" | "qa";
  id: string;
  level: ContentLevel;
  domain: KnowledgeDomain;
  title_ar: string;
  title_en: string;
  /** Verbatim source text (Arabic). Never model-written. */
  body_ar: string;
  /** Present only when the source itself provides English (e.g. the glossary's English equivalent). */
  body_en?: string;
  /** Glossary only: the approved English equivalent, e.g. "Tawhid / Oneness of God". */
  term_en?: string;
  source: { name: string; reference: string; url?: string };
};

export type UnderstandError =
  | "unconfigured"
  | "invalid"
  | "timeout"
  | "upstream"
  | "unclear"
  | "insufficient_reference"
  | "referral_required"
  | "rate"
  | "text"
  | "body"
  | "method"
  /** Cross-origin browser request (the API is same-origin only). */
  | "forbidden";

export type AnalyzeRequestBody = {
  stage: "analyze";
  message: string;
  language: Lang;
};

export type JourneyRequestBody = {
  stage: "journey";
  message: string;
  language: Lang;
  topicId: string;
  analyzeLevel: ContentLevel;
  /** `analyze.learning_focus`, passed back so the journey can add verbatim lessons on top of the core. */
  focus?: LessonAspect[];
};

export type UnderstandRequestBody = AnalyzeRequestBody | JourneyRequestBody;

type Mode = "live" | "mock";

/**
 * Analyze stage. `analyze.suggested_topics` holds only topics whose verified learning pack is
 * ready; each `title` is the server catalog title in the request language (never model text),
 * and `reason` is the model's neutral one-line link to the user's words.
 */
export type AnalyzeResponse =
  | { ok: true; mode: Mode; route: "topic_discovery"; analyze: AnalyzeResult }
  | { ok: true; mode: Mode; route: "direct_learning"; analyze: AnalyzeResult; payload: GuidancePayload }
  | { ok: true; mode: Mode; route: "knowledge"; analyze: AnalyzeResult; answer: KnowledgeAnswer }
  /**
   * Referral (self-harm → human support; Level D → qualified scholar; Level C → state the
   * difference + refer). `pointer` (optional) names the approved source for general information
   * in that domain, per the PDF's «يوضح المعلومات العامة ويحيل إلى جهة مؤهلة».
   */
  | { ok: true; mode: Mode; referral: ReferralPayload; pointer?: SourcePointer }
  | { ok: false; error: UnderstandError; pointer?: SourcePointer };

export type JourneyResponse =
  | { ok: true; mode: Mode; payload: GuidancePayload }
  | { ok: false; error: UnderstandError; pointer?: SourcePointer };

export type UnderstandResponse = AnalyzeResponse | JourneyResponse;
