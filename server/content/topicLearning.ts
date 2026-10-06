import type { ContentLevel, Lang, VerifiedContent, VerifiedStory } from "../../shared/experience/guidance";
import { getContentRecord, getStoryRecord } from "./catalog";
import { assertDisplayableContent, assertDisplayableStory, toRetrieveError } from "./contentPolicy";
import { isAllowlistedSourceId } from "./sourceRegistry";
import { getConceptEvidenceForTopic } from "./conceptEvidence";
import { getHadithEvidenceForTopic } from "./hadithEvidence";
import { getQuranEvidenceForTopic } from "./quranEvidence";
import { getStoryEvidenceForTopic } from "./storyEvidence";
import { selectSeerahAnchor } from "./storySelection";
import { getTafsirEvidenceForTopic } from "./tafsirEvidence";
import { getPublishedTopic, type Topic } from "./topics";
import { toPublicContent, toPublicStory } from "./whitelist";

export type TopicLearningFailure =
  | "TOPIC_NOT_FOUND"
  | "INSUFFICIENT_REFERENCE"
  | "NOT_VERIFIED"
  | "NOT_PUBLISHED"
  | "SOURCE_NOT_ALLOWLISTED";

export type TopicLearningPack = {
  quran: VerifiedContent | null;
  quranExplanation: VerifiedContent | null;
  hadith: VerifiedContent | null;
  hadithExplanation: VerifiedContent | null;
  story: VerifiedStory | null;
  relatedTopicIds: string[];
  /** Kept on topic metadata; not part of the default learning journey contract. */
  reflectionQuestion: { ar: string; en: string };
};

const DEFAULT_REFLECTION = {
  ar: "ما الشيء الصغير الذي تريد أن تحفظه من هذا الموضوع؟",
  en: "What small thing do you want to keep from this topic?",
};

function resolveContentRecord(
  record: ReturnType<typeof getContentRecord>,
  journeyLevel: ContentLevel,
  lang: Lang,
  journeyTopicId: string,
): VerifiedContent | null {
  if (!record) return null;
  if (!isAllowlistedSourceId(record.provenance.sourceId)) return null;
  const err = assertDisplayableContent(record, journeyLevel, journeyTopicId);
  if (err) return null;
  return toPublicContent(record, lang);
}

function resolveContentById(
  id: string | null | undefined,
  journeyLevel: ContentLevel,
  lang: Lang,
  journeyTopicId: string,
): VerifiedContent | null {
  if (!id) return null;
  return resolveContentRecord(getContentRecord(id), journeyLevel, lang, journeyTopicId);
}

function resolveStoryRecord(
  record: ReturnType<typeof getStoryRecord>,
  journeyLevel: ContentLevel,
  lang: Lang,
  journeyTopicId: string,
): VerifiedStory | null {
  if (!record) return null;
  if (!isAllowlistedSourceId(record.provenance.sourceId)) return null;
  const err = assertDisplayableStory(record, journeyLevel, journeyTopicId);
  if (err) return null;
  return toPublicStory(record, lang);
}

function pickQuran(topic: Topic, journeyLevel: ContentLevel, lang: Lang): VerifiedContent | null {
  const anchored = getQuranEvidenceForTopic(topic.id);
  if (anchored) {
    const item = resolveContentRecord(anchored, journeyLevel, lang, topic.id);
    if (item) return item;
  }
  for (const cid of topic.contentIds) {
    const record = getContentRecord(cid);
    if (!record || record.type !== "quran") continue;
    const item = resolveContentRecord(record, journeyLevel, lang, topic.id);
    if (item) return item;
  }
  return null;
}

function pickHadith(topic: Topic, journeyLevel: ContentLevel, lang: Lang): VerifiedContent | null {
  const anchored = getHadithEvidenceForTopic(topic.id);
  if (anchored) {
    const item = resolveContentRecord(anchored, journeyLevel, lang, topic.id);
    if (item) return item;
  }
  return resolveContentById(topic.hadithId, journeyLevel, lang, topic.id);
}

function pickQuranExplanation(
  topic: Topic,
  journeyLevel: ContentLevel,
  lang: Lang,
): VerifiedContent | null {
  // Verbatim tafsir of the topic's own verse comes first.
  const tafsir = getTafsirEvidenceForTopic(topic.id);
  if (tafsir) {
    const item = resolveContentRecord(tafsir, journeyLevel, lang, topic.id);
    if (item) return item;
  }
  const explicit = resolveContentById(topic.quranExplanationId, journeyLevel, lang, topic.id);
  if (explicit) return explicit;
  const anchored = getConceptEvidenceForTopic(topic.id);
  if (anchored) {
    const item = resolveContentRecord(anchored, journeyLevel, lang, topic.id);
    if (item) return item;
  }
  return resolveContentById(topic.conceptId, journeyLevel, lang, topic.id);
}

function pickHadithExplanation(
  topic: Topic,
  journeyLevel: ContentLevel,
  lang: Lang,
): VerifiedContent | null {
  return resolveContentById(topic.hadithExplanationId, journeyLevel, lang, topic.id);
}

function pickStory(topic: Topic, journeyLevel: ContentLevel, lang: Lang): VerifiedStory | null {
  const anchored = getStoryEvidenceForTopic(topic.id);
  if (anchored) {
    const item = resolveStoryRecord(anchored, journeyLevel, lang, topic.id);
    if (item) return item;
  }
  if (!topic.storyId) return null;
  const record = getStoryRecord(topic.storyId);
  if (!record || record.topicId !== topic.id) return null;
  return resolveStoryRecord(record, journeyLevel, lang, topic.id);
}

/**
 * The «موقف من السيرة» that fits what the person wrote: the topic's context passage whose routing
 * tags best match `message` (deterministic, no model), else the default scene. Same allowlist +
 * policy gate as every slot; null if nothing displayable.
 */
export function resolveTopicStoryForMessage(
  topicId: string,
  message: string | null | undefined,
  journeyLevel: ContentLevel = "A",
  lang: Lang = "ar",
): VerifiedStory | null {
  const anchor = selectSeerahAnchor(topicId, message);
  if (!anchor) return null;
  const record = getStoryRecord(anchor.storyId);
  if (!record || record.topicId !== topicId) return null;
  return resolveStoryRecord(record, journeyLevel, lang, topicId);
}

/** Resolve verified learning pack for a topic — allowlist + policy only; no model text. */
export function resolveTopicLearningPack(
  topicId: string,
  journeyLevel: ContentLevel = "A",
  lang: Lang = "ar",
): { pack: TopicLearningPack | null; error: TopicLearningFailure | null } {
  const topic = getPublishedTopic(topicId);
  if (!topic) return { pack: null, error: "TOPIC_NOT_FOUND" };

  const quran = pickQuran(topic, journeyLevel, lang);
  if (!quran) return { pack: null, error: "INSUFFICIENT_REFERENCE" };

  const hadith = pickHadith(topic, journeyLevel, lang);
  const quranExplanation = pickQuranExplanation(topic, journeyLevel, lang);
  const hadithExplanation = pickHadithExplanation(topic, journeyLevel, lang);
  const story = pickStory(topic, journeyLevel, lang);

  const reflectionQuestion = topic.reflectionQuestion ?? DEFAULT_REFLECTION;

  return {
    pack: {
      quran,
      quranExplanation,
      hadith,
      hadithExplanation,
      story,
      relatedTopicIds: topic.relatedTopicIds ?? [],
      reflectionQuestion,
    },
    error: null,
  };
}

export function topicLearningPolicyError(
  topicId: string,
  journeyLevel: ContentLevel,
): TopicLearningFailure | null {
  const topic = getPublishedTopic(topicId);
  if (!topic) return "TOPIC_NOT_FOUND";
  for (const cid of topic.contentIds) {
    const record = getContentRecord(cid);
    if (!record) continue;
    // Rows that are not published are never displayed (the pack resolver skips them), so they
    // cannot violate display policy — e.g. a legacy demo row listed next to a published one.
    if (record.provenance.verificationStatus !== "published") continue;
    if (!isAllowlistedSourceId(record.provenance.sourceId)) return "SOURCE_NOT_ALLOWLISTED";
    const err = assertDisplayableContent(record, journeyLevel, topicId);
    if (err) return (toRetrieveError(err) as TopicLearningFailure) ?? "INSUFFICIENT_REFERENCE";
  }
  return null;
}
