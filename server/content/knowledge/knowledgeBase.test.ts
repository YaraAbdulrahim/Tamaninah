import { describe, expect, it } from "vitest";
import { contentTokens, normalizeArabic, stemArabic } from "./arabicText";
import { EMPTY_KNOWLEDGE_BASE } from "./knowledgeBase";
import { getDefaultKnowledgeBase } from "./knowledgeData";
import { FIXTURE_EXCERPT, fixtureKnowledgeBase, knowledgeFixtureData } from "./testFixtures";

describe("arabic normalization", () => {
  it("strips tashkeel/tatweel and unifies alef, ya and ta marbuta", () => {
    expect(normalizeArabic("الإِسْلامُ")).toBe("الاسلام");
    expect(normalizeArabic("أإآٱ")).toBe("اااا");
    expect(normalizeArabic("مُصطفى")).toBe("مصطفي");
    expect(normalizeArabic("الكعبـــة")).toBe("الكعبه");
    expect(normalizeArabic("القرآنُ؟!")).toBe("القران");
  });

  it("stems articles and clitics so spelling variants meet", () => {
    expect(stemArabic(normalizeArabic("بالتوحيد"))).toBe(stemArabic(normalizeArabic("التوحيد")));
    expect(stemArabic(normalizeArabic("الكعبة"))).toBe(stemArabic(normalizeArabic("كعبة")));
    expect(contentTokens("هل القرآن من تأليف محمد؟")).toEqual(["قران", "تاليف", "محمد"]);
  });
});

describe("knowledge engine", () => {
  const kb = fixtureKnowledgeBase();

  it("detects an explicit meaning / translation question about one glossary term", () => {
    expect(kb.explicitGlossaryMatch("ما معنى التوحيد؟")?.id).toBe("gl-tawhid");
    expect(kb.explicitGlossaryMatch("ترجم كلمة التوحيد إلى الإنجليزية")?.id).toBe("gl-tawhid");
    expect(kb.explicitGlossaryMatch("ما معنى التوحيد لشخص لم يسمع بالمصطلح من قبل؟")?.id).toBe("gl-tawhid");
    expect(kb.explicitGlossaryMatch("What does tawhid mean?")?.id).toBe("gl-tawhid");
    // The term is not the object of the meaning cue.
    expect(kb.explicitGlossaryMatch("ما معنى الصبر في الإسلام؟")).toBeNull();
    expect(kb.explicitGlossaryMatch("هل الإسلام انتشر بالسيف؟")).toBeNull();
  });

  it("matches only a question about the term itself — not filler «يعني» or a term that introduces something else", () => {
    const real = getDefaultKnowledgeBase();
    for (const message of ["ما معنى التوحيد؟", "ترجم كلمة التوحيد", "translate tawhid", "what does tawhid mean"]) {
      expect(real.explicitGlossaryMatch(message)?.id, message).toBe("gl-tawhid");
    }
    expect(real.explicitGlossaryMatch("ما معنى الحديث؟")?.id).toBe("gl-hadith");
    for (const message of [
      "ما معنى حديث إنما الأعمال بالنيات؟", // a specific hadith, not the term «الحديث»
      "ما معنى حديث جبريل؟",
      "يعني الإسلام دين إرهاب؟", // «يعني» is filler, not a meaning cue
      "what does islam mean by jihad", // asks about jihad
      "what does jihad mean in islam",
      "Islam means peace?",
    ]) {
      expect(real.explicitGlossaryMatch(message), message).toBeNull();
    }
  });

  it("resolves a glossary id to the verbatim PDF row with its source", () => {
    const res = kb.resolve("gl-tawhid");
    expect(res.kind).toBe("answer");
    if (res.kind !== "answer") return;
    const row = knowledgeFixtureData.glossary.find((g) => g.id === "gl-tawhid")!;
    expect(res.answer).toMatchObject({
      kind: "glossary",
      domain: "terminology",
      level: "A",
      title_ar: "التوحيد",
      term_en: "Tawhid / Oneness of God",
      body_ar: row.usage_ar,
      source: {
        name: "المرجعية والحزمة العلمية والبيانات",
        reference: "نماذج لقاموس المصطلحات الأساسية — ص 8",
        url: "https://islamic-content.com/dictionary",
      },
    });
  });

  it("pre-filters Bayyinat questions lexically (with phrasing expansion)", () => {
    const kaaba = kb.findCandidates("لماذا يعبد المسلمون الكعبة؟");
    expect(kaaba[0]?.id).toBe("byn-0009");
    expect(kaaba[0]?.answerable).toBe(true);

    const authorship = kb.findCandidates("هل القرآن من تأليف محمد؟").map((c) => c.id);
    expect(authorship).toContain("byn-0027");
    expect(authorship.indexOf("byn-0027")).toBeLessThan(authorship.indexOf("byn-0026"));

    expect(kb.findCandidates("كيف أصلح سيارتي؟")).toEqual([]);
    expect(kb.findCandidates("ما معنى التوحيد؟")[0]).toMatchObject({ id: "gl-tawhid", kind: "glossary" });
  });

  it("caps the candidate list", () => {
    expect(kb.findCandidates("القرآن الكريم وثيقة مصدره البشر القراءات", 2)).toHaveLength(2);
  });

  it("resolves a verified Bayyinat excerpt verbatim with «المسألة N — ص P»", () => {
    const res = kb.resolve("byn-0009");
    expect(res.kind).toBe("answer");
    if (res.kind !== "answer") return;
    expect(res.answer).toMatchObject({
      kind: "qa",
      id: "byn-0009",
      level: "B",
      domain: "shubuhat",
      title_ar: "لماذا يعبد المسلمون الكعبة، والحجر الأسود؟",
      body_ar: FIXTURE_EXCERPT,
      source: {
        name: "بينات: أسئلة وأجوبة عن الإسلام",
        reference: "المسألة 9 — ص 65–66",
        url: "https://dawa.center/file/7937/download#page=66",
      },
    });
  });

  it("index-only or unverified questions resolve to a pointer at the exact question and page", () => {
    for (const id of ["byn-0027", "byn-0004"]) {
      const res = kb.resolve(id);
      expect(res.kind).toBe("index_only");
      if (res.kind !== "index_only") continue;
      expect(res.pointer.domain).toBe("shubuhat");
      expect(res.pointer.rule_ar).toBe("تعد مصدرًا أساسيًا للحلول الحوارية في الشبهات");
      expect(res.pointer.sources[0]!.name).toContain("المسألة");
      expect(res.pointer.sources[0]!.url).toMatch(/#page=\d+$/);
    }
    const authorship = kb.resolve("byn-0027");
    if (authorship.kind === "index_only") {
      expect(authorship.pointer.sources[0]!.name).toContain("ادعاء أن القرآن مصدره البشر.");
      expect(authorship.pointer.sources[0]!.name).toContain("ص 137");
    }
  });

  it("a verified level-C excerpt is restricted (referral, not an answer)", () => {
    expect(kb.resolve("byn-0056").kind).toBe("restricted");
  });

  it("unknown ids resolve to nothing", () => {
    expect(kb.resolve("byn-9999").kind).toBe("unknown");
    expect(kb.resolve("made-up").kind).toBe("unknown");
  });

  it("builds domain pointers from the PDF approved-sources table (absolute URLs)", () => {
    const pointer = kb.pointerFor("dawah");
    expect(pointer?.rule_ar).toBe("مرجعان شاملان");
    expect(pointer?.sources.map((s) => s.url)).toEqual(["https://dawa.center", "https://islamic-content.com"]);
    expect(kb.pointerFor(null)).toBeNull();
    expect(kb.pointerFor("seerah")).toBeNull();
  });

  it("an empty knowledge base never answers", () => {
    expect(EMPTY_KNOWLEDGE_BASE.findCandidates("ما معنى التوحيد؟")).toEqual([]);
    expect(EMPTY_KNOWLEDGE_BASE.resolve("gl-tawhid").kind).toBe("unknown");
    expect(EMPTY_KNOWLEDGE_BASE.pointerFor("fiqh")).toBeNull();
  });
});
