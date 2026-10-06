# UX Structure — Tuma'nina · طمأنينة

**Authority:** `docs/PRD.md` wins over this file. This file owns flow, screen structure, states, and the visual/interaction consequences of the PRD.  
**Tokens:** `MASTER.md` · **Page specs:** `pages/`

**Status:** Re-locked to the PRD. Supersedes the values-discovery architecture (see §14 *What changed*).

---

## 0. Product

**Tuma'nina — طمأنينة**  
**قصتك يمكن أن تكون بداية رحلة.** / *Your story can be the beginning of a journey.*

An AI-powered human-centered journey that starts from what a person is experiencing and connects them to verified Islamic stories, meaning, knowledge, and a step they can consider.

Not: Islamic chatbot · Islamic search engine · Islamic content library · AI therapist · dashboard · topic library.

**The core interface is conversation.** The core innovation is that the person never has to know which Islamic topic, value, or door to start from.

---

## 1. The sequence that must not invert

```
PERSON → EXPERIENCE → CONVERSATION → CONTEXT (internal) → VERIFIED RETRIEVAL
       → STORY OFFER (with consent) → STORY → CONVERSATION CONTINUES
       → MEANING → SOURCE → REFLECTION → NEXT STEP → CONTINUE
```

Two rules carry the whole product:

1. **Conversation before recommendation.** Never jump to a story before the context is understood and the person is met.
2. **Verified before generated.** Religious content is retrieved from a verified source before the system phrases anything.

---

## 2. Routes

| Route | Layer | What it is |
|---|---|---|
| `/` | Home | Editorial **promise** of the experience. Not the product. |
| `/experience` | Journey | The quiet opening of a conversation: *ما الذي يشغلك اليوم؟* |
| `/story` | Journey | The story as beats, entered from the conversation |
| `/room` | Journey | Story Room — the transitional immersive environment (Nice-to-Have) |
| `/source` | Journey | Verified source: Story → Claim → Source |
| `/continue` | Journey | Three honest exits. Never a values library. |

There is **no** `/understanding` screen and **no** `/meanings` screen. Context understanding and meaning live inside the conversation.

There is no `/explore`, no topic index, no values catalog, anywhere.

---

## 3. Home — the promise, not the journey

**Purpose:** the person understands the idea quickly, becomes curious, and knows they can start from their own experience.

**Home gives the promise of the experience and does not reveal the whole journey.**

### Hero
- **قصتك يمكن أن تكون بداية رحلة.**
- شعور، موقف، سؤال، خوف، أو شيء يشغلك اليوم. / ابدأ من حيث أنت.
- CTA: **ابدأ من تجربتك** → `/experience`
- Intentionally empty centre. No inputs on Home.

### Forbidden on Home (PRD §7)
A list of Islamic values · a list of Islamic topics · a stories library · Qur'anic verses · ḥadīth · detailed religious stories · a working chatbot · any RAG/technical explanation · dashboard chrome · "choose a value" · "choose a topic".

Also forbidden by consequence: a **"detected values"** demonstration (PRD §11), because that surface does not exist in the product.

Full spec: `pages/landing.md`.

---

## 4. Entry — `/experience`

Not a form. The opening of a calm conversation.

- **ما الذي يشغلك اليوم؟**
- يمكنك أن تحكي موقفًا، شعورًا، سؤالًا، خوفًا، أو حتى شيئًا لا تعرف كيف تصفه.
- Free writing. Any of these is a valid entry: a feeling, a situation, a question about the Prophet ﷺ, a request for reassurance, plain curiosity, or "I can't describe it".

Spec: `pages/experience-input.md`.

---

## 5. Conversation — the core interface

The AI is a **companion in conversation**, not a search box and not a ChatGPT clone. It must not own the entire screen.

### Turn logic
1. Understand what was written.
2. Read the context.
3. Answer humanly.
4. Decide whether clarification is needed.
5. Decide whether this is the right moment to offer a story — **and ask**.

### Context understanding
Extracted internally: emotional context, situation, intent, relevant themes, tone, likely knowledge needs.

**Never rendered as an analysis.** No `Detected values: Patience, Hope, Trust`. No theme chips. No confidence scores. No pipeline visualisation.

It may surface only as human language when it helps:
> "أفهم أنك مو بس خايف من المستقبل، أنت متعب من عدم معرفتك وش بيصير."

### Reassurance without overclaiming
Never "كل شيء سيتحسن بالتأكيد". Instead: "مرورك بهذا الشعور لا يعني أنه سيبقى معك إلى الأبد."

### Consent before the story
> "في قصة من السيرة فيها جانب قريب من هذا الشعور. تحب أشاركك فيها؟"

The person may accept, decline, ask something else, or change the subject. Declining is a first-class path.

Spec: `pages/conversation.md`.

---

## 6. Retrieval and story selection

Conversation → context → retrieval over the **Verified Islamic Knowledge Base** (RAG) → source validation → story selection.

Selection weighs: similarity to context, source reliability, relevance, completeness, historical context, suitability for intent. Similarity never claims the person lived the same event — only that a human or thematic point is shared.

**If no suitable source is found, no story is invented.** The system says plainly that it did not find a suitable verified connection and the conversation continues.

Why-this-story must be sayable:
> "اخترت لك هذه القصة لأن فيها جانبًا قريبًا من الشيء الذي وصفته لي."

---

## 7. Story — `/story`

Beats, not an article:

| Beat | |
|---|---|
| 01 | البداية — ما حدث وفق المصدر |
| 02 | الموقف — التحدي أو الظرف |
| 03 | ما حدث بعد ذلك — النتيجة أو التعامل |

Every beat is tied to its source. Source is reachable from every beat.

**Narrative style:** warm, clear, human, close to the person, never preachy, never stiff. Closeness of tone applies to the introduction, transitions, explanation, reflection, and dialogue. Qur'an, ḥadīth, original texts, and quotations stay exactly as the source has them.

No figurative depiction of sacred figures. Nothing invented: no events, dialogue, attributed sayings, unverified ḥadīth, incorrect verses, stories stitched from separate events, or dramatic detail the source does not carry.

Spec: `pages/interactive-story.md`.

---

## 8. After the story the conversation resumes

**The story is not the end of the experience.** This is essential, not optional.

> "وش أكثر شيء وقف معك في القصة؟"

The person answers in their own words, and the meaning is built from that answer — still without inventing anything beyond the source.

---

## 9. Meaning, source, reflection, next step

Three things stay visually and verbally distinct (PRD §22, §28):

| | |
|---|---|
| **Source** | what the source actually says |
| **Connection** | how the system sees a relation to this person's experience |
| **Reflection** | questions or thoughts to sit with |

The person must always be able to tell apart: what the source said · what the AI is saying · what is offered as reflection.

**Verified source — `/source`:** name, type, reference, original text where needed, translation where needed, context, what is quoted verbatim, what is summarised, and any limits or uncertainty. Rule: **Story → Claim → Source**. Not a footer link.

**Practical next step:** offered, never commanded. Never a fatwa, never a diagnosis. May be Qur'an reading, duʿāʾ, prayer, ṣadaqah, talking to someone trusted, resting, a practical step, seeking a professional, or learning more about the story. Contextual and never pushy.

Specs: `pages/meaning-lessons.md`, `pages/verified-source.md`, `pages/next-step.md`.

---

## 10. Safety and boundaries

If the words suggest immediate danger or acute crisis, the system does **not** lean on an Islamic story alone: respond with empathy, encourage contact with someone trusted, point toward appropriate help, give no medical or psychological diagnosis, and never claim to replace a professional.

Where a specialised religious ruling is needed, the system says it is not a source of fatwa and encourages a scholar or trusted scholarly body.

The system is not a muftī, shaykh, scholar, or substitute for people of knowledge. It is an **AI discovery and knowledge companion**.

Spec: `pages/safety.md`.

---

## 11. Continue — `/continue`

No Islamic values library. Three options only:

1. **ابدأ من شيء آخر يشغلك** — a new experience
2. **تابع من هنا** — stories or paths discovered during this journey
3. **تعرف أكثر على هذه القصة** — back into the source and related knowledge

Spec: `pages/journey-completion.md`.

---

## 12. Story Room — `/room`

The signature visual environment, now understood correctly: **a transitional space that makes the person feel they stepped inside the story.** It is not an ornamented religious interface and not a values selector.

| Piece | Spec |
|---|---|
| Centre | the person's own words on a plinth of light |
| Thresholds | architectural openings — **story paths that came out of the conversation**, not a menu of Islamic values |
| Environment | dusk, depth, light, restrained spatial movement |
| Entering | the threshold becomes the story (GSAP Flip, 500–800ms) |
| Mobile | corridor with snap, plus a plain list equivalent |
| Fallback | simple layout, first-class |

Forbidden: generic Islamic ornament, mosque imagery, figurative sacred representation, generic AI 3D, dashboard, node graph, orbiting circles, floating value chips.

**MVP status:** spatial interactions are **Nice to Have** (PRD §39). The journey must be complete and demoable without them, so the story must be enterable from the conversation with a plain transition. Build the room as an enhancement, never as a dependency.

Specs: `pages/story-room.md`, `pages/story-room-architecture.md`.

---

## 13. MVP and demo

**Must have:** Home · experience input · conversational AI · context understanding · retrieval · verified knowledge base · RAG · story selection · story presentation · source attribution · follow-up conversation · meaning/connection · reflection · practical next step · continue · Arabic · English · synthetic demo data · error states · source documentation · setup documentation.

**Nice to have:** Story Room spatial interactions · voice in/out · richer personalization · saved journeys · deeper story exploration.

**Demo path:** "اليوم أحس إني ضايع وأخاف من مستقبلي." → AI meets it → asks to share a story → story from a verified source → post-story reflection → "وش أسوي وأنا للحين خايف؟" → practical step → source with text and reference → *هل تريد أن تبدأ من شيء آخر يشغلك؟*

**Data:** everything in development and demo is synthetic or fully anonymised. No real conversations, no user records, no personal data, no secrets in the repo.

---

## 14. What changed from the previous lock

| Was locked | Now (PRD) |
|---|---|
| Brand "Story Room" | **Tuma'nina — طمأنينة**; Story Room is a feature inside the journey |
| `/understanding` screen showing context words | Context is **internal**; voiced humanly inside the conversation only |
| `/meanings` screen where derived Islamic values emerge and the person picks one | Removed. **No values surface at all.** Conversation leads to a story, with consent |
| Story Room doorways = Islamic values | Thresholds = **story paths** from the conversation |
| Story Room = signature must-have | Signature, but **Nice-to-Have** for MVP; journey must work without it |
| Journey ended at reflection | Conversation **resumes after the story**; then meaning, source, reflection, **practical next step** |
| Trust = source chapter | Same, plus explicit **AI transparency** (source voice vs AI voice vs reflection) and **safety/crisis** handling |
| English-led copy | Arabic is the authored language of the product's voice; English is a first-class parallel |

**Consequence for the built Home:** the sections that dramatise *context words → Islamic values* (Home 02 and 03 as built) advertise a mechanic the product no longer has, and Home may not show a values list. They must be replaced by *someone listens first → a verified story meets you → the conversation continues*.

---

## 15. Motion / 3D (unchanged boundary)

CSS + CSS 3D + SVG + GSAP (with Flip) only. No Three.js, React Three Fiber, GLTF, particle systems, Framer Motion, or drag-only orbit. All text, sources, and controls stay in the DOM. `prefers-reduced-motion` always resolves to the final state.

---

## 16. Accessibility and bilingual

Keyboard reach for every path, 2px visible focus not obscured, live `matchMedia` for reduced motion, semantic DOM, screen-reader-friendly conversation (status regions, no focus traps), `lang` + `dir` on `<html>`, logical CSS properties.

Arabic RTL and English LTR are both first-class. Tone, text length, typography, spacing, conversational style, and story presentation all adapt — translation alone is not support.
