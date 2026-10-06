/**
 * Verbatim section extraction from al-Jamhara concept pages (islamic-content.com/t/{id}).
 *
 * Used by the snapshot script (server/scripts/snapshotLessons.ts) and by tests. Pure functions only —
 * nothing here fetches. The page is cut into its printed cards («التعريف», «الفضل», «الأدلة», …) and
 * sub-headings; each section's text is taken as printed: tags stripped, entities decoded, honorific
 * glyph spans kept as their text (e.g. «عز وجل», «ﷺ»), tashkeel, ﴿…﴾ and [سورة: آية] untouched.
 * A section with any garbled part (mushaf-font glyphs, placeholders, stray Latin, unbalanced brackets)
 * is dropped whole — never repaired.
 */
import { SourceTextError, decodeEntities } from "../sourceText";

export type RawSection = {
  /** Printed card heading (h4), or "" on lesson-plan pages whose first card has none. */
  card: string;
  /** Printed sub-heading (h1/h2.head-4-title), or "" when the card body has none. */
  sub: string;
  /** Cleaned verbatim text; "\n" only where the page has a <br>. */
  text: string;
};

export type DroppedSection = { card: string; sub: string; reason: string };

export type JamharaPage = {
  /** The page's h1 title (e.g. «التوكل»). */
  title: string;
  sections: RawSection[];
  dropped: DroppedSection[];
};

/**
 * A CMS leak that some pages carry as plain text (Microsoft Word paste metadata), never part of the
 * encyclopedia's wording. It is removed only when it is the trailing run of a section; anywhere else
 * the section is treated as garbled.
 */
export const WORD_PASTE_ARTIFACT = "Normal 0 false false false EN-US X-NONE AR-SA";

const CARD_OPEN = '<div class="border-radius-10 border bg-white mb-30 p-30 wow fadeIn">';

function mainOf(html: string): string {
  const start = html.indexOf("<main");
  const end = html.indexOf("</main>");
  if (start < 0 || end < start) throw new SourceTextError("page has no <main> element");
  return html.slice(start, end);
}

export function pageTitle(html: string): string {
  const m = mainOf(html).match(/<h1 class="entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
  if (!m) throw new SourceTextError("page has no entry title");
  return htmlToText(m[1]!);
}

/** HTML fragment → verbatim text. Inline tags vanish, block tags become a space, <br> a newline. */
export function htmlToText(fragment: string): string {
  const BR = "\u0000";
  let t = fragment
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, BR)
    // Honorific glyph icons are empty <i> elements followed by their text in <span class='font-0'>.
    .replace(/<i\b[^>]*>\s*<\/i>/gi, "")
    .replace(/<\/?(?:p|div|h[1-6]|ul|ol|li|hr|section|article|table|tr|td|th|blockquote)\b[^>]*>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "");
  t = decodeEntities(t);
  t = t.replace(/[\s\u00A0]+/g, (ws) => (ws.includes(BR) ? BR : " "));
  return t
    .split(BR)
    .map((line) => line.replace(/[ \t\u00A0\r\f\v\n]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

const MUSHAF_OR_PRESENTATION_FORMS = /[\uE000-\uF8FF\uFB50-\uFD3D\uFD40-\uFDF9\uFDFC-\uFDFF\uFE70-\uFEFF]/;

/**
 * Why a cleaned text must not be shown, or null when it is clean. Glyph/placeholder/markup checks
 * apply to a whole section (any hit drops it); bracket balance is checked on each published part
 * (`balance: true`), so a source typo deep in a long section does not leak into the parts shown.
 */
export function lessonTextProblem(text: string, options: { balance?: boolean } = { balance: true }): string | null {
  if (!text.trim()) return "empty";
  if (/[<>]/.test(text)) return "markup left in text";
  if (/&(?:#x?[0-9a-f]+|[a-z]+);/i.test(text)) return "undecoded entity";
  if (/[@\uFFFD]/.test(text)) return "placeholder or replacement character";
  if (MUSHAF_OR_PRESENTATION_FORMS.test(text)) return "mushaf-font or presentation-form glyphs";
  if (/[A-Za-z]/.test(text)) return "stray Latin text";
  if (!/[؀-ۿ]/.test(text)) return "no Arabic text";
  if (!options.balance) return null;
  for (const [open, close] of [
    ["﴿", "﴾"],
    ["«", "»"],
    ["(", ")"],
    ["[", "]"],
  ] as const) {
    if (text.split(open).length !== text.split(close).length) return `unbalanced ${open}${close}`;
  }
  return null;
}

/** Removes the Word-paste artifact when it trails the section; returns null if it occurs elsewhere. */
export function stripTrailingArtifact(text: string): { text: string; stripped: boolean } | null {
  let out = text;
  let stripped = false;
  for (;;) {
    const trimmed = out.trimEnd();
    if (!trimmed.endsWith(WORD_PASTE_ARTIFACT)) break;
    out = trimmed.slice(0, -WORD_PASTE_ARTIFACT.length).trimEnd();
    stripped = true;
  }
  // A paragraph made only of the artifact also counts as trailing within that paragraph.
  const lines = out.split("\n").map((line) => {
    const l = line.trimEnd();
    if (l.endsWith(WORD_PASTE_ARTIFACT)) {
      stripped = true;
      return l.slice(0, -WORD_PASTE_ARTIFACT.length).trimEnd();
    }
    return line;
  });
  out = lines.filter((l) => l.trim()).join("\n");
  if (out.includes(WORD_PASTE_ARTIFACT)) return null;
  return { text: out, stripped };
}

/** Splits the page into cards → sub-headings → verbatim text. */
export function extractJamharaPage(html: string): JamharaPage {
  const main = mainOf(html);
  const title = pageTitle(html);
  const sections: RawSection[] = [];
  const dropped: DroppedSection[] = [];

  const chunks = main.split(CARD_OPEN).slice(1);
  for (const chunk of chunks) {
    // Each card ends where the next card opens; trailing page furniture is cut at the next <section>.
    const body = chunk.split(/<section\b/)[0]!.split('<div class="container">')[0]!;
    const cardMatch = body.match(/<h4 class="title-font[^"]*"[^>]*data-card="\d+"[^>]*>([\s\S]*?)<\/h4>/);
    const card = cardMatch ? htmlToText(cardMatch[1]!) : "";
    let rest = cardMatch ? body.slice(body.indexOf(cardMatch[0]) + cardMatch[0].length) : body;
    // Link-only sub-sub headings («التوكل في القرآن الكريم» → /ayat) are navigation, not text.
    rest = rest.replace(/<h5\b[^>]*>[\s\S]*?<\/h5>/gi, " ");

    const parts = rest.split(/<h([12]) class=["']head-4-title["']>([\s\S]*?)<\/h\1>/);
    // parts: [lead, level, heading, body, level, heading, body, ...]
    const pushSection = (sub: string, fragment: string) => {
      let text: string;
      try {
        text = htmlToText(fragment);
      } catch (error) {
        dropped.push({ card, sub, reason: error instanceof Error ? error.message : "decode failed" });
        return;
      }
      if (!text) return;
      const cleaned = stripTrailingArtifact(text);
      if (!cleaned) {
        dropped.push({ card, sub, reason: "Word-paste artifact inside the text" });
        return;
      }
      const problem = lessonTextProblem(cleaned.text, { balance: false });
      if (problem) {
        dropped.push({ card, sub, reason: problem });
        return;
      }
      sections.push({ card, sub, text: cleaned.text });
    };
    pushSection("", parts[0] ?? "");
    for (let i = 1; i + 2 < parts.length; i += 3) {
      const heading = htmlToText(parts[i + 1] ?? "");
      pushSection(heading, parts[i + 2] ?? "");
    }
  }
  return { title, sections, dropped };
}


const OPENERS: Record<string, string> = { "﴿": "﴾", "«": "»", "(": ")", "[": "]" };
const CLOSERS = new Set(Object.values(OPENERS));

const ORDINAL_ITEM =
  /^(?:(?:ثاني|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر)(?:ًا|اً|ا)\s?[:-]|(?:الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة)\s?:|النوع (?:الثاني|الثالث|الرابع|الخامس))/;
const NUMBERED_ITEM = /^(?:(\d{1,2})\s?[-–]\s|\((\d{1,2})\)\s)/;

/**
 * Item boundaries: a space before a list marker that the page itself prints — «2- », «(3) »
 * (numbers must run in sequence, so a citation such as «(8)» is never mistaken for an item), or
 * «ثانيًا:» / «الثانية:» / «النوع الثاني». Bracket depth is not tracked here so a source typo (an
 * unclosed quote) cannot hide later items.
 */
export function itemUnits(text: string): string[] {
  const units: string[] = [];
  const first = text.match(NUMBERED_ITEM);
  let last = first ? Number(first[1] ?? first[2]) : 0;
  let start = 0;
  for (let i = 1; i < text.length; i += 1) {
    if (text[i] !== " ") continue;
    if (!/[.،؛:\])»"]$/.test(text.slice(0, i))) continue;
    const after = text.slice(i + 1, i + 40);
    const num = after.match(NUMBERED_ITEM);
    const isItem = num ? Number(num[1] ?? num[2]) === last + 1 : ORDINAL_ITEM.test(after);
    if (!isItem) continue;
    if (num) last += 1;
    units.push(text.slice(start, i));
    start = i + 1;
  }
  units.push(text.slice(start));
  return units.filter((u) => u.trim());
}

const CITATION_START = /^(?:["(\[]|انظر|أخرجه|اخرجه|رواه|أخرجهما)/;

/** Sentence boundaries (after . ؟ !), never inside ﴿﴾ «» () [] and never right before a citation. */
function sentenceUnits(text: string): string[] {
  const units: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (OPENERS[ch]) depth += 1;
    else if (CLOSERS.has(ch)) depth = Math.max(0, depth - 1);
    if (depth > 0 || ch !== " ") continue;
    // Never separate a quotation from the citation printed right after it.
    if (CITATION_START.test(text.slice(i + 1, i + 12))) continue;
    if (/[.؟!][»"]?$/.test(text.slice(Math.max(0, i - 2), i))) {
      units.push(text.slice(start, i));
      start = i + 1;
    }
  }
  units.push(text.slice(start));
  return units.filter((u) => u.trim());
}

export type SplitResult = {
  /** Consecutive parts from the start of the section, each at most `max` characters. */
  parts: string[];
  /** True when the parts cover the whole section. */
  complete: boolean;
};

/**
 * Cuts a section into consecutive parts of at most `max` characters, at line breaks first, then the
 * page's own list markers, then sentence ends. Each part is a verbatim slice: joining all parts of a
 * complete split (with the original "\n" or " ") restores the section exactly. Stops after `maxParts`
 * parts or at a unit that cannot be cut short enough; returns null when not even one part fits.
 */
export function splitLessonBody(text: string, max: number, maxParts = 3): SplitResult | null {
  const units: { text: string; joiner: string; oversize: boolean }[] = [];
  text.split("\n").forEach((line, lineIndex) => {
    const pieces = line.length <= max ? [line] : itemUnits(line).flatMap((u) => (u.length <= max ? [u] : sentenceUnits(u)));
    pieces.forEach((piece, i) =>
      units.push({ text: piece, joiner: i === 0 && lineIndex > 0 ? "\n" : " ", oversize: piece.length > max }),
    );
  });
  const parts: string[] = [];
  let current = "";
  let consumed = 0;
  for (const unit of units) {
    if (unit.oversize) break;
    const next = current ? current + unit.joiner + unit.text : unit.text;
    if (next.length > max) {
      parts.push(current);
      if (parts.length === maxParts) {
        current = "";
        break;
      }
      current = unit.text;
    } else current = next;
    consumed += 1;
  }
  let leftover = false;
  if (current) {
    if (parts.length < maxParts) parts.push(current);
    else leftover = true;
  }
  if (!parts.length) return null;
  return { parts, complete: consumed === units.length && !leftover };
}
