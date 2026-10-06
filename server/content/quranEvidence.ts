import { getPublishedContentRecord } from "./publishedRepository";
import { getTopicQuranAnchor } from "./topicQuranAnchors";
import type { StoredContent } from "./recordTypes";

/** Resolve published Quran evidence for any topic with a configured anchor. */
export function getQuranEvidenceForTopic(topicId: string): StoredContent | null {
  const anchor = getTopicQuranAnchor(topicId);
  if (!anchor) return null;
  const record = getPublishedContentRecord(anchor.contentId);
  if (!record || record.type !== "quran") return null;
  return record;
}
