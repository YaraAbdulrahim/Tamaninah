import { getRegistrySource, isContentTypeAllowedForSource } from "../sourceRegistry";
import type { NormalizedQuranIngest, NormalizedStoryIngest } from "./types";
import { fingerprintText } from "./fingerprint";

export type NormalizeFailure =
  | "UNKNOWN_SOURCE"
  | "SOURCE_TYPE_MISMATCH"
  | "MISSING_REFERENCE"
  | "INVALID_ORIGIN";

export function normalizeQuranIngest(input: NormalizedQuranIngest): NormalizeFailure | null {
  if (!getRegistrySource(input.sourceId)) return "UNKNOWN_SOURCE";
  if (!isContentTypeAllowedForSource(input.sourceId, "quran")) return "SOURCE_TYPE_MISMATCH";
  if (!input.sourceReference.trim()) return "MISSING_REFERENCE";
  if (input.contentOrigin !== "source_text") return "INVALID_ORIGIN";
  if (!input.arabic.trim() || !input.quran.surah || !input.quran.ayah) return "MISSING_REFERENCE";
  return null;
}

export function normalizeStoryIngest(input: NormalizedStoryIngest): NormalizeFailure | null {
  if (!getRegistrySource(input.sourceId)) return "UNKNOWN_SOURCE";
  if (!isContentTypeAllowedForSource(input.sourceId, "seerah")) return "SOURCE_TYPE_MISMATCH";
  if (!input.sourceReference.trim() || !input.seerah.sourceReference.trim()) return "MISSING_REFERENCE";
  return null;
}

export function buildQuranFingerprint(record: Pick<NormalizedQuranIngest, "arabic" | "translation" | "sourceReference">) {
  return fingerprintText([record.arabic, record.translation, record.sourceReference]);
}

export function buildStoryFingerprint(record: Pick<NormalizedStoryIngest, "body" | "lessons" | "sourceReference">) {
  return fingerprintText([...record.body, ...record.lessons, record.sourceReference]);
}
