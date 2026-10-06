import { describe, expect, it } from "vitest";
import type { AnalyzeDraft } from "../../shared/experience/guidance";
import { mentionsSacredFigure, sanitizeModelText } from "./analyzeRouting";

const draft = (summary: string, reason: string): AnalyzeDraft => ({
  context_summary: summary,
  level: "A",
  safety: "safe",
  suggested_topics: [{ id: "tawakkul", title: "التوكل", reason }],
  input_intent: "DIRECT_QUESTION",
  recommended_path: "direct_learning",
});

describe("model free text never brings in sacred figures on its own", () => {
  it("recognises the Messenger ﷺ, prophets and Companions, not lookalike words", () => {
    expect(mentionsSacredFigure("يبحث الرسول عن معنى مفهوم التوكل")).toBe(true);
    expect(mentionsSacredFigure("كيف تعامل النبي مع الحزن")).toBe(true);
    expect(mentionsSacredFigure("قصة صحابي")).toBe(true);
    expect(mentionsSacredFigure("how the Prophet dealt with grief")).toBe(true);
    expect(mentionsSacredFigure("تسأل عن معنى التوكل")).toBe(false);
    expect(mentionsSacredFigure("رسالة من صديق")).toBe(false);
  });

  it("drops a reason that names the Messenger when the person did not", () => {
    const out = sanitizeModelText("وش معنى التوكل في الإسلام؟", draft("يبدو أنك تسأل عن معنى التوكل.", "يبحث الرسول عن معنى مفهوم التوكل."));
    expect(out.suggested_topics[0]).toEqual({ id: "tawakkul", title: "التوكل" });
    expect(out.context_summary).toBe("يبدو أنك تسأل عن معنى التوكل.");
  });

  it("clears a reading that brings in a sacred figure, so the page shows no AI line", () => {
    const out = sanitizeModelText("تعبت من الانتظار", draft("كما صبر النبي على الأذى، تمر بوقت صعب.", "الصبر يناسب الانتظار."));
    expect(out.context_summary).toBe("");
    expect(out.suggested_topics[0]?.reason).toBe("الصبر يناسب الانتظار.");
  });

  it("keeps a faithful restatement when the person asked about the Prophet ﷺ", () => {
    const msg = "أبي أعرف كيف كان النبي يتعامل مع الحزن";
    const d = draft("يبدو أنك تسأل عن تعامل النبي مع الحزن.", "مرتبط بسؤالك عن النبي والحزن.");
    expect(sanitizeModelText(msg, d)).toEqual(d);
  });
});

describe("indirect self-harm never lands on the fatwa referral", () => {
  it("routes a lived experience the model marks D + refer to human support", async () => {
    const { resolveAnalyzeRoute } = await import("./analyzeRouting");
    const d: AnalyzeDraft = {
      context_summary: "",
      level: "D",
      safety: "refer",
      suggested_topics: [],
      input_intent: "FEELING",
      recommended_path: "referral",
    };
    const r = resolveAnalyzeRoute("I don't see the point of going on anymore. Everyone would be better off without me.", d, "en", { readyTopicIds: [] });
    expect(r).toMatchObject({ kind: "referral", reason: "self_harm" });
  });

  it("the deterministic guard catches the indirect English phrasing before any model call", async () => {
    const { runAnalyze } = await import("./orchestrate");
    const r = await runAnalyze({ message: "Everyone would be better off without me.", language: "en", context: [] }, null);
    expect(r).toMatchObject({ ok: true, referral: { reason: "self_harm" } });
  });
});
