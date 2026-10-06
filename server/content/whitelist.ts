import type { ContentLevel, Lang, PublicProvenance, VerifiedContent, VerifiedStory } from "../../shared/experience/guidance";
import type { StoredContent, StoredStory } from "./catalog";
import { getContentRecord, getStoryRecord } from "./catalog";
import { assertDisplayableContent, assertDisplayableStory, toRetrieveError } from "./contentPolicy";
import { VERIFICATION_DISCLOSURE } from "./provenance";
import { attributionDisclosure, evidenceTypeLabel } from "./provenanceIntegrity";
import { displayNameForSource, getRegistrySource } from "./sourceRegistry";
import { getPublishedTopic } from "./topics";

export type WhitelistFailure =
  | "CONTENT_NOT_FOUND"
  | "STORY_NOT_FOUND"
  | "TOPIC_NOT_FOUND"
  | "NOT_VERIFIED"
  | "NOT_PUBLISHED"
  | "INSUFFICIENT_REFERENCE";

export function validateContentId(id: string | null | undefined): WhitelistFailure | null {
  if (!id) return "CONTENT_NOT_FOUND";
  const item = getContentRecord(id);
  if (!item) return "CONTENT_NOT_FOUND";
  if (!item.verified) return "NOT_VERIFIED";
  if (!item.published) return "NOT_PUBLISHED";
  return null;
}

export function validateStoryId(id: string | null | undefined): WhitelistFailure | null {
  if (!id) return null;
  const item = getStoryRecord(id);
  if (!item) return "STORY_NOT_FOUND";
  if (!item.verified) return "NOT_VERIFIED";
  if (!item.published) return "NOT_PUBLISHED";
  return null;
}

export function validateTopicId(id: string | null | undefined): WhitelistFailure | null {
  if (!id) return "TOPIC_NOT_FOUND";
  const topic = getPublishedTopic(id);
  if (!topic) return "TOPIC_NOT_FOUND";
  return null;
}

function toPublicProvenanceFromContent(provenance: StoredContent["provenance"], lang: Lang): PublicProvenance {
  const disclosure = VERIFICATION_DISCLOSURE[provenance.verificationStatus];
  return {
    sourceId: provenance.sourceId,
    sourceReference: provenance.sourceReference,
    verificationStatus: provenance.verificationStatus,
    contentOrigin: provenance.contentOrigin,
    verificationDisclosure: lang === "en" ? disclosure.en : disclosure.ar,
    attributionDisclosure: attributionDisclosure(lang, {
      contentOrigin: provenance.contentOrigin,
      evidenceType: provenance.reviewEvidence?.evidenceType,
      sourceId: provenance.sourceId,
    }),
    ...(provenance.reviewEvidence
      ? {
          reviewCheckedAgainst: provenance.reviewEvidence.checkedAgainst,
          reviewEvidenceType: provenance.reviewEvidence.evidenceType,
          reviewEvidenceTypeLabel: evidenceTypeLabel(lang, provenance.reviewEvidence.evidenceType),
        }
      : {}),
    ...(provenance.quran ? { quran: provenance.quran } : {}),
    ...(provenance.hadith ? { hadith: provenance.hadith } : {}),
    ...(provenance.tafsir ? { tafsir: provenance.tafsir } : {}),
    ...(provenance.seerah ? { seerah: provenance.seerah } : {}),
  };
}

function toPublicProvenanceFromStory(provenance: StoredStory["provenance"], lang: Lang): PublicProvenance {
  const disclosure = VERIFICATION_DISCLOSURE[provenance.verificationStatus];
  return {
    sourceId: provenance.sourceId,
    sourceReference: provenance.sourceReference,
    verificationStatus: provenance.verificationStatus,
    contentOrigin: provenance.contentOrigin,
    verificationDisclosure: lang === "en" ? disclosure.en : disclosure.ar,
    attributionDisclosure: attributionDisclosure(lang, {
      contentOrigin: provenance.contentOrigin,
      evidenceType: provenance.reviewEvidence?.evidenceType,
      sourceId: provenance.sourceId,
    }),
    ...(provenance.reviewEvidence
      ? {
          reviewCheckedAgainst: provenance.reviewEvidence.checkedAgainst,
          reviewEvidenceType: provenance.reviewEvidence.evidenceType,
          reviewEvidenceTypeLabel: evidenceTypeLabel(lang, provenance.reviewEvidence.evidenceType),
        }
      : {}),
    ...(provenance.hadith ? { hadith: provenance.hadith } : {}),
    ...(provenance.seerah ? { seerah: provenance.seerah } : {}),
  };
}

export function toPublicContent(item: StoredContent, lang: Lang = "ar"): VerifiedContent {
  const registry = getRegistrySource(item.provenance.sourceId);
  return {
    content_id: item.id,
    type: item.type,
    topicId: item.topicId,
    level: item.level,
    published: item.published,
    verified: item.verified,
    title: item.title,
    arabic: item.arabic,
    translation: item.translation,
    place: item.place,
    reference: item.provenance.sourceReference,
    source: {
      name: registry?.name ?? displayNameForSource(item.provenance.sourceId) ?? item.source.name,
      reference: item.provenance.sourceReference,
      ...(item.source.url ? { url: item.source.url } : {}),
    },
    provenance: toPublicProvenanceFromContent(item.provenance, lang),
    // Presentation fields are re-checked here too: only exact substrings of the text travel.
    ...(item.highlight && item.arabic.includes(item.highlight) ? { highlight: item.highlight } : {}),
    ...(item.lead && item.arabic.startsWith(item.lead) ? { lead: item.lead } : {}),
  };
}

export function toPublicStory(item: StoredStory, lang: Lang = "ar"): VerifiedStory {
  const registry = getRegistrySource(item.provenance.sourceId);
  return {
    story_id: item.id,
    topicId: item.topicId,
    level: item.level,
    published: item.published,
    verified: item.verified,
    title: lang === "en" && item.titleEn ? item.titleEn : item.title,
    headline: item.headline,
    opening: item.opening,
    body: item.body,
    lessons: item.lessons,
    takeaway: item.takeaway,
    keep: item.keep,
    source: {
      name: registry?.name ?? displayNameForSource(item.provenance.sourceId) ?? item.source.name,
      reference: item.provenance.sourceReference,
      ...(item.source.url ? { url: item.source.url } : {}),
    },
    provenance: toPublicProvenanceFromStory(item.provenance, lang),
    ...(item.scenes?.length ? { scenes: item.scenes } : {}),
    ...(item.beats?.length && item.beats.join(" ") === item.body.join("\n") ? { beats: item.beats } : {}),
    ...(item.keyQuotes?.length && item.keyQuotes.every((q) => item.body.some((b) => b.includes(q)))
      ? { key_quotes: item.keyQuotes }
      : {}),
  };
}

/**
 * Resolve displayable scripture + optional story for a user-chosen topic.
 * Fail closed: whitelist → registry → provenance → level policy.
 */
export function resolveTopicMedia(topicId: string, journeyLevel: ContentLevel = "A", lang: Lang = "ar") {
  const topicErr = validateTopicId(topicId);
  if (topicErr) {
    return { content: null, story: null, error: topicErr as WhitelistFailure };
  }
  const topic = getPublishedTopic(topicId)!;

  let primaryContent: StoredContent | null = null;
  for (const cid of topic.contentIds) {
    const record = getContentRecord(cid);
    if (!record) continue;
    const policyErr = assertDisplayableContent(record, journeyLevel, topicId);
    if (policyErr) continue;
    primaryContent = record;
    break;
  }
  if (!primaryContent) {
    return { content: null, story: null, error: "INSUFFICIENT_REFERENCE" as const };
  }

  let story: VerifiedStory | null = null;
  if (topic.storyId) {
    const storyRecord = getStoryRecord(topic.storyId);
    if (!storyRecord) {
      return { content: null, story: null, error: "STORY_NOT_FOUND" as const };
    }
    const storyPolicyErr = assertDisplayableStory(storyRecord, journeyLevel, topicId);
    if (storyPolicyErr) {
      return { content: null, story: null, error: toRetrieveError(storyPolicyErr) ?? "INSUFFICIENT_REFERENCE" };
    }
    story = toPublicStory(storyRecord, lang);
  }

  return { content: toPublicContent(primaryContent, lang), story, error: null };
}
