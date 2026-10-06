import type { ReviewEvidence, ReviewedRecord, StagedRecord } from "./types";
import { buildQuranFingerprint, buildStoryFingerprint } from "./normalize";

export type ReviewFailure =
  | "INVALID_EVIDENCE"
  | "TEXT_FINGERPRINT_MISMATCH"
  | "NOT_STAGED";

export function assertReviewEvidence(evidence: ReviewEvidence): ReviewFailure | null {
  if (evidence.kind !== "human_repository_review") return "INVALID_EVIDENCE";
  if (!evidence.reviewedAt || !evidence.reviewerRole.trim()) return "INVALID_EVIDENCE";
  if (!evidence.checkedAgainst.trim()) return "INVALID_EVIDENCE";
  if (!evidence.notes.trim()) return "INVALID_EVIDENCE";
  if (
    evidence.evidenceType !== "internal_snapshot" &&
    evidence.evidenceType !== "editorial_internal" &&
    evidence.evidenceType !== "live_api" &&
    evidence.evidenceType !== "source_page"
  ) {
    return "INVALID_EVIDENCE";
  }
  const against = evidence.checkedAgainst.toLowerCase();
  if (against.includes("http://") || against.includes("https://") || against.includes("dorar.net")) {
    return "INVALID_EVIDENCE";
  }
  return null;
}

export function submitInternalReview(
  staged: StagedRecord,
  evidence: ReviewEvidence,
): { ok: true; reviewed: ReviewedRecord } | { ok: false; error: ReviewFailure } {
  if (staged.status !== "pending_review") return { ok: false, error: "NOT_STAGED" };
  const evErr = assertReviewEvidence(evidence);
  if (evErr) return { ok: false, error: evErr };

  if (staged.kind === "content") {
    const fp = buildQuranFingerprint(staged.normalized);
    if (fp !== staged.normalized.textFingerprint) return { ok: false, error: "TEXT_FINGERPRINT_MISMATCH" };
  } else {
    const fp = buildStoryFingerprint(staged.normalized);
    if (fp !== staged.normalized.textFingerprint) return { ok: false, error: "TEXT_FINGERPRINT_MISMATCH" };
  }

  return {
    ok: true,
    reviewed: { ...staged, status: "internally_reviewed", evidence },
  };
}

export function verifyFingerprintOnPublish(
  reviewed: ReviewedRecord,
): ReviewFailure | null {
  if (reviewed.kind === "content") {
    const fp = buildQuranFingerprint(reviewed.normalized);
    if (fp !== reviewed.normalized.textFingerprint) return "TEXT_FINGERPRINT_MISMATCH";
  } else {
    const fp = buildStoryFingerprint(reviewed.normalized);
    if (fp !== reviewed.normalized.textFingerprint) return "TEXT_FINGERPRINT_MISMATCH";
  }
  return null;
}
