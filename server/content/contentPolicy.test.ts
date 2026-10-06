import { describe, expect, it } from "vitest";
import type { StoredContent, StoredStory } from "./catalog";
import { assertDisplayableContent, assertDisplayableStory } from "./contentPolicy";
import { publishedQuranProvenance, publishedStoryProvenance } from "./testPublishedProvenance";
import { resolveTopicMedia } from "./whitelist";
import { runJourney } from "../ai/orchestrate";
import { mockProvider } from "../ai/mockProvider";

const baseContent = (): StoredContent => ({
  id: "fixture-quran",
  type: "quran",
  topicId: "grief",
  level: "A",
  published: true,
  verified: true,
  arabic: "test",
  translation: "test",
  place: "test",
  source: { name: "Quran", reference: "1:1" },
  provenance: publishedQuranProvenance("1:1", 1, 1),
});

describe("content policy (P0.2 + P1-A)", () => {
  it("allows published verified Quran with registry provenance", () => {
    expect(assertDisplayableContent(baseContent(), "A")).toBeNull();
  });

  it("rejects unpublished and unverified records", () => {
    expect(assertDisplayableContent({ ...baseContent(), published: false }, "A")).toBe("NOT_PUBLISHED");
    expect(assertDisplayableContent({ ...baseContent(), verified: false }, "A")).toBe("NOT_VERIFIED");
  });

  it("applies level C policy — A catalog record cannot serve a C journey", () => {
    expect(assertDisplayableContent(baseContent(), "C")).toBe("LEVEL_POLICY_VIOLATION");
    const result = resolveTopicMedia("grief", "C");
    expect(result.content).toBeNull();
    expect(result.error).toBe("INSUFFICIENT_REFERENCE");
  });

  it("allows level B journey when sourceReference is present in provenance", () => {
    expect(assertDisplayableContent(baseContent(), "B")).toBeNull();
    const result = resolveTopicMedia("patience", "B");
    expect(result.error).toBeNull();
    expect(result.content?.level).toBe("A");
  });

  it("blocks level B journey when sourceReference is missing", () => {
    const noRef = {
      ...baseContent(),
      provenance: { ...baseContent().provenance, sourceReference: "" },
    };
    expect(assertDisplayableContent(noRef, "B")).toBe("SOURCE_REFERENCE_MISSING");
  });

  it("allows Seerah story with registry provenance", () => {
    const story: StoredStory = {
      id: "fixture-story",
      topicId: "effort",
      level: "A",
      published: true,
      verified: true,
      title: "t",
      headline: "h",
      opening: "o",
      body: ["b"],
      lessons: ["l"],
      takeaway: "t",
      keep: "k",
      source: { name: "Seerah", reference: "ref" },
      provenance: publishedStoryProvenance("ref"),
    };
    expect(assertDisplayableStory(story, "A")).toBeNull();
  });
});

describe("client level trust on journey", () => {
  it("does not grant A journey when message escalates to level C", async () => {
    const result = await runJourney(
      {
        message: "هذه مسألة خلافية بين العلماء وأحتاج فهمًا",
        language: "ar",
        context: [],
        topicId: "tawakkul",
        analyzeLevel: "A",
      },
      mockProvider,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("insufficient_reference");
  });

  it("requires referral for explicit level C referral patterns even if client sends A", async () => {
    const result = await runJourney(
      {
        message: "أي مذهب أتبع في هذا الخلاف؟",
        language: "ar",
        context: [],
        topicId: "tawakkul",
        analyzeLevel: "A",
      },
      mockProvider,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("referral_required");
  });
});
