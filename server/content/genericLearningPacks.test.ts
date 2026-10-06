import { describe, expect, it } from "vitest";
import { runAnalyze, runJourney } from "../ai/orchestrate";
import { mockProvider } from "../ai/mockProvider";
import { getQuranEvidenceForTopic } from "./quranEvidence";
import { resolveTopicLearningPack } from "./topicLearning";
import { assessTopicPackReadiness } from "./topicPackReadiness";
import { DEMO_PUBLISHED_TOPIC_ID } from "./demoFixtures";
import { isAllowlistedSourceId } from "./sourceRegistry";
import { assertDisplayableContent } from "./contentPolicy";
import { getContentRecord } from "./catalog";

describe("generic source-backed learning packs", () => {
  it("topic A and topic B produce different published quran packs", () => {
    const patience = resolveTopicLearningPack("patience", "A", "ar");
    const hope = resolveTopicLearningPack("hope", "A", "ar");
    expect(patience.error).toBeNull();
    expect(hope.error).toBeNull();
    expect(patience.pack?.quran?.content_id).toBe("quran-zumar-10");
    expect(hope.pack?.quran?.content_id).toBe("quran-zumar-53");
    expect(patience.pack?.quran?.arabic).not.toBe(hope.pack?.quran?.arabic);
  });

  it("getQuranEvidenceForTopic is generic (no tawakkul special case)", () => {
    expect(getQuranEvidenceForTopic("patience")?.id).toBe("quran-zumar-10");
    expect(getQuranEvidenceForTopic("effort")?.id).toBe("quran-najm-39");
    expect(getQuranEvidenceForTopic("topic-unpublished-fixture")).toBeNull();
  });

  it("a topic without a published quran row fails closed", () => {
    const record = getContentRecord("quran-zumar-10");
    expect(record?.provenance.verificationStatus).toBe("published");
    const fixture = resolveTopicLearningPack("topic-unpublished-fixture", "A");
    expect(fixture.error).not.toBeNull();
    expect(fixture.pack).toBeNull();
    const readiness = assessTopicPackReadiness("topic-unpublished-fixture");
    expect(readiness.ready).toBe(false);
  });

  it("live quran items carry sourceId, reference, and live_api evidence", () => {
    const ev = getQuranEvidenceForTopic("anxiety");
    expect(ev).toBeTruthy();
    expect(isAllowlistedSourceId(ev!.provenance.sourceId)).toBe(true);
    expect(ev!.provenance.sourceReference).toBe("2:286");
    expect(ev!.provenance.reviewEvidence?.evidenceType).toBe("live_api");
    expect(assertDisplayableContent(ev!, "A", "anxiety")).toBeNull();
  });

  it("no repository_demo quran on production-only topics", () => {
    for (const topicId of ["patience", "hope", "anxiety", "grief", "loss", "effort", "nearness", "amanah", "gratitude", DEMO_PUBLISHED_TOPIC_ID]) {
      const { pack } = resolveTopicLearningPack(topicId, "A");
      expect(pack?.quran?.provenance.verificationStatus).toBe("published");
    }
  });

  it("mock experiences A–D do not all return tawakkul", async () => {
    const inputs = [
      "بدأت وظيفة جديدة وأنا سعيد لكن خايف من المسؤولية.",
      "جتني نعمة كنت أنتظرها من زمان وفرحت فيها جدًا.",
      "فشلت في شيء كنت أتمنى أنجح فيه.",
      "محتار بين قرارين مهمين.",
    ];
    const sets = await Promise.all(
      inputs.map(async (message) => {
        const r = await runAnalyze({ message, language: "ar", context: [] }, mockProvider);
        if (!r.ok || !("analyze" in r)) return "";
        return r.analyze.suggested_topics.map((t) => t.id).sort().join(",");
      }),
    );
    const unique = new Set(sets);
    expect(unique.size).toBeGreaterThan(1);
    expect(sets.every((s) => s === "tawakkul,effort,amanah")).toBe(false);
  });

  it("insufficient_reference when journey topic lacks published quran", async () => {
    const journey = await runJourney(
      {
        message: "test",
        language: "ar",
        context: [],
        topicId: "topic-unpublished-fixture",
        analyzeLevel: "A",
      },
      mockProvider,
    );
    expect(journey.ok).toBe(false);
    if (journey.ok) return;
    expect(journey.error).toBe("insufficient_reference");
  });
});
