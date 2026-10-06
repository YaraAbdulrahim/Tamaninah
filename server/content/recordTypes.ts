import type { ContentLevel, ContentSource, ContentType } from "../../shared/experience/guidance";
import type { ContentProvenance, StoryProvenance } from "./provenance";

export type StoredContent = {
  id: string;
  type: ContentType;
  topicId: string;
  level: ContentLevel;
  published: boolean;
  verified: boolean;
  title?: string;
  arabic: string;
  translation: string;
  place: string;
  source: ContentSource;
  provenance: ContentProvenance;
  /** Presentation only: exact substrings of `arabic`, computed at load from curated locators. */
  highlight?: string;
  lead?: string;
};

export type StoryScene = {
  id: string;
  title: string;
  text: string;
  reference?: string;
};

export type StoredStory = {
  id: string;
  topicId: string;
  level: ContentLevel;
  published: boolean;
  verified: boolean;
  title: string;
  /** English form of the event label (titles are neutral labels, never religious text). */
  titleEn?: string;
  headline: string;
  opening: string;
  body: string[];
  lessons: string[];
  takeaway: string;
  keep: string;
  /** Interactive beats — no generated events; from stored narrative only. */
  scenes?: StoryScene[];
  source: ContentSource;
  provenance: StoryProvenance;
  /** Presentation only: consecutive verbatim segments of the body, and exact substrings to light up. */
  beats?: string[];
  keyQuotes?: string[];
};
