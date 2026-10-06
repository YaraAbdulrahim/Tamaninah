/**
 * Format of `server/content/snapshots/lessons.published.json`, written by
 * `server/scripts/snapshotLessons.ts`. Never hand-edit `body_ar`: every record is re-checked at load
 * time (anchor, URL, text shape, sha256) and dropped if it no longer matches.
 */
import type { LessonAspect } from "../../../shared/experience/guidance";

export const LESSON_SNAPSHOT_KIND = "tamaninah.lessons.published-snapshot";
export const LESSON_SNAPSHOT_SCHEMA = 1;

export type LessonSnapshotRecord = {
  /** `jamhara-{entryId}-{aspect}-{section ordinal}-{part}` — stable across re-snapshots. */
  id: string;
  entryId: number;
  /** Printed page title, e.g. «التوكل». */
  entryTitle: string;
  /** https://islamic-content.com/t/{entryId} */
  url: string;
  /** Printed card heading and sub-heading the text sits under. */
  card: string;
  sub: string;
  /** Heading as printed (card, plus sub-heading when there is one). */
  title_ar: string;
  /** Our English label, with "(n/m)" when the section is shown in parts. */
  title_en: string;
  aspect: LessonAspect;
  part: number;
  parts: number;
  /** False when the printed section continues beyond the stored parts (read on at `url`). */
  sectionComplete: boolean;
  /** Verbatim text; "\n" only where the page prints a line break. */
  body_ar: string;
  bodySha256: string;
  /** sha256 of the full cleaned section text this part was cut from. */
  sectionSha256: string;
  /** First fetch (the text that was stored). */
  fetchedAt: string;
  /** Second, independent fetch that reproduced the identical section text. */
  verifiedAt: string;
  requests: string[];
  verification_note: string;
};

export type LessonSnapshotEntry = {
  entryId: number;
  title: string;
  url: string;
  fetchedAt: string;
  verifiedAt: string;
  /** Anchored sections that were not stored, and why (garbled, missing, too long). */
  skipped: { card: string; sub: string; reason: string }[];
};

export type LessonSnapshotFile = {
  kind: typeof LESSON_SNAPSHOT_KIND;
  schema: typeof LESSON_SNAPSHOT_SCHEMA;
  source: string;
  sourceId: string;
  generatedAt: string;
  generator: string;
  notes: string;
  entries: LessonSnapshotEntry[];
  records: LessonSnapshotRecord[];
};
