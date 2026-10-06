import {
  QURANPEDIA_FIXTURE_MUSHAF,
  QURANPEDIA_FIXTURE_TRANSLATIONS,
} from "./quranpedia.fixtures";
import type {
  QuranpediaAyahBundle,
  QuranpediaFetchResult,
  QuranpediaMushafAyah,
  QuranpediaTranslationRow,
} from "./quranpediaTypes";

const API_BASE = "https://api.quranpedia.net/v1";
const DEFAULT_MUSHAF_ID = 1;
/** Prefer Sahih International when present in translation list. */
const PREFERRED_TRANSLATION_BOOK_ID = 13638;
const MIN_INTERVAL_MS = 220;

let lastRequestAt = 0;

export type QuranpediaClientOptions = {
  fetchImpl?: typeof fetch;
  /** When true, never hits the network (Vitest / offline). */
  useFixtures?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimitWait(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "").trim();
}

function pickTranslation(rows: QuranpediaTranslationRow[]): QuranpediaTranslationRow | null {
  if (!rows.length) return null;
  const preferred = rows.find((r) => r.book.id === PREFERRED_TRANSLATION_BOOK_ID);
  return preferred ?? rows[0] ?? null;
}

function parseTranslationBody(raw: string): string {
  const line = raw.split("\n")[0]?.trim() ?? "";
  return line.replace(/^\(\d+\)\s*/, "").trim();
}

export function quranpediaFixtureFetch(
  mushafId: number,
  surah: number,
  ayah: number,
): QuranpediaFetchResult {
  const key = `${mushafId}-${surah}-${ayah}`;
  const mushaf = QURANPEDIA_FIXTURE_MUSHAF[key];
  const translations = QURANPEDIA_FIXTURE_TRANSLATIONS[`${surah}-${ayah}`];
  if (!mushaf || !translations?.length) {
    return { ok: false, code: "HTTP_ERROR", message: `fixture missing for ${key}` };
  }
  const picked = pickTranslation(translations);
  if (!picked) return { ok: false, code: "EMPTY_TEXT", message: "no translation row" };
  const arabic = stripBom(mushaf.text);
  const translationEn = parseTranslationBody(picked["translation-content"]);
  if (!arabic || !translationEn) return { ok: false, code: "EMPTY_TEXT", message: "empty ayah text" };
  return {
    ok: true,
    bundle: {
      surah,
      ayah,
      mushafId,
      arabic,
      translationEn,
      translationBookId: picked.book.id,
    },
  };
}

async function fetchJson<T>(url: string, fetchImpl: typeof fetch): Promise<T | null> {
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (res.status === 429) return null;
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Read-only ayah fetch from allowlisted Quranpedia API — server-side only. */
export async function fetchQuranpediaAyah(
  surah: number,
  ayah: number,
  mushafId: number = DEFAULT_MUSHAF_ID,
  options: QuranpediaClientOptions = {},
): Promise<QuranpediaFetchResult> {
  const env = (import.meta as ImportMeta & { env?: { VITEST?: boolean | string; MODE?: string } }).env;
  const useFixtures =
    options.useFixtures ??
    (env?.VITEST === true || env?.VITEST === "true" || env?.MODE === "test");

  if (useFixtures) {
    return quranpediaFixtureFetch(mushafId, surah, ayah);
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    return { ok: false, code: "NETWORK", message: "fetch unavailable" };
  }

  await rateLimitWait();

  const mushafUrl = `${API_BASE}/mushafs/${mushafId}/${surah}/${ayah}`;
  const mushaf = await fetchJson<QuranpediaMushafAyah>(mushafUrl, fetchImpl);
  if (!mushaf?.text) {
    return { ok: false, code: "HTTP_ERROR", message: "mushaf fetch failed" };
  }

  await rateLimitWait();
  const transUrl = `${API_BASE}/translations/${surah}/${ayah}/en`;
  const translations = await fetchJson<QuranpediaTranslationRow[]>(transUrl, fetchImpl);
  const picked = translations ? pickTranslation(translations) : null;
  if (!picked) {
    return { ok: false, code: "EMPTY_TEXT", message: "translation fetch failed" };
  }

  const arabic = stripBom(mushaf.text);
  const translationEn = parseTranslationBody(picked["translation-content"]);
  if (!arabic || !translationEn) {
    return { ok: false, code: "EMPTY_TEXT", message: "empty ayah text" };
  }

  return {
    ok: true,
    bundle: {
      surah,
      ayah,
      mushafId,
      arabic,
      translationEn,
      translationBookId: picked.book.id,
    },
  };
}

export function formatQuranSourceReference(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

export function liveApiCheckedAgainst(mushafId: number, surah: number, ayah: number): string {
  return `api-v1-mushafs-${mushafId}-${surah}-${ayah}`;
}

export type { QuranpediaAyahBundle, QuranpediaFetchResult };
