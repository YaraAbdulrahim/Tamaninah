import type { StoredContent, StoredStory } from "./recordTypes";
import { loadQuranSnapshot } from "./quranSnapshot";
import { loadHadithSnapshot, loadTafsirSnapshot } from "./sourceSnapshot";
import { loadSeerahSnapshot } from "./seerahSnapshot";

/**
 * Runtime authority for displayable religious content. Every row comes from a committed snapshot
 * of an approved source, replayed through the publish gates synchronously at module init (no
 * network on cold start):
 *   - snapshots/quran.published.json   — Quranpedia mushaf + translation   (npm run snapshot:quran)
 *   - snapshots/tafsir.published.json  — Tafsir al-Tabari via Quranpedia   (server/scripts/snapshotContent.ts)
 *   - snapshots/hadith.published.json  — Sahih al-Bukhari / Muslim, shamela (server/scripts/snapshotContent.ts)
 *   - snapshots/seerah.published.json  — «موقف من السيرة»: Sahih al-Bukhari narrations / Sirat Ibn Hisham
 *                                        (server/scripts/snapshotContent.ts); stories with verbatim body only
 * Nothing hand-typed or editorial is published here.
 */
const publishedContent = new Map<string, StoredContent>();
const publishedStories = new Map<string, StoredStory>();

const quranSnapshot = loadQuranSnapshot();
const tafsirSnapshot = loadTafsirSnapshot();
const hadithSnapshot = loadHadithSnapshot();
const seerahSnapshot = loadSeerahSnapshot();
for (const story of seerahSnapshot.records) publishedStories.set(story.id, story);
if (seerahSnapshot.rejected.length) {
  console.warn(
    `[content] seerah snapshot rejected ${seerahSnapshot.rejected.length} record(s): ${seerahSnapshot.rejected
      .map((r) => `${r.storyId}:${r.reason}`)
      .join(", ")}`,
  );
}

for (const snapshot of [quranSnapshot, tafsirSnapshot, hadithSnapshot]) {
  for (const record of snapshot.records) publishedContent.set(record.id, record);
}

for (const [label, snapshot] of [
  ["quran", quranSnapshot],
  ["tafsir", tafsirSnapshot],
  ["hadith", hadithSnapshot],
] as const) {
  if (snapshot.rejected.length) {
    console.warn(
      `[content] ${label} snapshot rejected ${snapshot.rejected.length} record(s): ${snapshot.rejected
        .map((r) => `${r.contentId}:${r.reason}`)
        .join(", ")}`,
    );
  }
}

/** Bumped on every runtime change, so derived caches (ready topics) know to recompute. */
let revision = 0;

/** Merge live-ingested quran rows (opt-in live refresh; see quranPublishedWarm.ts). */
export function mergePublishedContentRecords(records: readonly StoredContent[]): void {
  for (const record of records) {
    publishedContent.set(record.id, record);
  }
  if (records.length) revision += 1;
}

export function publishedRepositoryRevision(): number {
  return revision;
}

/** Runtime authority: published, source-verified records only. */
export function getPublishedContentRecord(id: string): StoredContent | null {
  return publishedContent.get(id) ?? null;
}

export function getPublishedStoryRecord(id: string): StoredStory | null {
  return publishedStories.get(id) ?? null;
}

export function isPublishedRepositoryId(id: string): boolean {
  return publishedContent.has(id) || publishedStories.has(id);
}

export function listPublishedContentIds(): string[] {
  return [...publishedContent.keys()];
}

/** Every published content record (tests / audits). */
export function listPublishedContentRecords(): StoredContent[] {
  return [...publishedContent.values()];
}

export function listPublishedStoryRecords(): StoredStory[] {
  return [...publishedStories.values()];
}

export function quranSnapshotGeneratedAt(): string | null {
  return quranSnapshot.generatedAt;
}
