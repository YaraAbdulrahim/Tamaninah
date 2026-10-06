import { TMN_QURAN } from "../catalogProvenance";
import type { StoredContent } from "../recordTypes";
import {
  fetchQuranpediaAyah,
  formatQuranSourceReference,
  liveApiCheckedAgainst,
  quranpediaFixtureFetch,
  type QuranpediaClientOptions,
} from "../connectors/quranpedia";
import { LIVE_TOPIC_QURAN_ANCHORS, type TopicQuranAnchor } from "../topicQuranAnchors";
import { buildQuranFingerprint, normalizeQuranIngest } from "./normalize";
import { publishReviewedContent } from "./publish";
import { submitInternalReview } from "./review";
import type { NormalizedQuranIngest, ReviewEvidence, StagedRecord } from "./types";

function liveQuranReviewEvidence(anchor: TopicQuranAnchor, fetchedAt: string): ReviewEvidence {
  return {
    kind: "human_repository_review",
    evidenceType: "live_api",
    reviewedAt: fetchedAt,
    reviewerRole: "connector:quranpedia",
    notes:
      "Ingested via allowlisted Quranpedia API v1 (read-only). Text fingerprint locked at fetch; display still gated by published verification policy.",
    checkedAgainst: liveApiCheckedAgainst(anchor.mushafId, anchor.surah, anchor.ayah),
  };
}

function toNormalizedIngest(anchor: TopicQuranAnchor, bundle: LiveQuranBundle): NormalizedQuranIngest {
  const base = {
    contentId: anchor.contentId,
    topicId: anchor.topicId,
    contentType: "quran" as const,
    level: "A" as const,
    sourceId: TMN_QURAN,
    sourceReference: formatQuranSourceReference(bundle.surah, bundle.ayah),
    contentOrigin: "source_text" as const,
    quran: {
      surah: bundle.surah,
      ayah: bundle.ayah,
      edition: `quranpedia-mushaf-${bundle.mushafId}`,
    },
    arabic: bundle.arabic,
    translation: bundle.translationEn,
    place: anchor.placeAr,
  };
  return {
    ...base,
    textFingerprint: buildQuranFingerprint(base),
  };
}

export type LiveQuranBundle = {
  arabic: string;
  translationEn: string;
  mushafId: number;
  surah: number;
  ayah: number;
};

/** Fingerprint the pipeline would lock for this anchor + fetched bundle. */
export function liveQuranFingerprint(anchor: TopicQuranAnchor, bundle: LiveQuranBundle): string {
  return toNormalizedIngest(anchor, bundle).textFingerprint;
}

/**
 * Run one fetched Quranpedia bundle through normalize → internal review (live_api evidence) →
 * publish. Used by the live fetch and by the committed offline snapshot (same gates either way).
 */
export function publishLiveQuranBundle(
  anchor: TopicQuranAnchor,
  bundle: LiveQuranBundle,
  fetchedAt: string = new Date().toISOString(),
): StoredContent | null {
  return publishFromAnchor(anchor, bundle, fetchedAt);
}

function publishFromAnchor(
  anchor: TopicQuranAnchor,
  bundle: LiveQuranBundle,
  fetchedAt: string = new Date().toISOString(),
): StoredContent | null {
  if (bundle.surah !== anchor.surah || bundle.ayah !== anchor.ayah || bundle.mushafId !== anchor.mushafId) {
    return null;
  }
  const normalized = toNormalizedIngest(anchor, bundle);
  const normErr = normalizeQuranIngest(normalized);
  if (normErr) return null;

  const staged: StagedRecord = { kind: "content", normalized, status: "pending_review" };
  const evidence = liveQuranReviewEvidence(anchor, fetchedAt);
  const reviewed = submitInternalReview(staged, evidence);
  if (!reviewed.ok) return null;

  const pub = publishReviewedContent(reviewed.reviewed);
  if (!pub.ok) return null;
  return pub.record as StoredContent;
}

export async function ingestLiveQuranAnchor(
  anchor: TopicQuranAnchor,
  options: QuranpediaClientOptions = {},
): Promise<StoredContent | null> {
  const fetched = await fetchQuranpediaAyah(anchor.surah, anchor.ayah, anchor.mushafId, options);
  if (!fetched.ok) return null;
  return publishFromAnchor(anchor, fetched.bundle);
}

/** Deterministic published quran rows for Vitest (fixture API shapes). */
export function buildLiveQuranPublishedSliceFromFixtures(): StoredContent[] {
  const out: StoredContent[] = [];
  for (const anchor of LIVE_TOPIC_QURAN_ANCHORS) {
    const fetched = quranpediaFixtureFetch(anchor.mushafId, anchor.surah, anchor.ayah);
    if (!fetched.ok) continue;
    const record = publishFromAnchor(anchor, fetched.bundle);
    if (record) out.push(record);
  }
  return out;
}

export async function buildLiveQuranPublishedSlice(
  options: QuranpediaClientOptions = {},
): Promise<StoredContent[]> {
  const out: StoredContent[] = [];
  for (const anchor of LIVE_TOPIC_QURAN_ANCHORS) {
    const record = await ingestLiveQuranAnchor(anchor, options);
    if (record) out.push(record);
  }
  return out;
}
