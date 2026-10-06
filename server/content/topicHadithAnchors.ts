/**
 * Topic → hadith contentId anchors for published ingest.
 * Derived from TOPIC_HADITH_SOURCE_ANCHORS (Sahih al-Bukhari / Sahih Muslim on shamela.ws); the
 * text itself only ever comes from snapshots/hadith.published.json.
 */
import { HADITH_COLLECTIONS, hadithSourceReference } from "./sourceSnapshotRefs";
import { TOPIC_HADITH_SOURCE_ANCHORS } from "./topicSourceAnchors";

export type TopicHadithAnchor = {
  topicId: string;
  contentId: string;
  /** Collection + number, e.g. «صحيح البخاري 1469». */
  sourceReference: string;
};

export const LIVE_TOPIC_HADITH_ANCHORS: readonly TopicHadithAnchor[] = TOPIC_HADITH_SOURCE_ANCHORS.map((a) => ({
  topicId: a.topicId,
  contentId: a.contentId,
  sourceReference: hadithSourceReference({ collection: HADITH_COLLECTIONS[a.collection].collection, number: a.number }),
}));

export function getTopicHadithAnchor(topicId: string): TopicHadithAnchor | null {
  return LIVE_TOPIC_HADITH_ANCHORS.find((a) => a.topicId === topicId) ?? null;
}
