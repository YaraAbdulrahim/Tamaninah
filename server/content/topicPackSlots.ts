import type { Lang } from "../../shared/experience/guidance";

import { getContentRecord } from "./catalog";
import { getConceptEvidenceForTopic } from "./conceptEvidence";

import { hadithEvidenceGapReason, getHadithEvidenceForTopic } from "./hadithEvidence";

import { getQuranEvidenceForTopic } from "./quranEvidence";

import { getStoryEvidenceForTopic } from "./storyEvidence";

import { getTafsirEvidenceForTopic } from "./tafsirEvidence";

import { assertDisplayableContent, assertDisplayableStory } from "./contentPolicy";

import { getPublishedTopic } from "./topics";



export type SlotState = "READY" | "NOT_READY";



/** Slots shown in the learning journey (reflection excluded from contract). */

export type PackSlotKey =

  | "quran"

  | "quran_explanation"

  | "hadith"

  | "hadith_explanation"

  | "story";



export type PackSlotDetail = {

  state: SlotState;

  reason?: string;

  evidenceType?: "live_api" | "internal_snapshot" | "editorial_internal" | "source_page";

  sourceId?: string;

  reference?: string;

};



export type TopicPackSlotReadiness = {

  topicId: string;

  slots: Record<PackSlotKey, PackSlotDetail>;

  /** True only when every religious content slot is READY. */

  fullReligiousPack: boolean;

  /** Minimum journey (published quran) available. */

  journeyEligible: boolean;

};



function quranSlot(topicId: string): PackSlotDetail {

  const record = getQuranEvidenceForTopic(topicId);

  if (!record) return { state: "NOT_READY", reason: "insufficient_reference" };

  if (assertDisplayableContent(record, "A", topicId)) {

    return { state: "NOT_READY", reason: "policy_blocked" };

  }

  return {

    state: "READY",

    evidenceType: record.provenance.reviewEvidence?.evidenceType,

    sourceId: record.provenance.sourceId,

    reference: record.provenance.sourceReference,

  };

}



function hadithSlot(topicId: string): PackSlotDetail {

  const record = getHadithEvidenceForTopic(topicId);

  if (record && assertDisplayableContent(record, "A", topicId) === null) {

    return {

      state: "READY",

      evidenceType: record.provenance.reviewEvidence?.evidenceType,

      sourceId: record.provenance.sourceId,

      reference: record.provenance.sourceReference,

    };

  }

  return { state: "NOT_READY", reason: hadithEvidenceGapReason(topicId) };

}



function storySlot(topicId: string): PackSlotDetail {

  const record = getStoryEvidenceForTopic(topicId);

  if (!record) return { state: "NOT_READY", reason: "insufficient_reference" };

  if (assertDisplayableStory(record, "A", topicId)) {

    return { state: "NOT_READY", reason: "policy_blocked" };

  }

  return {

    state: "READY",

    evidenceType: record.provenance.reviewEvidence?.evidenceType,

    sourceId: record.provenance.sourceId,

    reference: record.provenance.sourceReference,

  };

}



function quranExplanationSlot(topicId: string): PackSlotDetail {

  const topic = getPublishedTopic(topicId);

  if (!topic) return { state: "NOT_READY", reason: "topic_not_found" };

  const tafsir = getTafsirEvidenceForTopic(topicId);

  if (tafsir && assertDisplayableContent(tafsir, "A", topicId) === null) {

    return {

      state: "READY",

      evidenceType: tafsir.provenance.reviewEvidence?.evidenceType,

      sourceId: tafsir.provenance.sourceId,

      reference: tafsir.provenance.sourceReference,

    };

  }

  const anchored = getConceptEvidenceForTopic(topicId);

  const id = topic.quranExplanationId ?? topic.conceptId;

  if (anchored && assertDisplayableContent(anchored, "A", topicId) === null) {

    return {

      state: "READY",

      evidenceType: anchored.provenance.reviewEvidence?.evidenceType,

      sourceId: anchored.provenance.sourceId,

      reference: anchored.provenance.sourceReference,

    };

  }

  if (!id) return { state: "NOT_READY", reason: "insufficient_reference" };

  const byId = getContentRecord(id);

  if (!byId) return { state: "NOT_READY", reason: "insufficient_reference" };

  if (assertDisplayableContent(byId, "A", topicId)) {

    return { state: "NOT_READY", reason: "policy_blocked" };

  }

  return {

    state: "READY",

    evidenceType: byId.provenance.reviewEvidence?.evidenceType,

    sourceId: byId.provenance.sourceId,

    reference: byId.provenance.sourceReference,

  };

}



function hadithExplanationSlot(topicId: string): PackSlotDetail {

  const topic = getPublishedTopic(topicId);

  if (!topic?.hadithExplanationId) {

    return { state: "NOT_READY", reason: "insufficient_reference" };

  }

  const record = getContentRecord(topic.hadithExplanationId);

  if (!record) return { state: "NOT_READY", reason: "insufficient_reference" };

  if (assertDisplayableContent(record, "A", topicId)) {

    return { state: "NOT_READY", reason: "policy_blocked" };

  }

  return {

    state: "READY",

    evidenceType: record.provenance.reviewEvidence?.evidenceType,

    sourceId: record.provenance.sourceId,

    reference: record.provenance.sourceReference,

  };

}



export function getTopicPackSlotReadiness(topicId: string): TopicPackSlotReadiness {

  const slots: Record<PackSlotKey, PackSlotDetail> = {

    quran: quranSlot(topicId),

    quran_explanation: quranExplanationSlot(topicId),

    hadith: hadithSlot(topicId),

    hadith_explanation: hadithExplanationSlot(topicId),

    story: storySlot(topicId),

  };

  const religiousReady = (Object.keys(slots) as PackSlotKey[]).every(

    (k) => slots[k].state === "READY",

  );

  const journeyEligible = slots.quran.state === "READY";

  return {

    topicId,

    slots,

    fullReligiousPack: religiousReady,

    journeyEligible,

  };

}



/** Public labels for UI (non-religious metadata). */

export function packSlotsForClient(topicId: string, lang: Lang) {

  const readiness = getTopicPackSlotReadiness(topicId);

  const labels: Record<PackSlotKey, { ar: string; en: string }> = {

    quran: { ar: "الآية", en: "Verse" },

    quran_explanation: { ar: "شرح الآية", en: "Verse explanation" },

    hadith: { ar: "الحديث", en: "Hadith" },

    hadith_explanation: { ar: "شرح الحديث", en: "Hadith explanation" },

    story: { ar: "قصة تفاعلية", en: "Interactive story" },

  };

  return (Object.keys(readiness.slots) as PackSlotKey[]).map((key) => ({

    key,

    label: lang === "en" ? labels[key].en : labels[key].ar,

    ready: readiness.slots[key].state === "READY",

  }));

}



export function isTopicJourneyEligible(topicId: string): boolean {

  return getTopicPackSlotReadiness(topicId).journeyEligible;

}


