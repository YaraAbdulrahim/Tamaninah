/**
 * Reference strings, URLs and fingerprints shared by the content snapshot script and its loader.
 * (No JSON imports here, so the script can run before any snapshot exists.)
 */
import { TMN_HADITH_BUKHARI, TMN_HADITH_MUSLIM, TMN_SEERAH_IBN_HISHAM, TMN_TAFSIR_TABARI } from "./catalogProvenance";
import { fingerprintText } from "./ingestion/fingerprint";
import type { HadithCollectionKey } from "./topicSourceAnchors";

export const QURANPEDIA_API_BASE = "https://api.quranpedia.net/v1";
export const SHAMELA_BASE = "https://shamela.ws";

export const TAFSIR_SOURCE_ID = TMN_TAFSIR_TABARI;

export const HADITH_COLLECTIONS: Record<
  HadithCollectionKey,
  { shamelaBookId: number; collection: string; sourceId: string }
> = {
  bukhari: { shamelaBookId: 1681, collection: "صحيح البخاري", sourceId: TMN_HADITH_BUKHARI },
  muslim: { shamelaBookId: 1727, collection: "صحيح مسلم", sourceId: TMN_HADITH_MUSLIM },
};

/** Grade basis — the challenge reference's hadith row (sources.pdf): «الأحاديث الصحيحة من الصحيحين». */
export const SAHIHAYN_GRADE = "صحيح";
export function sahihaynGradeBasis(collection: string): string {
  return `أخرجه ${collection}؛ والمرجعية المعتمدة (sources.pdf — الحديث النبوي) تعتمد «الأحاديث الصحيحة من الصحيحين».`;
}

export function quranpediaTafsirApiUrl(surah: number, ayah: number, bookId: number): string {
  return `${QURANPEDIA_API_BASE}/ayah/${surah}/${ayah}/book/${bookId}`;
}

/** Human-viewable Quranpedia embed: the ayah's tafsir tab with this book locked. */
export function quranpediaTafsirViewUrl(surah: number, ayah: number, bookId: number): string {
  return `https://quranpedia.net/embed?surah=${surah}&ayah=${ayah}&type=tafsir&book=${bookId}&lock=1`;
}

export function shamelaPageUrl(bookId: number, pageId: number): string {
  return `${SHAMELA_BASE}/book/${bookId}/${pageId}`;
}

export function shamelaPageContentUrl(bookId: number, pageId: number): string {
  return `${SHAMELA_BASE}/ajax/pageContent/${bookId}/${pageId}`;
}

export function shamelaNumberToPageUrl(bookId: number, number: number): string {
  return `${SHAMELA_BASE}/ajax/specialnumber2id/${bookId}/${number}`;
}

function pageRange(pages: readonly number[]): string {
  if (!pages.length) return "";
  const first = pages[0]!;
  const last = pages[pages.length - 1]!;
  return first === last ? String(first) : `${first}–${last}`;
}

/** e.g. "65:3 · ج23 ص446" — verse explained, then printed volume/page of the tafsir. */
export function tafsirSourceReference(input: { surah: number; ayah: number; volume: number; pages: readonly number[] }): string {
  return `${input.surah}:${input.ayah} · ج${input.volume} ص${pageRange(input.pages)}`;
}

/** e.g. "صحيح البخاري 1469". */
export function hadithSourceReference(input: { collection: string; number: number }): string {
  return `${input.collection} ${input.number}`;
}

export function sourceSnapshotFingerprint(arabic: string, reference: string, url: string): string {
  return fingerprintText([arabic, reference, url]);
}

/** Seerah sources on Shamela (story slot). */
export const SEERAH_SOURCES = {
  bukhari: { shamelaBookId: 1681, book: "صحيح البخاري", sourceId: TMN_HADITH_BUKHARI, kind: "sahih" as const },
  ibn_hisham: {
    shamelaBookId: 23833,
    book: "السيرة النبوية لابن هشام",
    sourceId: TMN_SEERAH_IBN_HISHAM,
    kind: "seerah_book" as const,
  },
};

/** e.g. «صحيح البخاري 3231» or «السيرة النبوية لابن هشام ج1 ص416». */
export function seerahSourceReference(input: {
  sourceKind: "sahih" | "seerah_book";
  book: string;
  number: number | null;
  part: number;
  printedPage: number;
}): string {
  return input.sourceKind === "sahih" && input.number
    ? `${input.book} ${input.number}`
    : `${input.book} ج${input.part} ص${input.printedPage}`;
}
