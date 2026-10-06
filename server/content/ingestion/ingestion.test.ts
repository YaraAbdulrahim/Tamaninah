import { describe, expect, it } from "vitest";
import { assertDisplayableContent } from "../contentPolicy";
import { getContentRecord } from "../catalog";
import { resolveTopicMedia } from "../whitelist";
import { buildQuranFingerprint, normalizeQuranIngest } from "./normalize";
import { submitInternalReview } from "./review";
import { publishReviewedContent } from "./publish";
import { quranProvenance, TMN_QURAN } from "../catalogProvenance";
import type { StoredContent } from "../recordTypes";
import type { NormalizedQuranIngest, ReviewEvidence } from "./types";

/**
 * Pipeline mechanics only. The bundle below is an inert placeholder (no religious text) and is
 * never added to the published repository.
 */
function placeholderIngest(): NormalizedQuranIngest {
  const base = {
    contentId: "pipeline-placeholder",
    topicId: "topic-unpublished-fixture",
    contentType: "quran" as const,
    level: "A" as const,
    sourceId: TMN_QURAN,
    sourceReference: "0:1",
    contentOrigin: "source_text" as const,
    quran: { surah: 1, ayah: 1, edition: "test-placeholder" },
    arabic: "placeholder",
    translation: "placeholder",
    place: "placeholder",
  };
  return { ...base, textFingerprint: buildQuranFingerprint(base) };
}

const EVIDENCE: ReviewEvidence = {
  kind: "human_repository_review",
  evidenceType: "internal_snapshot",
  reviewedAt: "2026-03-28T00:00:00.000Z",
  reviewerRole: "test",
  notes: "Pipeline unit test.",
  checkedAgainst: "test-placeholder-bundle",
};

describe("P1-B ingestion / review pipeline", () => {
  it("publishes only after review with evidence", () => {
    const normalized = placeholderIngest();
    expect(normalizeQuranIngest(normalized)).toBeNull();

    const staged = { kind: "content" as const, normalized, status: "pending_review" as const };
    const reviewed = submitInternalReview(staged, EVIDENCE);
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;

    const published = publishReviewedContent(reviewed.reviewed);
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(published.record.provenance.verificationStatus).toBe("published");
    expect(published.record.provenance.reviewEvidence?.checkedAgainst).toBe("test-placeholder-bundle");
    // The pipeline returns a record; it does not publish into the runtime repository by itself.
    expect(getContentRecord("pipeline-placeholder")).toBeNull();
  });

  it("rejects review evidence that claims an external URL", () => {
    const staged = { kind: "content" as const, normalized: placeholderIngest(), status: "pending_review" as const };
    const reviewed = submitInternalReview(staged, { ...EVIDENCE, checkedAgainst: "https://example.org/page" });
    expect(reviewed.ok).toBe(false);
  });

  it("rejects pending_review and repository_demo rows for display", () => {
    const pending: StoredContent = {
      id: "pending-staging",
      type: "quran",
      topicId: "tawakkul",
      level: "A",
      published: true,
      verified: false,
      arabic: "x",
      translation: "x",
      place: "x",
      source: { name: "Quran", reference: "65:3" },
      provenance: quranProvenance({
        sourceReference: "65:3",
        surah: 65,
        ayah: 3,
        verificationStatus: "pending_review",
      }),
    };
    expect(assertDisplayableContent(pending, "A")).toBe("NOT_VERIFIED");

    const demo = {
      ...pending,
      id: "demo-staging",
      verified: true,
      provenance: quranProvenance({ sourceReference: "65:3", surah: 65, ayah: 3 }),
    };
    expect(assertDisplayableContent(demo, "A")).toBe("NOT_VERIFIED");
  });

  it("resolves tawakkul from the Quranpedia snapshot, not from a hand-typed bundle", () => {
    const record = getContentRecord("quran-talaq-3");
    expect(record?.provenance.verificationStatus).toBe("published");
    expect(record?.provenance.reviewEvidence?.evidenceType).toBe("live_api");
    expect(record?.provenance.quran?.edition).toBe("quranpedia-mushaf-1");

    const media = resolveTopicMedia("tawakkul", "A");
    expect(media.error).toBeNull();
    expect(media.content?.provenance.reviewEvidenceType).toBe("live_api");
    expect(media.content?.provenance.attributionDisclosure.length).toBeGreaterThan(10);
    expect(media.story).toBeNull();
  });

  it("fails closed when sourceReference is tampered after review", () => {
    const staged = { kind: "content" as const, normalized: placeholderIngest(), status: "pending_review" as const };
    const reviewed = submitInternalReview(staged, EVIDENCE);
    if (!reviewed.ok) throw new Error("review failed");
    reviewed.reviewed.normalized.sourceReference = "99:99";
    const pub = publishReviewedContent(reviewed.reviewed);
    expect(pub.ok).toBe(false);
  });

  it("rejects published status without review evidence", () => {
    const base = placeholderIngest();
    const bad: StoredContent = {
      id: base.contentId,
      type: "quran",
      topicId: "tawakkul",
      level: "A",
      published: true,
      verified: true,
      arabic: base.arabic,
      translation: base.translation,
      place: "x",
      source: { name: "Quran", reference: "0:1" },
      provenance: {
        sourceId: base.sourceId,
        sourceReference: "0:1",
        verificationStatus: "published",
        contentOrigin: "source_text",
        quran: base.quran,
      },
    };
    expect(assertDisplayableContent(bad, "A")).toBe("MISSING_REVIEW_EVIDENCE");
  });
});
