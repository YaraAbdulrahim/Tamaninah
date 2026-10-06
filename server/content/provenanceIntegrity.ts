import type { ContentType } from "../../shared/experience/guidance";
import type { Lang } from "../../shared/experience/guidance";
import type { ContentOrigin } from "./provenance";
import type { ReviewEvidenceType } from "./ingestion/types";
import type { ContentProvenance, StoryProvenance } from "./provenance";
import { isScriptureAttributionSource } from "./sourceRegistry";

export type IntegrityFailure = "INVALID_EVIDENCE_TYPE" | "EVIDENCE_ORIGIN_MISMATCH" | "EXTERNAL_CLAIM_RISK";

/** `sourceId` names attribution; `checkedAgainst` is internal bundle id — never treat as external proof. */
export function assertPublishedIntegrity(
  contentType: ContentType,
  contentOrigin: ContentOrigin,
  provenance: ContentProvenance,
): IntegrityFailure | null {
  if (provenance.verificationStatus !== "published") return null;
  const ev = provenance.reviewEvidence;
  if (!ev?.evidenceType) return "INVALID_EVIDENCE_TYPE";

  if (looksLikeExternalClaim(ev.checkedAgainst)) return "EXTERNAL_CLAIM_RISK";

  if (contentOrigin === "source_text") {
    const okEvidence =
      ev.evidenceType === "internal_snapshot" || ev.evidenceType === "live_api" || ev.evidenceType === "source_page";
    if (!okEvidence) return "EVIDENCE_ORIGIN_MISMATCH";
    if (contentType === "quran" || contentType === "hadith" || contentType === "tafsir") return null;
    return "EVIDENCE_ORIGIN_MISMATCH";
  }

  if (contentOrigin === "reviewed_explanation") {
    if (ev.evidenceType !== "editorial_internal") return "EVIDENCE_ORIGIN_MISMATCH";
    if (contentType === "concept") return null;
    return "EVIDENCE_ORIGIN_MISMATCH";
  }

  return null;
}

/** Stories with reviewed_explanation cannot publish as external seerah imports (P1-B.1). */
export function assertPublishedStoryIntegrity(provenance: StoryProvenance): IntegrityFailure | null {
  if (provenance.verificationStatus !== "published") return null;
  const ev = provenance.reviewEvidence;
  if (!ev?.evidenceType) return "INVALID_EVIDENCE_TYPE";
  if (looksLikeExternalClaim(ev.checkedAgainst)) return "EXTERNAL_CLAIM_RISK";
  if (provenance.contentOrigin === "reviewed_explanation") {
    if (ev.evidenceType === "editorial_internal" && !isScriptureAttributionSource(provenance.sourceId)) {
      return null;
    }
    return "EVIDENCE_ORIGIN_MISMATCH";
  }
  if (
    provenance.contentOrigin === "source_text" &&
    ev.evidenceType !== "internal_snapshot" &&
    ev.evidenceType !== "live_api" &&
    ev.evidenceType !== "source_page"
  ) {
    return "EVIDENCE_ORIGIN_MISMATCH";
  }
  return null;
}

function looksLikeExternalClaim(checkedAgainst: string): boolean {
  const v = checkedAgainst.toLowerCase();
  return v.includes("http://") || v.includes("https://") || v.includes("dorar.net") || v.includes("quranpedia");
}

export function attributionDisclosure(
  lang: Lang,
  input: {
    contentOrigin: ContentOrigin;
    evidenceType?: ReviewEvidenceType;
    sourceId: string;
  },
): string {
  if (input.evidenceType === "live_api" && input.contentOrigin === "source_text") {
    return lang === "en"
      ? "Source label comes from the approved registry. Text was ingested via the allowlisted read-only API connector — attribution is not a substitute for your own scholarly review."
      : "اسم المصدر من السجل المعتمد. النص أُدخل عبر موصل API المعتمد (قراءة فقط) — الإسناد لا يغني عن مراجعتك العلمية.";
  }
  if (input.evidenceType === "source_page" && input.contentOrigin === "source_text") {
    return lang === "en"
      ? "Source label comes from the approved registry. Text was copied verbatim from the approved source page (linked) and re-checked by a second fetch — attribution is not a substitute for your own scholarly review."
      : "اسم المصدر من السجل المعتمد. النص منقول بحروفه من صفحة المصدر المعتمد (الرابط مرفق) وأُعيد التحقق منه بجلب ثانٍ — الإسناد لا يغني عن مراجعتك العلمية.";
  }
  if (input.evidenceType === "internal_snapshot" && input.contentOrigin === "source_text") {
    return lang === "en"
      ? "Source label comes from the approved registry. Text was matched to an internal project snapshot — not fetched live and not verified on the source website."
      : "اسم المصدر من السجل المعتمد. النص طُابق مع نسخة داخلية في المشروع — لم يُجلب مباشرة ولم يُتحقق من موقع المصدر.";
  }
  if (input.contentOrigin === "reviewed_explanation") {
    return lang === "en"
      ? "Editorial explanation — not imported source text."
      : "شرح تحريري — ليس نصًا منقولًا من المصدر.";
  }
  return lang === "en"
    ? "Attribution metadata only — not external verification."
    : "بيانات إسناد فقط — وليست تحققًا خارجيًا.";
}

export function evidenceTypeLabel(lang: Lang, evidenceType: ReviewEvidenceType | undefined): string {
  if (evidenceType === "internal_snapshot") {
    return lang === "en" ? "Internal snapshot match" : "مطابقة نسخة داخلية";
  }
  if (evidenceType === "editorial_internal") {
    return lang === "en" ? "Internal editorial review" : "مراجعة تحريرية داخلية";
  }
  if (evidenceType === "live_api") {
    return lang === "en" ? "Allowlisted API ingest" : "إدخال عبر API معتمد";
  }
  if (evidenceType === "source_page") {
    return lang === "en" ? "Copied from the approved source page" : "منقول من صفحة المصدر المعتمد";
  }
  return lang === "en" ? "Unspecified" : "غير محدد";
}

export function sourceIdIsNotExternalVerification(sourceId: string): boolean {
  return Boolean(sourceId.trim());
}
