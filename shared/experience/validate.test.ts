import { describe, expect, it } from "vitest";
import { parseModelJson, validateDraft, looksLikeScripture } from "./validate";

const warm = {
  emotional_state: { primary: "exhaustion", secondary: ["waiting"], confidence: 0.7 },
  user_need: "reassurance",
  response: ["يبدو إن الانتظار أخذ منك كثير.", "يمكن الإحساس إنك تحاول من فترة."],
  remember: "اللي تحسه الآن حقيقي، لكنه مو نهاية القصة.",
  topic_id: "effort",
  suggested_action: {
    type: "dua",
    title: "ادعُ بما في قلبك",
    description: "قل لله اللي بقلبك كما هو.",
  },
  safety: { level: "normal", requires_human_support: false },
  unclear: false,
};

describe("guidance contract", () => {
  it("accepts a warm structured draft", () => {
    const parsed = validateDraft(warm);
    expect(parsed?.topic_id).toBe("effort");
    expect(parsed?.safety.requires_human_support).toBe(false);
  });

  it("rejects religious text the model must not invent", () => {
    expect(
      validateDraft({
        ...warm,
        response: ["قال الله تعالى في كتابه."],
      }),
    ).toBeNull();
    expect(looksLikeScripture("رواه البخاري 2:286")).toBe(true);
  });

  it("unwraps fenced JSON from a model", () => {
    expect(parseModelJson("```json\n{\"unclear\":true}\n```")).toEqual({ unclear: true });
    expect(parseModelJson("not json")).toBeNull();
  });
});
