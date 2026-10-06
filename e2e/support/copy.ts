/**
 * Interface strings come from the app's own copy table, so a wording change in src/copy.ts does
 * not break the suite — the tests check that the right string shows up in the right place.
 * (A few safety-critical strings are also asserted literally in the specs, on purpose.)
 */
import { chipList, copy, HELPLINE_URL } from "../../src/copy";

export { HELPLINE_URL };
export const t = copy.ar;
export const en = copy.en;
/** Optional "what you're writing about" chips: [ar, en] by index (تجربة جديدة, سؤال يشغلني, شيء جميل حصل لي, …). */
export const chips = chipList;
