import { getPublishedContentRecord } from "./publishedRepository";
import type { StoredContent } from "./recordTypes";
import { getPublishedTopic } from "./topics";

/** Published concept/explanation for topic — published repository only. */
export function getConceptEvidenceForTopic(topicId: string): StoredContent | null {
  const topic = getPublishedTopic(topicId);
  if (!topic?.conceptId) return null;
  const record = getPublishedContentRecord(topic.conceptId);
  if (!record || record.type !== "concept" || record.topicId !== topicId) return null;
  return record;
}
