import type { ContentSource } from "../../shared/experience/guidance";
import type { ContentProvenance } from "./provenance";
import { getPublishedContentRecord, getPublishedStoryRecord } from "./publishedRepository";
import { quranProvenance, syncVerifiedFlag } from "./catalogProvenance";
import { displayNameForSource } from "./sourceRegistry";

export type { StoredContent, StoredStory } from "./recordTypes";
import type { StoredContent, StoredStory } from "./recordTypes";

function qSource(provenance: ContentProvenance): ContentSource {
  const name = displayNameForSource(provenance.sourceId) ?? "Quran";
  return { name, reference: provenance.sourceReference };
}

function qRecord(input: Omit<StoredContent, "source" | "verified"> & { provenance: ContentProvenance }): StoredContent {
  const verified = syncVerifiedFlag(input.provenance.verificationStatus);
  return { ...input, verified, source: qSource(input.provenance) };
}

/**
 * Local (non-published) catalog rows. All religious text shown to users comes from the published
 * repository (committed snapshots of approved sources — see publishedRepository.ts). The hand-typed
 * verses and editorial seerah narratives that used to live here were removed: nothing typed by
 * hand may be displayed as religious source text.
 *
 * What remains are inert test fixtures with placeholder (non-religious) text. None of them is
 * `published` verification, so the display gate (contentPolicy) can never show them — tests assert it.
 */
export const verifiedContent: StoredContent[] = [
  qRecord({
    id: "quran-fixture-unpublished",
    type: "quran",
    topicId: "topic-unpublished-fixture",
    level: "A",
    published: false,
    title: "Fixture",
    arabic: "fixture",
    translation: "fixture",
    place: "Fixture",
    provenance: quranProvenance({ sourceReference: "0:0", surah: 0, ayah: 0 }),
  }),
  qRecord({
    id: "quran-fixture-unverified",
    type: "quran",
    topicId: "patience",
    level: "A",
    published: true,
    title: "Unverified fixture",
    arabic: "unverified",
    translation: "unverified",
    place: "Fixture",
    provenance: quranProvenance({
      sourceReference: "0:0",
      surah: 0,
      ayah: 0,
      verificationStatus: "rejected",
    }),
  }),
  /** Legacy `repository_demo` status (published flag on, verified flag on) — still never displayable. */
  qRecord({
    id: "quran-fixture-demo",
    type: "quran",
    topicId: "topic-unpublished-fixture",
    level: "A",
    published: true,
    title: "Demo fixture",
    arabic: "demo-fixture",
    translation: "demo-fixture",
    place: "Fixture",
    provenance: quranProvenance({ sourceReference: "0:0", surah: 0, ayah: 0 }),
  }),
];

/** No local stories: a story is only shown when it is verbatim from an approved seerah source. */
export const verifiedStories: StoredStory[] = [];

export function getContentRecord(id: string | null | undefined): StoredContent | null {
  if (!id) return null;
  const published = getPublishedContentRecord(id);
  if (published) return published;
  return verifiedContent.find((entry) => entry.id === id) ?? null;
}

export function getStoryRecord(id: string | null | undefined): StoredStory | null {
  if (!id) return null;
  const published = getPublishedStoryRecord(id);
  if (published) return published;
  return verifiedStories.find((entry) => entry.id === id) ?? null;
}

/** Legacy meta for journey personalization prompts (published repository rows are not listed here). */
export function contentMeta() {
  return verifiedContent
    .filter((c) => c.published && c.provenance.verificationStatus === "published")
    .map(({ id, type, topicId, title }) => ({
      content_id: id,
      type,
      topicId,
      title,
    }));
}

export function storyMeta() {
  return verifiedStories
    .filter((s) => s.published && s.provenance.verificationStatus === "published")
    .map(({ id, topicId, title }) => ({ story_id: id, topicId, title }));
}
