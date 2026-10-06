import type { ContentLevel } from "../../shared/experience/guidance";

export type Topic = {
  id: string;
  title: { ar: string; en: string };
  description?: { ar: string; en: string };
  /** Primary scripture ids (quran first). */
  contentIds: string[];
  hadithId?: string | null;
  /** Published explanation tied to the topic’s quran item (legacy: conceptId). */
  quranExplanationId?: string | null;
  /** Published explanation tied to the topic’s hadith item. */
  hadithExplanationId?: string | null;
  /** @deprecated Prefer quranExplanationId */
  conceptId?: string | null;
  storyId: string | null;
  relatedTopicIds?: string[];
  reflectionQuestion?: { ar: string; en: string };
  /**
   * Routing metadata for the analyze model only — a few plain words for the experiences and
   * questions this topic covers. Never displayed; no verses, hadith, rulings or religious claims.
   */
  routingHint?: { ar: string; en: string };
  /** No repository_demo fallback — only published verified content (demo pipeline topics). */
  publishedContentOnly?: boolean;
  level: ContentLevel;
  published: boolean;
};

/**
 * Topics the AI may suggest. Content is resolved from the topic's anchors (topicQuranAnchors.ts,
 * topicSourceAnchors.ts) against the published repository — never from theme fallback, never from
 * hand-typed rows. `storyId` stays null: the «موقف من السيرة» story is resolved from topicSeerahAnchors.ts.
 */
export const topics: Topic[] = [
  {
    id: "patience",
    title: { ar: "الصبر", en: "Patience" },
    routingHint: {
      ar: "صعوبة مستمرة، ضغط، تعب، انتظار طويل، تحمّل",
      en: "ongoing hardship, pressure, exhaustion, long waiting, endurance",
    },
    description: { ar: "الثبات مع التجربة دون إنكار الألم.", en: "Steadiness with what you live, without denying the pain." },
    contentIds: ["quran-zumar-10"],
    hadithId: null,
    conceptId: null,
    storyId: null,
    reflectionQuestion: {
      ar: "متى شعرت أن الصبر كان فعلًا وليس مجرد انتظار؟",
      en: "When did patience feel like an active stance—not just waiting?",
    },
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  {
    id: "grief",
    title: { ar: "الحزن والفقد", en: "Grief and loss" },
    routingHint: {
      ar: "حزن، وفاة شخص عزيز، فراق، بكاء، ألم الفقد",
      en: "sadness, death of a loved one, separation, crying, the pain of loss",
    },
    contentIds: ["quran-baqarah-156"],
    storyId: null,
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  {
    id: "anxiety",
    title: { ar: "القلق والخوف", en: "Anxiety and fear" },
    routingHint: {
      ar: "قلق، خوف من المستقبل، توتر، أفكار مزعجة، خوف من الفشل أو من مسؤولية جديدة",
      en: "worry, fear of the future, stress, intrusive thoughts, fear of failing or of a new responsibility",
    },
    contentIds: ["quran-baqarah-286"],
    storyId: null,
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  {
    id: "hope",
    title: { ar: "الرجاء", en: "Hope" },
    routingHint: {
      ar: "يأس، إحباط، شعور بالذنب بعد خطأ، رغبة في بداية جديدة، تفاؤل",
      en: "despair, discouragement, guilt after a mistake, wanting a fresh start, optimism",
    },
    contentIds: ["quran-zumar-53"],
    storyId: null,
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  {
    id: "tawakkul",
    title: { ar: "التوكل", en: "Tawakkul" },
    routingHint: {
      ar: "الاعتماد على الله مع الأخذ بالأسباب، بداية جديدة، قرار مهم، نتيجة غير مضمونة، رزق ووظيفة",
      en: "relying on God while taking the means, new beginnings, big decisions, uncertain outcomes, livelihood and work",
    },
    description: { ar: "الاعتماد على الله مع الأخذ بالأسباب.", en: "Relying on God while still taking the means." },
    contentIds: ["quran-talaq-3"],
    hadithId: null,
    conceptId: null,
    storyId: null,
    relatedTopicIds: ["effort", "anxiety"],
    reflectionQuestion: {
      ar: "ما خطوة واحدة تقدر تتقنها هذا الأسبوع، وتفوّض نتيجتها لله؟",
      en: "What is one step you could do well this week, while leaving the outcome with God?",
    },
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  {
    id: "amanah",
    title: { ar: "الأمانة", en: "Trustworthiness" },
    routingHint: {
      ar: "مسؤولية، واجبات، وظيفة أو منصب أو دور جديد، الوفاء بالوعود، ما اؤتمنت عليه، أن يثق بك الناس",
      en: "responsibility, duties, a new job, role or position, keeping promises, what is entrusted to you, being trusted",
    },
    description: { ar: "حمل المسؤولية بصدق.", en: "Carrying responsibility with integrity." },
    contentIds: ["quran-muminun-8"],
    storyId: null,
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  {
    id: "loss",
    title: { ar: "الفقد", en: "Loss" },
    routingHint: {
      ar: "خسارة مال أو عمل أو فرصة، فقدان شيء عزيز، نقص، تراجع",
      en: "losing money, a job or an opportunity, losing something dear, shortage, setbacks",
    },
    contentIds: ["quran-baqarah-155"],
    storyId: null,
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  {
    id: "effort",
    title: { ar: "السعي والجهد", en: "Effort and striving" },
    routingHint: {
      ar: "سعي، عمل، اجتهاد، دراسة، محاولة من جديد بعد فشل، تعب لم تظهر نتيجته بعد",
      en: "striving, work, trying hard, studying, trying again after failure, effort not yet rewarded",
    },
    description: { ar: "العمل والانتظار دون أن يمحى المعنى.", en: "Work and waiting without erasing meaning." },
    contentIds: ["quran-najm-39"],
    storyId: null,
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  {
    id: "nearness",
    title: { ar: "القرب من الله", en: "Nearness to God" },
    routingHint: {
      ar: "رغبة في القرب من الله، دعاء، كيف أدعو الله وآداب الدعاء، عبادة، شعور بالبعد أو الفتور، سكينة",
      en: "wanting to be closer to God, supplication, how to make du'a and its etiquette, worship, feeling distant or lukewarm, inner calm",
    },
    contentIds: ["quran-baqarah-186"],
    storyId: null,
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  {
    id: "gratitude",
    title: { ar: "الشكر", en: "Gratitude" },
    routingHint: {
      ar: "نعمة، خبر سعيد، فرح، امتنان، شكر، نجاح، شيء جميل حصل",
      en: "blessings, good news, joy, thankfulness, gratitude, success, something good happened",
    },
    contentIds: ["quran-ibrahim-7"],
    storyId: null,
    publishedContentOnly: true,
    level: "A",
    published: true,
  },
  /** Internal fixture — not for production UI */
  {
    id: "topic-unpublished-fixture",
    title: { ar: "اختبار", en: "Test" },
    contentIds: ["quran-fixture-unpublished"],
    storyId: null,
    level: "A",
    published: false,
  },
];

export function getTopic(id: string | null | undefined): Topic | null {
  if (!id) return null;
  return topics.find((t) => t.id === id) ?? null;
}

export function getPublishedTopic(id: string): Topic | null {
  const topic = getTopic(id);
  if (!topic || !topic.published) return null;
  return topic;
}

/**
 * Topic list for the analyze prompt — pass `onlyIds` to restrict it to ready topics. Includes the
 * routing hints (model-only metadata; never part of any response).
 */
export function topicMetaForModel(onlyIds?: readonly string[]) {
  const allow = onlyIds ? new Set(onlyIds) : null;
  return topics
    .filter((t) => t.published && (!allow || allow.has(t.id)))
    .map((t) => ({
      id: t.id,
      title_ar: t.title.ar,
      title_en: t.title.en,
      level: t.level,
      ...(t.routingHint ? { hint_ar: t.routingHint.ar, hint_en: t.routingHint.en } : {}),
    }));
}

export function publishedTopicIds(): string[] {
  return topics.filter((t) => t.published).map((t) => t.id);
}

/** Data-driven: which topics reject legacy repository_demo at display time. */
export function topicRequiresPublishedContent(topicId: string | undefined): boolean {
  if (!topicId) return false;
  return getPublishedTopic(topicId)?.publishedContentOnly === true;
}

export type TopicId = (typeof topics)[number]["id"];
