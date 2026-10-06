import type { KnowledgeDomain } from "./api";

export type Lang = "ar" | "en";



export type SafetyLevel = "normal" | "emotional_distress" | "high_risk" | "self_harm_risk";



/** Topic ids align with `server/content/topics.ts` */

export type TopicId =

  | "patience"

  | "grief"

  | "anxiety"

  | "hope"

  | "tawakkul"

  | "loss"

  | "effort"

  | "nearness"

  | "amanah"

  | "gratitude";



/** @deprecated Use TopicId in new flows; kept for copy maps */

export type IslamicTheme = TopicId;



export type ContentLevel = "A" | "B" | "C" | "D";



export type AnalyzeSafety = "safe" | "unclear" | "refer";

export type InputIntent =
  | "EXPERIENCE"
  | "FEELING"
  | "SITUATION"
  | "DIRECT_QUESTION"
  | "RELIGIOUS_RULING_QUESTION"
  | "GENERAL_ISLAMIC_LEARNING"
  | "OUT_OF_SCOPE";

export type RecommendedPath = "topic_discovery" | "direct_learning" | "referral" | "insufficient";

export type ActionType = "quran" | "dua" | "charity" | "reach_out" | "prayer";



/** `tafsir` = verbatim excerpt of an approved tafsir explaining the journey's verse. */
export type ContentType = "quran" | "hadith" | "seerah" | "concept" | "tafsir";

export type VerificationStatus =
  | "repository_demo"
  | "pending_review"
  | "internally_reviewed"
  | "published"
  | "rejected";

export type ContentOrigin = "source_text" | "reviewed_explanation";

/** `source_page` = copied verbatim from the approved source's public page into a committed snapshot, re-checked by a second fetch. */
export type ReviewEvidenceType = "internal_snapshot" | "editorial_internal" | "live_api" | "source_page";

export type PublicProvenance = {
  sourceId: string;
  sourceReference: string;
  verificationStatus: VerificationStatus;
  contentOrigin: ContentOrigin;
  verificationDisclosure: string;
  /** Plain-language boundary: attribution vs what was actually reviewed. */
  attributionDisclosure: string;
  reviewCheckedAgainst?: string;
  reviewEvidenceType?: ReviewEvidenceType;
  reviewEvidenceTypeLabel?: string;
  quran?: { surah: number; ayah: number; edition?: string };
  hadith?: {
    collection: string;
    hadithReference: string;
    grade?: string;
    /** Hadith number as printed in the edition. */
    number?: number;
    /** كتاب / باب as printed. */
    book?: string;
    chapter?: string;
    edition?: string;
    /** Exact page of the approved edition (e.g. shamela.ws/book/1681/2367). */
    url?: string;
    /** Why the grade holds (e.g. in the Sahihayn per the challenge reference). */
    gradeBasis?: string;
  };
  /** Tafsir excerpt: the verse it explains and where it sits in the book. */
  tafsir?: {
    surah: number;
    ayah: number;
    book: string;
    author: string;
    volume: number;
    pages: number[];
    edition?: string;
    editor?: string;
    url: string;
  };
  /** Seerah passage location (story slot «من السيرة»). */
  seerah?: {
    sourceReference: string;
    /** The book the passage is quoted from (a Seerah book, or a Sahih collection narrating the event). */
    book?: string;
    edition?: string;
    volume?: number;
    page?: number;
    /** Exact page of the approved edition (shamela.ws/book/{id}/{page}). */
    url?: string;
    /** "seerah_book" (e.g. Sirat Ibn Hisham — no grade asserted) or "sahih" (narration in the Sahihayn). */
    sourceKind?: "seerah_book" | "sahih";
    /** For sahih narrations only: the hadith number in that collection. */
    number?: number;
  };
};

export type ContentSource = {

  name: string;

  reference?: string;

  url?: string;

};



export type ConversationTurn = { role: "user" | "companion"; text: string };



export type GuidanceRequest = {

  message: string;

  language: Lang;

  context: ConversationTurn[];

};



export type JourneyRequest = GuidanceRequest & {

  topicId: string;

  analyzeLevel: ContentLevel;

};



export type EmotionalState = {

  primary: string;

  secondary: string[];

  confidence: number;

};



export type SuggestedAction = {

  type: ActionType;

  title: string;

  description: string;

};



export type LearningStep = {

  title: string;

  description: string;

};



export type VerifiedContent = {

  content_id: string;

  type: ContentType;

  topicId: string;

  level: ContentLevel;

  published: boolean;

  verified: boolean;

  title?: string;

  arabic: string;

  translation: string;

  place: string;

  reference: string;

  source: ContentSource;

  provenance: PublicProvenance;

  /**
   * Presentation only — every value is an exact substring of `arabic`, curated per anchor and validated at load.
   * `highlight`: the part to light first (verse / hadith). `lead`: the opening the page shows before
   * «عرض كاملًا» (tafsir). Absent → show the whole text.
   */
  highlight?: string;

  lead?: string;

};



export type StoryScene = {
  id: string;
  title: string;
  text: string;
  reference?: string;
};

export type VerifiedStory = {

  story_id: string;

  topicId: string;

  level: ContentLevel;

  published: boolean;

  verified: boolean;

  title: string;

  headline: string;

  opening: string;

  body: string[];

  lessons: string[];

  takeaway: string;

  keep: string;

  scenes?: StoryScene[];

  source: ContentSource;

  provenance: PublicProvenance;

  /**
   * Presentation only for a Seerah scene — verbatim consecutive segments of the passage (joined they equal the
   * body text) revealed one after another, and `key_quotes`: exact substrings to light up inside them.
   */
  beats?: string[];

  key_quotes?: string[];

};



export type SuggestedTopic = {

  id: string;

  title: string;

  reason?: string;

};



export type AnalyzeResult = {

  context_summary: string;

  level: ContentLevel;

  safety: AnalyzeSafety;

  suggested_topics: SuggestedTopic[];

  input_intent: InputIntent;

  recommended_path: RecommendedPath;

  /**
   * What the person asked to learn or understand beyond the core journey (empty or absent = nothing
   * extra). Set by the analyze stage; the browser sends it back as `focus` with the journey request.
   */
  learning_focus?: LessonAspect[];

};

export type JourneyBridges = {
  quran?: string;
  tafsir?: string;
  hadith?: string;
  seerah?: string;
  /** «ما يمر بك اليوم… ليس خارج الرحلة.» moment: three short labels (feel → learn → can do now). */
  connect?: { title: string; points: [string, string, string] };
};

/** The kinds of extra learning a person may ask for («علمني»، «كيف أدعي؟»، «وش فضل…»). */
export type LessonAspect = "meaning" | "how" | "etiquette" | "virtues" | "fruits" | "evidence" | "types" | "examples";

/**
 * Extra learning material shown on top of the core journey (verse → tafsir → hadith → seerah) when the
 * person asks to learn or understand more. Always a verbatim section of an approved source.
 */
export type LessonItem = {
  id: string;
  topicId: string;
  aspect: LessonAspect;
  /** The section heading as the source prints it (Arabic). */
  title_ar: string;
  /** Our English label for that heading (UI only). */
  title_en: string;
  /** Verbatim source text. Never model-written. */
  body_ar: string;
  source: { name: string; reference: string; url: string };
};



export type ReferralPayload = {

  kind: "referral";

  reason: "level_d" | "self_harm" | "level_c";

  level: "D" | "C";

  context_summary: string;

  message: string;

};



export type LearningPackSlotKey =
  | "quran"
  | "quran_explanation"
  | "hadith"
  | "hadith_explanation"
  | "story";

export type LearningPackSlotView = {
  key: LearningPackSlotKey;
  label: string;
  ready: boolean;
};

export type GuidancePayload = {

  heading: string;

  emotional_state: EmotionalState;

  context: string;

  user_need: string;

  response: string[];

  remember: string;

  topic_id: TopicId;

  /** Runtime journey level after server-side policy (not client-only). */

  governance_level?: ContentLevel;

  content: VerifiedContent | null;

  quran_explanation?: VerifiedContent | null;

  hadith?: VerifiedContent | null;

  hadith_explanation?: VerifiedContent | null;

  /** @deprecated Use quran_explanation */
  concept?: VerifiedContent | null;

  story: VerifiedStory | null;

  related_topics?: { id: string; title: string }[];

  suggested_action: SuggestedAction;

  learning_path: LearningStep[];

  reflection_question: string;

  safety: {

    level: SafetyLevel;

    requires_human_support: boolean;

  };

  unclear: boolean;

  /** Which journey sections have published verified content (honest UI). */
  pack_slots?: LearningPackSlotView[];

  /** Verbatim extra learning sections for what the person asked to learn (see LessonItem). */
  lessons?: LessonItem[];

  /**
   * Present when the person asked to learn more. `covered: false` means the approved content in
   * Tamaninah does not cover that part reliably — the UI says so instead of filling the gap.
   */
  learning_request?: { focus: LessonAspect[]; covered: boolean };

  /**
   * Short product-copy lines that lead into each part of the journey, in the request language (e.g. «شيء من
   * القرآن يلامس ما تعيشه»). Curated per topic by the team — never model-written, never religious claims beyond
   * describing the item that follows.
   */
  bridges?: JourneyBridges;

};



export type ModelDraft = {

  heading: string;

  emotional_state: EmotionalState;

  context: string;

  user_need: string;

  response: string[];

  remember: string;

  topic_id: TopicId;

  suggested_action: SuggestedAction;

  learning_path: LearningStep[];

  reflection_question: string;

  safety: {

    level: SafetyLevel;

    requires_human_support: boolean;

  };

  unclear: boolean;

};



export type AnalyzeDraft = {

  context_summary: string;

  level: ContentLevel;

  safety: AnalyzeSafety;

  suggested_topics: SuggestedTopic[];

  input_intent: InputIntent;

  recommended_path: RecommendedPath;

  /** Server-validated against the candidate list it sent; never trusted blindly. */
  knowledge_id?: string | null;

  /** Knowledge domain per the PDF's approved-sources table (for pointers). */
  domain?: KnowledgeDomain | null;

  /** What the person explicitly asked to learn (enum-validated; merged with deterministic cues server-side). */
  learning_focus?: LessonAspect[];

};



export type CatalogMeta = {

  content_id: string;

  type: ContentType;

  topicId: string;

  title?: string;

};



export type StoryMeta = {

  story_id: string;

  topicId: string;

  title: string;

};


