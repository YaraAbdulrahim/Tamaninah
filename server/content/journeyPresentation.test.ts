import { describe, expect, it } from "vitest";
import seerahJson from "./snapshots/seerah.published.json";
import { buildRepositoryJourneyPayload } from "../ai/orchestratePayload";
import { runJourney } from "../ai/orchestrate";
import { repositoryOnlyProvider } from "../ai/repositoryOnlyProvider";
import { beatsFrom, keyQuotesFrom, leadFrom, sliceSpan } from "./presentation";
import { listPublishedContentRecords, listPublishedStoryRecords } from "./publishedRepository";
import { storyFromSeerahSnapshot } from "./seerahSnapshot";
import { normalizeForRouting, selectSeerahAnchor, tagScore } from "./storySelection";
import { BRIDGED_TOPIC_IDS } from "./topicBridges";
import { resolveTopicLearningPack } from "./topicLearning";
import { readyTopicIds } from "./topicPackReadiness";
import { TOPIC_SEERAH_ANCHORS } from "./topicSeerahAnchors";

const SENTENCE_END = /[.؟!»")]$/;

describe("presentation metadata is verbatim", () => {
  const records = listPublishedContentRecords();

  it("every verse and hadith has a highlight that is an exact substring of its stored text", () => {
    for (const r of records.filter((x) => x.type === "quran" || x.type === "hadith")) {
      expect([r.id, typeof r.highlight]).toEqual([r.id, "string"]);
      expect(r.arabic.includes(r.highlight!)).toBe(true);
      expect(r.highlight!.length).toBeLessThanOrEqual(r.arabic.length);
      expect(r.highlight).toBe(r.highlight!.trim());
    }
  });

  it("every tafsir has a lead that is a verbatim prefix ending at a sentence boundary", () => {
    for (const r of records.filter((x) => x.type === "tafsir")) {
      expect([r.id, typeof r.lead]).toEqual([r.id, "string"]);
      expect(r.arabic.startsWith(r.lead!)).toBe(true);
      expect(r.lead).toMatch(SENTENCE_END);
    }
    // 65:3's excerpt has three paragraphs; its lead is the gloss of the reliance clause.
    const t653 = records.find((r) => r.id === "tafsir-tabari-65-3")!;
    expect(t653.lead!.length).toBeLessThan(t653.arabic.length);
    expect(t653.lead!.split("\n")).toHaveLength(2);
  });

  it("every Seerah passage has 2–4 beats that rejoin to the body, and 1–2 key quotes inside it", () => {
    const stories = listPublishedStoryRecords();
    expect(stories.length).toBe(TOPIC_SEERAH_ANCHORS.length);
    for (const s of stories) {
      const body = s.body.join("\n");
      expect([s.id, s.beats?.length && s.beats.length >= 2 && s.beats.length <= 4]).toEqual([s.id, true]);
      expect(s.beats!.join(" ")).toBe(body);
      for (const beat of s.beats!) expect(body.includes(beat)).toBe(true);
      expect(s.keyQuotes!.length).toBeGreaterThanOrEqual(1);
      expect(s.keyQuotes!.length).toBeLessThanOrEqual(2);
      for (const q of s.keyQuotes!) expect(body.includes(q)).toBe(true);
    }
  });

  it("the public payload carries the same verbatim fields", () => {
    for (const topicId of readyTopicIds()) {
      const { pack } = resolveTopicLearningPack(topicId, "A", "ar");
      expect(pack!.quran!.arabic.includes(pack!.quran!.highlight!)).toBe(true);
      expect(pack!.quranExplanation!.arabic.startsWith(pack!.quranExplanation!.lead!)).toBe(true);
      expect(pack!.hadith!.arabic.includes(pack!.hadith!.highlight!)).toBe(true);
      expect(pack!.story!.beats!.join(" ")).toBe(pack!.story!.body.join("\n"));
      for (const q of pack!.story!.key_quotes!) expect(pack!.story!.body.join("\n").includes(q)).toBe(true);
    }
  });

  it("a locator that no longer fits drops the field, not the record", () => {
    const text = "قال: هذا نص للتجربة. ثم انتهى.";
    expect(sliceSpan(text, { start: "غير موجود", end: "انتهى" })).toBeUndefined();
    expect(leadFrom(text, "للتجربة.")).toBe("قال: هذا نص للتجربة.");
    expect(leadFrom(text, "نص")).toBeUndefined(); // not a sentence end
    expect(beatsFrom(text, ["ثم انتهى"])).toEqual(["قال: هذا نص للتجربة.", "ثم انتهى."]);
    expect(beatsFrom(text, ["غير موجود"])).toBeUndefined();
    expect(keyQuotesFrom(text, [{ start: "غير", end: "موجود" }])).toBeUndefined();

    const row = structuredClone(seerahJson.records[0]!);
    row.arabic = `${row.arabic.slice(0, 40)}`;
    const story = storyFromSeerahSnapshot(row as (typeof seerahJson.records)[number] & { sourceKind: "sahih" });
    expect(story.body).toEqual([row.arabic]);
    expect(story.beats).toBeUndefined();
  });
});

describe("context-relevant Seerah (deterministic, model-free)", () => {
  const DEBT = "شايلة هم القروض والديون";

  it("normalizes Arabic for routing (tashkeel, alef forms, ta marbuta, attached prefixes)", () => {
    expect(normalizeForRouting("القُرُوضُ والدُّيون، إيجار!")).toBe("القروض والديون ايجار");
    expect(tagScore(DEBT, ["قروض", "ديون", "مال"])).toBe(2);
    expect(tagScore("ديوني كثيرة", ["ديون"])).toBe(1);
    expect(tagScore("I'm drowning in debts", ["debt"])).toBe(1);
    expect(tagScore("أحس بقلق شديد من المستقبل", ["ديون", "قروض", "الم"])).toBe(0);
  });

  it("«شايلة هم القروض والديون» on the anxiety journey → the debt Seerah; otherwise the default", async () => {
    expect(selectSeerahAnchor("anxiety", DEBT)?.storyId).toBe("seerah-bukhari-2916");
    expect(selectSeerahAnchor("anxiety", "قلقان من بكرة")?.storyId).toBe("seerah-bukhari-3-fear");
    expect(selectSeerahAnchor("anxiety", "")?.storyId).toBe("seerah-bukhari-3-fear");

    const withDebt = await runJourney(
      { message: DEBT, language: "ar", context: [], topicId: "anxiety", analyzeLevel: "A" },
      repositoryOnlyProvider,
    );
    const plain = await runJourney(
      { message: "أحس بخوف من المستقبل", language: "ar", context: [], topicId: "anxiety", analyzeLevel: "A" },
      repositoryOnlyProvider,
    );
    expect(withDebt.ok && withDebt.payload.story?.story_id).toBe("seerah-bukhari-2916");
    expect(withDebt.ok && withDebt.payload.story?.source.reference).toBe("صحيح البخاري 2916");
    expect(plain.ok && plain.payload.story?.story_id).toBe("seerah-bukhari-3-fear");
  });

  it("direct-learning payloads use the same selection (payload builder)", () => {
    const { pack } = resolveTopicLearningPack("anxiety", "A", "ar");
    const payload = buildRepositoryJourneyPayload("anxiety", pack!, "A", "ar", { focus: [], message: DEBT });
    expect(payload.story?.story_id).toBe("seerah-bukhari-2916");
    const noMessage = buildRepositoryJourneyPayload("anxiety", pack!, "A", "ar");
    expect(noMessage.story?.story_id).toBe("seerah-bukhari-3-fear");
  });

  it("each context passage is reachable from its topic, and only from it", () => {
    const cases: [string, string, string][] = [
      ["patience", "أمي مريضة في المستشفى", "seerah-bukhari-5648"],
      ["grief", "توفي ابني الصغير", "seerah-bukhari-1284"],
      ["effort", "تعبت من الشغل والدوام", "seerah-bukhari-2262"],
      ["loss", "خسرت فلوسي كلها", "seerah-bukhari-5416"],
      ["hope", "شايلة هم القروض والديون", "seerah-bukhari-3231"],
    ];
    for (const [topicId, message, storyId] of cases) {
      expect([topicId, selectSeerahAnchor(topicId, message)?.storyId]).toEqual([topicId, storyId]);
    }
  });
});

describe("bridges (curated product copy)", () => {
  it("every ready topic's payload has all bridges in both languages, without scripture markers", async () => {
    expect([...BRIDGED_TOPIC_IDS].sort()).toEqual([...readyTopicIds()].sort());
    for (const topicId of readyTopicIds()) {
      for (const language of ["ar", "en"] as const) {
        const result = await runJourney(
          { message: "x", language, context: [], topicId, analyzeLevel: "A" },
          repositoryOnlyProvider,
        );
        if (!result.ok) throw new Error(`${topicId} journey failed`);
        const b = result.payload.bridges!;
        const lines = [b.quran, b.tafsir, b.hadith, b.seerah, b.connect?.title, ...(b.connect?.points ?? [])];
        expect(lines).toHaveLength(8);
        for (const line of lines) {
          expect([topicId, language, Boolean(line?.trim())]).toEqual([topicId, language, true]);
          expect(line).not.toMatch(/[﴿﴾«»]|قال رسول|حرام|حلال|يجب|واجب/);
        }
        if (language === "en") expect(lines.join(" ")).not.toMatch(/[؀-ۿ]/);
        else expect(lines.join(" ")).not.toMatch(/تشعرين|تمرين|تعيشين|عزيزتي|عزيزي/);
      }
    }
  });
});
