import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import seerahJson from "./snapshots/seerah.published.json";
import { runJourney } from "../ai/orchestrate";
import { repositoryOnlyProvider } from "../ai/repositoryOnlyProvider";
import { assertDisplayableStory } from "./contentPolicy";
import { hasValidReviewEvidence } from "./provenance";
import { listPublishedStoryRecords } from "./publishedRepository";
import { loadSeerahSnapshot } from "./seerahSnapshot";
import { isContentTypeAllowedForSource, isScriptureAttributionSource } from "./sourceRegistry";
import { arabicSkeleton, hasFootnoteMarker } from "./sourceText";
import { getTopicPackSlotReadiness } from "./topicPackSlots";
import { readyTopicIds } from "./topicPackReadiness";
import { TOPIC_SEERAH_ANCHORS } from "./topicSeerahAnchors";
import { topics } from "./topics";

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const PUBLISHED_TOPICS = topics.filter((t) => t.published).map((t) => t.id).sort();

describe("«موقف من السيرة» — published Seerah passages", () => {
  const stories = listPublishedStoryRecords();

  it("one default passage per topic (plus context passages), from the snapshot, loaded without rejections", () => {
    expect(loadSeerahSnapshot().rejected).toEqual([]);
    const defaults = TOPIC_SEERAH_ANCHORS.filter((a) => a.role === "default");
    expect(defaults.map((a) => a.topicId).sort()).toEqual(PUBLISHED_TOPICS);
    expect(stories.map((s) => s.id).sort()).toEqual(TOPIC_SEERAH_ANCHORS.map((a) => a.storyId).sort());
    for (const a of TOPIC_SEERAH_ANCHORS.filter((x) => x.role === "context")) {
      expect([a.storyId, (a.tags?.length ?? 0) > 3]).toEqual([a.storyId, true]);
    }
    for (const s of stories) {
      const row = seerahJson.records.find((r) => r.storyId === s.id)!;
      expect(s.body).toEqual([row.arabic]);
      expect(sha256(row.arabic)).toBe(row.excerptSha256);
    }
  });

  it("every story has an approved Seerah source, a page URL, its location and verification evidence", () => {
    for (const s of stories) {
      const p = s.provenance;
      expect([s.id, isContentTypeAllowedForSource(p.sourceId, "seerah"), isScriptureAttributionSource(p.sourceId)]).toEqual([
        s.id,
        true,
        true,
      ]);
      expect(p.contentOrigin).toBe("source_text");
      expect(hasValidReviewEvidence(p.reviewEvidence)).toBe(true);
      expect(p.reviewEvidence?.evidenceType).toBe("source_page");
      expect(p.reviewEvidence?.notes).toMatch(/Pass 1 .*Pass 2 .*byte-identical/);
      expect(p.sourceReference.trim().length).toBeGreaterThan(0);
      expect(s.source.url).toMatch(/^https:\/\/shamela\.ws\/book\/(1681|23833)\/\d+$/);
      expect(p.seerah).toMatchObject({ url: s.source.url, sourceReference: p.sourceReference });
      expect(p.seerah?.book?.length).toBeGreaterThan(3);
      expect(p.seerah?.edition?.length).toBeGreaterThan(10);
      expect(p.seerah?.volume).toBeGreaterThan(0);
      expect(p.seerah?.page).toBeGreaterThan(0);
      expect(assertDisplayableStory(s, "A", s.topicId)).toBeNull();
    }
  });

  it("Sahih narrations carry their grade; Ibn Hisham passages carry none", () => {
    const sahih = stories.filter((s) => s.provenance.seerah?.sourceKind === "sahih");
    const book = stories.filter((s) => s.provenance.seerah?.sourceKind === "seerah_book");
    expect(sahih.length + book.length).toBe(stories.length);
    expect(book.length).toBeGreaterThan(0);
    for (const s of sahih) {
      expect(s.provenance.sourceId).toBe("tmn-src-hadith-bukhari-shamela");
      expect(s.provenance.hadith).toMatchObject({ collection: "صحيح البخاري", grade: "صحيح" });
      expect(s.source.reference).toBe(`صحيح البخاري ${s.provenance.hadith?.number}`);
    }
    for (const s of book) {
      expect(s.provenance.sourceId).toBe("tmn-src-seerah-ibn-hisham-shamela");
      expect(s.provenance.hadith).toBeUndefined();
      expect(JSON.stringify(s)).not.toContain("صحيح");
      expect(s.source.reference).toMatch(/^السيرة النبوية لابن هشام ج\d ص\d+$/);
    }
  });

  it("passages are clean prose (no editorial fields, no poetry, no footnote markers, balanced quotes)", () => {
    for (const s of stories) {
      expect([s.headline, s.opening, s.takeaway, s.keep, s.lessons]).toEqual(["", "", "", "", []]);
      const text = s.body.join("\n");
      expect(text).not.toMatch(/[<>]| \.\.\. |⦗/);
      expect(hasFootnoteMarker(text)).toBe(false);
      expect(text.split("«").length).toBe(text.split("»").length);
      expect(text.split("﴿").length).toBe(text.split("﴾").length);
      expect(text.length).toBeLessThanOrEqual(1700);
      // The title is a neutral event label, not a quotation from the passage.
      expect(arabicSkeleton(text).skeleton).not.toContain(arabicSkeleton(s.title).skeleton);
      expect(s.titleEn).toMatch(/^[\x20-\x7e]+$/);
    }
  });

  it("the loader drops tampered or mis-graded rows (fail closed)", () => {
    const bad = structuredClone(seerahJson);
    const ibnHisham = bad.records.findIndex((r) => r.sourceKind === "seerah_book");
    bad.records[0]!.arabic = `${bad.records[0]!.arabic} زيادة`;
    bad.records[1]!.storyId = "seerah-unknown";
    bad.records[2]!.sourceId = "tmn-src-concept-dawa";
    bad.records[3]!.url = "https://example.org/page";
    bad.records[4]!.title = "عنوان آخر";
    bad.records[5]!.arabic = `${bad.records[5]!.arabic} [١]`;
    bad.records[ibnHisham]!.grade = "صحيح";
    const reasons = Object.fromEntries(loadSeerahSnapshot(bad).rejected.map((r) => [r.storyId, r.reason]));
    expect(reasons[seerahJson.records[0]!.storyId]).toBe("TEXT_FINGERPRINT_MISMATCH");
    expect(reasons["seerah-unknown"]).toBe("UNKNOWN_ANCHOR");
    expect(reasons[seerahJson.records[2]!.storyId]).toBe("SOURCE_NOT_ALLOWED");
    expect(reasons[seerahJson.records[3]!.storyId]).toBe("URL_MISMATCH");
    expect(reasons[seerahJson.records[4]!.storyId]).toBe("LABEL_MISMATCH");
    expect(reasons[seerahJson.records[5]!.storyId]).toBe("UNCLEAN_TEXT");
    expect(reasons[seerahJson.records[ibnHisham]!.storyId]).toBe("GRADE_NOT_ALLOWED");
    expect(loadSeerahSnapshot({ kind: "x" }).records).toEqual([]);
  });
});

describe("the journey core includes the Seerah passage", () => {
  it("every ready topic's story slot is READY and its journey carries the story in both languages", async () => {
    for (const topicId of readyTopicIds()) {
      expect([topicId, getTopicPackSlotReadiness(topicId).slots.story.state]).toEqual([topicId, "READY"]);
      for (const language of ["ar", "en"] as const) {
        const result = await runJourney(
          { message: "x", language, context: [], topicId, analyzeLevel: "A" },
          repositoryOnlyProvider,
        );
        expect([topicId, language, result.ok]).toEqual([topicId, language, true]);
        if (!result.ok) continue;
        const story = result.payload.story;
        const anchor = TOPIC_SEERAH_ANCHORS.find((a) => a.topicId === topicId && a.role === "default")!;
        expect(story?.story_id).toBe(anchor.storyId);
        expect(story?.title).toBe(language === "en" ? anchor.titleEn : anchor.title);
        expect(story?.body.length).toBe(1);
        expect(story?.source.url).toMatch(/^https:\/\/shamela\.ws\//);
        expect(result.payload.pack_slots?.find((s) => s.key === "story")?.ready).toBe(true);
      }
    }
  });
});
