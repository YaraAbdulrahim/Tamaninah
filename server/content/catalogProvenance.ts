import type { ContentProvenance, StoryProvenance, VerificationStatus } from "./provenance";

export const TMN_QURAN = "tmn-src-quran-mushaf";
export const TMN_HADITH = "tmn-src-hadith-dorar";
export const TMN_SEERAH = "tmn-src-seerah-dorar";
export const TMN_CONCEPT = "tmn-src-concept-dawa";
export const TMN_ISLAMIC_CONTENT = "tmn-src-islamic-content";
/** Tafsir al-Tabari (جامع البيان) via the Quranpedia API — verbatim excerpts only. */
export const TMN_TAFSIR_TABARI = "tmn-src-tafsir-tabari";
/** Sahih al-Bukhari, al-Sultaniyya edition on shamela.ws (book 1681) — verbatim hadith text. */
export const TMN_HADITH_BUKHARI = "tmn-src-hadith-bukhari-shamela";
/** Sahih Muslim, ed. Muhammad Fu'ad 'Abd al-Baqi on shamela.ws (book 1727) — verbatim hadith text. */
export const TMN_HADITH_MUSLIM = "tmn-src-hadith-muslim-shamela";
/** Sirat Ibn Hisham, ed. al-Saqqa / al-Abyari / Shalabi on shamela.ws (book 23833) — verbatim Seerah passages. */
export const TMN_SEERAH_IBN_HISHAM = "tmn-src-seerah-ibn-hisham-shamela";

const DEMO: VerificationStatus = "repository_demo";

export function quranProvenance(input: {
  sourceReference: string;
  surah: number;
  ayah: number;
  edition?: string;
  verificationStatus?: VerificationStatus;
}): ContentProvenance {
  return {
    sourceId: TMN_QURAN,
    sourceReference: input.sourceReference,
    verificationStatus: input.verificationStatus ?? DEMO,
    contentOrigin: "source_text",
    quran: {
      surah: input.surah,
      ayah: input.ayah,
      edition: input.edition ?? "repository-demo-mushaf",
    },
  };
}

export function seerahStoryProvenance(input: {
  sourceReference: string;
  verificationStatus?: VerificationStatus;
  contentOrigin?: "source_text" | "reviewed_explanation";
  hadithReference?: string;
}): StoryProvenance {
  return {
    sourceId: TMN_SEERAH,
    sourceReference: input.sourceReference,
    verificationStatus: input.verificationStatus ?? DEMO,
    contentOrigin: input.contentOrigin ?? "reviewed_explanation",
    seerah: { sourceReference: input.sourceReference },
    ...(input.hadithReference
      ? { hadith: { collection: "صحيح البخاري", hadithReference: input.hadithReference } }
      : {}),
  };
}

export function syncVerifiedFlag(status: VerificationStatus): boolean {
  return status === "repository_demo" || status === "published";
}
