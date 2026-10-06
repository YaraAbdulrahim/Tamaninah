# Conversation — page spec

**Authority:** `docs/PRD.md` §9, §10, §11, §12, §16, §20, §21, §24 · Flow: `UX-STRUCTURE.md` §5

The core interface of the product. A companion in conversation — **not** a search box and **not** a ChatGPT clone.

---

## Climate

Daylight, warmer and more interactive than Home. One calm column. The AI never owns the whole screen: the person's own words, the story, its source, and the reflection all keep their place.

---

## Turn logic

1. Understand what was written.
2. Read the context (internally).
3. Reply humanly.
4. Clarify if needed.
5. Decide whether it is the right moment to offer a story — **then ask**.

Never jump from the first message to a story.

---

## Context understanding — internal only

Extracted: emotional context, situation, intent, relevant themes, tone, likely knowledge needs.

**Never rendered as analysis.** No `Detected values: …`, no theme chips, no scores, no pipeline view. It may only surface as human language when it helps:

> "أفهم أنك مو بس خايف من المستقبل، أنت متعب من عدم معرفتك وش بيصير."

---

## Offering a story

> "في قصة من السيرة فيها جانب قريب من هذا الشعور. تحب أشاركك فيها؟"

- Accept and decline are equally available real buttons.
- Declining continues the conversation; it is not a dead end.
- The person may also ask something else, request a story directly, or change the subject.

If retrieval finds no suitable verified source: say so plainly, invite another phrasing or a continued conversation. **Never invent a story.**

Why-this-story is stated without overclaiming:
> "اخترت لك هذه القصة لأن فيها جانبًا قريبًا من الشيء الذي وصفته لي."

---

## After the story

The conversation resumes — this is required, not optional.

> "وش أكثر شيء وقف معك في القصة؟"

The person's answer shapes the meaning that follows, still bounded by the source.

---

## Warmth without overclaiming

Forbidden: "كل شيء سيتحسن بالتأكيد."  
Use: "مرورك بهذا الشعور لا يعني أنه سيبقى معك إلى الأبد."

No diagnosis. No promises about the future. No religious ruling.

---

## Waiting

Human language, `aria-busy`, a polite live region, reserved layout. Never "Generating…", never a spinner as brand, never a blank screen.

---

## Register

**Warm, simple MSA (فصحى مبسطة).** Close to the person without dialect, and never preachy or archaic. The PRD's example replies are colloquial; keep their warmth and render it in accessible MSA.

## Surface rules

No bubble tails, avatars, typing dots, send-sparkle, thread sidebar, or message counters. The person's turn and the companion's turn are typographically distinct. 16px minimum input type. Focus ring teal, always visible.

## Accessibility

New turns announced politely without stealing focus. Every action reachable by keyboard. The conversation is readable as a document, in order, by a screen reader. Escape never traps the person.
