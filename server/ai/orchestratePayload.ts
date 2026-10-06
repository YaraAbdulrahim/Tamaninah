import type { GuidancePayload, Lang, LessonAspect } from "../../shared/experience/guidance";
import { selectLessons } from "../content/lessons/lessonRepository";
import { resolveTopicStoryForMessage, type TopicLearningPack } from "../content/topicLearning";
import { topicBridges } from "../content/topicBridges";
import { packSlotsForClient } from "../content/topicPackSlots";
import { topicSuggestedAction } from "../content/topicSteps";
import { getPublishedTopic } from "../content/topics";

/** What the person asked to learn on top of the journey (see LessonItem / learning_request). */
export type JourneyLearning = { focus: readonly LessonAspect[]; message: string };

export function buildRepositoryJourneyPayload(
  topicId: GuidancePayload["topic_id"],
  pack: TopicLearningPack,
  governanceLevel: GuidancePayload["governance_level"],
  lang: Lang,
  learning?: JourneyLearning,
): GuidancePayload {
  const related = pack.relatedTopicIds
    .map((id) => getPublishedTopic(id))
    .filter(Boolean)
    .map((t) => ({ id: t!.id, title: lang === "en" ? t!.title.en : t!.title.ar }));

  // "Learn more": verbatim approved lessons added on top of the core slots — never instead of them.
  const selection = learning ? selectLessons({ topicId, focus: learning.focus, message: learning.message }) : null;

  return {
    heading: "",
    emotional_state: { primary: "unspecified", secondary: [], confidence: 0.5 },
    context: "",
    user_need: "",
    response: [],
    remember: "",
    topic_id: topicId,
    governance_level: governanceLevel,
    content: pack.quran,
    quran_explanation: pack.quranExplanation,
    hadith: pack.hadith,
    hadith_explanation: pack.hadithExplanation,
    /** @deprecated Journey UI uses quran_explanation; kept for legacy readers. */
    concept: pack.quranExplanation,
    /** The Seerah scene that fits the person's own words (tag match, model-free), else the topic default. */
    story: (learning ? resolveTopicStoryForMessage(topicId, learning.message, governanceLevel ?? "A", lang) : null) ?? pack.story,
    related_topics: related,
    /** One step from the product copy (docs/EXPERIENCE.md §06) — guidance, not religious text. */
    suggested_action: topicSuggestedAction(topicId, lang),
    learning_path: [],
    reflection_question: "",
    pack_slots: packSlotsForClient(topicId, lang),
    safety: { level: "normal", requires_human_support: false },
    unclear: false,
    ...(selection ? { lessons: selection.lessons, learning_request: selection.learning_request } : {}),
    /** Curated product-copy lines leading into each part of the journey (never religious text). */
    bridges: topicBridges(topicId, lang),
  };
}
