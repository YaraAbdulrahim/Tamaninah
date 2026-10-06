import { describe, expect, it } from "vitest";
import { runDirectLearning, runJourney } from "../ai/orchestrate";
import { mockProvider } from "../ai/mockProvider";
import { repositoryOnlyProvider } from "../ai/repositoryOnlyProvider";
import * as prompts from "../ai/prompts";
import { assertDisplayableContent, assertDisplayableStory } from "./contentPolicy";
import { getContentRecord } from "./catalog";
import { DEMO_PUBLISHED_TOPIC_ID } from "./demoFixtures";
import { isDisplayableVerification } from "./provenance";
import { awaitQuranPublishedWarm, scheduleQuranPublishedWarm } from "./quranPublishedWarm";
import { resolveTopicLearningPack } from "./topicLearning";
import { publishedQuranProvenance, publishedStoryProvenance } from "./testPublishedProvenance";
import type { StoredContent, StoredStory } from "./recordTypes";
import { resolveTopicMedia } from "./whitelist";
import { retrieveVerified } from "./retrieve";
import { isAllowlistedSourceId } from "./sourceRegistry";

describe("production religious display gate", () => {
  it("repository_demo is never displayable to users", () => {
    expect(isDisplayableVerification("repository_demo")).toBe(false);
    const catalogDemo = getContentRecord("quran-fixture-demo");
    expect(catalogDemo?.provenance.verificationStatus).toBe("repository_demo");
    expect(assertDisplayableContent(catalogDemo!, "A", "grief")).toBe("NOT_VERIFIED");
    // grief now resolves only to its published Quranpedia row.
    expect(resolveTopicMedia("grief", "A").content?.provenance.verificationStatus).toBe("published");
  });

  it("blocks content without allowlisted sourceId", () => {
    const row: StoredContent = {
      id: "x",
      type: "quran",
      topicId: "patience",
      level: "A",
      published: true,
      verified: true,
      arabic: "x",
      translation: "x",
      place: "x",
      source: { name: "Quran", reference: "1:1" },
      provenance: publishedQuranProvenance("1:1", 1, 1),
    };
    row.provenance.sourceId = "tmn-src-unknown";
    expect(assertDisplayableContent(row, "A", "patience")).toBe("UNKNOWN_SOURCE_ID");
  });

  it("blocks content without sourceReference", () => {
    const row: StoredContent = {
      id: "x",
      type: "quran",
      topicId: "patience",
      level: "A",
      published: true,
      verified: true,
      arabic: "x",
      translation: "x",
      place: "x",
      source: { name: "Quran", reference: "" },
      provenance: { ...publishedQuranProvenance("1:1", 1, 1), sourceReference: "" },
    };
    expect(assertDisplayableContent(row, "A", "patience")).toBe("SOURCE_REFERENCE_MISSING");
  });

  it("blocks unverified records", () => {
    const row: StoredContent = {
      id: "x",
      type: "quran",
      topicId: "patience",
      level: "A",
      published: true,
      verified: false,
      arabic: "x",
      translation: "x",
      place: "x",
      source: { name: "Quran", reference: "1:1" },
      provenance: publishedQuranProvenance("1:1", 1, 1),
    };
    expect(assertDisplayableContent(row, "A", "patience")).toBe("NOT_VERIFIED");
  });

  it("retrieveVerified rejects repository_demo content ids", () => {
    const out = retrieveVerified({ content_ids: ["quran-fixture-demo"] }, "A");
    expect(out.content).toBeNull();
    expect(out.error).toBe("INSUFFICIENT_REFERENCE");
  });

  it("resolveTopicLearningPack uses the same published gate as resolveTopicMedia", () => {
    for (const topicId of ["grief", "patience", "loss", "amanah"]) {
      const pack = resolveTopicLearningPack(topicId, "A");
      const media = resolveTopicMedia(topicId, "A");
      expect(pack.error).toBeNull();
      expect(media.content?.content_id).toBe(pack.pack!.quran!.content_id);
      expect(isAllowlistedSourceId(pack.pack!.quran!.provenance.sourceId)).toBe(true);
    }
    expect(resolveTopicLearningPack("topic-unpublished-fixture", "A").error).toBe("TOPIC_NOT_FOUND");
  });

  it("runJourney works without an AI provider (repository-only)", async () => {
    const result = await runJourney(
      {
        message: "test",
        language: "ar",
        context: [],
        topicId: DEMO_PUBLISHED_TOPIC_ID,
        analyzeLevel: "A",
      },
      repositoryOnlyProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.response).toEqual([]);
    expect(result.payload.content?.provenance.verificationStatus).toBe("published");
  });

  it("runDirectLearning works without an AI provider", async () => {
    const result = await runDirectLearning(
      {
        message: "وش معنى التوكل",
        language: "ar",
        context: [],
        topicId: DEMO_PUBLISHED_TOPIC_ID,
        analyzeLevel: "A",
      },
      repositoryOnlyProvider,
    );
    expect(result.ok).toBe(true);
  });

  it("runJourney never returns AI religious prose", async () => {
    const result = await runJourney(
      {
        message: "انقبلت في وظيفة",
        language: "ar",
        context: [],
        topicId: DEMO_PUBLISHED_TOPIC_ID,
        analyzeLevel: "A",
      },
      repositoryOnlyProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.response).toEqual([]);
    expect(result.payload.remember).toBe("");
    expect(result.payload.heading).toBe("");
  });

  it("legacy journey personalization prompts are removed from production exports", () => {
    expect("JOURNEY_SYSTEM_PROMPT" in prompts).toBe(false);
    expect("journeyUserPrompt" in prompts).toBe(false);
    expect("personalizePrompt" in prompts).toBe(false);
  });

  it("mock provider rejects journey stage (no religious prose path)", async () => {
    await expect(
      mockProvider.complete([{ role: "user", content: JSON.stringify({ stage: "journey", message: "x" }) }]),
    ).rejects.toThrow(/analyze-only/i);
  });

  it("no journey fallback to tawakkul when another topic is requested", async () => {
    const result = await runJourney(
      {
        message: "test",
        language: "ar",
        context: [],
        topicId: "patience",
        analyzeLevel: "A",
      },
      repositoryOnlyProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.topic_id).toBe("patience");
    expect(result.payload.content?.content_id).toBe("quran-zumar-10");
  });

  it("tawakkul's verse comes from the Quranpedia snapshot like every other topic", () => {
    const pack = resolveTopicLearningPack(DEMO_PUBLISHED_TOPIC_ID, "A");
    expect(pack.pack?.quran?.content_id).toBe("quran-talaq-3");
    expect(pack.pack?.quran?.provenance.reviewEvidenceType).toBe("live_api");
  });

  it("quran warm scheduling is safe in vitest (no network)", async () => {
    scheduleQuranPublishedWarm();
    await awaitQuranPublishedWarm();
    expect(resolveTopicLearningPack("patience", "A").error).toBeNull();
  });

  it("published story requires published verification", () => {
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
    expect(assertDisplayableStory(story, "A", "effort")).toBeNull();
    const demoStory = {
      ...story,
      provenance: { ...story.provenance, verificationStatus: "repository_demo" as const },
    };
    expect(assertDisplayableStory(demoStory, "A", "effort")).toBe("NOT_VERIFIED");
  });

  it("catalog repository_demo quran fails display even when verified flag is true", () => {
    const demo = getContentRecord("quran-fixture-demo");
    expect(demo).toBeTruthy();
    expect(assertDisplayableContent(demo!, "A", "hope")).toBe("NOT_VERIFIED");
  });
});
