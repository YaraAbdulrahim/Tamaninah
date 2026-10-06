/**
 * Formats of the committed offline snapshots written by `server/scripts/snapshotContent.ts`:
 *   - snapshots/tafsir.published.json  (Tafsir al-Tabari via the Quranpedia API)
 *   - snapshots/hadith.published.json  (Sahih al-Bukhari / Sahih Muslim pages on shamela.ws)
 *
 * Never hand-edit `arabic`: every record is re-checked at load time against its anchor and its
 * fingerprint; a record that no longer matches is dropped (fail closed).
 */
export const SOURCE_SNAPSHOT_SCHEMA = 1;
export const TAFSIR_SNAPSHOT_KIND = "tamaninah.tafsir.published-snapshot";
export const HADITH_SNAPSHOT_KIND = "tamaninah.hadith.published-snapshot";

type SnapshotVerification = {
  /** First fetch (the text that was stored). */
  fetchedAt: string;
  /** Second, independent fetch that reproduced the identical excerpt. */
  verifiedAt: string;
  /** Every URL requested for this item (both passes). */
  requests: string[];
  /** sha256 of the stored excerpt (hex). */
  excerptSha256: string;
  /** sha256 of the cleaned full source text the excerpt was sliced from (hex). */
  sourceTextSha256: string;
  /** Character offset of the excerpt in that cleaned text. */
  excerptOffset: number;
  /** Human-readable account of how the text was fetched, cleaned and re-checked. */
  verification_note: string;
  /** In-repo fingerprint of arabic + reference + url (checked at load). */
  textFingerprint: string;
};

export type TafsirSnapshotRecord = SnapshotVerification & {
  contentId: string;
  topicId: string;
  sourceId: string;
  surah: number;
  ayah: number;
  bookId: number;
  /** Book metadata exactly as returned by the API's `book` object. */
  bookName: string;
  author: string;
  authorShort: string;
  editor: string | null;
  publisher: string | null;
  edition: string | null;
  volume: number;
  pages: number[];
  /** Verbatim excerpt; paragraph breaks kept as "\n". */
  arabic: string;
  /** Human-viewable page for this tafsir of the ayah (Quranpedia embed, tafsir tab, book locked). */
  url: string;
};

export type TafsirSnapshotFile = {
  kind: typeof TAFSIR_SNAPSHOT_KIND;
  schema: typeof SOURCE_SNAPSHOT_SCHEMA;
  source: string;
  generatedAt: string;
  generator: string;
  notes: string;
  records: TafsirSnapshotRecord[];
};

export type HadithSnapshotRecord = SnapshotVerification & {
  contentId: string;
  topicId: string;
  sourceId: string;
  /** e.g. «صحيح البخاري» / «صحيح مسلم». */
  collection: string;
  shamelaBookId: number;
  shamelaPageId: number;
  number: number;
  /** Book (كتاب) and chapter (باب) as printed in Shamela's page path. */
  kitab: string;
  bab: string;
  /** Printed volume and page (Shamela's ج / ص for this page). */
  part: number;
  printedPage: number;
  /** Edition statement from the Shamela book card. */
  edition: string;
  grade: string;
  gradeBasis: string;
  /** Verbatim text from the Companion to the end of the matn. */
  arabic: string;
  /** The exact Shamela page: https://shamela.ws/book/{book}/{page}. */
  url: string;
};

export type HadithSnapshotFile = {
  kind: typeof HADITH_SNAPSHOT_KIND;
  schema: typeof SOURCE_SNAPSHOT_SCHEMA;
  source: string;
  generatedAt: string;
  generator: string;
  notes: string;
  records: HadithSnapshotRecord[];
};

export const SEERAH_SNAPSHOT_KIND = "tamaninah.seerah.published-snapshot";

/** «موقف من السيرة» — one verbatim passage per topic (snapshots/seerah.published.json). */
export type SeerahSnapshotRecord = SnapshotVerification & {
  storyId: string;
  topicId: string;
  sourceId: string;
  /** "sahih" = narration in Sahih al-Bukhari (graded); "seerah_book" = Sirat Ibn Hisham (no grade). */
  sourceKind: "sahih" | "seerah_book";
  /** Neutral event labels from the anchor (not religious text). */
  title: string;
  titleEn: string;
  /** Book title as cited, e.g. «صحيح البخاري» / «السيرة النبوية لابن هشام». */
  book: string;
  shamelaBookId: number;
  shamelaPageId: number;
  /** Sahih narrations only. */
  number: number | null;
  /** Page path (كتاب / باب or the Seerah section heading) as printed by Shamela. */
  kitab: string;
  bab: string;
  part: number;
  printedPage: number;
  edition: string;
  /** «صحيح» for Sahihayn narrations; null for a Seerah book (no grade asserted). */
  grade: string | null;
  gradeBasis: string | null;
  /** Verbatim passage (one paragraph). */
  arabic: string;
  url: string;
};

export type SeerahSnapshotFile = {
  kind: typeof SEERAH_SNAPSHOT_KIND;
  schema: typeof SOURCE_SNAPSHOT_SCHEMA;
  source: string;
  generatedAt: string;
  generator: string;
  notes: string;
  records: SeerahSnapshotRecord[];
};
