import { getPublishedContentRecord } from "./publishedRepository";
import type { StoredContent } from "./recordTypes";
import { getTopicQuranAnchor } from "./topicQuranAnchors";
import { getTopicTafsirAnchor } from "./topicSourceAnchors";

/**
 * Published tafsir excerpt for a topic — only if it explains the very verse the topic's Quran
 * slot shows (published repository only; no editorial fallback).
 */
export function getTafsirEvidenceForTopic(topicId: string): StoredContent | null {
  const anchor = getTopicTafsirAnchor(topicId);
  const verse = getTopicQuranAnchor(topicId);
  if (!anchor || !verse) return null;
  const record = getPublishedContentRecord(anchor.contentId);
  if (!record || record.type !== "tafsir" || record.topicId !== topicId) return null;
  const t = record.provenance.tafsir;
  if (!t || t.surah !== verse.surah || t.ayah !== verse.ayah) return null;
  return record;
}
