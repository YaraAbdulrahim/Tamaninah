/**
 * Synchronous loader for snapshots/seerah.published.json — the «موقف من السيرة» story slot
 * (zero network at runtime).
 *
 * Each record becomes a StoredStory whose body is the verbatim passage and whose editorial fields
 * (headline, opening, lessons, takeaway, keep) are empty. A record is published only if it still
 * matches its anchor, its source is approved for "seerah", it carries URL + verification evidence,
 * the grade fields fit the source kind (Sahihayn → «صحيح»; Seerah book → none), and its fingerprint
 * matches the text captured at fetch time. Anything else is dropped (fail closed).
 */
import seerahJson from "./snapshots/seerah.published.json";
import { assertDisplayableStory } from "./contentPolicy";
import type { StoredStory } from "./recordTypes";
import { displayNameForSource, isContentTypeAllowedForSource } from "./sourceRegistry";
import { verificationGap } from "./sourceSnapshot";
import { SEERAH_SNAPSHOT_KIND, SOURCE_SNAPSHOT_SCHEMA, type SeerahSnapshotRecord } from "./sourceSnapshotFormat";
import {
  SAHIHAYN_GRADE,
  SEERAH_SOURCES,
  seerahSourceReference,
  shamelaPageUrl,
  sourceSnapshotFingerprint,
} from "./sourceSnapshotRefs";
import { getSeerahAnchorByStoryId } from "./topicSeerahAnchors";
import { beatsFrom, keyQuotesFrom } from "./presentation";

export type SeerahSnapshotLoad = {
  records: StoredStory[];
  rejected: { storyId: string; reason: string }[];
  generatedAt: string | null;
};

function rejectReason(row: SeerahSnapshotRecord): string | null {
  if (!row || typeof row !== "object") return "INVALID_RECORD";
  const anchor = getSeerahAnchorByStoryId(row.storyId);
  if (!anchor) return "UNKNOWN_ANCHOR";
  const meta = SEERAH_SOURCES[anchor.source];
  if (
    anchor.topicId !== row.topicId ||
    anchor.shamelaPageId !== row.shamelaPageId ||
    meta.shamelaBookId !== row.shamelaBookId ||
    meta.kind !== row.sourceKind ||
    meta.book !== row.book ||
    (anchor.number ?? null) !== row.number
  ) {
    return "ANCHOR_MISMATCH";
  }
  if (anchor.title !== row.title || anchor.titleEn !== row.titleEn) return "LABEL_MISMATCH";
  if (row.sourceId !== meta.sourceId || !isContentTypeAllowedForSource(row.sourceId, "seerah")) {
    return "SOURCE_NOT_ALLOWED";
  }
  if (row.url !== shamelaPageUrl(row.shamelaBookId, row.shamelaPageId)) return "URL_MISMATCH";
  if (row.sourceKind === "sahih") {
    if (row.grade !== SAHIHAYN_GRADE || !row.gradeBasis?.trim() || !row.number) return "MISSING_GRADE";
  } else if (row.grade !== null || row.gradeBasis !== null) {
    // A Seerah book is not graded here; never display «صحيح» on it.
    return "GRADE_NOT_ALLOWED";
  }
  if (!row.kitab?.trim() || !row.edition?.trim() || !row.part || !row.printedPage) return "MISSING_LOCATION";
  return verificationGap(row);
}

export function storyFromSeerahSnapshot(row: SeerahSnapshotRecord): StoredStory {
  const reference = seerahSourceReference(row);
  const name = displayNameForSource(row.sourceId) ?? row.book;
  // Presentation (exact slices of the passage; dropped — not the story — if a locator no longer fits).
  const anchor = getSeerahAnchorByStoryId(row.storyId);
  const beats = beatsFrom(row.arabic, anchor?.beatStarts);
  const keyQuotes = keyQuotesFrom(row.arabic, anchor?.keyQuotes);
  return {
    ...(beats ? { beats } : {}),
    ...(keyQuotes ? { keyQuotes } : {}),
    id: row.storyId,
    topicId: row.topicId,
    level: "A",
    published: true,
    verified: true,
    title: row.title,
    titleEn: row.titleEn,
    headline: "",
    opening: "",
    body: [row.arabic],
    lessons: [],
    takeaway: "",
    keep: "",
    source: { name, reference, url: row.url },
    provenance: {
      sourceId: row.sourceId,
      sourceReference: reference,
      verificationStatus: "published",
      contentOrigin: "source_text",
      reviewEvidence: {
        kind: "human_repository_review",
        evidenceType: "source_page",
        reviewedAt: row.verifiedAt,
        reviewerRole: "connector:shamela",
        notes: row.verification_note,
        checkedAgainst: `shamela-${row.shamelaBookId}-p${row.shamelaPageId}${row.number ? `-n${row.number}` : ""}`,
      },
      seerah: {
        sourceReference: reference,
        book: row.book,
        edition: row.edition,
        volume: row.part,
        page: row.printedPage,
        url: row.url,
        sourceKind: row.sourceKind,
        ...(row.number ? { number: row.number } : {}),
      },
      ...(row.sourceKind === "sahih" && row.number && row.grade
        ? {
            hadith: {
              collection: row.book,
              hadithReference: String(row.number),
              grade: row.grade,
              number: row.number,
              book: row.kitab,
              chapter: row.bab,
              edition: row.edition,
              url: row.url,
              ...(row.gradeBasis ? { gradeBasis: row.gradeBasis } : {}),
            },
          }
        : {}),
    },
  };
}

export function loadSeerahSnapshot(file: unknown = seerahJson): SeerahSnapshotLoad {
  const data = file as { kind?: string; schema?: number; records?: unknown; generatedAt?: unknown } | null;
  if (!data || data.kind !== SEERAH_SNAPSHOT_KIND || data.schema !== SOURCE_SNAPSHOT_SCHEMA || !Array.isArray(data.records)) {
    return { records: [], rejected: [{ storyId: "*", reason: "INVALID_SNAPSHOT_FILE" }], generatedAt: null };
  }
  const records: StoredStory[] = [];
  const rejected: SeerahSnapshotLoad["rejected"] = [];
  const seen = new Set<string>();
  for (const row of data.records as SeerahSnapshotRecord[]) {
    const id = String(row?.storyId ?? "?");
    const reason = rejectReason(row);
    if (reason) {
      rejected.push({ storyId: id, reason });
      continue;
    }
    if (seen.has(id)) {
      rejected.push({ storyId: id, reason: "DUPLICATE" });
      continue;
    }
    if (sourceSnapshotFingerprint(row.arabic, seerahSourceReference(row), row.url) !== row.textFingerprint) {
      rejected.push({ storyId: id, reason: "TEXT_FINGERPRINT_MISMATCH" });
      continue;
    }
    const story = storyFromSeerahSnapshot(row);
    const policy = assertDisplayableStory(story, "A", row.topicId);
    if (policy) {
      rejected.push({ storyId: id, reason: `POLICY_${policy}` });
      continue;
    }
    seen.add(id);
    records.push(story);
  }
  return { records, rejected, generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : null };
}
