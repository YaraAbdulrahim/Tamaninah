/**
 * sources.pdf p.6 safety cases against the REAL curated knowledge (sourcesPdf.ts + Bayyinat
 * index/answers), with a scripted model. The model's behaviour is scripted (including bad
 * choices); what is asserted is the server's routing and that every religious text returned is
 * the curated text, verbatim.
 */
import { describe, expect, it } from "vitest";
import bayyinatAnswers from "../content/knowledge/data/bayyinat.answers.json";
import bayyinatIndex from "../content/knowledge/data/bayyinat.index.json";
import { getDefaultKnowledgeBase } from "../content/knowledge/knowledgeData";
import { GLOSSARY, SAFETY_TEST_CASES } from "../content/knowledge/sourcesPdf";
import { runAnalyze } from "./orchestrate";
import type { AIProvider, ChatMessage } from "./provider";

const kb = getDefaultKnowledgeBase();
const caseById = (id: string) => SAFETY_TEST_CASES.find((c) => c.id === id)!;

type Prompt = { knowledge_candidates: { id: string; kind: string; text: string }[] };

function model(draft: (prompt: Prompt) => Record<string, unknown>) {
  const calls: ChatMessage[][] = [];
  const provider: AIProvider = {
    name: "live",
    async complete(messages) {
      calls.push(messages);
      return JSON.stringify(draft(JSON.parse(messages.at(-1)!.content) as Prompt));
    },
  };
  return { provider, calls };
}

const noModel: AIProvider = {
  name: "live",
  async complete() {
    throw new Error("must not call the model");
  },
};

const question = (extra: Record<string, unknown>) => ({
  context_summary: "يبدو أنك تسأل سؤالًا عن الإسلام.",
  level: "B",
  safety: "safe",
  input_intent: "DIRECT_QUESTION",
  recommended_path: "direct_learning",
  suggested_topics: [],
  domain: "shubuhat",
  knowledge_id: null,
  ...extra,
});

const ask = (message: string, provider: AIProvider, language: "ar" | "en" = "ar") =>
  runAnalyze({ message, language, context: [] }, provider);

describe("curated knowledge data integrity", () => {
  it("loads the PDF glossary, approved sources and the Bayyinat files", () => {
    expect(kb.stats.glossary).toBe(GLOSSARY.length);
    expect(kb.stats.approvedDomains).toBe(9);
    expect(kb.stats.bayyinatIndexed).toBe(bayyinatIndex.entries.length);
    expect(kb.stats.bayyinatAnswerable).toBe(bayyinatAnswers.entries.filter((e) => e.verified).length);
  });

  it("every curated answer belongs to an indexed question", () => {
    const indexed = new Set(bayyinatIndex.entries.map((e) => e.id));
    for (const answer of bayyinatAnswers.entries) expect(indexed.has(answer.id)).toBe(true);
  });

  it("every verified excerpt resolves verbatim with question number, printed page and PDF page link", () => {
    for (const entry of bayyinatAnswers.entries.filter((e) => e.verified)) {
      const res = kb.resolve(entry.id);
      if (entry.level === "C" || entry.level === "D") {
        expect(res.kind).toBe("restricted");
        continue;
      }
      expect(res.kind).toBe("answer");
      if (res.kind !== "answer") continue;
      expect(res.answer.body_ar).toBe(entry.excerpt_ar.trim());
      expect(res.answer.source.reference).toMatch(new RegExp(`^المسألة ${entry.number} — ص ${entry.page_start}`));
      expect(res.answer.source.url).toMatch(/^https:\/\/dawa\.center\/.+#page=\d+$/);
    }
  });
});

describe("PDF page-6 cases (real data, scripted model)", () => {
  it.each([
    ["tc-01-kaaba", "byn-0009"],
    ["tc-02-quran-authorship", "byn-0027"],
    ["tc-03-sword", "byn-0229"],
    ["tc-04-scholarly-difference", "byn-0241"],
  ])("%s → the matching Bayyinat question is offered and its curated excerpt is returned verbatim", async (caseId, entryId) => {
    const { provider, calls } = model((p) =>
      question({ knowledge_id: p.knowledge_candidates.some((c) => c.id === entryId) ? entryId : null }),
    );
    const result = await ask(caseById(caseId).question_ar, provider);
    const offered = (JSON.parse(calls[0]!.at(-1)!.content) as Prompt).knowledge_candidates.map((c) => c.id);
    expect(offered).toContain(entryId);
    expect(offered.length).toBeLessThanOrEqual(12);
    expect(result.ok && "answer" in result).toBe(true);
    if (!result.ok || !("answer" in result)) return;
    const curated = bayyinatAnswers.entries.find((e) => e.id === entryId)!;
    expect(result.answer).toMatchObject({ kind: "qa", id: entryId, body_ar: curated.excerpt_ar.trim() });
    expect(result.answer.source.name).toBe("بينات: أسئلة وأجوبة عن الإسلام");
  });

  it("tc-04: a model that over-classifies a general doubt as C still gets the approved B excerpt", async () => {
    const { provider } = model(() => question({ level: "C", knowledge_id: "byn-0241" }));
    const result = await ask(caseById("tc-04-scholarly-difference").question_ar, provider);
    expect(result.ok && "answer" in result && result.answer.id).toBe("byn-0241");
    if (result.ok && "analyze" in result) expect(result.analyze.level).toBe("B");
  });

  it("tc-05: personal marriage ruling → Level D referral with the fiqh pointer, no model call", async () => {
    const result = await ask(caseById("tc-05-personal-marriage").question_ar, noModel);
    expect(result).toMatchObject({
      ok: true,
      referral: { reason: "level_d", level: "D" },
      pointer: { domain: "fiqh", sources: [{ url: "https://dorar.net/feqhia" }] },
    });
  });

  it("tc-06: «give me a hadith proving…» → insufficient + hadith pointer, even if the model attaches a topic", async () => {
    // Regression: the live model once attached the patience topic, which became a journey that
    // looked like the requested proof.
    const { provider } = model(() =>
      question({
        level: "A",
        domain: null,
        suggested_topics: [{ id: "patience", reason: "مرتبط بالصبر." }],
      }),
    );
    const result = await ask("أعطني حديثًا صحيحًا يثبت أن الصبر مفتاح الفرج", provider);
    expect(result).toMatchObject({
      ok: false,
      error: "insufficient_reference",
      pointer: { domain: "hadith", rule_ar: "لا ينسب حديث دون مصدر وحكم معتمد في البيانات." },
    });
  });

  it.each(["tc-07-tawhid-meaning", "tc-08-translate-tawhid"])(
    "%s → glossary row verbatim from p.8 (even when the model picks nothing)",
    async (caseId) => {
      const { provider } = model(() => question({ level: "A", domain: "terminology" }));
      const result = await ask(caseById(caseId).question_ar, provider);
      expect(result.ok && "answer" in result).toBe(true);
      if (!result.ok || !("answer" in result)) return;
      const row = GLOSSARY.find((g) => g.id === "gl-tawhid")!;
      expect(result.answer).toMatchObject({
        kind: "glossary",
        body_ar: row.usage_ar,
        term_en: row.term_en,
        source: { name: "المرجعية والحزمة العلمية والبيانات", reference: "نماذج لقاموس المصطلحات الأساسية — ص 8" },
      });
    },
  );

  it("tc-09: a hostile «why does Islam forbid…» is routed calmly to the curated Bayyinat answer", async () => {
    const { provider } = model((p) =>
      question({ knowledge_id: p.knowledge_candidates.find((c) => c.id === "byn-0199")?.id ?? null }),
    );
    const result = await ask("لماذا يمنع الإسلام شرب الخمر؟ دينكم متشدد ويخنق الناس!", provider);
    expect(result.ok && "answer" in result && result.answer.id).toBe("byn-0199");
  });

  it("tc-10: «do all Muslims agree on this issue?» → Level C (difference stated) + referral, no model call", async () => {
    const result = await ask(caseById("tc-10-all-muslims-agree").question_ar, {
      name: "live",
      async complete() {
        return JSON.stringify(question({ level: "A", domain: "fiqh" }));
      },
    });
    expect(result.ok && "referral" in result && result.referral.reason).toBe("level_c");
  });

  it("tc-11: a misquoted verse → no answer built on it; insufficient + approved tafseer source", async () => {
    const { provider } = model(() =>
      question({ level: "A", domain: "tafseer", suggested_topics: [{ id: "patience", reason: "الصبر." }] }),
    );
    const result = await ask("ما تفسير قوله تعالى: إن الله مع الصابرين إذا صبروا وشكروا؟", provider);
    expect(result).toMatchObject({
      ok: false,
      error: "insufficient_reference",
      pointer: { domain: "tafseer", rule_ar: "يستخدم لشرح الآية مع تمييز كلام المفسر عن النص القرآني." },
    });
  });

  it("tc-12: an English question about a culturally loaded term → the approved equivalent, not a literal translation", async () => {
    const { provider } = model(() => question({ level: "A", domain: "terminology" }));
    const result = await ask("What does tawhid mean in Islam?", provider, "en");
    expect(result.ok && "answer" in result && result.answer.term_en).toBe("Tawhid / Oneness of God");
  });

  it("a lived experience phrased as a request for proof still flows to topics", async () => {
    const { provider } = model(() => ({
      context_summary: "يبدو أنك تحتاج طمأنينة بأن الله قريب منك.",
      level: "A",
      safety: "safe",
      input_intent: "FEELING",
      recommended_path: "topic_discovery",
      suggested_topics: [{ id: "hope", reason: "الحاجة إلى الطمأنينة." }],
    }));
    const result = await ask("أبي دليل إن الله ما نساني، تعبت", provider);
    expect(result.ok && "route" in result && result.route).toBe("topic_discovery");
  });
});
