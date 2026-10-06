import { describe, expect, it } from "vitest";
import { getDefaultKnowledgeBase } from "../content/knowledge/knowledgeData";
import { fixtureKnowledgeBase, knowledgeFixtureData, FIXTURE_EXCERPT } from "../content/knowledge/testFixtures";
import { readyTopicIds } from "../content/topicPackReadiness";
import { runAnalyze } from "./orchestrate";
import type { AIProvider, ChatMessage } from "./provider";

/** Provider that returns one scripted analyze JSON and records what it was sent. */
function scripted(draft: Record<string, unknown> | ((prompt: PromptJson) => Record<string, unknown>)) {
  const seen: { messages: ChatMessage[]; prompt: PromptJson }[] = [];
  const provider: AIProvider = {
    name: "live",
    async complete(messages) {
      const prompt = JSON.parse(messages.at(-1)!.content) as PromptJson;
      seen.push({ messages, prompt });
      return JSON.stringify(typeof draft === "function" ? draft(prompt) : draft);
    },
  };
  return { provider, seen };
}

type PromptJson = {
  message: string;
  topics: { id: string; title_ar: string; title_en: string }[];
  knowledge_candidates: { id: string; kind: string; text: string }[];
};

const kb = fixtureKnowledgeBase();
const ask = (message: string, provider: AIProvider, language: "ar" | "en" = "ar") =>
  runAnalyze({ message, language, context: [] }, provider, { knowledge: kb });

const question = (extra: Record<string, unknown>) => ({
  context_summary: "يبدو أنك تسأل سؤالًا عامًا عن الإسلام.",
  level: "B",
  safety: "safe",
  input_intent: "DIRECT_QUESTION",
  recommended_path: "direct_learning",
  suggested_topics: [],
  domain: "shubuhat",
  knowledge_id: null,
  ...extra,
});

describe("knowledge route — glossary", () => {
  it("«ما معنى التوحيد؟» → verbatim glossary row from sources.pdf p.8", async () => {
    const { provider, seen } = scripted((p) =>
      question({ level: "A", domain: "terminology", knowledge_id: p.knowledge_candidates[0]?.id ?? null }),
    );
    const result = await ask("ما معنى التوحيد؟", provider);
    expect(seen[0]!.prompt.knowledge_candidates[0]).toMatchObject({ id: "gl-tawhid", kind: "glossary" });
    expect(result.ok && "route" in result && result.route).toBe("knowledge");
    if (!result.ok || !("answer" in result)) return;
    const row = knowledgeFixtureData.glossary.find((g) => g.id === "gl-tawhid")!;
    expect(result.answer.kind).toBe("glossary");
    expect(result.answer.body_ar).toBe(row.usage_ar);
    expect(result.answer.term_en).toBe("Tawhid / Oneness of God");
    expect(result.answer.source.reference).toContain("ص 8");
    expect(result.analyze.level).toBe("A");
  });

  it("«ترجم كلمة التوحيد إلى الإنجليزية» → glossary even if the model forgot to pick it", async () => {
    const { provider } = scripted(question({ level: "A", domain: "terminology", knowledge_id: null }));
    const result = await ask("ترجم كلمة التوحيد إلى الإنجليزية", provider);
    expect(result.ok && "answer" in result && result.answer.id).toBe("gl-tawhid");
  });
});

describe("knowledge route — explicit glossary fallback only for a question about the term", () => {
  const real = getDefaultKnowledgeBase();
  const askReal = (message: string, provider: AIProvider, language: "ar" | "en" = "ar") =>
    runAnalyze({ message, language, context: [] }, provider, { knowledge: real });

  it.each(["hadith", null])(
    "«ما معنى حديث إنما الأعمال بالنيات؟» (model domain %s) → insufficient + hadith pointer, not the «الحديث» glossary row",
    async (domain) => {
      const { provider } = scripted(question({ domain }));
      const result = await askReal("ما معنى حديث إنما الأعمال بالنيات؟", provider);
      expect(result).toMatchObject({ ok: false, error: "insufficient_reference", pointer: { domain: "hadith" } });
    },
  );

  it.each([
    ["يعني الإسلام دين إرهاب؟", "ar"],
    ["what does islam mean by jihad", "en"],
  ] as const)("%s → no glossary answer for «الإسلام»", async (message, language) => {
    const { provider } = scripted(question({ domain: "shubuhat" }));
    const result = await askReal(message, provider, language);
    expect(result).toMatchObject({ ok: false, error: "insufficient_reference" });
  });

  it.each([
    ["ما معنى التوحيد؟", "ar"],
    ["ترجم كلمة التوحيد", "ar"],
    ["translate tawhid", "en"],
    ["what does tawhid mean", "en"],
  ] as const)("%s → still the glossary row when the model picks nothing", async (message, language) => {
    const { provider } = scripted(question({ level: "A", domain: "terminology" }));
    const result = await askReal(message, provider, language);
    expect(result.ok && "answer" in result && result.answer.id).toBe("gl-tawhid");
  });
});

describe("knowledge route — Bayyinat", () => {
  it("sends ~12 lexical candidates and accepts a verified pick → verbatim excerpt", async () => {
    const { provider, seen } = scripted(question({ knowledge_id: "byn-0009" }));
    const result = await ask("لماذا يعبد المسلمون الكعبة؟", provider);
    const candidates = seen[0]!.prompt.knowledge_candidates;
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(12);
    expect(candidates.map((c) => c.id)).toContain("byn-0009");
    expect(result.ok && "answer" in result).toBe(true);
    if (!result.ok || !("answer" in result)) return;
    expect(result.answer).toMatchObject({
      kind: "qa",
      body_ar: FIXTURE_EXCERPT,
      source: { name: "بينات: أسئلة وأجوبة عن الإسلام", reference: "المسألة 9 — ص 65–66" },
    });
  });

  it("never trusts a model id that was not in the candidate list", async () => {
    // byn-0009 exists and is verified, but this message does not retrieve it.
    const { provider, seen } = scripted(question({ knowledge_id: "byn-0009", domain: "hadith" }));
    const result = await ask("أعطني حديثًا عن الصدق", provider);
    expect(seen[0]!.prompt.knowledge_candidates.map((c) => c.id)).not.toContain("byn-0009");
    expect(result).toMatchObject({ ok: false, error: "insufficient_reference", pointer: { domain: "hadith" } });
  });

  it("«هل القرآن من تأليف محمد؟» → index-only question → pointer to the exact Bayyinat question + page", async () => {
    const { provider } = scripted((p) => {
      const hit = p.knowledge_candidates.find((c) => c.text.includes("مصدره البشر"));
      return question({ knowledge_id: hit?.id ?? null });
    });
    const result = await ask("هل القرآن من تأليف محمد؟", provider);
    expect(result).toMatchObject({ ok: false, error: "insufficient_reference" });
    if (result.ok) return;
    expect(result.pointer?.domain).toBe("shubuhat");
    expect(result.pointer?.sources[0]?.name).toContain("المسألة 27");
    expect(result.pointer?.sources[0]?.name).toContain("ص 137");
    expect(result.pointer?.sources[0]?.url).toBe("https://dawa.center/file/7937/download#page=138");
  });

  it("a curated but unverified excerpt is never shown", async () => {
    const { provider } = scripted(question({ knowledge_id: "byn-0004", domain: "aqeeda" }));
    const result = await ask("كيف نجيب على سؤال من خلق الله؟", provider);
    expect(result).toMatchObject({ ok: false, error: "insufficient_reference" });
  });

  it("a level-C excerpt → state the difference + referral (not the answer)", async () => {
    const { provider } = scripted(question({ knowledge_id: "byn-0056", domain: "quran" }));
    const result = await ask("هل تعدد القراءات القرآنية يدل على الاختلاف في القرآن؟", provider);
    expect(result.ok && "referral" in result && result.referral.reason).toBe("level_c");
  });

  it("no fitting candidate → insufficient_reference + the PDF's approved source for the domain", async () => {
    const { provider } = scripted(question({ domain: "fiqh" }));
    const result = await ask("ما هي شروط الوضوء؟", provider);
    expect(result).toMatchObject({
      ok: false,
      error: "insufficient_reference",
      pointer: { domain: "fiqh", rule_ar: "لا تتحول إلى فتوى شخصية أو ترجيح آلي مستقل." },
    });
  });
});

describe("feelings and experiences keep flowing to topics", () => {
  it("offers only ready topics, with server catalog titles — never model titles", async () => {
    // Every catalog topic is ready now, so restrict the ready set to show a non-ready one is dropped.
    const ready = readyTopicIds().filter((id) => id !== "grief");
    const { provider, seen } = scripted({
      context_summary: "يبدو أنك متعب ومرهق من أمور كثيرة.",
      level: "A",
      safety: "safe",
      input_intent: "FEELING",
      recommended_path: "topic_discovery",
      domain: null,
      knowledge_id: null,
      suggested_topics: [
        { id: "patience", title: "عنوان من النموذج", reason: "الثبات مع التعب." },
        { id: "grief", title: "الحزن", reason: "مرتبط بالفقد." },
        { id: "hope", title: "x", reason: "هذا حرام عليك" },
      ],
    });
    const result = await runAnalyze({ message: "تعبت من كل شيء", language: "ar", context: [] }, provider, {
      knowledge: kb,
      readyTopicIds: ready,
    });
    expect(seen[0]!.prompt.topics.map((t) => t.id).sort()).toEqual([...ready].sort());
    expect(result.ok && "route" in result && result.route).toBe("topic_discovery");
    if (!result.ok || !("analyze" in result)) return;
    expect(result.analyze.suggested_topics).toEqual([
      { id: "patience", title: "الصبر", reason: "الثبات مع التعب." },
      // Ruling language in a reason is dropped; the topic stays.
      { id: "hope", title: "الرجاء" },
    ]);
  });

  it("uses English catalog titles for English requests", async () => {
    const { provider } = scripted({
      context_summary: "You seem anxious about the future.",
      level: "A",
      safety: "safe",
      input_intent: "FEELING",
      recommended_path: "topic_discovery",
      suggested_topics: [{ id: "anxiety", title: "قلق", reason: "Worry about what comes next." }],
    });
    const result = await ask("I'm worried about my future", provider, "en");
    expect(result.ok && "analyze" in result && result.analyze.suggested_topics[0]?.title).toBe("Anxiety and fear");
  });

  it("a feeling with no ready topic is an honest insufficient_reference", async () => {
    const { provider } = scripted({
      context_summary: "يبدو أنك فقدت شخصًا عزيزًا.",
      level: "A",
      safety: "safe",
      input_intent: "EXPERIENCE",
      recommended_path: "topic_discovery",
      suggested_topics: [{ id: "grief", reason: "مرتبط بالفقد." }],
    });
    // grief has a verified pack today; simulate it not being ready.
    const result = await runAnalyze({ message: "توفي والدي الأسبوع الماضي", language: "ar", context: [] }, provider, {
      knowledge: kb,
      readyTopicIds: readyTopicIds().filter((id) => id !== "grief"),
    });
    expect(result).toMatchObject({ ok: false, error: "insufficient_reference" });
  });

  it("model 'refer' on a lived experience → human-support referral, not a fatwa referral", async () => {
    const { provider } = scripted({
      context_summary: "يبدو أنك تمر بضيق شديد.",
      level: "A",
      safety: "refer",
      input_intent: "FEELING",
      recommended_path: "referral",
      suggested_topics: [],
    });
    const result = await ask("ما عاد لي طاقة لأي شيء ولا أرى مخرجًا", provider);
    expect(result.ok && "referral" in result && result.referral.reason).toBe("self_harm");
  });
});
