/**
 * Synchronous loader for the committed Quranpedia snapshot (zero network at runtime).
 *
 * Each record is replayed through the live pipeline (normalize → review with live_api evidence →
 * publish) using its original fetch time, and must reproduce the fingerprint captured at fetch
 * time. Anything that does not match an anchor or its fingerprint is dropped (fail closed).
 */
import snapshotJson from "./snapshots/quran.published.json";
import { TMN_QURAN } from "./catalogProvenance";
import { liveQuranFingerprint, publishLiveQuranBundle } from "./ingestion/liveQuranPipeline";
import {
  QURAN_SNAPSHOT_KIND,
  QURAN_SNAPSHOT_SCHEMA,
  type QuranSnapshotFile,
  type QuranSnapshotRecord,
} from "./quranSnapshotFormat";
import type { StoredContent } from "./recordTypes";
import { sliceSpan } from "./presentation";
import { getTopicQuranAnchorByContentId } from "./topicQuranAnchors";

export type QuranSnapshotLoad = {
  records: StoredContent[];
  rejected: { contentId: string; reason: string }[];
  generatedAt: string | null;
};

export function loadQuranSnapshot(file: unknown = snapshotJson): QuranSnapshotLoad {
  const data = file as Partial<QuranSnapshotFile> | null;
  if (
    !data ||
    data.kind !== QURAN_SNAPSHOT_KIND ||
    data.schema !== QURAN_SNAPSHOT_SCHEMA ||
    data.sourceId !== TMN_QURAN ||
    !Array.isArray(data.records)
  ) {
    return { records: [], rejected: [{ contentId: "*", reason: "INVALID_SNAPSHOT_FILE" }], generatedAt: null };
  }

  const records: StoredContent[] = [];
  const rejected: QuranSnapshotLoad["rejected"] = [];
  for (const row of data.records as QuranSnapshotRecord[]) {
    const reason = rejectReason(row);
    if (reason) {
      rejected.push({ contentId: String(row?.contentId ?? "?"), reason });
      continue;
    }
    const anchor = getTopicQuranAnchorByContentId(row.contentId)!;
    const bundle = {
      arabic: row.arabic,
      translationEn: row.translationEn,
      mushafId: row.mushafId,
      surah: row.surah,
      ayah: row.ayah,
    };
    if (liveQuranFingerprint(anchor, bundle) !== row.textFingerprint) {
      rejected.push({ contentId: row.contentId, reason: "TEXT_FINGERPRINT_MISMATCH" });
      continue;
    }
    const published = publishLiveQuranBundle(anchor, bundle, row.fetchedAt);
    if (!published) {
      rejected.push({ contentId: row.contentId, reason: "PIPELINE_REJECTED" });
      continue;
    }
    // Presentation: the topic clause, sliced from the fetched verse (dropped if the locator no longer fits).
    const highlight = sliceSpan(published.arabic, anchor.highlight);
    records.push(highlight ? { ...published, highlight } : published);
  }
  return { records, rejected, generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : null };
}

function rejectReason(row: QuranSnapshotRecord | null | undefined): string | null {
  if (!row || typeof row !== "object") return "INVALID_RECORD";
  const anchor = getTopicQuranAnchorByContentId(row.contentId);
  if (!anchor) return "UNKNOWN_ANCHOR";
  if (anchor.topicId !== row.topicId || anchor.surah !== row.surah || anchor.ayah !== row.ayah) {
    return "ANCHOR_MISMATCH";
  }
  if (anchor.mushafId !== row.mushafId) return "ANCHOR_MISMATCH";
  if (typeof row.arabic !== "string" || !row.arabic.trim()) return "EMPTY_TEXT";
  if (typeof row.translationEn !== "string" || !row.translationEn.trim()) return "EMPTY_TEXT";
  if (!row.fetchedAt || Number.isNaN(Date.parse(row.fetchedAt))) return "INVALID_FETCHED_AT";
  if (row.evidence?.evidenceType !== "live_api") return "INVALID_EVIDENCE";
  return null;
}
