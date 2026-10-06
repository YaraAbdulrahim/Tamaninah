import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublishedContentRecord, mergePublishedContentRecords } from "./publishedRepository";
import * as topicLearning from "./topicLearning";
import { readyTopicIds } from "./topicPackReadiness";

describe("readyTopicIds memoization", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resolves packs once and serves the cached list until the published repository changes", () => {
    const first = readyTopicIds();
    const resolve = vi.spyOn(topicLearning, "resolveTopicLearningPack");

    const again = readyTopicIds();
    expect(again).toEqual(first);
    expect(resolve).not.toHaveBeenCalled();
    // Each caller gets its own copy of the cached list.
    again.pop();
    expect(readyTopicIds()).toEqual(first);

    // Any merge into the published repository invalidates the cache.
    mergePublishedContentRecords([getPublishedContentRecord("quran-talaq-3")!]);
    expect(readyTopicIds()).toEqual(first);
    expect(resolve).toHaveBeenCalled();
  });

  it("a merged record that breaks a topic's pack drops the topic; restoring it brings the topic back", () => {
    const before = readyTopicIds();
    expect(before).toContain("tawakkul");
    const original = getPublishedContentRecord("quran-talaq-3")!;
    mergePublishedContentRecords([
      { ...original, provenance: { ...original.provenance, verificationStatus: "pending_review" } },
    ]);
    try {
      expect(readyTopicIds()).not.toContain("tawakkul");
    } finally {
      mergePublishedContentRecords([original]);
    }
    expect(readyTopicIds()).toEqual(before);
  });
});
