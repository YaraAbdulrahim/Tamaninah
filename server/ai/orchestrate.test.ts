import { describe, expect, it } from "vitest";
import type { AIProvider } from "./provider";
import { createProvider, modeForEnv, runAnalyze, runJourney, type OrchestratorEnv } from "./orchestrate";
import { mockProvider } from "./mockProvider";

describe("guidance orchestrator", () => {
  it("prefers a live provider when a key is present", () => {
    const provider = createProvider({ AI_API_KEY: "sk-test", MODE: "development" });
    expect(provider?.name).toBe("live");
  });

  it("uses the mock only when it is explicitly opted in", () => {
    expect(createProvider({ MODE: "development" })).toBeNull();
    expect(createProvider({ AI_MOCK: "true" })?.name).toBe("mock");
  });

  it("modeForEnv reads the env directly and agrees with createProvider", () => {
    const cases: [OrchestratorEnv, "live" | "mock"][] = [
      [{}, "live"],
      [{ AI_MOCK: "false" }, "live"],
      [{ AI_MOCK: "true" }, "mock"],
      [{ AI_MOCK: "1" }, "mock"],
      [{ AI_API_KEY: "k", AI_MOCK: "true" }, "live"],
      [{ OPENAI_API_KEY: "k", AI_MOCK: "1" }, "live"],
      [{ AI_API_KEY: "   ", AI_MOCK: "true" }, "mock"],
      [{ AI_API_KEY: "k" }, "live"],
    ];
    for (const [env, mode] of cases) {
      expect(modeForEnv(env)).toBe(mode);
      expect(modeForEnv(env)).toBe(createProvider(env)?.name ?? "live");
    }
  });

  it("interrupts locally on danger", async () => {
    const result = await runAnalyze({ message: "ما أبغى أعيش", language: "ar", context: [] }, mockProvider);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("referral" in result && result.referral?.reason).toBe("self_harm");
  });

  it("the self-harm guard reads the user's own context turns, never companion text", async () => {
    let modelCalls = 0;
    const feeling: AIProvider = {
      name: "live",
      async complete() {
        modelCalls += 1;
        return JSON.stringify({
          context_summary: "يبدو أنك قلق من المستقبل.",
          level: "A",
          safety: "safe",
          input_intent: "FEELING",
          recommended_path: "topic_discovery",
          suggested_topics: [{ id: "anxiety", reason: "القلق مما سيأتي." }],
        });
      },
    };
    const message = "أشعر بالقلق من المستقبل";
    const companion = await runAnalyze(
      {
        message,
        language: "ar",
        context: [{ role: "companion", text: "If you ever think about suicide or want to die, call a helpline now." }],
      },
      feeling,
    );
    expect(modelCalls).toBe(1);
    expect(companion.ok && "route" in companion && companion.route).toBe("topic_discovery");

    const user = await runAnalyze(
      { message, language: "ar", context: [{ role: "user", text: "ما أبغى أعيش" }] },
      feeling,
    );
    expect(modelCalls).toBe(1);
    expect(user.ok && "referral" in user && user.referral.reason).toBe("self_harm");
  });

  it("suggests multiple topics for a new job scenario", async () => {
    const result = await runAnalyze(
      {
        message: "انقبلت في وظيفة جديدة، فرحان لكن خايف ما أكون قد المسؤولية.",
        language: "ar",
        context: [],
      },
      mockProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !("analyze" in result)) return;
    expect(result.analyze.suggested_topics.length).toBeGreaterThanOrEqual(2);
    expect(result.analyze.suggested_topics.length).toBeLessThanOrEqual(4);
  });

  it("builds journey from user-chosen topic with verified content", async () => {
    const result = await runJourney(
      {
        message: "انقبلت في وظيفة جديدة، فرحان لكن خايف",
        language: "ar",
        context: [],
        topicId: "tawakkul",
        analyzeLevel: "A",
      },
      mockProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.content?.content_id).toBe("quran-talaq-3");
    expect(result.payload.content?.source.name).toBe("Quranpedia");
    expect(result.payload.response).toEqual([]);
    expect(result.payload.remember).toBe("");
    expect(result.payload.governance_level).toBe("A");
  });

  it("does not call the model on journey — verified repository content only", async () => {
    const stages: string[] = [];
    const live: AIProvider = {
      name: "live",
      async complete() {
        stages.push("analyze");
        return JSON.stringify({
          context_summary: "سعي وانتظار.",
          level: "A",
          safety: "safe",
          suggested_topics: [
            { id: "tawakkul", title: "التوكل", reason: "مرتبط بالنتيجة." },
            { id: "effort", title: "السعي", reason: "مرتبط بالعمل." },
          ],
        });
      },
    };

    const journey = await runJourney(
      {
        message: "كل ما اسعى لوظيفة ما تضبط",
        language: "ar",
        context: [],
        topicId: "tawakkul",
        analyzeLevel: "A",
      },
      live,
    );
    expect(stages).toEqual([]);
    expect(journey.ok).toBe(true);
    if (!journey.ok) return;
    expect(journey.payload.content?.reference).toBe("65:3");
    expect(journey.payload.response).toEqual([]);
  });
});
