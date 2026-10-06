import { describe, expect, it } from "vitest";
import { composeMessage, interpret, learningFocus } from "@/understand";
import type { AnalyzeResult } from "../../shared/experience/guidance";

const analyze: AnalyzeResult = {
  context_summary: "قراءة",
  level: "A",
  safety: "safe",
  suggested_topics: [{ id: "patience", title: "الصبر" }],
  input_intent: "FEELING",
  recommended_path: "topic_discovery",
};

describe("composeMessage", () => {
  it("sends picked feelings as the message when nothing was written", () => {
    expect(composeMessage("  ", ["حزين", "قلقان"], "ar", "شعوري الآن:")).toBe("حزين، قلقان");
    expect(composeMessage("", ["Sad"], "en", "How I feel right now:")).toBe("Sad");
  });

  it("appends feelings to written words", () => {
    expect(composeMessage(" تعبت ", ["مكسور"], "ar", "شعوري الآن:")).toBe("تعبت\n\n(شعوري الآن: مكسور)");
  });
});

describe("learningFocus", () => {
  it("keeps only known aspects, once each, in order", () => {
    expect(learningFocus({ ...analyze, learning_focus: ["how", "x" as never, "how", "evidence"] })).toEqual(["how", "evidence"]);
  });

  it("is empty when the analyze stage asked for nothing extra (or sent something malformed)", () => {
    expect(learningFocus(analyze)).toEqual([]);
    expect(learningFocus(null)).toEqual([]);
    expect(learningFocus({ ...analyze, learning_focus: "how" as never })).toEqual([]);
  });
});

describe("interpret", () => {
  it("drops malformed topics and treats none left as insufficient", () => {
    const bad = { ...analyze, suggested_topics: [{ id: "x", title: " " }] };
    expect(interpret("analyze", { ok: true, mode: "live", route: "topic_discovery", analyze: bad }, null)).toEqual({ kind: "insufficient" });
  });

  it("never shows a learning result without catalog content", () => {
    const empty = { content: null, story: null } as never;
    expect(interpret("journey", { ok: true, mode: "live", payload: empty }, analyze)).toEqual({ kind: "insufficient" });
  });

  it("keeps the analyze reading for journey results", () => {
    const p = { content: { arabic: "x" }, story: null } as never;
    expect(interpret("journey", { ok: true, mode: "live", payload: p }, analyze)).toMatchObject({ kind: "learning", analyze });
  });

  it("rejects a knowledge answer without verbatim source text", () => {
    const answer = { kind: "qa", body_ar: "", source: { name: "x" } } as never;
    expect(interpret("analyze", { ok: true, mode: "live", route: "knowledge", analyze, answer }, null)).toEqual({
      kind: "error",
      error: "invalid",
    });
  });

  it("maps server errors", () => {
    expect(interpret("analyze", { ok: false, error: "timeout" }, null)).toEqual({ kind: "error", error: "timeout" });
    expect(interpret("journey", { ok: false, error: "referral_required" }, analyze)).toEqual({ kind: "referral", referral: null });
  });
});
