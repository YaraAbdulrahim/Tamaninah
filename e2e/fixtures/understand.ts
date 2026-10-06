/**
 * Wire fixtures for POST /api/understand, typed against the real contract
 * (shared/experience/api.ts + guidance.ts) so a contract change breaks these at compile time.
 *
 * Every religious-looking string here is an obvious TEST FIXTURE («… تجريبي»), never scripture:
 * an assertion that finds one of them on screen proves the text came from the response.
 */
import type {
  AnalyzeResponse,
  JourneyResponse,
  KnowledgeAnswer,
  SourcePointer,
} from "../../shared/experience/api";
import type {
  AnalyzeResult,
  GuidancePayload,
  LessonItem,
  PublicProvenance,
  VerifiedContent,
  VerifiedStory,
} from "../../shared/experience/guidance";

export const T = {
  reading: "قراءة تجريبية لكلامك: تعب من محاولات ما تبان نتيجتها.",
  verse1: "نص آية تجريبي أول",
  verse2: "نص آية تجريبي ثانٍ",
  /** The part of the verse lit first — an exact substring of it. */
  verseHighlight: "آية تجريبي أول",
  verseTranslation: "Test verse translation (fixture).",
  versePlace: "سورة تجريبية",
  /** The tafsir excerpt; its lead is the opening shown before «عرض التفسير كاملًا». */
  explanation: "افتتاح شرح تجريبي للآية. وتتمة الشرح التجريبي بعد الافتتاح.",
  explanationLead: "افتتاح شرح تجريبي للآية.",
  hadith: "قال: «نص حديث تجريبي يُضاء جزء منه، ثم بقيته». رواه مصدر تجريبي.",
  hadithHighlight: "نص حديث تجريبي يُضاء جزء منه",
  hadithGrade: "صحيح (تجريبي)",
  hadithExplanation: "نص شرح تجريبي للحديث",
  storyTitle: "موقف تجريبي من السيرة",
  storyPara1: "الفقرة الأولى من نص السيرة التجريبي",
  storyPara2: "الفقرة الثانية من نص السيرة التجريبي",
  storyRef: "كتاب سيرة تجريبي — ج1 ص100",
  storyKeyQuote: "الفقرة الثانية",
  bridgeQuran: "جسر تجريبي إلى الآية",
  bridgeTafsir: "جسر تجريبي إلى التفسير",
  bridgeHadith: "جسر تجريبي إلى الحديث",
  bridgeSeerah: "جسر تجريبي إلى السيرة",
  connectTitle: "عنوان ربط تجريبي",
  connectPoints: ["نقطة تجريبية أولى", "نقطة تجريبية ثانية", "نقطة تجريبية ثالثة"],
  lessonTitle: "عنوان قسم تجريبي",
  lessonTitleEn: "Fixture lesson heading",
  lessonBody: "نص قسم تجريبي منقول من المصدر",
  lessonLong: "جملة تجريبية طويلة منقولة من قسم في مصدر معتمد، تبيّن كيف يُطوى النص الطويل. ".repeat(8).trim(),
  stepTitle: "خطوة تجريبية",
  stepDescription: "وصف خطوة تجريبية تقدر تسويها اليوم.",
  relatedTitle: "مسار تجريبي تالٍ",
  topicPatience: "موضوع تجريبي: الصبر",
  topicPatienceReason: "سبب تجريبي يربط الموضوع بكلامك",
  topicHope: "موضوع تجريبي: الرجاء",
  glossaryTitle: "مصطلح تجريبي",
  glossaryTermEn: "Test term (fixture)",
  glossaryBody: "نص تعريف تجريبي منقول من المصدر",
  qaTitle: "سؤال تجريبي عن الإسلام؟",
  qaBody: "مقتطف جواب تجريبي منقول من المصدر",
  sourceName: "مصدر تجريبي",
  referralMessage: "رسالة إحالة تجريبية من الخادم",
  pointerLabel: "مجال تجريبي",
  pointerRule: "قاعدة استخدام تجريبية",
  pointerSource: "رابط مصدر تجريبي",
} as const;

export const SOURCE_URL = "https://example.org/e2e-fixture-source";

const provenance = (over: Partial<PublicProvenance> = {}): PublicProvenance => ({
  sourceId: "e2e-fixture",
  sourceReference: "fixture",
  verificationStatus: "published",
  contentOrigin: "source_text",
  verificationDisclosure: "",
  attributionDisclosure: "",
  ...over,
});

export const verse = (over: Partial<VerifiedContent> = {}): VerifiedContent => ({
  content_id: "e2e-verse",
  type: "quran",
  topicId: "patience",
  level: "A",
  published: true,
  verified: true,
  arabic: `${T.verse1} ۝ ${T.verse2}`,
  translation: T.verseTranslation,
  place: T.versePlace,
  reference: "2:5-6",
  source: { name: T.sourceName, reference: "2:5-6", url: SOURCE_URL },
  provenance: provenance({ quran: { surah: 2, ayah: 5 } }),
  highlight: T.verseHighlight,
  ...over,
});

const more = (type: VerifiedContent["type"], arabic: string, over: Partial<VerifiedContent> = {}): VerifiedContent => ({
  ...verse(),
  content_id: `e2e-${type}-${arabic.length}`,
  type,
  arabic,
  translation: "",
  place: "",
  reference: "مرجع تجريبي",
  source: { name: T.sourceName, reference: "مرجع تجريبي", url: SOURCE_URL },
  provenance: provenance(),
  highlight: undefined,
  lead: undefined,
  ...over,
});

/**
 * «موقف من السيرة»: a verbatim Seerah excerpt — short event title, the source's own paragraphs, book/
 * volume/page + link. Editorial fields are empty. The provenance even carries a hadith grade (a Sahihayn
 * narration could) so the specs can prove the Seerah card never shows one.
 */
export const story = (over: Partial<VerifiedStory> = {}): VerifiedStory => ({
  story_id: "e2e-story",
  topicId: "patience",
  level: "A",
  published: true,
  verified: true,
  title: T.storyTitle,
  headline: "",
  opening: "",
  body: [T.storyPara1, T.storyPara2],
  lessons: [],
  takeaway: "",
  keep: "",
  source: { name: T.sourceName, reference: T.storyRef, url: SOURCE_URL },
  provenance: provenance({ hadith: { collection: "مجموعة تجريبية", hadithReference: "2", grade: T.hadithGrade } }),
  // Scenes: the passage's own paragraphs (joined with single spaces they equal the body), one key line lit.
  beats: [T.storyPara1, T.storyPara2],
  key_quotes: [T.storyKeyQuote],
  ...over,
});

/** «لتتعلّم أكثر»: one verbatim section of an approved source. */
export const lesson = (over: Partial<LessonItem> = {}): LessonItem => ({
  id: "e2e-lesson",
  topicId: "patience",
  aspect: "how",
  title_ar: T.lessonTitle,
  title_en: T.lessonTitleEn,
  body_ar: T.lessonBody,
  source: { name: T.sourceName, reference: "باب تجريبي — ص 3", url: `${SOURCE_URL}#lesson` },
  ...over,
});

export const payload = (over: Partial<GuidancePayload> = {}): GuidancePayload => ({
  heading: "",
  emotional_state: { primary: "unspecified", secondary: [], confidence: 0.5 },
  context: "",
  user_need: "",
  response: [],
  remember: "",
  topic_id: "patience",
  governance_level: "A",
  content: verse(),
  quran_explanation: null,
  hadith: null,
  hadith_explanation: null,
  story: null,
  related_topics: [],
  suggested_action: { type: "reach_out", title: T.stepTitle, description: T.stepDescription },
  learning_path: [],
  reflection_question: "",
  safety: { level: "normal", requires_human_support: false },
  unclear: false,
  ...over,
});

/** The curated lines that lead into each stage (the plain `payload()` has none: the UI's defaults show). */
export const bridges = () => ({
  quran: T.bridgeQuran,
  tafsir: T.bridgeTafsir,
  hadith: T.bridgeHadith,
  seerah: T.bridgeSeerah,
  connect: { title: T.connectTitle, points: [...T.connectPoints] as [string, string, string] },
});

/**
 * A full learning pack: verse (+ highlight), tafsir (+ lead), hadith (+ grade, highlight), hadith
 * explanation, Seerah (+ beats, key quote), bridges, step, next path.
 */
export const fullPayload = (over: Partial<GuidancePayload> = {}): GuidancePayload =>
  payload({
    quran_explanation: more("concept", T.explanation, { lead: T.explanationLead }),
    hadith: more("hadith", T.hadith, {
      provenance: provenance({ hadith: { collection: "مجموعة تجريبية", hadithReference: "1", grade: T.hadithGrade } }),
      highlight: T.hadithHighlight,
    }),
    hadith_explanation: more("concept", T.hadithExplanation),
    story: story(),
    related_topics: [{ id: "hope", title: T.relatedTitle }],
    bridges: bridges(),
    ...over,
  });

export const analyze = (over: Partial<AnalyzeResult> = {}): AnalyzeResult => ({
  context_summary: T.reading,
  level: "B",
  safety: "safe",
  suggested_topics: [
    { id: "patience", title: T.topicPatience, reason: T.topicPatienceReason },
    { id: "hope", title: T.topicHope },
  ],
  input_intent: "FEELING",
  recommended_path: "topic_discovery",
  ...over,
});

export const pointer = (over: Partial<SourcePointer> = {}): SourcePointer => ({
  domain: "fiqh",
  label_ar: T.pointerLabel,
  label_en: "Test domain (fixture)",
  rule_ar: T.pointerRule,
  sources: [{ name: T.pointerSource, url: SOURCE_URL }],
  ...over,
});

export const glossary = (over: Partial<KnowledgeAnswer> = {}): KnowledgeAnswer => ({
  kind: "glossary",
  id: "e2e-gl",
  level: "A",
  domain: "terminology",
  title_ar: T.glossaryTitle,
  title_en: T.glossaryTermEn,
  body_ar: T.glossaryBody,
  term_en: T.glossaryTermEn,
  source: { name: T.sourceName, reference: "قاموس تجريبي — ص 8", url: SOURCE_URL },
  ...over,
});

export const qa = (over: Partial<KnowledgeAnswer> = {}): KnowledgeAnswer => ({
  kind: "qa",
  id: "e2e-qa",
  level: "B",
  domain: "shubuhat",
  title_ar: T.qaTitle,
  title_en: "Fixture Q&A — Q9",
  body_ar: T.qaBody,
  source: { name: "بينات (تجريبي)", reference: "المسألة 9 — ص 42", url: `${SOURCE_URL}#page=42` },
  ...over,
});

/* ───────── whole responses ───────── */

export type Stubbed = { status?: number; body: unknown };

const ok = <B>(body: B): Stubbed => ({ status: 200, body });

export const R = {
  topics: (a: Partial<AnalyzeResult> = {}) =>
    ok<AnalyzeResponse>({ ok: true, mode: "mock", route: "topic_discovery", analyze: analyze(a) }),
  journey: (p: Partial<GuidancePayload> = {}) => ok<JourneyResponse>({ ok: true, mode: "mock", payload: fullPayload(p) }),
  direct: (p: Partial<GuidancePayload> = {}) =>
    ok<AnalyzeResponse>({
      ok: true,
      mode: "mock",
      route: "direct_learning",
      analyze: analyze({ input_intent: "DIRECT_QUESTION", recommended_path: "direct_learning", level: "A" }),
      payload: payload(p),
    }),
  knowledge: (answer: KnowledgeAnswer) =>
    ok<AnalyzeResponse>({
      ok: true,
      mode: "mock",
      route: "knowledge",
      analyze: analyze({ input_intent: "DIRECT_QUESTION", recommended_path: "direct_learning", suggested_topics: [] }),
      answer,
    }),
  selfHarm: () =>
    ok<AnalyzeResponse>({
      ok: true,
      mode: "mock",
      referral: { kind: "referral", reason: "self_harm", level: "D", context_summary: "", message: T.referralMessage },
      // The client must drop pointers on the self-harm screen even if one arrives.
      pointer: pointer(),
    }),
  levelD: () =>
    ok<AnalyzeResponse>({
      ok: true,
      mode: "mock",
      referral: { kind: "referral", reason: "level_d", level: "D", context_summary: "", message: T.referralMessage },
      pointer: pointer(),
    }),
  insufficient: (withPointer = true): Stubbed => ({
    status: 422,
    body: withPointer ? { ok: false, error: "insufficient_reference", pointer: pointer() } : { ok: false, error: "insufficient_reference" },
  }),
  unclear: (): Stubbed => ({ status: 422, body: { ok: false, error: "unclear" } }),
  upstream: (): Stubbed => ({ status: 502, body: { ok: false, error: "upstream" } }),
  rate: (): Stubbed => ({ status: 429, body: { ok: false, error: "rate" } }),
};
