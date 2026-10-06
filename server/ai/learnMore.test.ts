import { describe, expect, it } from "vitest";
import snapshot from "../content/snapshots/lessons.published.json";
import { validateAnalyze } from "../../shared/experience/validate";
import type { LessonSnapshotFile } from "../content/lessons/lessonFormat";
import { fixtureKnowledgeBase } from "../content/knowledge/testFixtures";
import { RateLimiter, handleUnderstand } from "../http/understand";
import { runAnalyze, runJourney } from "./orchestrate";
import type { AIProvider } from "./provider";

const bodies = new Set((snapshot as unknown as LessonSnapshotFile).records.map((r) => r.body_ar));

function model(draft: Record<string, unknown>): AIProvider {
  return {
    name: "live",
    async complete() {
      return JSON.stringify({ level: "A", safety: "safe", domain: "dawah", knowledge_id: null, ...draft });
    },
  };
}

const journey = (topicId: string, message: string, focus?: string[]) =>
  runJourney(
    { message, language: "ar", context: [], topicId, analyzeLevel: "A", ...(focus ? { focus: focus as never } : {}) },
    { name: "live" },
  );

describe("learning_focus from the model is enum-validated", () => {
  it("drops unknown aspects and keeps at most 3", () => {
    const draft = validateAnalyze({
      context_summary: "يبدو أنك تريد أن تتعلم عن التوكل.",
      level: "A",
      safety: "safe",
      input_intent: "GENERAL_ISLAMIC_LEARNING",
      recommended_path: "topic_discovery",
      suggested_topics: [{ id: "tawakkul", reason: "تريد التعلم عنه." }],
      learning_focus: ["meaning", "bogus", "how", 7, "how", "virtues", "fruits"],
    });
    expect(draft?.learning_focus).toEqual(["meaning", "how", "virtues"]);
    expect(validateAnalyze({ context_summary: "x", learning_focus: "how" })?.learning_focus).toEqual([]);
  });
});

describe("analyze → learning_focus and direct-learning lessons", () => {
  it("topic discovery passes the focus through (model + cues)", async () => {
    const result = await runAnalyze(
      { message: "أبي أتعلم عن التوكل", language: "ar", context: [] },
      model({
        context_summary: "يبدو أنك تريد أن تتعلم عن التوكل.",
        input_intent: "GENERAL_ISLAMIC_LEARNING",
        recommended_path: "topic_discovery",
        suggested_topics: [{ id: "tawakkul", reason: "التوكل هو ما تريد تعلمه." }, { id: "effort", reason: "الأخذ بالأسباب." }],
        learning_focus: [],
      }),
      { knowledge: fixtureKnowledgeBase() },
    );
    expect(result).toMatchObject({ ok: true, route: "topic_discovery", analyze: { learning_focus: ["meaning", "how"] } });
  });

  it("«كيف أدعي؟» → nearness journey (direct learning) with the core kept and du'a lessons on top", async () => {
    const result = await runAnalyze(
      { message: "كيف أدعي؟", language: "ar", context: [] },
      model({
        context_summary: "يبدو أنك تسأل عن كيفية الدعاء.",
        input_intent: "DIRECT_QUESTION",
        recommended_path: "direct_learning",
        suggested_topics: [{ id: "nearness", reason: "الدعاء والقرب من الله." }],
      }),
      { knowledge: fixtureKnowledgeBase() },
    );
    expect(result.ok && "route" in result && result.route).toBe("direct_learning");
    if (!result.ok || !("route" in result) || result.route !== "direct_learning") return;
    expect(result.analyze.learning_focus).toEqual(["how"]);
    const p = result.payload;
    expect(p.topic_id).toBe("nearness");
    expect(p.content?.content_id).toBe("quran-baqarah-186");
    expect(p.quran_explanation).toBeTruthy();
    expect(p.hadith).toBeTruthy();
    expect(p.learning_request).toEqual({ focus: ["how"], covered: true });
    expect(p.lessons?.length).toBe(3);
    expect(p.lessons!.every((l) => l.id.startsWith("jamhara-2366-etiquette-") && bodies.has(l.body_ar))).toBe(true);
  });

  it("an experience with no learning ask carries no focus", async () => {
    const result = await runAnalyze(
      { message: "تعبت من الضغط في الشغل", language: "ar", context: [] },
      model({
        context_summary: "يبدو أنك متعب من ضغط العمل.",
        input_intent: "FEELING",
        recommended_path: "topic_discovery",
        domain: null,
        suggested_topics: [{ id: "patience", reason: "ضغط مستمر." }],
        learning_focus: [],
      }),
      { knowledge: fixtureKnowledgeBase() },
    );
    expect(result.ok && "analyze" in result && result.analyze.learning_focus).toBeUndefined();
  });

  it("guards are unchanged: an explicit evidence request is still insufficient, even with a learning focus", async () => {
    const result = await runAnalyze(
      { message: "أعطني حديث يثبت فضل الصبر", language: "ar", context: [] },
      model({
        context_summary: "يبدو أنك تطلب حديثًا عن فضل الصبر.",
        input_intent: "DIRECT_QUESTION",
        recommended_path: "direct_learning",
        domain: "hadith",
        suggested_topics: [{ id: "patience", reason: "الصبر." }],
        learning_focus: ["virtues", "evidence"],
      }),
      { knowledge: fixtureKnowledgeBase() },
    );
    expect(result).toMatchObject({ ok: false, error: "insufficient_reference" });
  });
});

describe("journey with focus", () => {
  it("keeps every core slot and adds verbatim lessons on top", async () => {
    const plain = await journey("tawakkul", "مقبل على وظيفة جديدة");
    const learn = await journey("tawakkul", "مقبل على وظيفة جديدة", ["meaning", "how"]);
    if (!plain.ok || !learn.ok) throw new Error("journey failed");
    expect(plain.payload.lessons).toBeUndefined();
    expect(plain.payload.learning_request).toBeUndefined();
    for (const slot of ["content", "quran_explanation", "hadith", "hadith_explanation", "story", "pack_slots"] as const) {
      expect(learn.payload[slot], slot).toEqual(plain.payload[slot]);
    }
    expect(learn.payload.content).toBeTruthy();
    expect(learn.payload.learning_request).toEqual({ focus: ["meaning", "how"], covered: true });
    expect(learn.payload.lessons!.length).toBeGreaterThan(0);
    expect(learn.payload.lessons!.length).toBeLessThanOrEqual(3);
    expect(learn.payload.lessons!.every((l) => bodies.has(l.body_ar))).toBe(true);
  });

  it("applies the learning cues to the message when focus is absent", async () => {
    const r = await journey("patience", "علمني عن الصبر");
    expect(r.ok && r.payload.learning_request).toEqual({ focus: ["meaning", "how"], covered: true });
  });

  it("an uncovered focus → covered:false and no generated text", async () => {
    const r = await journey("amanah", "وش معنى الأمانة؟", ["meaning"]);
    if (!r.ok) throw new Error("journey failed");
    expect(r.payload.learning_request).toEqual({ focus: ["meaning"], covered: false });
    expect(r.payload.lessons).toEqual([]);
    expect(r.payload.content).toBeTruthy();
  });

  it("safety guards still win over a learning focus", async () => {
    expect(await journey("patience", "أبغى أموت، علمني عن الصبر", ["how"])).toEqual({ ok: false, error: "referral_required" });
  });
});

describe("HTTP: focus is enum-validated", () => {
  const post = (body: unknown) =>
    new Request("https://tamaninah.example/api/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json", host: "tamaninah.example" },
      body: JSON.stringify(body),
    });
  const base = { stage: "journey", message: "مقبل على وظيفة جديدة", language: "ar", topicId: "tawakkul", analyzeLevel: "A" };

  it.each([["how"], [["bogus"]], [[1]], [{ how: true }], [["how", "x"]]])("rejects focus=%j", async (focus) => {
    const res = await handleUnderstand(post({ ...base, focus }), {}, { rateLimiter: new RateLimiter(), provider: null });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "body" });
  });

  it("accepts a valid focus (and an absent one)", async () => {
    const res = await handleUnderstand(post({ ...base, focus: ["how", "how"] }), {}, { rateLimiter: new RateLimiter(), provider: null });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payload.learning_request).toEqual({ focus: ["how"], covered: true });
    expect(body.payload.lessons[0].source.url).toBe("https://islamic-content.com/t/646");

    const none = await handleUnderstand(post(base), {}, { rateLimiter: new RateLimiter(), provider: null });
    expect(none.status).toBe(200);
    expect((await none.json()).payload.lessons).toBeUndefined();
  });
});
