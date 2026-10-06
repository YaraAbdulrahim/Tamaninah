import type { ContentLevel } from "../../../shared/experience/guidance";
import type { ContentOrigin, ContentProvenance, StoryProvenance } from "../provenance";

/**
 * - internal_snapshot: matched to an in-repo bundle (legacy; no live source fetch)
 * - live_api: fetched through an allowlisted read-only API connector (Quranpedia)
 * - source_page: copied verbatim from the approved source's public page (shamela.ws) into a
 *   committed snapshot and re-checked by a second, independent fetch
 * - editorial_internal: editorial copy — never scripture
 */
export type ReviewEvidenceType = "internal_snapshot" | "editorial_internal" | "live_api" | "source_page";

/** Human review record — not a claim of live external verification. */
export type ReviewEvidence = {
  kind: "human_repository_review";
  /** What kind of review actually happened. */
  evidenceType: ReviewEvidenceType;
  reviewedAt: string;
  reviewerRole: string;
  notes: string;
  /** Internal bundle/snapshot id — not a URL and not proof of external verification. */
  checkedAgainst: string;
};

export type IngestionWorkflowStatus =
  | "repository_demo"
  | "pending_review"
  | "internally_reviewed"
  | "published"
  | "rejected";

export type NormalizedQuranIngest = {
  contentId: string;
  topicId: string;
  contentType: "quran";
  level: ContentLevel;
  sourceId: string;
  sourceReference: string;
  contentOrigin: "source_text";
  quran: { surah: number; ayah: number; edition: string };
  title?: string;
  arabic: string;
  translation: string;
  place: string;
  /** Immutable hash of source text at ingest time — detects tampering after review. */
  textFingerprint: string;
};

export type NormalizedStoryIngest = {
  storyId: string;
  topicId: string;
  level: ContentLevel;
  sourceId: string;
  sourceReference: string;
  contentOrigin: ContentOrigin;
  seerah: { sourceReference: string };
  title: string;
  headline: string;
  opening: string;
  body: string[];
  lessons: string[];
  takeaway: string;
  keep: string;
  textFingerprint: string;
};

export type StagedRecord =
  | { kind: "content"; normalized: NormalizedQuranIngest; status: "pending_review" }
  | { kind: "story"; normalized: NormalizedStoryIngest; status: "pending_review" };

export type ReviewedRecord =
  | {
      kind: "content";
      normalized: NormalizedQuranIngest;
      status: "internally_reviewed";
      evidence: ReviewEvidence;
    }
  | {
      kind: "story";
      normalized: NormalizedStoryIngest;
      status: "internally_reviewed";
      evidence: ReviewEvidence;
    };

export type PublishedProvenance = (ContentProvenance | StoryProvenance) & {
  verificationStatus: "published";
  reviewEvidence: ReviewEvidence;
};
