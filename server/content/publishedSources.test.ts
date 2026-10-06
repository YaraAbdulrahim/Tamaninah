import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import tafsirJson from "./snapshots/tafsir.published.json";
import hadithJson from "./snapshots/hadith.published.json";
import { runJourney } from "../ai/orchestrate";
import { repositoryOnlyProvider } from "../ai/repositoryOnlyProvider";
import { getStoryRecord } from "./catalog";
import { assertDisplayableContent } from "./contentPolicy";
import { hasValidReviewEvidence } from "./provenance";
import {
  getPublishedContentRecord,
  listPublishedContentRecords,
  listPublishedStoryRecords,
} from "./publishedRepository";
import {
  isAllowlistedSourceId,
  isContentTypeAllowedForSource,
  isScriptureAttributionSource,
} from "./sourceRegistry";
import { loadHadithSnapshot, loadTafsirSnapshot } from "./sourceSnapshot";
import {
  arabicSkeleton,
  cleanQuranpediaBookPages,
  cleanShamelaNass,
  hasFootnoteMarker,
  locateExcerpt,
} from "./sourceText";
import { resolveTopicLearningPack } from "./topicLearning";
import { getTopicPackSlotReadiness } from "./topicPackSlots";
import { readyTopicIds } from "./topicPackReadiness";
import { getTopicQuranAnchor } from "./topicQuranAnchors";
import { TOPIC_HADITH_SOURCE_ANCHORS, TOPIC_TAFSIR_ANCHORS } from "./topicSourceAnchors";
import { topics } from "./topics";

const here = dirname(fileURLToPath(import.meta.url));
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const ALLOWED_HOSTS = new Set(["api.quranpedia.net", "quranpedia.net", "shamela.ws"]);
const PUBLISHED_TOPICS = topics.filter((t) => t.published).map((t) => t.id).sort();
const ARABIC = /[؀-ۿ]/;

describe("published religious content — provenance and evidence", () => {
  const records = listPublishedContentRecords();

  it("publishes a verse, a tafsir excerpt and a hadith for every topic", () => {
    expect(records.filter((r) => r.type === "quran")).toHaveLength(10);
    expect(records.filter((r) => r.type === "tafsir")).toHaveLength(10);
    expect(records.filter((r) => r.type === "hadith")).toHaveLength(10);
    expect(records.every((r) => ["quran", "tafsir", "hadith"].includes(r.type))).toBe(true);
  });

  it("every published item has an approved source, a reference and valid verification evidence", () => {
    for (const r of records) {
      const label = `${r.id}`;
      expect([label, isAllowlistedSourceId(r.provenance.sourceId)]).toEqual([label, true]);
      expect([label, isContentTypeAllowedForSource(r.provenance.sourceId, r.type)]).toEqual([label, true]);
      expect([label, isScriptureAttributionSource(r.provenance.sourceId)]).toEqual([label, true]);
      expect(r.provenance.sourceReference.trim().length).toBeGreaterThan(0);
      expect(r.provenance.contentOrigin).toBe("source_text");
      expect(hasValidReviewEvidence(r.provenance.reviewEvidence)).toBe(true);
      expect(["live_api", "source_page"]).toContain(r.provenance.reviewEvidence?.evidenceType);
      expect(assertDisplayableContent(r, "A", r.topicId)).toBeNull();
      if (r.type === "quran") {
        expect(r.provenance.quran?.edition).toMatch(/^quranpedia-mushaf-\d+$/);
        expect(r.provenance.reviewEvidence?.checkedAgainst).toMatch(/^api-v1-mushafs-/);
      } else {
        expect(r.source.url).toMatch(/^https:\/\/(quranpedia\.net|shamela\.ws)\//);
        expect(r.provenance.reviewEvidence?.notes).toMatch(/Pass 2/);
      }
    }
  });

  it("snapshot rows carry fetch times, requests to approved hosts only, hashes and a verification note", () => {
    const rows = [...tafsirJson.records, ...hadithJson.records];
    expect(rows).toHaveLength(TOPIC_TAFSIR_ANCHORS.length + TOPIC_HADITH_SOURCE_ANCHORS.length);
    for (const row of rows) {
      expect(sha256(row.arabic)).toBe(row.excerptSha256);
      expect(Date.parse(row.verifiedAt)).toBeGreaterThanOrEqual(Date.parse(row.fetchedAt));
      expect(row.requests.length).toBeGreaterThanOrEqual(2);
      for (const url of row.requests) expect(ALLOWED_HOSTS.has(new URL(url).host)).toBe(true);
      expect(row.verification_note).toMatch(/Pass 1 .*Pass 2 .*byte-identical/);
    }
    expect(loadTafsirSnapshot().rejected).toEqual([]);
    expect(loadHadithSnapshot().rejected).toEqual([]);
  });

  it("excerpts are clean: no markup, no footnote markers, at most three paragraphs", () => {
    for (const r of records.filter((x) => x.type !== "quran")) {
      expect(r.arabic).not.toMatch(/[<>]|&[a-z]+;|⦗/);
      expect(hasFootnoteMarker(r.arabic)).toBe(false);
      expect(r.arabic.split("\n").length).toBeLessThanOrEqual(3);
      expect(r.arabic).toMatch(/[.؟!»")]$/);
    }
  });
});

describe("no editorial or hand-typed fixture can be published", () => {
  it("the tawakkul fixture bundles and their pipeline are gone", () => {
    expect(existsSync(resolve(here, "ingestion/fixtures"))).toBe(false);
    expect(existsSync(resolve(here, "ingestion/tawakkulPipeline.ts"))).toBe(false);
    expect(existsSync(resolve(here, "ingestion/publishBundles.ts"))).toBe(false);
    expect(getPublishedContentRecord("hadith-tawakkul-umar")).toBeNull();
    expect(getPublishedContentRecord("concept-tawakkul-v1")).toBeNull();
    expect(getStoryRecord("seerah-taif-tawakkul")).toBeNull();
  });

  it("nothing published is editorial or from an internal bundle; stories carry no editorial fields", () => {
    for (const r of listPublishedContentRecords()) {
      expect(r.provenance.reviewEvidence?.evidenceType).not.toBe("editorial_internal");
      expect(r.provenance.reviewEvidence?.evidenceType).not.toBe("internal_snapshot");
      expect(r.provenance.contentOrigin).not.toBe("reviewed_explanation");
      expect(["concept", "seerah"]).not.toContain(r.type);
    }
    for (const s of listPublishedStoryRecords()) {
      expect(s.provenance.contentOrigin).toBe("source_text");
      expect(s.provenance.reviewEvidence?.evidenceType).toBe("source_page");
      expect([s.headline, s.opening, s.takeaway, s.keep, s.lessons, s.scenes]).toEqual(["", "", "", "", [], undefined]);
    }
  });

  it("the loaders drop tampered or under-documented rows (fail closed)", () => {
    const tafsir = structuredClone(tafsirJson);
    tafsir.records[0]!.arabic = `${tafsir.records[0]!.arabic} زيادة`;
    tafsir.records[1]!.contentId = "tafsir-unknown";
    tafsir.records[2]!.sourceId = "tmn-src-concept-dawa";
    tafsir.records[3]!.verification_note = "";
    tafsir.records[4]!.url = "https://example.org/x";
    expect(loadTafsirSnapshot(tafsir).rejected.map((r) => r.reason)).toEqual([
      "TEXT_FINGERPRINT_MISMATCH",
      "UNKNOWN_ANCHOR",
      "SOURCE_NOT_ALLOWED",
      "MISSING_VERIFICATION_NOTE",
      "URL_MISMATCH",
    ]);

    const hadith = structuredClone(hadithJson);
    hadith.records[0]!.grade = "";
    hadith.records[1]!.arabic = `${hadith.records[1]!.arabic} (١)`;
    hadith.records[2]!.shamelaPageId = 1;
    hadith.records[3]!.fetchedAt = "not a date";
    expect(loadHadithSnapshot(hadith).rejected.map((r) => r.reason)).toEqual([
      "MISSING_GRADE",
      "UNCLEAN_TEXT",
      "ANCHOR_MISMATCH",
      "INVALID_FETCH_TIMES",
    ]);
    expect(loadHadithSnapshot({ kind: "x" }).records).toEqual([]);
  });
});

describe("learning packs per topic", () => {
  it("every published topic is ready with a verified Quran slot", () => {
    expect(readyTopicIds().sort()).toEqual(PUBLISHED_TOPICS);
    for (const id of PUBLISHED_TOPICS) {
      const slots = getTopicPackSlotReadiness(id).slots;
      expect([id, slots.quran.state, slots.quran.evidenceType]).toEqual([id, "READY", "live_api"]);
      expect([id, slots.quran_explanation.state, slots.hadith.state, slots.story.state]).toEqual([
        id,
        "READY",
        "READY",
        "READY",
      ]);
    }
  });

  it("the tafsir explains the topic's exact verse; the hadith carries collection, كتاب/باب, number, edition, page and grade", () => {
    for (const id of PUBLISHED_TOPICS) {
      const { pack } = resolveTopicLearningPack(id, "A", "ar");
      const verse = getTopicQuranAnchor(id)!;
      expect(pack?.quran?.provenance.quran).toMatchObject({ surah: verse.surah, ayah: verse.ayah });
      expect(pack?.quranExplanation?.type).toBe("tafsir");
      expect(pack?.quranExplanation?.provenance.tafsir).toMatchObject({ surah: verse.surah, ayah: verse.ayah });
      expect(pack?.quranExplanation?.source.url).toContain(`surah=${verse.surah}&ayah=${verse.ayah}`);

      const h = pack?.hadith?.provenance.hadith;
      expect(["صحيح البخاري", "صحيح مسلم"]).toContain(h?.collection);
      expect(h?.grade).toBe("صحيح");
      expect(h?.gradeBasis).toContain("الأحاديث الصحيحة من الصحيحين");
      expect(h?.book).toContain("كتاب");
      expect(h?.chapter).toContain("باب");
      expect(h?.edition?.length).toBeGreaterThan(10);
      expect(h?.url).toMatch(/^https:\/\/shamela\.ws\/book\/(1681|1727)\/\d+$/);
      expect(pack?.hadith?.reference).toBe(`${h?.collection} ${h?.number}`);
      expect(pack?.hadith?.source.url).toBe(h?.url);
      expect(pack?.hadith?.place).toContain(h!.book!);
    }
  });

  it("each ready topic's journey payload carries a non-empty step in both languages (no verses, hadith or rulings)", async () => {
    for (const topicId of readyTopicIds()) {
      for (const language of ["ar", "en"] as const) {
        const result = await runJourney(
          { message: "x", language, context: [], topicId, analyzeLevel: "A" },
          repositoryOnlyProvider,
        );
        expect([topicId, language, result.ok]).toEqual([topicId, language, true]);
        if (!result.ok) continue;
        const step = result.payload.suggested_action;
        expect(["quran", "dua", "charity", "reach_out"]).toContain(step.type);
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.description.trim().length).toBeGreaterThan(0);
        const text = `${step.title} ${step.description}`;
        expect(text).not.toMatch(/[﴿﴾ﷺ]|قال رسول|حديث|حرام|يجب|واجب/);
        if (language === "en") expect(ARABIC.test(text)).toBe(false);
        else expect(ARABIC.test(text)).toBe(true);
      }
    }
  });
});

describe("source text helpers", () => {
  it("locates an excerpt without tashkeel but returns the original slice with it", () => {
    const text = "مقدمة. قَالَ: «إِنَّ الْعَيْنَ تَدْمَعُ.» بعده";
    const loc = locateExcerpt(text, "قال: «إن", "تدمع.»");
    expect(loc.text).toBe("قَالَ: «إِنَّ الْعَيْنَ تَدْمَعُ.»");
    expect(arabicSkeleton(loc.text).skeleton).toBe("قال: «إن العين تدمع.»");
    expect(() => locateExcerpt("أ ب أ ب", "أ", "ب")).toThrow(/2 times/);
  });

  it("strips Shamela apparatus (copy buttons, hamesh, printed-page markers) but no words", () => {
    const nass =
      '<p><span class="anchor"></span>١ - عَنْ زَيْدٍ: «نَصٌّ<a href="#p1" class="btn_tag btn"><span>x</span></a></p>' +
      "<p>⦗١٢⦘</p><p>بَاقٍ.»</p><hr><p class=\"hamesh\">(نص) حاشية المحقق</p>";
    expect(cleanShamelaNass(nass)).toBe("١ - عَنْ زَيْدٍ: «نَصٌّ بَاقٍ.»");
  });

  it("drops Quranpedia footnote blocks and orders pages", () => {
    const pages = [
      { part: "3", page: 2, text: "تتمة الكلام.<br />" },
      { part: "3", page: 1, text: 'أول الكلام (١) و<div class="foot-notes">(١) حاشية</div>' },
    ];
    expect(cleanQuranpediaBookPages(pages).text).toBe("أول الكلام (١) و تتمة الكلام.");
    expect(hasFootnoteMarker("أول الكلام (١) و")).toBe(true);
    expect(hasFootnoteMarker("﴿الْحَمْدُ لِلَّهِ (٢)﴾")).toBe(false);
  });
});
