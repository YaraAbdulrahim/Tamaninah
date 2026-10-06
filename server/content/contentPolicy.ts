import type { ContentLevel } from "../../shared/experience/guidance";
import type { StoredContent, StoredStory } from "./catalog";
import {
  assertProvenanceForContent,
  assertProvenanceForStory,
  isDisplayableVerification,
  type ProvenanceFailure,
} from "./provenance";
import { contentPermittedForLevel, requiresReferenceForLevel } from "./levelGuard";
import type { WhitelistFailure } from "./whitelist";

export type ContentPolicyFailure =
  | WhitelistFailure
  | ProvenanceFailure
  | "LEVEL_POLICY_VIOLATION";

export function assertDisplayableContent(
  record: StoredContent,
  journeyLevel: ContentLevel,
  journeyTopicId?: string,
): ContentPolicyFailure | null {
  if (!record.published) return "NOT_PUBLISHED";
  if (
    !record.verified ||
    !isDisplayableVerification(
      record.provenance.verificationStatus,
      record.topicId,
      journeyTopicId,
    )
  ) {
    return "NOT_VERIFIED";
  }

  const provErr = assertProvenanceForContent(
    record.type,
    record.provenance,
    journeyTopicId ?? record.topicId,
  );
  if (provErr) return provErr;

  if (!contentPermittedForLevel(record.level, journeyLevel)) return "LEVEL_POLICY_VIOLATION";

  const ref = record.provenance.sourceReference.trim();
  if (requiresReferenceForLevel(journeyLevel) && !ref) {
    return "SOURCE_REFERENCE_MISSING";
  }

  return null;
}

export function assertDisplayableStory(
  record: StoredStory,
  journeyLevel: ContentLevel,
  journeyTopicId?: string,
): ContentPolicyFailure | null {
  if (!record.published) return "NOT_PUBLISHED";
  if (
    !record.verified ||
    !isDisplayableVerification(
      record.provenance.verificationStatus,
      record.topicId,
      journeyTopicId,
    )
  ) {
    return "NOT_VERIFIED";
  }

  const provErr = assertProvenanceForStory(record.provenance, journeyTopicId ?? record.topicId);
  if (provErr) return provErr;

  if (!contentPermittedForLevel(record.level, journeyLevel)) return "LEVEL_POLICY_VIOLATION";

  const ref = record.provenance.sourceReference.trim();
  if (requiresReferenceForLevel(journeyLevel) && !ref) {
    return "SOURCE_REFERENCE_MISSING";
  }

  return null;
}

/** Fail-closed: any policy violation maps to insufficient reference at API boundary. */
export function toRetrieveError(failure: ContentPolicyFailure | WhitelistFailure | null) {
  if (!failure) return null;
  return "INSUFFICIENT_REFERENCE" as const;
}
