import { describe, expect, it } from "vitest";
import { guessDomain } from "./analyzeRouting";
import { runAnalyze } from "./orchestrate";
import { mockProvider } from "./mockProvider";
import type { AIProvider } from "./provider";
import { validateAnalyze } from "../../shared/experience/validate";

describe("lexical domain guess", () => {
  it("matches ruling words as tokens: «الحكمة» (wisdom) and «محكمة» (court) are not fiqh", () => {
    expect(guessDomain("ما الحكمة من الابتلاء؟")).not.toBe("fiqh");
    expect(guessDomain("ذهبت إلى المحكمة اليوم وأنا خائف")).not.toBe("fiqh");
    for (const message of [
      "ما حكم صيام يوم الجمعة؟",
      "وحكم الربا؟",
      "بحكم الشرع ماذا أفعل؟",
      "ما الأحكام المتعلقة بالبيع؟",
      "هل يجوز ذلك؟",
      "هل هذا حلال؟",
      "أريد فتوى",
      "is this halal?",
      "what is the ruling on this",
    ]) {
      expect(guessDomain(message), message).toBe("fiqh");
    }
  });

  it("«ما الحكمة من الابتلاء؟» with no model domain is not refused as a fiqh question", async () => {
    const model: AIProvider = {
      name: "live",
      async complete() {
        return JSON.stringify({
          context_summary: "يبدو أنك تسأل عن الحكمة من الابتلاء.",
          level: "A",
          safety: "safe",
          input_intent: "DIRECT_QUESTION",
          recommended_path: "direct_learning",
          domain: null,
          suggested_topics: [{ id: "patience", reason: "الصبر على الابتلاء." }],
        });
      },
    };
    const result = await runAnalyze({ message: "ما الحكمة من الابتلاء؟", language: "ar", context: [] }, model);
    expect(result.ok && "route" in result && result.route).toBe("direct_learning");
  });
});

describe("intent-aware analyze routing", () => {
  it("Test A: new job experience → topic discovery", async () => {
    const result = await runAnalyze(
      {
        message: "بدأت وظيفة جديدة وأنا سعيد لكن خايف من المسؤولية.",
        language: "ar",
        context: [],
      },
      mockProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !("route" in result)) return;
    expect(result.route).toBe("topic_discovery");
    if (!("analyze" in result)) return;
    expect(result.analyze.input_intent).toBe("EXPERIENCE");
    expect(result.analyze.suggested_topics.length).toBeGreaterThanOrEqual(2);
  });

  it("Test B: zakat direct question → insufficient (no catalog topic)", async () => {
    const result = await runAnalyze(
      { message: "وش معنى الزكاة في الإسلام؟", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("insufficient_reference");
  });

  it("Test B2: tawakkul meaning → direct learning with repository payload", async () => {
    const result = await runAnalyze(
      { message: "وش معنى التوكل في الإسلام؟", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !("route" in result)) return;
    expect(result.route).toBe("direct_learning");
    if (!("payload" in result)) return;
    expect(result.analyze.input_intent).toBe("DIRECT_QUESTION");
    expect(result.payload.content?.content_id).toBe("quran-talaq-3");
    expect(result.payload.response).toEqual([]);
  });

  it("Test C: joy/blessing → feeling / topic discovery", async () => {
    const result = await runAnalyze(
      { message: "جتني نعمة وفرحت فيها جدًا.", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok || !("analyze" in result)) return;
    expect(result.analyze.input_intent).toBe("FEELING");
    expect(result.route).toBe("topic_discovery");
  });

  it("Test D: generic ruling question → no 2-topic requirement, insufficient without evidence", async () => {
    const result = await runAnalyze(
      { message: "وش حكم الشيء اللي صار معي اليوم؟", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("insufficient_reference");
  });

  it("Test E: car repair → out of scope / insufficient", async () => {
    const result = await runAnalyze(
      { message: "كيف أصلح سيارتي؟", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("insufficient_reference");
  });

  it("Test G: sensitive personal ruling → referral", async () => {
    const result = await runAnalyze(
      { message: "هل زواجي صحيح شرعًا؟", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("referral" in result).toBe(true);
  });

  it("Test H: direct question with one topic passes validation", () => {
    const parsed = validateAnalyze({
      context_summary: "سؤال عن التوكل.",
      level: "A",
      safety: "safe",
      input_intent: "DIRECT_QUESTION",
      recommended_path: "direct_learning",
      suggested_topics: [{ id: "tawakkul", title: "التوكل", reason: "مرتبط." }],
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.suggested_topics).toHaveLength(1);
  });

  it("Test I: scripture in topic title rejects analyze", () => {
    const parsed = validateAnalyze({
      context_summary: "سؤال.",
      level: "A",
      safety: "safe",
      input_intent: "DIRECT_QUESTION",
      recommended_path: "direct_learning",
      suggested_topics: [{ id: "patience", title: "﴿وَمَن يَتَوَكَّلْ﴾", reason: "ok" }],
    });
    expect(parsed).toBeNull();
  });
});

describe("guessDomain — Qur'an words as tokens", () => {
  it("does not read «نهاية», «هداية» or «بداية» as a Qur'an question", async () => {
    const { guessDomain } = await import("./analyzeRouting");
    expect(guessDomain("كيف أطلب الهداية؟")).not.toBe("quran");
    expect(guessDomain("هل هذه نهاية الطريق؟")).not.toBe("quran");
    expect(guessDomain("ما معنى آية الكرسي؟")).toBe("quran");
    expect(guessDomain("ما تفسير سورة الفاتحة")).toBe("tafseer");
    expect(guessDomain("what does this verse mean")).toBe("quran");
  });
});
