import { buildLiveQuranPublishedSlice } from "./ingestion/liveQuranPipeline";
import { mergePublishedContentRecords } from "./publishedRepository";

/**
 * OPT-IN live refresh of Quran items from Quranpedia (dev/preview only, `QURAN_LIVE_WARM=true`).
 *
 * Production never needs it: the committed snapshot (server/content/snapshots/quran.published.json)
 * is loaded synchronously at module init, so topics are ready with zero network and this is never
 * awaited on the request path.
 */
function runningInVitest(): boolean {
  const env = (import.meta as ImportMeta & { env?: { VITEST?: boolean | string; MODE?: string } }).env;
  return env?.VITEST === true || env?.VITEST === "true" || env?.MODE === "test";
}

let warmPromise: Promise<void> | null = null;

export function liveQuranWarmEnabled(env: { QURAN_LIVE_WARM?: string } | undefined): boolean {
  const flag = env?.QURAN_LIVE_WARM?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

/** Start an async live merge (no-op under Vitest). Callers decide whether it is enabled. */
export function scheduleQuranPublishedWarm(): void {
  if (runningInVitest()) return;
  if (warmPromise) return;
  warmPromise = buildLiveQuranPublishedSlice()
    .then((records) => {
      mergePublishedContentRecords(records);
    })
    .catch(() => {
      /* fail closed — the snapshot stays authoritative */
    });
}

/** Await a scheduled live refresh (tests / scripts only — never on the request path). */
export async function awaitQuranPublishedWarm(): Promise<void> {
  if (runningInVitest()) return;
  if (warmPromise) await warmPromise;
}

/** Test hook: reset warm state between isolated server tests. */
export function resetQuranPublishedWarmForTests(): void {
  warmPromise = null;
}
