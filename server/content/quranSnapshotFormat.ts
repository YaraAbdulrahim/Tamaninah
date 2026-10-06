/**
 * Format of `server/content/snapshots/quran.published.json` — the committed offline copy of the
 * Quranpedia API v1 responses the live pipeline fetched for each topic anchor.
 *
 * Written only by `npm run snapshot:quran` (server/scripts/snapshotQuran.ts). Never hand-edit the
 * verse text: every record is replayed through normalize → review → publish at load time and its
 * fingerprint must still match, otherwise the record is dropped (fail closed).
 */
export const QURAN_SNAPSHOT_KIND = "tamaninah.quran.published-snapshot";
export const QURAN_SNAPSHOT_SCHEMA = 1;

export type QuranSnapshotRecord = {
  contentId: string;
  topicId: string;
  surah: number;
  ayah: number;
  mushafId: number;
  translationBookId: number;
  /** Mushaf text exactly as returned by `GET /v1/mushafs/{mushaf}/{surah}/{ayah}` (BOM stripped). */
  arabic: string;
  /** First line of the chosen translation from `GET /v1/translations/{surah}/{ayah}/en`. */
  translationEn: string;
  fetchedAt: string;
  requests: string[];
  evidence: {
    evidenceType: "live_api";
    reviewerRole: string;
    checkedAgainst: string;
  };
  /** Pipeline fingerprint of arabic + translation + reference at fetch time. */
  textFingerprint: string;
};

export type QuranSnapshotFile = {
  kind: typeof QURAN_SNAPSHOT_KIND;
  schema: typeof QURAN_SNAPSHOT_SCHEMA;
  sourceId: string;
  source: string;
  generatedAt: string;
  generator: string;
  notes: string;
  records: QuranSnapshotRecord[];
};
