import { describe, expect, it } from "vitest";
import {
  SOURCE_REGISTRY,
  getRegistrySource,
  isContentTypeAllowedForSource,
  isRegistrySourceApproved,
  isScriptureAttributionSource,
} from "./sourceRegistry";
import { assertProvenanceForContent } from "./provenance";
import { quranProvenance, TMN_HADITH, TMN_QURAN } from "./catalogProvenance";
import { publishedQuranProvenance, TEST_PUBLISHED_REVIEW } from "./testPublishedProvenance";
import type { StoredContent } from "./catalog";
import { assertDisplayableContent } from "./contentPolicy";
import { resolveTopicMedia } from "./whitelist";

describe("source registry", () => {
  it("lists only pre-approved project sources", () => {
    expect(SOURCE_REGISTRY.every((s) => s.sourceId.startsWith("tmn-src-"))).toBe(true);
    expect(getRegistrySource("tmn-src-quran-mushaf")?.status).toBe("approved");
  });

  it("binds content types to sources explicitly", () => {
    expect(isContentTypeAllowedForSource(TMN_QURAN, "quran")).toBe(true);
    expect(isContentTypeAllowedForSource(TMN_QURAN, "hadith")).toBe(false);
    expect(isContentTypeAllowedForSource(TMN_HADITH, "hadith")).toBe(true);
  });

  it("displays tawakkul's verse from the Quranpedia snapshot — no story", () => {
    const result = resolveTopicMedia("tawakkul", "A");
    expect(result.error).toBeNull();
    expect(result.content?.provenance.sourceId).toBe(TMN_QURAN);
    expect(result.content?.provenance.verificationStatus).toBe("published");
    expect(result.content?.provenance.reviewCheckedAgainst).toBe("api-v1-mushafs-1-65-3");
    expect(result.content?.provenance.reviewEvidenceType).toBe("live_api");
    expect(result.content?.provenance.quran?.surah).toBe(65);
    expect(result.content?.provenance.contentOrigin).toBe("source_text");
    expect(result.story).toBeNull();
  });

  it("registers the Sahihayn editions and the early tafsir as scripture-attribution sources", () => {
    for (const [id, type] of [
      ["tmn-src-hadith-bukhari-shamela", "hadith"],
      ["tmn-src-hadith-muslim-shamela", "hadith"],
      ["tmn-src-tafsir-tabari", "tafsir"],
    ] as const) {
      expect(getRegistrySource(id)?.status).toBe("approved");
      expect(getRegistrySource(id)?.allowedContentTypes).toContain(type);
      expect(getRegistrySource(id)?.allowedContentTypes).not.toContain("concept");
      expect(isScriptureAttributionSource(id)).toBe(true);
    }
    expect(isContentTypeAllowedForSource("tmn-src-tafsir-tabari", "concept")).toBe(false);
    expect(isContentTypeAllowedForSource("tmn-src-hadith-bukhari-shamela", "concept")).toBe(false);
    // Seerah: Sirat Ibn Hisham (seerah only) and Bukhari's Seerah narrations (hadith + seerah).
    expect(getRegistrySource("tmn-src-seerah-ibn-hisham-shamela")?.allowedContentTypes).toEqual(["seerah"]);
    expect(isScriptureAttributionSource("tmn-src-seerah-ibn-hisham-shamela")).toBe(true);
    expect(getRegistrySource("tmn-src-hadith-bukhari-shamela")?.allowedContentTypes).toEqual(["hadith", "seerah"]);
    expect(getRegistrySource("tmn-src-hadith-muslim-shamela")?.allowedContentTypes).toEqual(["hadith"]);
    expect(isScriptureAttributionSource("tmn-src-concept-dawa")).toBe(false);
    expect(isScriptureAttributionSource("tmn-src-islamic-content")).toBe(false);
  });
});

describe("provenance enforcement", () => {
  const base = (): StoredContent => ({
    id: "fixture",
    type: "quran",
    topicId: "grief",
    level: "A",
    published: true,
    verified: true,
    arabic: "x",
    translation: "x",
    place: "x",
    source: { name: "Quran", reference: "1:1" },
    provenance: publishedQuranProvenance("1:1", 1, 1),
  });

  it("passes approved source + allowed type + valid provenance", () => {
    expect(assertDisplayableContent(base(), "A")).toBeNull();
  });

  it("fails closed on unknown sourceId", () => {
    const bad = {
      ...base(),
      provenance: { ...base().provenance, sourceId: "unknown-src" },
    };
    expect(assertDisplayableContent(bad, "A")).toBe("UNKNOWN_SOURCE_ID");
  });

  it("fails when source is not allowed for content type", () => {
    const bad = {
      ...base(),
      provenance: { ...base().provenance, sourceId: TMN_HADITH },
    };
    expect(assertDisplayableContent(bad, "A")).toBe("SOURCE_TYPE_MISMATCH");
  });

  it("fails on missing sourceReference when required", () => {
    const bad = {
      ...base(),
      provenance: { ...base().provenance, sourceReference: "  " },
    };
    expect(assertDisplayableContent(bad, "B")).toBe("SOURCE_REFERENCE_MISSING");
  });

  it("fails on invalid verificationStatus", () => {
    const bad = {
      ...base(),
      verified: false,
      provenance: quranProvenance({
        sourceReference: "1:1",
        surah: 1,
        ayah: 1,
        verificationStatus: "rejected",
      }),
    };
    expect(assertDisplayableContent(bad, "A")).toBe("NOT_VERIFIED");
  });

  it("rejects AI-style source_text misuse on concept type", () => {
    const conceptLike: StoredContent = {
      ...base(),
      type: "concept",
      provenance: {
        sourceId: "tmn-src-concept-dawa",
        sourceReference: "term-1",
        verificationStatus: "published",
        contentOrigin: "source_text",
        reviewEvidence: TEST_PUBLISHED_REVIEW,
      },
    };
    expect(assertProvenanceForContent("concept", conceptLike.provenance, "grief")).toBe(
      "EVIDENCE_ORIGIN_MISMATCH",
    );
  });

  it("rejects reviewed_explanation posing as quran source_text", () => {
    const bad = {
      ...base(),
      provenance: { ...base().provenance, contentOrigin: "reviewed_explanation" as const },
    };
    expect(assertProvenanceForContent("quran", bad.provenance, "grief")).toBe("EVIDENCE_ORIGIN_MISMATCH");
  });

  it("fails on incomplete quran provenance", () => {
    const bad = {
      ...base(),
      provenance: {
        ...base().provenance,
        quran: undefined,
      },
    };
    expect(assertProvenanceForContent("quran", bad.provenance, "grief")).toBe("INCOMPLETE_PROVENANCE");
  });

  it("does not allow spoofing sourceId via legacy name-only records", () => {
    expect(isRegistrySourceApproved("tmn-src-quran-mushaf")).toBe(true);
    expect(isRegistrySourceApproved("fake-quran")).toBe(false);
  });
});

describe("PDF-named sources in the registry", () => {
  it("approves the challenge reference itself and Bayyinat as reference-only sources", () => {
    for (const id of ["tmn-src-challenge-reference", "tmn-src-bayyinat"]) {
      const entry = getRegistrySource(id);
      expect(entry?.status).toBe("approved");
      expect(entry?.allowedContentTypes).toEqual([]);
    }
  });

  it("covers the dorar.net tafseer / aqeeda / feqhia domains named in the PDF", () => {
    const catalogs = SOURCE_REGISTRY.map((s) => s.referenceCatalog);
    for (const path of ["dorar.net/tafseer", "dorar.net/aqeeda", "dorar.net/feqhia", "dorar.net/hadith", "dorar.net/history"]) {
      expect(catalogs).toContain(path);
    }
  });

  it("reference-only entries cannot carry displayable catalog content", () => {
    for (const id of ["tmn-src-tafseer-dorar", "tmn-src-aqeeda-dorar", "tmn-src-fiqh-dorar"]) {
      expect(isContentTypeAllowedForSource(id, "quran")).toBe(false);
      expect(isContentTypeAllowedForSource(id, "concept")).toBe(false);
    }
  });
});
