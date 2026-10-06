import { getPublishedStoryRecord } from "./publishedRepository";
import type { StoredStory } from "./recordTypes";
import { getTopicSeerahAnchor } from "./topicSeerahAnchors";

/**
 * «موقف من السيرة» for this journey topic: the published, verbatim Seerah passage named by the
 * topic's anchor (snapshots/seerah.published.json). No cross-topic or editorial stories.
 */
export function getStoryEvidenceForTopic(topicId: string): StoredStory | null {
  const anchor = getTopicSeerahAnchor(topicId);
  if (!anchor) return null;
  const record = getPublishedStoryRecord(anchor.storyId);
  if (!record || record.topicId !== topicId) return null;
  return record;
}
