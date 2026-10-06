import { describe, expect, it } from "vitest";

import { retrieveVerified } from "./retrieve";

import { resolveTopicMedia, validateContentId } from "./whitelist";



describe("verified retrieval", () => {

  it("returns null for unknown content id — no theme fallback", () => {

    const { content, story, error } = retrieveVerified({

      heading: "",

      emotional_state: { primary: "anxiety", secondary: [], confidence: 0.6 },

      user_need: "calm",

      response: ["يبدو إن الخوف من القادم قاعد يأكل يومك."],

      remember: "أنت في اليوم هذا فقط.",

      topic_id: "anxiety",

      suggested_action: { type: "prayer", title: "صلاة", description: "صلّ ركعتين بهدوء." },

      learning_path: [],

      reflection_question: "",

      context: "خوف من القادم",

      safety: { level: "normal", requires_human_support: false },

      unclear: false,

      content_ids: ["not-in-catalog"],

      story_id: "missing",

    } as never);



    expect(content).toBeNull();

    expect(story).toBeNull();

    expect(error).toBe("CONTENT_NOT_FOUND");

  });



  it("returns catalog scripture for a known id", () => {

    const { content, error } = retrieveVerified({

      heading: "",

      emotional_state: { primary: "grief", secondary: [], confidence: 0.8 },

      user_need: "comfort",

      response: ["يبدو إن الفقد قاعد يثقل عليك."],

      remember: "خذ وقتك.",

      topic_id: "grief",

      suggested_action: { type: "dua", title: "دعاء", description: "ادع بما في قلبك." },

      learning_path: [],

      reflection_question: "",

      context: "فقد قريب",

      safety: { level: "normal", requires_human_support: false },

      unclear: false,

      content_ids: ["quran-zumar-10"],

      story_id: null,

    } as never);



    expect(error).toBeNull();

    expect(content?.content_id).toBe("quran-zumar-10");

    expect(content?.verified).toBe(true);

    expect(content?.source.name).toBe("Quranpedia");

    expect(content?.reference).toBe("39:10");

  });



  it("does not display unverified content", () => {

    expect(validateContentId("quran-fixture-unverified")).toBe("NOT_VERIFIED");

  });



  it("does not display unpublished content", () => {

    expect(validateContentId("quran-fixture-unpublished")).toBe("NOT_PUBLISHED");

  });



  it("resolves topic media fail closed when topic has no publishable content", () => {

    const result = resolveTopicMedia("topic-unpublished-fixture");

    expect(result.content).toBeNull();

    expect(result.error).toBe("TOPIC_NOT_FOUND");

  });



  it("resolves topic A with valid Quran record under governance", () => {

    const result = resolveTopicMedia("tawakkul", "A");

    expect(result.error).toBeNull();

    expect(result.content?.content_id).toBe("quran-talaq-3");

    expect(result.content?.source.name).toBe("Quranpedia");

  });

});


