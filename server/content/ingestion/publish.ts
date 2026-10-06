import type { StoredContent, StoredStory } from "../recordTypes";
import type { ContentProvenance, StoryProvenance } from "../provenance";
import { displayNameForSource } from "../sourceRegistry";
import { verifyFingerprintOnPublish } from "./review";
import type { ReviewedRecord } from "./types";

export type PublishFailure =
  | "NOT_INTERNALLY_REVIEWED"
  | "TEXT_FINGERPRINT_MISMATCH"
  | "INVALID_EVIDENCE"
  | "NOT_STAGED";

export function publishReviewedContent(reviewed: ReviewedRecord): { ok: true; record: StoredContent | StoredStory } | { ok: false; error: PublishFailure } {
  if (reviewed.status !== "internally_reviewed") return { ok: false, error: "NOT_INTERNALLY_REVIEWED" };
  const fpErr = verifyFingerprintOnPublish(reviewed);
  if (fpErr) return { ok: false, error: fpErr };

  if (reviewed.kind === "content") {
    const n = reviewed.normalized;
    const provenance: ContentProvenance = {
      sourceId: n.sourceId,
      sourceReference: n.sourceReference,
      verificationStatus: "published",
      contentOrigin: "source_text",
      quran: { surah: n.quran.surah, ayah: n.quran.ayah, edition: n.quran.edition },
      reviewEvidence: reviewed.evidence,
    };
    const record: StoredContent = {
      id: n.contentId,
      type: "quran",
      topicId: n.topicId,
      level: n.level,
      published: true,
      verified: true,
      title: n.title,
      arabic: n.arabic,
      translation: n.translation,
      place: n.place,
      source: {
        name: displayNameForSource(n.sourceId) ?? "Quran",
        reference: n.sourceReference,
      },
      provenance,
    };
    return { ok: true, record };
  }

  const n = reviewed.normalized;
  const provenance: StoryProvenance = {
    sourceId: n.sourceId,
    sourceReference: n.sourceReference,
    verificationStatus: "published",
    contentOrigin: n.contentOrigin,
    seerah: n.seerah,
    reviewEvidence: reviewed.evidence,
  };
  const record: StoredStory = {
    id: n.storyId,
    topicId: n.topicId,
    level: n.level,
    published: true,
    verified: true,
    title: n.title,
    headline: n.headline,
    opening: n.opening,
    body: n.body,
    lessons: n.lessons,
    takeaway: n.takeaway,
    keep: n.keep,
    source: {
      name: displayNameForSource(n.sourceId) ?? "Seerah",
      reference: n.sourceReference,
    },
    provenance,
  };
  return { ok: true, record };
}
