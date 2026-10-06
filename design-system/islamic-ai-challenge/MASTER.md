# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/islamic-ai-challenge/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> Also read `UX-STRUCTURE.md` for journey order, states, and content rules.
> Page files override visual treatment. UX-STRUCTURE overrides flow and copy intent.
> **`docs/PRD.md` overrides everything.**

---

**Product:** Tuma'nina — طمأنينة · *قصتك يمكن أن تكون بداية رحلة.*
**Project:** Islamic AI Challenge
**Generated:** 2026-09-21
**Product type:** Immersive narrative knowledge journey (hybrid: human wellness + education + discovery)
**Category (verified):** Yoga / Meditation / Calm storytelling — remapped for Islamic knowledge, not spa
**Design Dials:** Variance 7/10 (Balanced / Modern) | Motion 7/10 (Standard; cinematic on Home chapters + Story Room) | Density 3/10 (Spacious)
**Languages:** Arabic RTL and English LTR are first-class. Never treat Arabic as a translated overlay.

---

## 1. Product analysis

### What this is

A person arrives with a **human experience** — an emotion, question, situation, or plain curiosity. The product **talks with them**, understands context internally, retrieves a verified Islamic story, offers it with consent, then keeps the conversation going toward meaning, source, reflection, and a step they can consider.

Pipeline:

`Experience → Conversation → Context (internal) → Verified Retrieval → Story (with consent) → Conversation continues → Meaning → Source → Reflection → Next step → Continue`

**Conversation is the core interface.** It must not look like a ChatGPT clone, and the AI must not own the whole screen.

### What this is not

| Forbidden product feeling | Why it fails here |
|---|---|
| Generic AI chatbot | Conversation-first UI makes the model feel like a religious authority |
| Traditional Islamic content website | Article lists, ornament, and archive IA kill discovery |
| Generic SaaS dashboard | Cards, sidebars, and tables are the opposite of a narrative room |
| Simple search engine | Keyword retrieval skips emotion, meaning, and trust |

### Target users

| Audience | What they need | Design implication |
|---|---|---|
| Muslims | Familiar meanings without being preached at | Calm, not instructional chrome |
| New Muslims | Clarity, context, no assumed knowledge | Plain language, source always visible |
| Non-Muslims exploring Islam | Dignity, no othering, no conversion funnel | Human experience first, not identity gate |
| Young digital users | Immersive, premium, not “kids app” or “mosque site” | Spatial Story Room, restrained motion |
| International users | Cultural breadth, bilingual, RTL/LTR | Arabic is authored, not mirrored English |

### Signature experience

**Story Room** is the transitional immersive environment **inside the journey** (never the homepage): the person’s **own words** at the centre, and the **story paths that came out of the conversation** as architectural thresholds. It is not a menu of Islamic values. Spatial interaction is Nice-to-Have for MVP — the journey must be complete without it.

**Sequence that must not invert:** Person → Experience → Conversation → Verified story → Meaning → Source → Reflection → Next step.

---

## 2. Visual thesis

**Modern Islamic Serenity:** سكينة + أمان + أمل + دفء + قرب.

Islamic identity is **proportion, light, language, and earth** — not ornament, not mosque green, not spa teal.

| Express | How |
|---|---|
| Human emotion | Large unhurried type. The person's words stay intact, never clipped or gradient-washed |
| AI technology | Invisible. No purple, no generation glow, no template glass |
| Reassurance | Warm ivory, deep olive, room to breathe |
| Islamic identity | Cream paper, olive ink, Naskh only for Qur'an, bilingual sans for UI |
| Knowledge | Typographic source beside the text |
| Trust | Verified source as a first-class object |

### Dual atmosphere

| Climate | Where | Feeling |
|---|---|---|
| **Daylight ivory** | Home, experience, sources | Warm cream, sand, sage, trust |
| **Dusk chamber** | Story Room only | Warm ink derived from the same earth, never OLED |

---

## 3. Style

**Primary:** Organic Biophilic, remapped — earth, rounded 16–24px, natural shadow. **No** leaves, spa stones, waves, or forest-green `#228B22`.

**Rejected:** Liquid Glass, VisionOS, HUD, neon, Swiss SaaS, traditional Quran-app chrome, Western wellness purple, bright Islamic green, gradient-clip headlines, frosted `backdrop-filter` panels.

---

## 4. Color

User families, grades chosen for 4.5:1 body text on ivory.

| Role | Hex | Token | Use |
|---|---|---|---|
| Warm Ivory | `#F3EEE4` | `--color-ivory` / `--color-background` | Canvas |
| Deep Olive | `#3D4A38` | `--color-olive` / `--color-primary` / `--color-accent` | Actions, headings, brand |
| On olive | `#F7F3EA` | `--color-on-primary` | Text on buttons |
| Sage | `#7D8B74` | `--color-sage` | Soft fields, ribbon, glyphs — never as small body text |
| Warm Sand | `#E6D9C4` | `--color-sand` / `--color-secondary` | Cards of warmth, remember plate |
| Muted Rose | `#C4A4A0` | `--color-rose` | Safety and human warmth, decorative |
| Soft Gold | `#C4A35A` | `--color-gold` | Hairlines and light only, never a fill |
| Gold ink | `#7A5C22` | `--color-gold-ink` | Rare large-text gold (4.5:1 on ivory) |
| Ink | `#2C2824` | `--color-foreground` | Body |
| Mute ink | `#5A534A` | `--color-muted-foreground` | Meta (4.5:1 on ivory) |
| Card | `#FBF8F2` | `--color-card` | Lifted surfaces |
| Line | `#DDD4C5` | `--color-border` | Hairlines |
| Focus | `#3D4A38` | `--color-ring` | Visible 3:1 ring |

**Do not** use teal `#0891B2`, mosque green, purple, pink gradients, or metallic gold buttons.

---

## 5. Typography

Bilingual sans for the product. Naskh is reserved for scripture.

| Role | Latin | Arabic |
|---|---|---|
| Display | **Source Serif 4** 600–700 | **IBM Plex Sans Arabic** 600–700 |
| UI / body | **Source Sans 3** 400–600 | **Noto Sans Arabic** 400–600 |
| Qur'an quotation only | — | **Noto Naskh Arabic** (`--font-verse`) |

Do not use Naskh or Amiri for buttons, chips, or paraphrases. Do not split Arabic into `inline-block` word spans — it breaks joining and swallows spaces.

### Google Fonts

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap');
```

### Type rules

- UI chrome never uses verse type.
- Max measure for narrative: ~42em Latin, ~36em Arabic.
- Do not justify Arabic. Do not all-caps Latin.
- Mixed EN/AR in one sentence: wrap the guest script in `lang` and `dir`.

---

## 6. Spacing, layout, radius

Density 3/10 — spacious. This is a room, not a toolbelt.

| Token | Value | Use |
|---|---|---|
| `--space-2xs` | `8px` | Icon-to-label |
| `--space-xs` | `16px` | Compact clusters |
| `--space-sm` | `24px` | Control padding |
| `--space-md` | `40px` | Block gaps |
| `--space-lg` | `64px` | Section gaps |
| `--space-xl` | `80px` | Chapter padding |
| `--space-2xl` | `96px` | Viewport margins (desktop) |

**Radius:** `--radius-s 12px` · `--radius-m 20px` · `--radius-l 28px` · `--radius-full 999px`  
Organic, not squircles-on-everything. Story Room nodes are circular. Primary CTA is pill. Source block is nearly sharp (`12px`) so it feels documentary.

**Layout:** one primary column. No 12-column dashboard. Story Room is the exception (spatial hall of architectural doorways, not a radial graph). Desktop max content width 1120px; narrative width 720px. Home is editorial full-bleed chapters.

**Elevation (use sparingly):**

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(44,40,36,0.06)` | Input rest |
| `--shadow-md` | `0 8px 24px rgba(44,40,36,0.08)` | Cards, hover |
| `--shadow-lg` | `0 24px 48px rgba(44,40,36,0.12)` | Rare lift |

No stacked card grids. If a screen has more than three cards, it is wrong.

---

## 7. Iconography

Library: **Phosphor** (`@phosphor-icons/react`), weight `regular`. Heroicons only if Phosphor has no fit.

| Concept | Icon | Notes |
|---|---|---|
| Navigation / discovery | `Compass` | Story Room, discovered paths — never a values catalog |
| Human / compassion | `Heart` | Meaning, reflection — not “like” |
| Knowledge | `BookOpen` | Story, source |
| Verified | `SealCheck` or `CheckCircle` | Always with visible text |
| Continue | `ArrowRight` / `ArrowLeft` | Flip with `dir` |
| Pause motion | `Pause` | Carousels, if any |

Rules:

- No emoji as icons.
- Decorative icons beside text: `aria-hidden="true"`.
- Icon-only controls need an accessible name (`aria-label`) and 44×44px hit area.
- One weight per surface. Do not mix fill and outline at the same hierarchy except **selected** meaning node (fill) vs idle (outline).

---

## 8. Components

These are the product’s components. Do not introduce a design-system card, sidebar, table, or chatbot composer.

### Language switch

`EN` | `العربية`  
Always in the header. Changes `lang` + `dir` on `<html>`. Does not merely translate strings — layout, type, and Story Room labels reflow.

### Experience field

Full-width, large, multiline. Placeholder is a human prompt, not “Search…”.  
16px minimum font (no iOS zoom). Focus ring teal. No send-sparkle button. Primary action: **Continue** / **استمر**.

### Conversation surface

The person’s turns and the companion’s turns are typographically distinct, but this is **not** a chat app: no bubble tails, no avatars, no typing dots, no send-sparkle, no sidebar of threads, no message-count chrome. The companion’s turn is body type in a calm measure; the person’s words read as their own voice and stay retrievable. Offers (“تحب أشاركك القصة؟”) are real buttons with an equally available decline. Waiting states use human language + `aria-busy` + a live region, never “Generating…”.

### Story threshold

Used only **after** the conversation has produced a story path. The label is a story path from *this* journey, never an item from a global Islamic menu.  
Idle: hairline + display label. Active: filled dusk/teal. Must be a `<button>`. `aria-pressed` / `aria-current`. Not a card and not a mind-map node.

### Next step offer

A suggestion, never an instruction. Phrased conditionally (“إذا يناسبك…”), dismissible, never a checklist, never gamified, never a fatwa or a diagnosis.

### Safety response

When words suggest danger or acute crisis: empathy first, encouragement to reach someone trusted, a clear pointer to appropriate help, no diagnosis, no claim to replace a professional, and no Islamic story used as the whole answer. Visually calm and plain — not a red alert banner.

### Story core

The user’s experience phrase at the center. Not a card. Not truncated with ellipsis unless a “read full” control exists.

### Chapter frame

Full viewport. Step index `01`–`06` as meta type. Title. One idea. One primary action.

### Source block

Typographic citation. Book/collection, reference, translator if any, verification status.  
Not a yellow banner. Not a Wikipedia card.

### AI honesty bar

Persistent, quiet: the system is **not a religious authority** and does not invent quotations, events, or rulings. Visible on understanding, story, and source screens.

### Buttons

```css
.btn-primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
  padding: 14px 28px;
  border-radius: 999px;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 200ms ease, box-shadow 200ms ease;
}
.btn-primary:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 3px;
}
.btn-secondary {
  background: transparent;
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  padding: 14px 28px;
  border-radius: 999px;
  cursor: pointer;
}
```

No `translateY` hover that shifts layout. Hover = color/shadow only.

### Inputs

```css
.input-experience {
  width: 100%;
  min-height: 160px;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: var(--color-card);
  font: 400 18px/1.6 var(--font-body);
  color: var(--color-foreground);
}
.input-experience:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent);
}
```

Failed submit: inline error via `aria-describedby` **and** a focusable error summary at the top (`role="alert"`, `tabindex="-1"`). Never toast-only.

---

## 9. Interaction patterns

| Pattern | Do | Don’t |
|---|---|---|
| Story Room select | Click/tap a **discovered** doorway, keyboard + Enter | Drag-only orbit; a preset six-value wheel |
| Orbit (optional) | Pointer drag as enhancement | Drag as the only way to reach a meaning |
| Story chapters | Next/Prev buttons, keys, optional scroll-snap | Scroll-jacking, no skip |
| AI wait | “Looking beneath the surface…” + skeleton + `aria-busy` | “Generating…”; blank screen; decorative bounce |
| Trust | Source chapter + persistent source control | Hidden footnotes |
| Back | Always return to the previous journey step | Trap in a modal story |

**Dragging (WCAG 2.2 AA):** if the orbit can be rotated, provide equivalent buttons and a meaning list. Keyboard must reach every node.

**Focus not obscured:** no sticky CTA covering focused nodes. Use `scroll-padding` if a whisper-header exists. Story Room chrome is minimal and must not hide `:focus-visible`.

**Focus appearance:** 2px teal outline, 2px offset, 3:1 against adjacent color.

**Motion budget:** animate **1–2** key elements per view (UX: Excessive Motion).

---

## 10. Motion

Verified GSAP presets. Respect `prefers-reduced-motion: reduce` everywhere — skip tween, show final state.

| Moment | Preset | Duration | Easing |
|---|---|---|---|
| Route between journey steps | Page Transition **Subtle** | 200–300ms | `power1.inOut` |
| Enter Story Room | Stagger from center (adapted Stagger List) | 400–600ms | `power2.out` (not `back.out`) |
| Chapter reveal | Scroll Reveal **Standard** | 400–600ms | `power2.out` |
| Shared element node → story | Page Transition **Complex** Flip, **one** element | 500–800ms | `expo.inOut` |
| Meaning list on mobile | Stagger List **Subtle** | 250–350ms | `power1.out` |

```js
// Reduced motion gate — required
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Enter Story Room (standard). Skip if reduce.
gsap.from(".meaning-node", {
  opacity: 0,
  scale: 0.94,
  duration: 0.45,
  stagger: { each: 0.05, from: "center" },
  ease: "power2.out",
});

// Chapter reveal
gsap.from(chapter.children, {
  opacity: 0,
  y: 24,
  duration: 0.5,
  stagger: 0.08,
  ease: "power2.out",
});
```

**Do not** use `back.out` overshoot in this product — it reads as playful SaaS, not meaning.

**Parallax:** optional depth in dusk chapters only. High a11y risk. Disabled on reduced motion, small phones, and if it would scroll-jack.

**Autoplay:** none. No looping hero video. No rotating testimonial carousel on landing.

Exit faster than enter on route changes. Never block navigation on animation (cap exit ~250ms).

---

## 11. Responsive behavior

| Viewport | Story Room | Story chapters | Input |
|---|---|---|---|
| **Mobile 375** | Core first; **this journey’s** doorways as a vertical path; no tiny orbit; no value-grid | Full-screen, tap Next, no parallax | Full width, large textarea |
| **Tablet 768** | Shallower hall; doorways ≥44px; smaller camera yaw | Scroll-snap optional | Centered, 90% |
| **Desktop 1024+** | True radial room, generous dead space | Chapter frames, optional mild depth | Centered, max 720px |
| **1440+** | Room stays centered; do not stretch nodes to the edge | Same | Same |

Breakpoints: 375 / 768 / 1024 / 1440.

Touch targets ≥ 44×44px. Node labels must not collide; on small screens prefer list over overlap.

Landscape phones: keep core visible; meanings become a horizontal scroller with snap, plus a list alternative.

---

## 12. Bidirectionality

| Rule | Detail |
|---|---|
| Document | `<html lang="ar" dir="rtl">` or `lang="en" dir="ltr"` |
| CSS | Logical properties only: `margin-inline`, `padding-inline`, `inset-inline`, `text-align: start` |
| Icons | Directional arrows flip; `Compass`, `Heart`, `BookOpen` do not mirror |
| Story Room | Nodes keep clock positions; label `text-align` follows `dir`; focus order follows visual reading direction |
| Numerals | Story steps `01–06` stay Western digits for consistency; dates in sources follow locale |
| Copy | Arabic is written for Arabic, not calqued from English. Shorter English lines are not a virtue in Arabic |
| **Default language** | **Arabic RTL** is the default on first visit. English is available in the switch and is a first-class parallel, not a fallback |
| **Arabic register** | **Warm, close, everyday Arabic** — the way a person actually speaks (`مو`, `وش`, `خلنا`, `أبي`). Product copy, the companion's voice, reassurance, and reflection all use it. Authority surfaces stay in clean MSA: the challenge band, the sources and verification pages, and the narration of Seerah events. Qur'an, ḥadīth, and quotations stay exactly as the source has them. Authority: `docs/EXPERIENCE.md` |

---

## 13. Trust and AI honesty (product law)

These are UX rules, not legal copy only.

0. Three voices stay distinguishable at all times: **what the source says** · **what the AI says** · **what is offered as reflection**.
1. Every important Islamic claim is traceable to a **verified source**.
2. The AI **must not invent** religious information, stories, dialogue, events, quotations, or dramatic detail — and must not stitch one story from separate events.
3. If the corpus cannot support a story, show an honest empty state and invite another meaning or a broader experience. Never fill the gap with generated scripture.
4. Quran text uses **Amiri Quran** and a citation. Paraphrase is visually distinct from quotation.
5. The interface never presents the model as a scholar, mufti, or imam.
6. “Verified” is a status with a source, not a decorative badge.
7. Warmth never overclaims: no promises about the future, no diagnosis, no guarantee that a feeling will pass.
8. Tone may come close to the person’s own way of speaking in introductions, transitions, explanation, reflection, and dialogue. Qur’an, ḥadīth, original texts, and quotations stay exactly as the source has them.

---

## 14. Anti-patterns (do not use)

- Generic purple AI gradients
- Excessive gold / brass / mosque luxury
- Arabesque wallpaper, crescents, lanterns, or ornamental geometry as decoration
- Generic glassmorphism / frosted cards
- Dashboard sidebars, KPI cards, tables of “content”
- Chat bubbles as the primary UI
- Search-bar-as-hero
- Template testimonial carousels (no fake social proof)
- Emoji as icons
- Layout-shifting hovers (`translateY` / scale that moves neighbors)
- Invisible focus, `outline-none` without replacement
- Parallax or orbit without a reduced-motion and keyboard path
- Academic journal density, footnotes as the only source
- Continuous decorative animation
- Invented quotes in beautiful type
- **Any list of Islamic values or topics offered as navigation** — homepage menu, chips, “choose a value”, “choose a topic”, or a stories library
- **Machine-analysis surfaces**: `Detected values: Patience, Hope, Trust`, theme chips, confidence scores, a visible RAG/pipeline diagram
- Story Room as a generic node graph or a fixed value orbit
- Landing that looks like an Islamic topic library, a chatbot, or a technical explainer
- Qur’anic verses, ḥadīth, or detailed religious stories on the Home page
- Jumping to a story before the conversation has understood the context or asked

---

## 15. Accessibility checklist

- [ ] Body text ≥ 4.5:1 in daylight and dusk
- [ ] Focus visible, 2px, not covered by sticky chrome
- [ ] `prefers-reduced-motion` skips parallax, orbit, Flip, stagger
- [ ] Story Room: keyboard + “Paths from your experience” list; no drag-only orbit
- [ ] Icon-only buttons have names; decorative icons `aria-hidden`
- [ ] Experience form: label, `aria-describedby` errors, focusable error summary after submit
- [ ] AI loading: `aria-busy`, status in a live region, layout reserved (no jump)
- [ ] Skip link and skip-story control
- [ ] Language switch announces the new language
- [ ] RTL and LTR both tested at 375 and 1440
- [ ] `cursor: pointer` on all clickable elements (web)

---

## 16. How to use this file when building

```
I am building the [Page Name] page.
Read design-system/islamic-ai-challenge/MASTER.md.
Read design-system/islamic-ai-challenge/UX-STRUCTURE.md.
Check design-system/islamic-ai-challenge/pages/[page-name].md.
If the page file exists, its visual rules override Master.
UX-STRUCTURE owns journey order, two-layer IA (Home vs journey), values rules, and content law.
Do not implement screens that are not in the current request.
Do not implement until UX-STRUCTURE is approved.
```
