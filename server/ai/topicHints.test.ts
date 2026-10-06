import { describe, expect, it } from "vitest";
import { readyTopicIds } from "../content/topicPackReadiness";
import { resolveTopicLearningPack } from "../content/topicLearning";
import { topicMetaForModel } from "../content/topics";
import { mockProvider } from "./mockProvider";
import { runAnalyze, runJourney } from "./orchestrate";
import type { AIProvider } from "./provider";

type PromptTopic = { id: string; title_ar: string; title_en: string; hint_ar?: string; hint_en?: string };

const GRATITUDE_MESSAGE = "صار لي شيء جميل وأحس بالامتنان، وودي أفهم كيف يكون الشكر في الإسلام.";

/** Provider that records the analyze prompt and returns a fixed draft. */
function capturing(draft: Record<string, unknown>) {
  const seen: { topics: PromptTopic[] }[] = [];
  const provider: AIProvider = {
    name: "live",
    async complete(messages) {
      seen.push(JSON.parse(messages.at(-1)!.content) as { topics: PromptTopic[] });
      return JSON.stringify(draft);
    },
  };
  return { provider, seen };
}

describe("topic routing hints (model-only metadata)", () => {
  it("every ready topic sends a plain hint in both languages to the analyze prompt", async () => {
    const { provider, seen } = capturing({
      context_summary: "يبدو أنك فرحان بشيء جديد.",
      level: "A",
      safety: "safe",
      input_intent: "EXPERIENCE",
      recommended_path: "topic_discovery",
      suggested_topics: [{ id: "amanah", reason: "مرتبط بالمسؤولية الجديدة." }],
    });
    const result = await runAnalyze(
      { message: "انقبلت في وظيفة جديدة، فرحان جدًا، لكن خايف ما أكون قد المسؤولية.", language: "ar", context: [] },
      provider,
    );
    const topics = seen[0]!.topics;
    expect(topics.map((t) => t.id).sort()).toEqual([...readyTopicIds()].sort());
    for (const t of topics) {
      expect([t.id, Boolean(t.hint_ar?.trim()), Boolean(t.hint_en?.trim())]).toEqual([t.id, true, true]);
      // Routing words only — no scripture marks, no attributed sayings, no rulings.
      expect(`${t.hint_ar} ${t.hint_en}`).not.toMatch(/[﴿﴾ﷺ«»]|قال|حرام|حلال|يجب|haram|halal|must/i);
    }
    expect(topics.find((t) => t.id === "amanah")?.hint_ar).toContain("مسؤولية");
    expect(topics.find((t) => t.id === "amanah")?.hint_en).toContain("new job");
    expect(topics.find((t) => t.id === "gratitude")?.hint_en).toContain("good news");

    // Hints never travel back to the client.
    expect(JSON.stringify(result)).not.toContain("hint_");
    expect(JSON.stringify(result)).not.toContain(topics.find((t) => t.id === "amanah")!.hint_ar!);
  });

  it("the model metadata carries hints; nothing else about a topic is exposed", () => {
    for (const meta of topicMetaForModel()) {
      expect(Object.keys(meta).sort()).toEqual(["hint_ar", "hint_en", "id", "level", "title_ar", "title_en"]);
    }
  });
});

describe("gratitude topic", () => {
  it("is ready and offered for a positive experience", async () => {
    expect(readyTopicIds()).toContain("gratitude");
    const result = await runAnalyze({ message: GRATITUDE_MESSAGE, language: "ar", context: [] }, mockProvider);
    expect(result.ok && "route" in result && result.route).toBe("topic_discovery");
    if (!result.ok || !("analyze" in result)) return;
    expect(result.analyze.suggested_topics[0]).toMatchObject({ id: "gratitude", title: "الشكر" });
  });

  it("serves 14:7, Tabari on 14:7 and Sahih Muslim 2999 — all from verified snapshots", async () => {
    const { pack, error } = resolveTopicLearningPack("gratitude", "A", "ar");
    expect(error).toBeNull();
    expect(pack?.quran?.provenance.quran).toMatchObject({ surah: 14, ayah: 7 });
    expect(pack?.quranExplanation?.provenance.tafsir).toMatchObject({ surah: 14, ayah: 7, volume: 16 });
    expect(pack?.hadith?.provenance.hadith).toMatchObject({
      collection: "صحيح مسلم",
      number: 2999,
      grade: "صحيح",
      url: "https://shamela.ws/book/1727/7432",
    });
    expect(pack?.story?.story_id).toBe("seerah-bukhari-4837");

    for (const language of ["ar", "en"] as const) {
      const journey = await runJourney(
        { message: GRATITUDE_MESSAGE, language, context: [], topicId: "gratitude", analyzeLevel: "A" },
        mockProvider,
      );
      expect(journey.ok).toBe(true);
      if (!journey.ok) continue;
      expect(journey.payload.topic_id).toBe("gratitude");
      expect(journey.payload.suggested_action.type).toBe("dua");
      expect(journey.payload.suggested_action.title.length).toBeGreaterThan(0);
    }
  });
});
