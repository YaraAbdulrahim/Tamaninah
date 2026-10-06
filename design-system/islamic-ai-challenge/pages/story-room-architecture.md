# Story Room — Visual & Interaction Architecture

**Status:** Spatial/interaction source of truth for the **journey** Story Room (not Home). Subordinate to `docs/PRD.md` §19 and `UX-STRUCTURE.md` §12.

**MVP status: Nice-to-Have.** The journey must work without this layer.

Public `/` is Home, which may show a non-live glimpse. This environment is `/room`.

**Terminology correction:** what this file calls a *doorway* or *path* is a **story path produced by the conversation** — a threshold into one verified story. It is never an Islamic value offered for browsing, and the room is never a chooser of values. Where this file says values, read story paths.

**Owns:** spatial composition, motion, 3D vs DOM, cinematic transitions, story staging, responsive translation, accessibility, hackathon tech boundary.

**Does not replace:** product philosophy in `UX-STRUCTURE.md` or tokens in `MASTER.md`. If they conflict, philosophy wins on *what* appears; this file wins on *how the room is built*.

**Visual goal:** An interactive digital environment where a person’s experience is the centre of a journey, and discovered meanings are **doorways** into verified Islamic stories.

**Closer to:** interactive editorial + cinematic spatial interface + quiet AI.  
**Not:** website + chatbot + cards + dashboard + dark page of floating circles.

---

## 0. One-sentence test

If a screenshot could be mistaken for a node graph, a card grid, or a values picker, the room has failed.

If a screenshot shows **their sentence standing in a chamber**, and **two to five architectural openings that clearly grew from that sentence**, it has succeeded.

---

## 1. Spatial composition

Treat the Story Room as a **single interior**, not a layout. The browser window is a camera looking into a dusk chamber.

### 1.1 What sits at the centre (physically)

A **still of language**, not a component.

- A low **plinth of light** on the chamber floor (elliptical pool, ~20–28% of stage width).
- On it, the person’s experience in display type (Lora / Noto Naskh Arabic).
- This is the `h1`. It is never a card, chip, logo, or value name.
- If the text is long: first breath (one or two clauses) on the plinth; a control **Read full experience** expands in place or as a quiet overlay. Never ellipsis-only truncation.

Canonical centre:

> Someone close to me wronged me and accused me of something I didn’t do…

### 1.2 How the experience is represented

| Layer | Representation |
|---|---|
| Semantic | Heading of the region “Story Room” |
| Visual | Inscription in the light pool |
| Narrative | The origin the doorways grew from |
| Persistent | Same string Flip-travels from Experience → Understanding → Paths → Room (`data-flip-id="experience-core"`) |

The room is *about* this text. If you removed the doorways, the room should still feel occupied by a person.

### 1.3 Doorways (2–5, never a filled set of six)

Doorways are **architecture**, not nodes.

Each doorway is a standing opening on the floor plane:

- **Sill** — a short threshold bar on the floor, aligned toward the plinth
- **Jambs + lintel** — a simple rectangular or faintly arched frame. Hairline cream at ~40% opacity. **Not gold, not arabesque, not minaret.**
- **Inscription** — the emergent meaning on the lintel in display type (Justice / Patience / Forgiveness in the canonical journey)
- **Aperture** — the interior of the door. Unselected: darker than the chamber, a hint of depth. Selected: a teal-lit interior, as if a story-space exists beyond
- **Count** — only paths from *this* understanding. Three in the example. Two is allowed. Five is the maximum. Do not invent extra doors to symmetrize.

Placement (desktop): standing **on the floor**, in an arc **behind and beside** the plinth, receding in perspective — like openings in the far wall of a small hall, not planets around a sun.

```
                 [ Patience ]
        [ Justice ]         [ Forgiveness ]

                    ( experience )
                      light pool
                         ◆  camera
```

(Order follows `dir`. RTL mirrors inscription and tab order, not the metaphor.)

### 1.4 Depth hierarchy (z)

| Depth | What lives there | Role |
|---|---|---|
| **Background (z far)** | Dusk void, vertical falloff (warmer near floor, cooler above). No stars, no particles, no ornaments | Atmosphere |
| **Midground** | Floor plane (perspective trapezoid), implied walls as light falloff, doorways standing on the floor | The room |
| **Centre** | Light pool + experience text | Human origin |
| **Foreground** | Back, language, honesty, “Paths from your experience”, primary action | Controls — DOM, always sharp |

Never put body copy in the WebGL/canvas layer.

### 1.5 Lighting

- **Key:** soft frontal-down warm light (manuscript dusk, not spotlight entertainment).
- **Practical:** the plinth emits a quiet pool (`radial-gradient`, low contrast, not neon).
- **Path light (selected only):** a faint floor runner from plinth to the chosen sill — this is the sentence *Experience → Meaning*.
- **Aperture light (selected only):** `--color-dusk-accent` interior, still dim enough for cream text at 4.5:1.
- Unselected doors remain unlit. Colour is not the only selected indicator (frame weight + `aria-current` + inscription contrast).

### 1.6 Atmosphere (narrative only)

Allowed: fog of darkness at the edges, dustless air, floor receding, one breathing of light intensity ≤2% if motion is on.

Forbidden: particles, floating motifs, calligraphy wallpaper, crescents, geometric Islamic tiles as texture, lens flare, rain, fireflies.

### 1.7 How the environment answers a selection

When a doorway is selected (not yet entered):

1. Its aperture **fills with light**.
2. The floor runner appears **only** to that sill.
3. Other doors recede (opacity, cooler, no layout shift).
4. The camera eases a few degrees toward that opening (see §2).
5. Optional, in the aperture only: the **story title** as a whisper of type — not the article.
6. Primary control becomes **Step into the story** (if verified) or the honest empty line (if not).

The person should feel the room *choose a direction*, not a button turning teal.

---

## 2. Motion language

Shared tokens from `MASTER.md`. Gate **all** of this on `prefers-reduced-motion: reduce` (live `matchMedia`, not a one-time snapshot). Animate **1–2 ideas per moment**. No `back.out`. Exit faster than enter. Never block navigation (>~250ms exit).

| Moment | What moves | Why it means something | Timing |
|---|---|---|---|
| **Enter the room** | Dusk overlay rises; daylight of Paths is left behind | Crossing a threshold into the chamber | Overlay **Standard** 400–600ms `power2.inOut` |
| **Experience appears** | The Flip-carried core settles onto the plinth; pool eases in | Their words take the centre | 400–500ms `power2.out` |
| **Doorways emerge** | Frames grow **out from the plinth along the floor** (not dropping from the sky, not popping in a circle) | Meanings are *from* the experience | Stagger from centre 400–600ms `power2.out`, 50–80ms each, max 5 |
| **Hover / pointer** | Aperture +5% luminance; sill hairline brightens | This opening can be entered | 150–200ms color/opacity only. **No** scale of neighbours, **no** layout shift |
| **Select** | Runner + aperture light + 4–8° camera yaw toward the door | A path is chosen | 400–500ms `power2.out` |
| **Camera / depth** | Tiny `rotateY` / `translateZ` of the midground group | Looking toward the chosen meaning | Same as select. Amplitude small enough not to nauseate |
| **Lighting** | Pool leans toward the runner | Energy flows experience → door | Coupled to select |
| **Doorway → story** | **One** Flip: the chosen **aperture** expands to the viewport | You step through the door | **Complex** Flip 500–800ms `expo.inOut`. Single `data-flip-id` |
| **Return to room** | Reverse Flip of the aperture, or overlay down if Flip target missing | You are in the hall again | Exit ≤250ms feel; do not wait on story teardown |

Pointer-drag orbit is **not** in MVP. It reads as a globe/graph. Keyboard + tap are the spatial controls.

Idle drift of the whole room is **off** for MVP (motion sensitivity). Light breathing of the pool is optional and must pause on hover, focus, offscreen, and reduced motion.

---

## 3. 3D / spatial technology

3D is a **means of depth**, not a scene to stock with objects.

### 3.1 Where 3D earns its place

| Place | 3D value |
|---|---|
| Story Room midground | Floor + doorways in perspective so it reads as an interior |
| 05 → 06 | Daylight paper giving way to dusk volume |
| Door → story | Aperture becoming the story space |
| Story beats 01–03 | **Very slight** depth in typographic layers, not a 3D set |

### 3.2 What is actually 3D vs DOM (MVP)

| Surface | Technology | Why |
|---|---|---|
| Experience text, doorway labels, story body, source, chrome, honesty, CTAs | **DOM** | Accessibility, RTL, selection, SEO of meaning, maintainability |
| Chamber floor, doorway frames, perspective | **CSS 3D** (`perspective` on stage, `transform: translateZ / rotateX` on floor group) | Real spatial read without a WebGL text pipeline |
| Doorway arch geometry | **SVG** (simple frame, 1–2 paths) inside the DOM button | Crisp, themeable, not a bitmap |
| Dusk fog / void | **CSS gradients** first. Optional **one** decorative canvas/WebGL quad behind the DOM, `pointer-events: none`, `aria-hidden="true"` | Atmosphere only |
| Enter / Flip / stagger | **GSAP** (+ Flip plugin for one shared element) | Already the motion system in Master |
| Hover/select light | **CSS** custom properties | Cheap, reduced-motion friendly |

### 3.3 What we will not use in the hackathon MVP

| Tool | Decision |
|---|---|
| **React Three Fiber / full Three.js scene** | Out of MVP. Text in canvas fails SR, RTL, and focus. High cost. |
| **WebGL everywhere** | No. |
| **Framer Motion** | Do not add a second motion runtime. GSAP + CSS only. |
| **Physics, GLTF models, skyboxes** | No. |
| **CSS 3D for the whole app** | No. Only Story Room + the 05→06 and door→story moments. |

If there is leftover time after a solid CSS-3D room: one WebGL fog layer, antialias set **at construction**, paused when `prefers-reduced-motion` is true (listen to `change`, not a startup snapshot). Canvas gets no interaction and is not the source of labels.

### 3.4 Accessibility of any canvas

If a canvas exists: decorative only. Do **not** put `role="img"` as the only description of the room — the **DOM heading and doorway buttons** are the accessible room. Three.js stack’s `aria-label` on canvas applies only if the canvas were the product; here it must remain silent (`aria-hidden`).

---

## 4. Cinematic transition (one journey, not dashboard pages)

Keep a **persistent experience core** in the DOM across 02→06 so the story does not teleport.

### 4.1 Personal Experience → Understanding → Emergent Themes

Climate stays **daylight**. These are rooms in the same house.

| Step | Visual | Motion |
|---|---|---|
| **02 Experience** | Full field. Core is the textarea content | None except focus |
| **02 → 03** | Subtle page fade **Subtle** 200–300ms `power1.inOut`. The first line of the experience **Flips** (or simply remains mounted in a layout shell) into a quoted inscription | Exit ≤250ms |
| **03 Understanding** | Inscription visible. Status: “Looking beneath the surface of your experience…” Skeleton for human themes. Then themes list as type, not cards | Skeleton + `aria-busy`; no spinner-as-brand |
| **03 → 04** | Same inscription. Human themes stay. **Possible paths** appear as large type that will become lintels | Stagger **Subtle** 250–350ms |
| **05 Choice** | Same canvas as 04. Selected path is a doorway *in miniature* (frame draws around the word) | Frame draw 300–400ms |

No dusk yet. No chamber. The path word is the seed of the later lintel (`data-flip-id="path-{id}"`).

### 4.2 Emergent Themes / Choice → Story Room

This is the **crossing**.

1. Overlay of dusk ink rises from the **bottom** of the viewport (floor first) — Standard 400–600ms `power2.inOut`. Overlay lives at layout root so it survives the route change.
2. Behind it, the room mounts in its **final** pose if reduced motion; otherwise:
3. Experience core Flips onto the plinth (`experience-core`).
4. Chosen path Flips from the daylight word into the **lit lintel** (`path-{id}`). **Only this one** Flip besides the core — Master: do not compound many Flips.
5. Sibling doorways **grow from the plinth along the floor**.
6. Overlay completes. Honesty line is already there (no pop).

Result: one continuous sentence: *I wrote → it was understood → a word was chosen → I am standing in a room of that word.*

### 4.3 Story Room → Selected meaning → Verified story

1. Selection (if not already chosen) lights runner + aperture.
2. **Step into the story** (or second activate).
3. Flip **the aperture** to full viewport (`data-flip-id="story-aperture"`). The frame becomes the story stage; lintel title remains as whisper meta, then yields to beat 01.
4. Story beats 01–03 play **inside that opened volume** (see §5). Same dusk. No jump to a white article template.

If Flip cannot run (reduced motion, missing target): 200ms fade into beat 01, aperture already full-bleed.

---

## 5. Story presentation (not an article)

The opened doorway **is** the story. The person has walked in.

### 5.1 Scene structure

| Beat | Lives | Visual idea |
|---|---|---|
| **01 What happened?** | Inside the aperture, dusk | Title + short setting. One typographic scene |
| **02 What was the challenge?** | Same volume, step forward | Previous scene recedes (opacity); challenge comes forward |
| **03 What happened next?** | Same | Response, still catalog-only |
| **04 Meaning** | Climate shifts toward daylight | Three bands (source / connection / reflection) — DOM article-of-one-screen, not the chamber |
| **05 Source** | Daylight documentary | Story → Claim → Source |
| **06 Reflection** | Daylight | Return to their words |

MVP story *environment* is beats **01–03**. 04–06 are editorial, still full-bleed, not a dashboard.

### 5.2 Visual layers (01–03)

1. **Void** — dusk (same room air)
2. **Light** — a slower, larger pool; no figurative people, no prophet illustration
3. **Type** — display for the beat question (meta `01 / 03`), body for catalog text (max ~720px)
4. **Chrome** — Previous, Next, Source, Close to room

No long scrolling column of all beats.

### 5.3 Typography transitions

Beat question in meta tracking. Catalog body fades/slides **8–16px** only (scroll-reveal subtle). Reduced motion: instant swap. Arabic line-height stays loose.

### 5.4 Scroll / interaction

- **Desktop/tablet:** Next/Prev buttons are the truth. Optional scroll-snap *between beats* if it does not scroll-jack. Keyboard arrows equivalent.
- **Mobile:** full-screen beat + large Next. No parallax. No pinch-orbit.
- Autoplay: never.

### 5.5 Camera / environment

Between 01–03: camera **dolly of 0–8px** equivalent (CSS `translateZ` on the type layer), not a fly-through. If it causes nausea or reduced motion: crossfade only.

### 5.6 Source reveal

Control **Source** from any beat jumps to screen 09 (state preserved). In-beat, a persistent whisper **Verified source** (icon + words) is visible so trust is not a surprise ending.

### 5.7 Where you are

- Whisper: story title · `01 / 03` · path name  
- Close: returns through the aperture into the room  
- Not a SaaS stepper of 11 product steps

---

## 6. Responsive: translate the concept, do not stack the desktop

The **metaphor is a hall**. Devices change how you *walk* it.

### Desktop (≥1024)

True chamber. `perspective` ~1000–1400px. Floor visible. 2–5 doorways on the far wall. Pointer hover on apertures. Click selects; CTA or second activate enters.

### Tablet (768–1023)

Shallower hall (`perspective` higher / less Z). Doorways larger (≥44px). Hover may be absent; tap = select. Camera yaw smaller (2–4°).

### Mobile (<768)

**Do not** shrink the orbit. **Do not** make a card list.

Translate as a **corridor in section:**

1. **Near:** dusk full-bleed; experience inscription large, as if written on the floor at your feet.
2. **Ahead:** doorways as **successive thresholds** in a **horizontal snap strip** (one doorway dominant at a time). Swipe moves to the next opening — like walking the hall. Snap, no free orbit.
3. **Always:** “Paths from your experience” opens the same doorways as a vertical list (the a11y/touch equivalent).
4. Tap the dominant threshold = select; **Step into the story** under it.

Landscape phone: keep the inscription visible; thresholds in a short horizontal strip; list still available.

---

## 7. Accessibility

| Concern | Specification |
|---|---|
| **Keyboard** | Tab cycles **doorway buttons** in reading order. Space/Enter selects. Enter again or the visible CTA steps through if verified. Esc returns to Paths (05) from the room, or to the room from the story. Focus order matches visual order (`dir`). |
| **Focus** | 2px `--color-dusk-accent` (dusk) / `--color-ring` (day), 2px offset, 3:1. Not covered by chrome (`scroll-padding`). Focus never trapped in canvas. |
| **Text** | All meaning and story text is DOM. ≥4.5:1. Arabic first-class type. |
| **Reduced motion** | Live `matchMedia`. No overlay fly, no Flip, no camera yaw, no stagger, no pool breathing, no WebGL animation. Paint the **final** room and **final** beat. Honour mid-session changes. |
| **Dragging** | Not required in MVP. If swipe-on-mobile exists, the list control is the WCAG alternative. |
| **Non-spatial fallback** | Control **Simple layout** (and automatic when reduced motion **or** `prefers-contrast` / coarse + small viewport if spatial CSS fails). Fallback: dusk or daylight page; `h1` experience; doorways as a vertical list of large buttons; same labels, same CTA. No perspective. This is a first-class mode, not an afterthought. |
| **Canvas** | `aria-hidden="true"` if present. |
| **Busy** | Understanding uses `aria-busy` + live status, not a spinning brand. |
| **Icon-only** | None without names. Decorative SVG frames `aria-hidden` on the frame paths; the button name is the meaning. |

---

## 8. Technical boundary (hackathon MVP)

### Must ship (highest impact)

1. CSS 3D chamber: floor + plinth + 2–5 DOM doorways  
2. Experience text as `h1` on the plinth  
3. Select = light runner + aperture (no graph physics)  
4. GSAP overlay 05→06 and **one** Flip aperture→story  
5. Story beats 01–03 as full-bleed DOM scenes  
6. Reduced-motion + simple-layout fallback  
7. RTL logical CSS  

### Ship if time

- Floor runner as SVG/CSS  
- Whisper of story title in the lit aperture  
- Horizontal snap corridor on mobile  
- Shared Flip of `experience-core` across 03–06  

### Do not ship

- Three.js / R3F product scene  
- Particles, ornaments, GLTF  
- Framer Motion as a second system  
- Drag-to-orbit  
- Figurative illustration of persons in sacred history  
- Spatial UI on Landing, Experience, Source, or Reflection  

### Suggested implementation stack (when coding is approved)

Existing Vite + React app. Add **GSAP + Flip**. Story Room = one component tree (stage, floor, plinth, `Doorway` buttons). No new meta-framework.

---

## 9. Choreography checklist (implementation order later)

1. Simple-layout fallback (always works)  
2. Dusk chamber + plinth + DOM doorways in CSS 3D  
3. Select lighting  
4. Overlay into the room  
5. Aperture Flip into beat 01  
6. Mobile corridor snap  
7. Optional fog canvas  

Never build 7 before 1–3.

---

*Stop. No implementation until this architecture is approved.*
