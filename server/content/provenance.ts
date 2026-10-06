import type { ContentType } from "../../shared/experience/guidance";
import type { ReviewEvidence } from "./ingestion/types";
import {
  SOURCE_REGISTRY,
  type RegistrySource,
  getRegistrySource,
  isContentTypeAllowedForSource,
  isRegistrySourceApproved,
} from "./sourceRegistry";

export type { ReviewEvidence, ReviewEvidenceType } from "./ingestion/types";
import {
  assertPublishedIntegrity,
  assertPublishedStoryIntegrity,
  type IntegrityFailure,
} from "./provenanceIntegrity";
export type VerificationStatus =
  | "repository_demo"
  | "pending_review"
  | "internally_reviewed"
  | "published"
  | "rejected";

export type ContentOrigin = "source_text" | "reviewed_explanation";

export type QuranProvenanceMeta = {
  surah: number;
  ayah: number;
  edition?: string;
};

export type HadithProvenanceMeta = {
  collection: string;
  hadithReference: string;
  /** Required for display (PDF: «لا ينسب حديث دون مصدر وحكم معتمد في البيانات»). */
  grade?: string;
  number?: number;
  /** كتاب / باب as printed in the edition. */
  book?: string;
  chapter?: string;
  edition?: string;
  /** Exact page of the approved edition. */
  url?: string;
  gradeBasis?: string;
};

/** Where a tafsir excerpt comes from and which verse it explains. */
export type TafsirProvenanceMeta = {
  surah: number;
  ayah: number;
  book: string;
  author: string;
  volume: number;
  pages: number[];
  edition?: string;
  editor?: string;
  url: string;
};

export type SeerahProvenanceMeta = {
    sourceReference: string;
    /** The book the passage is quoted from (a Seerah book, or a Sahih collection narrating the event). */
    book?: string;
    edition?: string;
    volume?: number;
    page?: number;
    /** Exact page of the approved edition (shamela.ws/book/{id}/{page}). */
    url?: string;
    /** "seerah_book" (e.g. Sirat Ibn Hisham — no grade asserted) or "sahih" (narration in the Sahihayn). */
    sourceKind?: "seerah_book" | "sahih";
    /** For sahih narrations only: the hadith number in that collection. */
    number?: number;
  };

export type ContentProvenance = {
  sourceId: string;
  sourceReference: string;
  verificationStatus: VerificationStatus;
  contentOrigin: ContentOrigin;
  reviewEvidence?: ReviewEvidence;
  quran?: QuranProvenanceMeta;
  hadith?: HadithProvenanceMeta;
  tafsir?: TafsirProvenanceMeta;
  seerah?: SeerahProvenanceMeta;
};

export type StoryProvenance = {
  sourceId: string;
  sourceReference: string;
  verificationStatus: VerificationStatus;
  contentOrigin: ContentOrigin;
  reviewEvidence?: ReviewEvidence;
  seerah?: SeerahProvenanceMeta;
  hadith?: HadithProvenanceMeta;
};

export const VERIFICATION_DISCLOSURE: Record<VerificationStatus, { ar: string; en: string }> = {
  repository_demo: {
    ar: "محتوى تجريبي — غير معروض كمحتوى موثوق (legacy).",
    en: "Demo placeholder — not offered as trusted content.",
  },
  pending_review: {
    ar: "قيد المراجعة — غير جاهز للعرض.",
    en: "Pending review — not displayable.",
  },
  internally_reviewed: {
    ar: "مراجع داخليًا — لم يُفعَّل بعد للعرض في التطبيق.",
    en: "Internally reviewed — not yet cleared for in-app display.",
  },
  published: {
    ar: "مسموح للعرض في التطبيق بعد مراجعة داخلية — لا يعني اعتمادًا خارجيًا أو جلبًا من موقع المصدر.",
    en: "Cleared for in-app display after internal review — not external endorsement or live source fetch.",
  },
  rejected: {
    ar: "مرفوض — غير جاهز للعرض.",
    en: "Rejected — not displayable.",
  },
};

export function hasValidReviewEvidence(evidence: ReviewEvidence | undefined): boolean {
  if (!evidence || evidence.kind !== "human_repository_review") return false;
  return Boolean(
    evidence.evidenceType &&
      evidence.reviewedAt &&
      evidence.reviewerRole.trim() &&
      evidence.checkedAgainst.trim() &&
      evidence.notes.trim(),
  );
}

/**
 * User-facing religious content — only human-reviewed published records.
 * `repository_demo` remains in catalog/fixtures for tests and ingest tooling, never for display.
 */
export function isDisplayableVerification(
  status: VerificationStatus,
  _recordTopicId?: string,
  _journeyTopicId?: string,
): boolean {
  return status === "published";
}

export type ProvenanceFailure =
  | "UNKNOWN_SOURCE_ID"
  | "SOURCE_NOT_APPROVED"
  | "SOURCE_TYPE_MISMATCH"
  | "SOURCE_REFERENCE_MISSING"
  | "INVALID_VERIFICATION_STATUS"
  | "INCOMPLETE_PROVENANCE"
  | "INVALID_CONTENT_ORIGIN"
  | "MISSING_REVIEW_EVIDENCE"
  | IntegrityFailure;

export function assertRegistryBinding(
  sourceId: string,
  contentType: ContentType,
): ProvenanceFailure | null {
  const entry = getRegistrySource(sourceId);
  if (!entry) return "UNKNOWN_SOURCE_ID";
  if (!isRegistrySourceApproved(sourceId)) return "SOURCE_NOT_APPROVED";
  if (!isContentTypeAllowedForSource(sourceId, contentType)) return "SOURCE_TYPE_MISMATCH";
  return null;
}

export function assertProvenanceForContent(
  contentType: ContentType,
  provenance: ContentProvenance,
  topicId?: string,
): ProvenanceFailure | null {
  if (!isDisplayableVerification(provenance.verificationStatus, topicId)) {
    return "INVALID_VERIFICATION_STATUS";
  }
  if (provenance.verificationStatus === "published" && !hasValidReviewEvidence(provenance.reviewEvidence)) {
    return "MISSING_REVIEW_EVIDENCE";
  }
  const integrityErr = assertPublishedIntegrity(contentType, provenance.contentOrigin, provenance);
  if (integrityErr) return integrityErr;
  const bindErr = assertRegistryBinding(provenance.sourceId, contentType);
  if (bindErr) return bindErr;
  if (!provenance.sourceReference.trim()) return "SOURCE_REFERENCE_MISSING";

  if (contentType === "quran" || contentType === "hadith" || contentType === "tafsir") {
    if (provenance.contentOrigin !== "source_text") return "INVALID_CONTENT_ORIGIN";
  }
  if (contentType === "concept" && provenance.contentOrigin === "source_text") {
    return "INVALID_CONTENT_ORIGIN";
  }

  if (contentType === "quran") {
    if (!provenance.quran?.surah || !provenance.quran.ayah) return "INCOMPLETE_PROVENANCE";
  }
  if (contentType === "hadith") {
    if (!provenance.hadith?.collection || !provenance.hadith.hadithReference) {
      return "INCOMPLETE_PROVENANCE";
    }
    if (!provenance.hadith.grade?.trim()) return "INCOMPLETE_PROVENANCE";
  }
  if (contentType === "tafsir") {
    const t = provenance.tafsir;
    if (!t?.surah || !t.ayah || !t.book.trim() || !t.url.trim()) return "INCOMPLETE_PROVENANCE";
  }
  if (contentType === "seerah") {
    if (!provenance.seerah?.sourceReference?.trim()) return "INCOMPLETE_PROVENANCE";
  }

  return null;
}

export function assertProvenanceForStory(provenance: StoryProvenance, topicId?: string): ProvenanceFailure | null {
  if (!isDisplayableVerification(provenance.verificationStatus, topicId)) {
    return "INVALID_VERIFICATION_STATUS";
  }
  if (provenance.verificationStatus === "published" && !hasValidReviewEvidence(provenance.reviewEvidence)) {
    return "MISSING_REVIEW_EVIDENCE";
  }
  const storyIntegrity = assertPublishedStoryIntegrity(provenance);
  if (storyIntegrity) return storyIntegrity;
  const bindErr = assertRegistryBinding(provenance.sourceId, "seerah");
  if (bindErr) return bindErr;
  if (!provenance.sourceReference.trim()) return "SOURCE_REFERENCE_MISSING";
  if (provenance.contentOrigin !== "source_text" && provenance.contentOrigin !== "reviewed_explanation") {
    return "INVALID_CONTENT_ORIGIN";
  }
  const seerahRef = provenance.seerah?.sourceReference?.trim() || provenance.hadith?.hadithReference?.trim();
  if (!seerahRef) return "INCOMPLETE_PROVENANCE";
  return null;
}

export function registryAttribution(sourceId: string): Pick<RegistrySource, "name" | "referenceCatalog"> | null {
  const entry = getRegistrySource(sourceId);
  if (!entry) return null;
  return { name: entry.name, referenceCatalog: entry.referenceCatalog };
}

export const approvedSourceIds = SOURCE_REGISTRY.filter((s) => s.status === "approved").map((s) => s.sourceId);
