import type { ContentLevel } from "../../shared/experience/guidance";
import { getContentRecord, getStoryRecord } from "./catalog";
import { assertDisplayableContent, assertDisplayableStory, toRetrieveError } from "./contentPolicy";
import {
  toPublicContent,
  toPublicStory,
  validateContentId,
  validateStoryId,
} from "./whitelist";

/**
 * IDs from the model only — no theme fallback. Fail closed.
 */
export function retrieveVerified(
  draft: { content_ids?: string[]; story_id?: string | null },
  journeyLevel: ContentLevel = "A",
) {
  const chosenId = draft.content_ids?.[0];
  const contentErr = validateContentId(chosenId);
  if (contentErr || !chosenId) {
    return { content: null, story: null, error: contentErr ?? ("CONTENT_NOT_FOUND" as const) };
  }

  const record = getContentRecord(chosenId);
  if (!record) {
    return { content: null, story: null, error: "CONTENT_NOT_FOUND" as const };
  }

  const journeyTopicId = record.topicId;
  const policyErr = assertDisplayableContent(record, journeyLevel, journeyTopicId);
  if (policyErr) {
    return { content: null, story: null, error: toRetrieveError(policyErr) ?? "INSUFFICIENT_REFERENCE" };
  }

  let story = null;
  if (draft.story_id) {
    const storyErr = validateStoryId(draft.story_id);
    if (storyErr) {
      return { content: null, story: null, error: storyErr };
    }
    const storyRecord = getStoryRecord(draft.story_id);
    if (!storyRecord) {
      return { content: null, story: null, error: "STORY_NOT_FOUND" as const };
    }
    const storyPolicyErr = assertDisplayableStory(storyRecord, journeyLevel, storyRecord.topicId);
    if (storyPolicyErr) {
      return { content: null, story: null, error: toRetrieveError(storyPolicyErr) ?? "INSUFFICIENT_REFERENCE" };
    }
    story = toPublicStory(storyRecord);
  }

  return { content: toPublicContent(record), story, error: null };
}

export { resolveTopicMedia } from "./whitelist";
