import { describe, expect, it } from "vitest";
import {
  assertPublishedIntegrity,
  assertPublishedStoryIntegrity,
  attributionDisclosure,
  sourceIdIsNotExternalVerification,
} from "./provenanceIntegrity";
import {
  assertProvenanceForContent,
  type StoryProvenance,
} from "./provenance";
import { getContentRecord } from "./catalog";
import type { StoredContent } from "./recordTypes";

const publishedQuranEvidence = {
  kind: "human_repository_review" as const,
  evidenceType: "internal_snapshot" as const,
  reviewedAt: "2026-03-28T00:00:00.000Z",
  reviewerRole: "content_steward",
  notes: "Internal bundle match.",
  checkedAgainst: "tmn-static-mushaf-bundle-v1:65:3",
};

const liveApiQuranEvidence = {
  kind: "human_repository_review" as const,
  evidenceType: "live_api" as const,
  reviewedAt: "2026-03-28T00:00:00.000Z",
  reviewerRole: "connector:quranpedia",
  notes: "Allowlisted API ingest.",
  checkedAgainst: "api-v1-mushafs-1-39-10",
};

describe("P1-B.1 provenance integrity", () => {
  it("sourceId alone does not imply external verification", () => {
    expect(sourceIdIsNotExternalVerification("tmn-src-seerah-dorar")).toBe(true);
    const disclosure = attributionDisclosure("en", {
      sourceId: "tmn-src-seerah-dorar",
      contentOrigin: "reviewed_explanation",
    });
    expect(disclosure.toLowerCase()).not.toContain("verified from");
    expect(disclosure.toLowerCase()).toContain("editorial");
  });

  it("internal snapshot is not presented as external source evidence", () => {
    const err = assertPublishedIntegrity("quran", "source_text", {
      sourceId: "tmn-src-quran-mushaf",
      sourceReference: "65:3",
      verificationStatus: "published",
      contentOrigin: "source_text",
      quran: { surah: 65, ayah: 3 },
      reviewEvidence: {
        ...publishedQuranEvidence,
        checkedAgainst: "https://dorar.net/example",
      },
    });
    expect(err).toBe("EXTERNAL_CLAIM_RISK");

    const ok = assertPublishedIntegrity("quran", "source_text", {
      sourceId: "tmn-src-quran-mushaf",
      sourceReference: "65:3",
      verificationStatus: "published",
      contentOrigin: "source_text",
      quran: { surah: 65, ayah: 3 },
      reviewEvidence: publishedQuranEvidence,
    });
    expect(ok).toBeNull();
  });

  it("live_api evidence is valid for published quran source_text", () => {
    const ok = assertPublishedIntegrity("quran", "source_text", {
      sourceId: "tmn-src-quran-mushaf",
      sourceReference: "39:10",
      verificationStatus: "published",
      contentOrigin: "source_text",
      quran: { surah: 39, ayah: 10 },
      reviewEvidence: liveApiQuranEvidence,
    });
    expect(ok).toBeNull();
    const disclosure = attributionDisclosure("en", {
      sourceId: "tmn-src-quran-mushaf",
      contentOrigin: "source_text",
      evidenceType: "live_api",
    });
    expect(disclosure.toLowerCase()).toContain("api");
  });

  it("editorial reviewed_explanation cannot publish as source_text quran", () => {
    const err = assertPublishedIntegrity("quran", "reviewed_explanation", {
      sourceId: "tmn-src-quran-mushaf",
      sourceReference: "65:3",
      verificationStatus: "published",
      contentOrigin: "reviewed_explanation",
      quran: { surah: 65, ayah: 3 },
      reviewEvidence: {
        kind: "human_repository_review",
        evidenceType: "editorial_internal",
        reviewedAt: "2026-03-28T00:00:00.000Z",
        reviewerRole: "content_steward",
        notes: "Editorial only.",
        checkedAgainst: "tmn-editorial-seerah-taif-v1",
      },
    });
    expect(err).toBe("EVIDENCE_ORIGIN_MISMATCH");
  });

  it("changing sourceId does not auto-verify content", () => {
    const base: StoredContent = {
      id: "quran-talaq-3",
      type: "quran",
      topicId: "tawakkul",
      level: "A",
      published: true,
      verified: true,
      arabic: "x",
      translation: "x",
      place: "x",
      source: { name: "Quran", reference: "65:3" },
      provenance: {
        sourceId: "tmn-src-quran-mushaf",
        sourceReference: "65:3",
        verificationStatus: "published",
        contentOrigin: "source_text",
        quran: { surah: 65, ayah: 3 },
        reviewEvidence: publishedQuranEvidence,
      },
    };
    const spoofed = {
      ...base,
      provenance: { ...base.provenance, sourceId: "tmn-src-seerah-dorar" },
    };
    expect(assertProvenanceForContent("quran", spoofed.provenance, "tawakkul")).toBe("SOURCE_TYPE_MISMATCH");
  });

  it("published status still requires integrity policy", () => {
    const badEvidence = {
      kind: "human_repository_review" as const,
      evidenceType: "editorial_internal" as const,
      reviewedAt: "2026-03-28T00:00:00.000Z",
      reviewerRole: "content_steward",
      notes: "Wrong type for mushaf text.",
      checkedAgainst: "tmn-static-mushaf-bundle-v1:65:3",
    };
    expect(
      assertProvenanceForContent(
        "quran",
        {
          sourceId: "tmn-src-quran-mushaf",
          sourceReference: "65:3",
          verificationStatus: "published",
          contentOrigin: "source_text",
          quran: { surah: 65, ayah: 3 },
          reviewEvidence: badEvidence,
        },
        "tawakkul",
      ),
    ).toBe("EVIDENCE_ORIGIN_MISMATCH");
  });

  it("record without sufficient evidence cannot claim stronger proof", () => {
    expect(
      assertProvenanceForContent(
        "quran",
        {
          sourceId: "tmn-src-quran-mushaf",
          sourceReference: "65:3",
          verificationStatus: "published",
          contentOrigin: "source_text",
          quran: { surah: 65, ayah: 3 },
        },
        "tawakkul",
      ),
    ).toBe("MISSING_REVIEW_EVIDENCE");

    const dorarCover: StoryProvenance = {
      sourceId: "tmn-src-seerah-dorar",
      sourceReference: "taif",
      verificationStatus: "published",
      contentOrigin: "reviewed_explanation",
      seerah: { sourceReference: "taif" },
      reviewEvidence: {
        kind: "human_repository_review",
        evidenceType: "editorial_internal",
        reviewedAt: "2026-03-28T00:00:00.000Z",
        reviewerRole: "content_steward",
        notes: "Editorial snapshot only.",
        checkedAgainst: "tmn-editorial-seerah-taif-v1",
      },
    };
    expect(assertPublishedStoryIntegrity(dorarCover)).toBe("EVIDENCE_ORIGIN_MISMATCH");

    const editorialStory: StoryProvenance = {
      sourceId: "tmn-src-concept-dawa",
      sourceReference: "learning-narrative",
      verificationStatus: "published",
      contentOrigin: "reviewed_explanation",
      seerah: { sourceReference: "taif-frame" },
      reviewEvidence: {
        kind: "human_repository_review",
        evidenceType: "editorial_internal",
        reviewedAt: "2026-03-28T00:00:00.000Z",
        reviewerRole: "content_steward",
        notes: "Editorial learning narrative.",
        checkedAgainst: "tmn-editorial-seerah-taif-v1",
      },
    };
    expect(assertPublishedStoryIntegrity(editorialStory)).toBeNull();
  });

  it("quran-talaq-3 is published from the Quranpedia snapshot (live_api evidence)", () => {
    const record = getContentRecord("quran-talaq-3");
    expect(record?.provenance.reviewEvidence?.evidenceType).toBe("live_api");
    if (record) {
      expect(assertProvenanceForContent("quran", record.provenance, "tawakkul")).toBeNull();
    }
  });
});
