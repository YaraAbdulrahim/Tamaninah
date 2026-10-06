/**
 * Synchronous loaders for the committed tafsir / hadith snapshots (zero network at runtime).
 *
 * A record is published only if it still matches its anchor (topic, verse / number, pinned page),
 * its source is approved for the content type, it carries a URL + verification evidence, and its
 * fingerprint still matches the text captured at fetch time. Everything else is dropped (fail
 * closed) and reported in `rejected`.
 */
import tafsirJson from "./snapshots/tafsir.published.json";
import hadithJson from "./snapshots/hadith.published.json";
import { assertDisplayableContent } from "./contentPolicy";
import type { ReviewEvidence } from "./ingestion/types";
import type { StoredContent } from "./recordTypes";
import { displayNameForSource, isContentTypeAllowedForSource } from "./sourceRegistry";
import {
  HADITH_SNAPSHOT_KIND,
  SOURCE_SNAPSHOT_SCHEMA,
  TAFSIR_SNAPSHOT_KIND,
  type HadithSnapshotRecord,
  type TafsirSnapshotRecord,
} from "./sourceSnapshotFormat";
import {
  HADITH_COLLECTIONS,
  SAHIHAYN_GRADE,
  TAFSIR_SOURCE_ID,
  hadithSourceReference,
  quranpediaTafsirViewUrl,
  shamelaPageUrl,
  sourceSnapshotFingerprint,
  tafsirSourceReference,
} from "./sourceSnapshotRefs";
import { hasFootnoteMarker } from "./sourceText";
import { leadFrom, sliceSpan } from "./presentation";
import {
  getHadithSourceAnchorByContentId,
  getTafsirAnchorByContentId,
  tafsirMatchesQuranAnchor,
} from "./topicSourceAnchors";

export type SourceSnapshotLoad = {
  records: StoredContent[];
  rejected: { contentId: string; reason: string }[];
  generatedAt: string | null;
};

const SHA256 = /^[0-9a-f]{64}$/;

function validDate(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/** Shared evidence checks — every published religious item must carry these. */
export function verificationGap(
  row: Partial<
    Pick<
      TafsirSnapshotRecord,
      "arabic" | "url" | "fetchedAt" | "verifiedAt" | "requests" | "verification_note" | "excerptSha256" | "sourceTextSha256"
    >
  >,
): string | null {
  if (typeof row.arabic !== "string" || !row.arabic.trim()) return "EMPTY_TEXT";
  if (/[<>]/.test(row.arabic) || hasFootnoteMarker(row.arabic)) return "UNCLEAN_TEXT";
  if (typeof row.url !== "string" || !/^https:\/\//.test(row.url)) return "MISSING_URL";
  if (!validDate(row.fetchedAt) || !validDate(row.verifiedAt)) return "INVALID_FETCH_TIMES";
  if (!Array.isArray(row.requests) || row.requests.length < 2) return "MISSING_REQUESTS";
  if (typeof row.verification_note !== "string" || row.verification_note.trim().length < 40) {
    return "MISSING_VERIFICATION_NOTE";
  }
  if (!SHA256.test(String(row.excerptSha256)) || !SHA256.test(String(row.sourceTextSha256))) return "MISSING_HASHES";
  return null;
}

function fileHeaderOk(data: unknown, kind: string): data is { records: unknown[]; generatedAt?: string } {
  const d = data as { kind?: string; schema?: number; records?: unknown } | null;
  return Boolean(d && d.kind === kind && d.schema === SOURCE_SNAPSHOT_SCHEMA && Array.isArray(d.records));
}

function evidence(row: { verifiedAt: string; verification_note: string }, input: {
  evidenceType: ReviewEvidence["evidenceType"];
  reviewerRole: string;
  checkedAgainst: string;
}): ReviewEvidence {
  return {
    kind: "human_repository_review",
    evidenceType: input.evidenceType,
    reviewedAt: row.verifiedAt,
    reviewerRole: input.reviewerRole,
    notes: row.verification_note,
    checkedAgainst: input.checkedAgainst,
  };
}

/* ───────────── tafsir ───────────── */

function tafsirReject(row: TafsirSnapshotRecord): string | null {
  if (!row || typeof row !== "object") return "INVALID_RECORD";
  const anchor = getTafsirAnchorByContentId(row.contentId);
  if (!anchor) return "UNKNOWN_ANCHOR";
  if (anchor.topicId !== row.topicId || anchor.surah !== row.surah || anchor.ayah !== row.ayah || anchor.bookId !== row.bookId) {
    return "ANCHOR_MISMATCH";
  }
  if (!tafsirMatchesQuranAnchor(anchor)) return "NOT_THE_TOPIC_VERSE";
  if (row.sourceId !== TAFSIR_SOURCE_ID || !isContentTypeAllowedForSource(row.sourceId, "tafsir")) {
    return "SOURCE_NOT_ALLOWED";
  }
  if (row.url !== quranpediaTafsirViewUrl(row.surah, row.ayah, row.bookId)) return "URL_MISMATCH";
  if (!row.bookName?.trim() || !row.volume || !Array.isArray(row.pages) || !row.pages.length) return "MISSING_LOCATION";
  return verificationGap(row);
}

export function tafsirRecordFromSnapshot(row: TafsirSnapshotRecord): StoredContent {
  const reference = tafsirSourceReference(row);
  const name = displayNameForSource(row.sourceId) ?? row.bookName;
  return {
    id: row.contentId,
    type: "tafsir",
    topicId: row.topicId,
    level: "A",
    published: true,
    verified: true,
    arabic: row.arabic,
    translation: "",
    // Display label names the edition's editor so the wording can be checked against the right print.
    place: [row.authorShort ? `${row.bookName} — ${row.authorShort}` : row.bookName, row.editor ? `ت. ${row.editor}` : ""]
      .filter(Boolean)
      .join("، "),
    source: { name, reference, url: row.url },
    provenance: {
      sourceId: row.sourceId,
      sourceReference: reference,
      verificationStatus: "published",
      contentOrigin: "source_text",
      reviewEvidence: evidence(row, {
        evidenceType: "live_api",
        reviewerRole: "connector:quranpedia-tafsir",
        checkedAgainst: `api-v1-ayah-${row.surah}-${row.ayah}-book-${row.bookId}`,
      }),
      tafsir: {
        surah: row.surah,
        ayah: row.ayah,
        book: row.bookName,
        author: row.author,
        volume: row.volume,
        pages: row.pages,
        ...(row.edition ? { edition: row.edition } : {}),
        ...(row.editor ? { editor: row.editor } : {}),
        url: row.url,
      },
    },
    ...presentLead(row),
  };
}

/** Lead shown before «عرض التفسير كاملًا»: dropped (not the record) if it no longer fits. */
function presentLead(row: TafsirSnapshotRecord): { lead?: string } {
  const anchor = getTafsirAnchorByContentId(row.contentId);
  const lead = anchor ? leadFrom(row.arabic, anchor.leadEnd ?? anchor.endLocator) : undefined;
  return lead ? { lead } : {};
}

export function loadTafsirSnapshot(file: unknown = tafsirJson): SourceSnapshotLoad {
  if (!fileHeaderOk(file, TAFSIR_SNAPSHOT_KIND)) {
    return { records: [], rejected: [{ contentId: "*", reason: "INVALID_SNAPSHOT_FILE" }], generatedAt: null };
  }
  return publishRows(file.records as TafsirSnapshotRecord[], tafsirReject, tafsirRecordFromSnapshot, (row) =>
    tafsirSourceReference(row),
  ).withGeneratedAt(file.generatedAt);
}

/* ───────────── hadith ───────────── */

function hadithReject(row: HadithSnapshotRecord): string | null {
  if (!row || typeof row !== "object") return "INVALID_RECORD";
  const anchor = getHadithSourceAnchorByContentId(row.contentId);
  if (!anchor) return "UNKNOWN_ANCHOR";
  const meta = HADITH_COLLECTIONS[anchor.collection];
  if (
    anchor.topicId !== row.topicId ||
    anchor.number !== row.number ||
    anchor.shamelaPageId !== row.shamelaPageId ||
    meta.shamelaBookId !== row.shamelaBookId ||
    meta.collection !== row.collection
  ) {
    return "ANCHOR_MISMATCH";
  }
  if (row.sourceId !== meta.sourceId || !isContentTypeAllowedForSource(row.sourceId, "hadith")) {
    return "SOURCE_NOT_ALLOWED";
  }
  if (row.url !== shamelaPageUrl(row.shamelaBookId, row.shamelaPageId)) return "URL_MISMATCH";
  if (row.grade !== SAHIHAYN_GRADE || !row.gradeBasis?.trim()) return "MISSING_GRADE";
  if (!row.kitab?.trim() || !row.bab?.trim() || !row.edition?.trim()) return "MISSING_LOCATION";
  return verificationGap(row);
}

export function hadithRecordFromSnapshot(row: HadithSnapshotRecord): StoredContent {
  const reference = hadithSourceReference(row);
  const name = displayNameForSource(row.sourceId) ?? row.collection;
  return {
    id: row.contentId,
    type: "hadith",
    topicId: row.topicId,
    level: "A",
    published: true,
    verified: true,
    arabic: row.arabic,
    translation: "",
    place: `${row.kitab} — ${row.bab}`,
    source: { name, reference, url: row.url },
    provenance: {
      sourceId: row.sourceId,
      sourceReference: reference,
      verificationStatus: "published",
      contentOrigin: "source_text",
      reviewEvidence: evidence(row, {
        evidenceType: "source_page",
        reviewerRole: "connector:shamela",
        checkedAgainst: `shamela-${row.shamelaBookId}-p${row.shamelaPageId}-n${row.number}`,
      }),
      hadith: {
        collection: row.collection,
        hadithReference: String(row.number),
        grade: row.grade,
        number: row.number,
        book: row.kitab,
        chapter: row.bab,
        edition: row.edition,
        url: row.url,
        gradeBasis: row.gradeBasis,
      },
    },
    ...presentHadithHighlight(row),
  };
}

function presentHadithHighlight(row: HadithSnapshotRecord): { highlight?: string } {
  const highlight = sliceSpan(row.arabic, getHadithSourceAnchorByContentId(row.contentId)?.highlight);
  return highlight ? { highlight } : {};
}

export function loadHadithSnapshot(file: unknown = hadithJson): SourceSnapshotLoad {
  if (!fileHeaderOk(file, HADITH_SNAPSHOT_KIND)) {
    return { records: [], rejected: [{ contentId: "*", reason: "INVALID_SNAPSHOT_FILE" }], generatedAt: null };
  }
  return publishRows(file.records as HadithSnapshotRecord[], hadithReject, hadithRecordFromSnapshot, (row) =>
    hadithSourceReference(row),
  ).withGeneratedAt(file.generatedAt);
}

/* ───────────── shared publish gate ───────────── */

function publishRows<R extends { contentId: string; arabic: string; url: string; textFingerprint: string; topicId: string }>(
  rows: R[],
  reject: (row: R) => string | null,
  toRecord: (row: R) => StoredContent,
  referenceOf: (row: R) => string,
) {
  const records: StoredContent[] = [];
  const rejected: SourceSnapshotLoad["rejected"] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const id = String(row?.contentId ?? "?");
    const reason = reject(row);
    if (reason) {
      rejected.push({ contentId: id, reason });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ contentId: id, reason: "DUPLICATE" });
      continue;
    }
    if (sourceSnapshotFingerprint(row.arabic, referenceOf(row), row.url) !== row.textFingerprint) {
      rejected.push({ contentId: id, reason: "TEXT_FINGERPRINT_MISMATCH" });
      continue;
    }
    const record = toRecord(row);
    const policy = assertDisplayableContent(record, "A", row.topicId);
    if (policy) {
      rejected.push({ contentId: id, reason: `POLICY_${policy}` });
      continue;
    }
    seen.add(id);
    records.push(record);
  }
  return {
    withGeneratedAt(generatedAt: unknown): SourceSnapshotLoad {
      return { records, rejected, generatedAt: typeof generatedAt === "string" ? generatedAt : null };
    },
  };
}
