import type { ContentType } from "../../shared/experience/guidance";
import { SOURCE_REGISTRY } from "./sourceRegistry";

/** Bridge for docs/tests that referenced SOURCE_FAMILY labels. */
export const expectedSourceFamilyFromRegistry: Record<
  ContentType,
  { label: string; referenceCatalog: string }
> = {
  quran: labelFor("quran"),
  hadith: labelFor("hadith"),
  seerah: labelFor("seerah"),
  concept: labelFor("concept"),
  tafsir: labelFor("tafsir"),
};

function labelFor(family: ContentType) {
  const entry = SOURCE_REGISTRY.find((s) => s.sourceFamily === family);
  return {
    label: entry?.name ?? family,
    referenceCatalog: entry?.referenceCatalog ?? "",
  };
}

export { displayNameForSource } from "./sourceRegistry";
