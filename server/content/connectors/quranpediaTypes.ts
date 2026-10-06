/** Quranpedia API v1 — server-side only. */

export type QuranpediaMushafAyah = {
  id: number;
  number: number;
  surah: string;
  page_number?: number;
  text: string;
  marker?: string;
};

export type QuranpediaTranslationRow = {
  book: { id: number; name: string; short_name: string | null };
  "translation-content": string;
};

export type QuranpediaAyahBundle = {
  surah: number;
  ayah: number;
  mushafId: number;
  arabic: string;
  translationEn: string;
  translationBookId: number;
};

export type QuranpediaFetchResult =
  | { ok: true; bundle: QuranpediaAyahBundle }
  | { ok: false; code: "HTTP_ERROR" | "INVALID_JSON" | "EMPTY_TEXT" | "RATE_LIMIT" | "NETWORK"; message: string };
