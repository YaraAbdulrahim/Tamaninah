import { describe, expect, it } from "vitest";
import { detectLevelC, detectLevelD, requiresLevelCReferral } from "./levelGuard";
import { runAnalyze } from "../ai/orchestrate";
import { mockProvider } from "../ai/mockProvider";

describe("level D guard", () => {
  it("detects personal fatwa patterns locally", () => {
    expect(detectLevelD("هل زواجي صحيح إذا لم يكن هناك ولي")).toBe(true);
    expect(detectLevelD("هل صلاتي صحيحة في حالتي")).toBe(true);
    expect(detectLevelD("أحس إني تعبت من الانتظار")).toBe(false);
  });

  it("detects level C escalation patterns", () => {
    expect(detectLevelC("هذه مسألة خلافية بين العلماء")).toBe(true);
    expect(detectLevelC("أحس إني تعبت")).toBe(false);
    expect(requiresLevelCReferral("أي مذهب أتبع؟")).toBe(true);
  });

  it("returns insufficient_reference for level C analyze without topic discovery", async () => {
    const live = {
      name: "live" as const,
      async complete() {
        return JSON.stringify({
          context_summary: "خلاف علمي.",
          level: "C",
          safety: "safe",
          suggested_topics: [
            { id: "tawakkul", title: "التوكل", reason: "مرتبط." },
            { id: "hope", title: "الرجاء", reason: "مرتبط." },
          ],
        });
      },
    };
    const result = await runAnalyze(
      { message: "هذه مسألة خلافية بين العلماء", language: "ar", context: [] },
      live,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("insufficient_reference");
  });

  it("returns referral for level D without a normal journey", async () => {
    const result = await runAnalyze(
      { message: "هل يجب علي أن أطلق زوجتي في هذه الحالة", language: "ar", context: [] },
      mockProvider,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("referral" in result).toBe(true);
    if ("referral" in result && result.referral) {
      expect(result.referral.level).toBe("D");
    }
  });
});
