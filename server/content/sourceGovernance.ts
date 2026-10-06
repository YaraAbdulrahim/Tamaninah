import type { ContentType } from "../../shared/experience/guidance";
import {
  assertRegistryBinding,
  type ProvenanceFailure,
} from "./provenance";
import { expectedSourceFamilyFromRegistry } from "./sourceRegistryBridge";

export type SourceGovernanceFailure =
  | ProvenanceFailure
  | "UNKNOWN_CONTENT_TYPE";

/** @deprecated P1-A — use registry via contentPolicy. Kept for narrow test imports. */
export const SOURCE_FAMILY = expectedSourceFamilyFromRegistry;

export function governanceTypeForStory(): ContentType {
  return "seerah";
}

export function sourceReferencePresent(sourceReference: string | null | undefined): boolean {
  return Boolean(sourceReference?.trim());
}

/** Registry enforcement: sourceId + content type binding. */
export function assertSourceAllowedByRegistry(
  sourceId: string,
  contentType: ContentType,
): SourceGovernanceFailure | null {
  if (!contentType) return "UNKNOWN_CONTENT_TYPE";
  return assertRegistryBinding(sourceId, contentType);
}

/** Legacy name-based check removed from display path — map failure for old tests. */
export function assertSourceAllowed(
  contentType: ContentType,
  source: { name?: string; reference?: string } | null | undefined,
): "SOURCE_METADATA_MISSING" | "SOURCE_FAMILY_MISMATCH" | null {
  if (!source?.name?.trim()) return "SOURCE_METADATA_MISSING";
  const name = source.name.trim().toLowerCase();
  const family = SOURCE_FAMILY[contentType];
  if (!family) return "SOURCE_FAMILY_MISMATCH";
  const ok =
    name === family.label.toLowerCase() ||
    (contentType === "seerah" && (name === "seerah" || name === "hadith / seerah"));
  return ok ? null : "SOURCE_FAMILY_MISMATCH";
}

export function sourceMetadataPresent(source: { name?: string; reference?: string } | null | undefined): boolean {
  if (!source) return false;
  return Boolean(source.name?.trim() && source.reference?.trim());
}
