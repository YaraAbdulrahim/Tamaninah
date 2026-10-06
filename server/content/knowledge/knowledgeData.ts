/**
 * Default knowledge base for the running app, built once from the curated files:
 * - sourcesPdf.ts — verbatim transcription of sources.pdf (scope, levels, approved sources, glossary)
 * - data/bayyinat.index.json / data/bayyinat.answers.json — Bayyinat question index + reviewed excerpts
 *
 * JSON is imported as modules so it is bundled into the Netlify Function (no runtime file reads).
 */
import bayyinatAnswers from "./data/bayyinat.answers.json";
import bayyinatIndex from "./data/bayyinat.index.json";
import { createKnowledgeBase, type KnowledgeBase } from "./knowledgeBase";
import type { BayyinatAnswersFile, BayyinatIndexFile } from "./knowledgeTypes";
import { APPROVED_SOURCES, GLOSSARY, LEVELS, SCOPE, SOURCES_PDF } from "./sourcesPdf";

let cached: KnowledgeBase | null = null;

export function getDefaultKnowledgeBase(): KnowledgeBase {
  if (!cached) {
    cached = createKnowledgeBase({
      referenceTitleAr: SOURCES_PDF.name_ar,
      approvedSources: APPROVED_SOURCES,
      glossary: GLOSSARY,
      bayyinatIndex: bayyinatIndex as BayyinatIndexFile,
      bayyinatAnswers: bayyinatAnswers as BayyinatAnswersFile,
      // Prompt grounding: only the PDF's own Arabic wording (no UI translations).
      levels: LEVELS.map(({ level, name_ar, scope_ar, handling_ar }) => ({ level, name_ar, scope_ar, handling_ar })),
      scope: SCOPE,
    });
  }
  return cached;
}
