import { dorarHadithAdapterStatus } from "./connectors/dorarHadith";
import { getPublishedContentRecord } from "./publishedRepository";
import type { StoredContent } from "./recordTypes";
import { getTopicHadithAnchor } from "./topicHadithAnchors";

export type HadithEvidenceGap =
  | "adapter_not_ready"
  | "license_clarification_needed"
  | "no_anchor"
  | "not_published";

/** Resolve published hadith evidence for a topic — no catalog demo fallback. */
export function getHadithEvidenceForTopic(topicId: string): StoredContent | null {
  const anchor = getTopicHadithAnchor(topicId);
  if (!anchor) return null;
  const record = getPublishedContentRecord(anchor.contentId);
  if (!record || record.type !== "hadith") return null;
  return record;
}

export function hadithEvidenceGapReason(topicId: string): HadithEvidenceGap {
  if (getHadithEvidenceForTopic(topicId)) return "not_published";
  if (getTopicHadithAnchor(topicId)) return "not_published";
  return dorarHadithAdapterStatus();
}
