import { getContentRecord } from "./catalog";
import { getPublishedTopic, getTopic, topics, type Topic } from "./topics";
import { resolveTopicLearningPack, type TopicLearningFailure } from "./topicLearning";
import { assertDisplayableContent } from "./contentPolicy";
import { publishedRepositoryRevision } from "./publishedRepository";
import { isAllowlistedSourceId } from "./sourceRegistry";

export type TopicPackStatus =
  | { ready: true; topicId: string }
  | { ready: false; topicId: string; reason: TopicLearningFailure | "UNPUBLISHED_TOPIC" | "NOT_READY" };

/** Catalog topic exists but may lack published verified quran journey. */
export function assessTopicPackReadiness(topicId: string): TopicPackStatus {
  const catalog = getTopic(topicId);
  if (!catalog) return { ready: false, topicId, reason: "TOPIC_NOT_FOUND" };
  if (!catalog.published) return { ready: false, topicId, reason: "UNPUBLISHED_TOPIC" };
  const topic = getPublishedTopic(topicId);
  if (!topic) return { ready: false, topicId, reason: "UNPUBLISHED_TOPIC" };

  const { pack, error } = resolveTopicLearningPack(topicId, "A", "ar");
  if (pack && !error) return { ready: true, topicId };
  return { ready: false, topicId, reason: error ?? "NOT_READY" };
}

export function topicHasPublishedVerifiedQuran(topic: Topic): boolean {
  for (const cid of topic.contentIds) {
    const record = getContentRecord(cid);
    if (!record || record.type !== "quran") continue;
    if (!isAllowlistedSourceId(record.provenance.sourceId)) continue;
    if (record.provenance.verificationStatus !== "published") continue;
    if (assertDisplayableContent(record, "A") === null) return true;
  }
  return false;
}

export function countPublishedVerifiedQuranTopics(): number {
  return getPublishedTopicIdsWithQuran().length;
}

function getPublishedTopicIdsWithQuran(): string[] {
  return topics
    .filter((t) => t.published)
    .filter((t) => topicHasPublishedVerifiedQuran(t))
    .map((t) => t.id);
}

let readyCache: { revision: number; ids: readonly string[] } | null = null;

/**
 * Topics whose verified learning pack resolves right now (published, allowlisted Quran item at
 * level A). Only these may be suggested to the user. Memoized per published-repository revision:
 * the repository changes at runtime only through `mergePublishedContentRecords` (opt-in live
 * warm-up), which invalidates the cache.
 */
export function readyTopicIds(): string[] {
  const revision = publishedRepositoryRevision();
  let cache = readyCache;
  if (!cache || cache.revision !== revision) {
    cache = readyCache = {
      revision,
      ids: topics
        .filter((t) => t.published)
        .filter((t) => assessTopicPackReadiness(t.id).ready)
        .map((t) => t.id),
    };
  }
  return [...cache.ids];
}
