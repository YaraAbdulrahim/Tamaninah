import { quranProvenance, TMN_CONCEPT } from "./catalogProvenance";
import type { ReviewEvidence } from "./ingestion/types";
import type { ContentProvenance, StoryProvenance } from "./provenance";

export const TEST_PUBLISHED_REVIEW: ReviewEvidence = {
  kind: "human_repository_review",
  evidenceType: "internal_snapshot",
  reviewedAt: "2026-01-01T00:00:00.000Z",
  reviewerRole: "test",
  notes: "Published fixture for display policy tests.",
  checkedAgainst: "test-published-fixture",
};

export function publishedQuranProvenance(
  sourceReference: string,
  surah: number,
  ayah: number,
): ContentProvenance {
  return {
    ...quranProvenance({ sourceReference, surah, ayah, verificationStatus: "published" }),
    reviewEvidence: TEST_PUBLISHED_REVIEW,
  };
}

export function publishedStoryProvenance(sourceReference: string): StoryProvenance {
  return {
    sourceId: TMN_CONCEPT,
    sourceReference,
    verificationStatus: "published",
    contentOrigin: "reviewed_explanation",
    seerah: { sourceReference },
    reviewEvidence: {
      ...TEST_PUBLISHED_REVIEW,
      evidenceType: "editorial_internal",
    },
  };
}
