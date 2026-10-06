import { describe, expect, it } from "vitest";
import { runAnalyze, runJourney } from "../ai/orchestrate";
import { mockProvider } from "../ai/mockProvider";
import { assertDisplayableContent } from "./contentPolicy";
import { DEMO_PUBLISHED_TOPIC_ID } from "./demoFixtures";
import { publishedTopicIds } from "./topics";
import { resolveTopicLearningPack } from "./topicLearning";
import { isAllowlistedSourceId } from "./sourceRegistry";
import { validateAnalyze } from "../../shared/experience/validate";
import { quranProvenance } from "./catalogProvenance";
import { publishedQuranProvenance } from "./testPublishedProvenance";
import type { StoredContent } from "./recordTypes";

describe("product governance — AI vs repository", () => {
  it("Test 1: AI suggests valid topic IDs", async () => {
    const result = await runAnalyze(
      {
        message: "انقبلت في وظيفة جديدة، فرحان جدًا لكن خايف ما أكون قد المسؤولية.",
        language: "ar",
        context: [],
      },
      mockProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !("analyze" in result)) return;
    const allowed = new Set(publishedTopicIds());
    expect(result.analyze.suggested_topics.length).toBeGreaterThanOrEqual(2);
    expect(result.analyze.suggested_topics.every((t) => allowed.has(t.id))).toBe(true);
    expect(result.analyze.suggested_topics.some((t) => t.id === "tawakkul" || t.id === "amanah" || t.id === "effort")).toBe(true);
  });

  it("mock analyze suggests different topics for gratitude vs failure inputs", async () => {
    const joy = await runAnalyze(
      { message: "جتني نعمة كنت أنتظرها من زمان وفرحت فيها جدًا.", language: "ar", context: [] },
      mockProvider,
    );
    const fail = await runAnalyze(
      { message: "فشلت في شيء كنت أتمنى أنجح فيه وأحس بالإحباط.", language: "ar", context: [] },
      mockProvider,
    );
    if (!joy.ok || !("analyze" in joy) || !fail.ok || !("analyze" in fail)) throw new Error("analyze failed");
    const joyIds = joy.analyze.suggested_topics.map((t) => t.id).sort().join(",");
    const failIds = fail.analyze.suggested_topics.map((t) => t.id).sort().join(",");
    expect(joyIds).not.toBe(failIds);
  });

  it("mock analyze returns insufficient for zakat when no catalog topic exists", async () => {
    const result = await runAnalyze(
      { message: "وش معنى الزكاة في الإسلام؟", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("insufficient_reference");
  });

  it("Test 2: analyze rejects scripture text instead of topic IDs", () => {
    const bad = validateAnalyze({
      context_summary: "فرح وخوف.",
      level: "A",
      safety: "safe",
      suggested_topics: [
        { id: "tawakkul", title: "﴿وَمَن يَتَوَكَّلْ﴾", reason: "آية" },
        { id: "effort", title: "السعي", reason: "ok" },
      ],
    });
    expect(bad).toBeNull();
  });

  it("Test 3: content without allowlisted sourceId fails display", () => {
    const record: StoredContent = {
      id: "x",
      type: "quran",
      topicId: "grief",
      level: "A",
      published: true,
      verified: true,
      arabic: "x",
      translation: "x",
      place: "x",
      source: { name: "Q", reference: "1:1" },
      provenance: { ...publishedQuranProvenance("1:1", 1, 1), sourceId: "fake-src" },
    };
    expect(isAllowlistedSourceId("fake-src")).toBe(false);
    expect(assertDisplayableContent(record, "A")).toBe("UNKNOWN_SOURCE_ID");
  });

  it("Test 4: published but not verified does not display", () => {
    const record: StoredContent = {
      id: "x",
      type: "quran",
      topicId: "patience",
      level: "A",
      published: true,
      verified: false,
      arabic: "x",
      translation: "x",
      place: "x",
      source: { name: "Q", reference: "1:1" },
      provenance: quranProvenance({ sourceReference: "1:1", surah: 1, ayah: 1, verificationStatus: "pending_review" }),
    };
    expect(assertDisplayableContent(record, "A")).toBe("NOT_VERIFIED");
  });

  it("Test 5: non-allowlisted source blocks topic learning", () => {
    expect(isAllowlistedSourceId("tmn-src-quran-mushaf")).toBe(true);
    expect(isAllowlistedSourceId("openai-knowledge")).toBe(false);
  });

  it("Test 6: fail closed when topic lacks verified quran", () => {
    const pack = resolveTopicLearningPack("topic-unpublished-fixture", "A");
    expect(pack.error).toBe("TOPIC_NOT_FOUND");
  });

  it("Test 7: level D returns referral", async () => {
    const result = await runAnalyze(
      { message: "هل زواجي صحيح شرعًا؟", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("referral" in result).toBe(true);
  });

  it("Test 8: out-of-scope practical question does not force Islamic topics", async () => {
    const result = await runAnalyze(
      { message: "كيف أصلح سيارتي إذا تعطلت؟", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("insufficient_reference");
  });
});

describe("topic learning pack (data-driven)", () => {
  it("loads patience pack from verified snapshots (verse + tafsir + hadith + Seerah passage)", () => {
    const { pack, error } = resolveTopicLearningPack("patience", "A", "ar");
    expect(error).toBeNull();
    expect(pack?.quran?.content_id).toBe("quran-zumar-10");
    expect(pack?.quran?.provenance.reviewEvidenceType).toBe("live_api");
    expect(pack?.quranExplanation?.content_id).toBe("tafsir-tabari-39-10");
    expect(pack?.hadith?.content_id).toBe("hadith-bukhari-1469");
    expect(pack?.story?.story_id).toBe("seerah-bukhari-1283");
  });

  it("loads the full tawakkul pack from snapshots — no fixtures", () => {
    const { pack, error } = resolveTopicLearningPack(DEMO_PUBLISHED_TOPIC_ID, "A", "ar");
    expect(error).toBeNull();
    expect(pack?.quran?.content_id).toBe("quran-talaq-3");
    expect(pack?.hadith?.content_id).toBe("hadith-bukhari-6472");
    expect(pack?.hadith?.provenance.hadith?.grade).toBe("صحيح");
    expect(pack?.quranExplanation?.type).toBe("tafsir");
    expect(pack?.quranExplanation?.provenance.tafsir).toMatchObject({ surah: 65, ayah: 3 });
    expect(pack?.story?.story_id).toBe("seerah-bukhari-4563");
    expect(pack?.relatedTopicIds.length).toBeGreaterThan(0);
  });

  it("runJourney returns repository payload without AI religious prose", async () => {
    const journey = await runJourney(
      {
        message: "انقبلت في وظيفة جديدة",
        language: "ar",
        context: [],
        topicId: "tawakkul",
        analyzeLevel: "A",
      },
      mockProvider,
    );
    expect(journey.ok).toBe(true);
    if (!journey.ok) return;
    expect(journey.payload.content?.content_id).toBe("quran-talaq-3");
    expect(journey.payload.hadith).toBeTruthy();
    expect(journey.payload.quran_explanation).toBeTruthy();
    expect(journey.payload.reflection_question).toBe("");
    expect(journey.payload.story?.story_id).toBe("seerah-bukhari-4563");
    expect(journey.payload.response).toEqual([]);
    expect(journey.payload.suggested_action.title.length).toBeGreaterThan(0);
  });
});
