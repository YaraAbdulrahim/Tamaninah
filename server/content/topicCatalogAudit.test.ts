import { describe, expect, it } from "vitest";
import { topics } from "./topics";
import { getContentRecord, verifiedContent, verifiedStories } from "./catalog";
import { assertDisplayableContent } from "./contentPolicy";
import { topicHasPublishedVerifiedQuran, countPublishedVerifiedQuranTopics } from "./topicPackReadiness";
import { LIVE_TOPIC_QURAN_ANCHORS } from "./topicQuranAnchors";

describe("topic catalog audit", () => {
  it("reports catalog vs published verified quran coverage", () => {
    const publishedTopics = topics.filter((t) => t.published);
    const withVerifiedQuran = publishedTopics.filter((t) => topicHasPublishedVerifiedQuran(t));
    expect(publishedTopics.length).toBeGreaterThanOrEqual(9);
    expect(withVerifiedQuran.length).toBeGreaterThanOrEqual(4);
    expect(countPublishedVerifiedQuranTopics()).toBe(withVerifiedQuran.length);
  });

  it("every published topic has exactly one live anchor, listed in its contentIds", () => {
    for (const topic of topics.filter((t) => t.published)) {
      const anchors = LIVE_TOPIC_QURAN_ANCHORS.filter((a) => a.topicId === topic.id);
      expect([topic.id, anchors.length]).toEqual([topic.id, 1]);
      expect(topic.contentIds).toContain(anchors[0]!.contentId);
    }
    expect(new Set(LIVE_TOPIC_QURAN_ANCHORS.map((a) => a.contentId)).size).toBe(LIVE_TOPIC_QURAN_ANCHORS.length);
  });

  it("no published topic points at a local (hand-typed / demo) catalog row", () => {
    for (const topic of topics.filter((t) => t.published)) {
      for (const id of topic.contentIds) {
        expect([topic.id, id, getContentRecord(id)?.provenance.verificationStatus]).toEqual([topic.id, id, "published"]);
      }
      expect(topic.storyId).toBeNull();
    }
  });

  it("the remaining local catalog rows are inert fixtures that can never be displayed", () => {
    for (const row of verifiedContent) {
      expect(row.provenance.verificationStatus).not.toBe("published");
      expect(assertDisplayableContent(row, "A")).not.toBeNull();
      expect(row.arabic).toMatch(/^[a-z-]+$/);
    }
    expect(verifiedStories).toEqual([]);
  });
});
