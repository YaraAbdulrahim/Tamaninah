import { describe, expect, it } from "vitest";
import { runJourney } from "../ai/orchestrate";
import { mockProvider } from "../ai/mockProvider";
import { getContentRecord } from "./catalog";
import { assertDisplayableContent } from "./contentPolicy";
import { DEMO_PUBLISHED_TOPIC_ID } from "./demoFixtures";
import { getHadithEvidenceForTopic } from "./hadithEvidence";
import { getQuranEvidenceForTopic } from "./quranEvidence";
import { dorarHadithAdapterStatus } from "./connectors/dorarHadith";
import { getTopicPackSlotReadiness } from "./topicPackSlots";
import { resolveTopicLearningPack } from "./topicLearning";
import { getTopicQuranAnchor } from "./topicQuranAnchors";

describe("patience topic pack (honest, non-tawakkul)", () => {
  it("patience is not tawakkul and uses generic quran anchor", () => {
    expect(getTopicQuranAnchor("patience")?.contentId).toBe("quran-zumar-10");
    expect(getTopicQuranAnchor("patience")?.topicId).not.toBe(DEMO_PUBLISHED_TOPIC_ID);
  });

  it("resolves journey pack with published quran only", () => {
    const { pack, error } = resolveTopicLearningPack("patience", "A", "ar");
    expect(error).toBeNull();
    expect(pack?.quran?.content_id).toBe("quran-zumar-10");
    expect(pack?.quran?.provenance.reviewEvidenceType).toBe("live_api");
    expect(pack?.hadith?.content_id).toBe("hadith-bukhari-1469");
    expect(pack?.quranExplanation?.content_id).toBe("tafsir-tabari-39-10");
    expect(pack?.story?.story_id).toBe("seerah-bukhari-1283");
    expect(pack?.hadithExplanation).toBeNull();
    expect(pack?.reflectionQuestion.ar.length).toBeGreaterThan(5);
  });

  it("quran evidence comes from published repository / quranpedia path", () => {
    const record = getQuranEvidenceForTopic("patience");
    expect(record?.provenance.sourceId).toBe("tmn-src-quran-mushaf");
    expect(record?.provenance.sourceReference).toBe("39:10");
    expect(record?.provenance.reviewEvidence?.evidenceType).toBe("live_api");
  });

  it("hadith comes from the Sahih al-Bukhari snapshot (Dorar adapter stays unused)", () => {
    expect(dorarHadithAdapterStatus()).toBe("license_clarification_needed");
    const hadith = getHadithEvidenceForTopic("patience");
    expect(hadith?.provenance.sourceId).toBe("tmn-src-hadith-bukhari-shamela");
    expect(hadith?.provenance.hadith).toMatchObject({ collection: "صحيح البخاري", number: 1469, grade: "صحيح" });
    expect(hadith?.provenance.hadith?.url).toBe("https://shamela.ws/book/1681/2367");
    const readiness = getTopicPackSlotReadiness("patience");
    expect(readiness.slots.hadith.state).toBe("READY");
    expect(readiness.slots.hadith.evidenceType).toBe("source_page");
  });

  it("attaches only patience's own verbatim Seerah passage (no cross-topic or editorial story)", () => {
    const { pack } = resolveTopicLearningPack("patience", "A");
    expect(pack?.story?.topicId).toBe("patience");
    expect(pack?.story?.lessons).toEqual([]);
    expect(pack?.story?.takeaway).toBe("");
  });

  it("quran explanation is a verbatim Tabari excerpt; no hadith explanation is invented", () => {
    const readiness = getTopicPackSlotReadiness("patience");
    expect(readiness.slots.quran_explanation.state).toBe("READY");
    expect(readiness.slots.quran_explanation.sourceId).toBe("tmn-src-tafsir-tabari");
    expect(readiness.slots.hadith_explanation.state).toBe("NOT_READY");
    expect(readiness.slots.story.state).toBe("READY");
    expect(readiness.fullReligiousPack).toBe(false);
    expect(readiness.journeyEligible).toBe(true);
  });

  it("serves published quran overlay for patience (not catalog demo path)", () => {
    const published = getQuranEvidenceForTopic("patience");
    expect(published?.provenance.verificationStatus).toBe("published");
    expect(getContentRecord("quran-zumar-10")?.provenance.verificationStatus).toBe("published");
  });

  it("repository_demo would be blocked for patience journey if it were the only row", () => {
    const demoOnly = getContentRecord("quran-zumar-10");
    if (!demoOnly) throw new Error("missing fixture");
    const spoofDemo = {
      ...demoOnly,
      provenance: { ...demoOnly.provenance, verificationStatus: "repository_demo" as const },
    };
    expect(assertDisplayableContent(spoofDemo, "A", "patience")).toBe("NOT_VERIFIED");
  });

  it("journey for patience does not fallback to tawakkul", async () => {
    const journey = await runJourney(
      {
        message: "أحتاج صبرًا مع تجربة صعبة",
        language: "ar",
        context: [],
        topicId: "patience",
        analyzeLevel: "A",
      },
      mockProvider,
    );
    expect(journey.ok).toBe(true);
    if (!journey.ok) return;
    expect(journey.payload.topic_id).toBe("patience");
    expect(journey.payload.content?.content_id).toBe("quran-zumar-10");
    expect(journey.payload.hadith?.content_id).toBe("hadith-bukhari-1469");
    expect(journey.payload.pack_slots?.find((s) => s.key === "quran")?.ready).toBe(true);
    expect(journey.payload.pack_slots?.find((s) => s.key === "hadith")?.ready).toBe(true);
    expect(journey.payload.pack_slots?.find((s) => s.key === "story")?.ready).toBe(true);
    expect(journey.payload.story?.story_id).toBe("seerah-bukhari-1283");
  });

  it("new topic can reuse orchestration without core edits", () => {
    const anchor = getTopicQuranAnchor("hope");
    expect(anchor?.topicId).toBe("hope");
    const { error } = resolveTopicLearningPack("hope", "A");
    expect(error).toBeNull();
  });

  it("published quran items expose sourceId reference and provenance", () => {
    const q = getQuranEvidenceForTopic("patience");
    expect(q?.provenance.sourceId).toBeTruthy();
    expect(q?.provenance.sourceReference).toMatch(/^\d+:\d+$/);
    expect(q?.provenance.reviewEvidence?.checkedAgainst).toContain("api-v1-mushafs");
  });
});
