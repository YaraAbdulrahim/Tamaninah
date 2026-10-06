/**
 * Dorar Hadith (tmn-src-hadith-dorar) — allowlisted routing only.
 *
 * Official access today: HTML search + JSONP endpoints (browser-oriented).
 * No stable, documented read-only REST API suitable for server-side ingest
 * without license/usage clarification.
 *
 * Do not scrape. Do not fabricate hadith bundles.
 */
export const DORAR_HADITH_ADAPTER_STATUS = "license_clarification_needed" as const;

export type DorarHadithAdapterStatus = typeof DORAR_HADITH_ADAPTER_STATUS | "adapter_not_ready";

export function dorarHadithAdapterStatus(): DorarHadithAdapterStatus {
  return DORAR_HADITH_ADAPTER_STATUS;
}
