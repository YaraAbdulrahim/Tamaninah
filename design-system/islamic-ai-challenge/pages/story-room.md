# Story Room — page override

**Authority:** `docs/PRD.md` §19

**Not the homepage.** Public `/` is Home. This is `/room`: a **transitional space that makes the person feel they stepped inside the story**, reached after the conversation has produced a story path.

**MVP status:** spatial interaction is **Nice to Have** (PRD §39). The journey must be complete and demoable without it — a plain transition into `/story` is always available. Build this as an enhancement, never as a dependency.

**Spatial / motion source of truth:** `story-room-architecture.md`. This file stays the product rules for *what* may appear in the room.

---

## Climate

**Dusk chamber.** Warm ink `#181714`, cream text, teal discovery. An immersive narrative room, not a graph and not a page of components.

## Spatial model — doorways, not a mind map

```
        [ path A ]     [ path B ]

              ( their experience )
                     CORE

              [ path C ]
```

- **Core:** the person’s own words in display type. Not a card, not a value name, not the product logo.
- **Thresholds:** only **story paths that came out of this conversation** (typically 1–3). A threshold is a way into a specific verified story, not an Islamic value to browse.
- Never pad the room with extra openings to make it look symmetrical, and never fill it with value names.
- Selected doorway is lit (filled teal). Others recede (outline, lower opacity) — they remain reachable.
- Soft light from the core toward doorways is atmosphere, not HUD wireframe.
- Chrome: back, language, honesty. No sidebar.

The environment should read as: **these paths rose out of this story.**

## Interaction

| Input | Result |
|---|---|
| Activate a doorway | Select that path; announce its name |
| Second activate or “Step into the story” | Open Interactive Story if verified |
| Tab | Reading-direction order among **this journey’s** doorways |
| Escape / Back | Return to the conversation |
| List control | “Paths from your experience” — required equivalent; drag is optional and never the only way |

## Responsive

| Viewport | Treatment |
|---|---|
| < 768 | **Corridor:** stand on the inscription; swipe architectural thresholds (horizontal snap). Always: **Paths from your experience** list. No tiny orbit. No cards. |
| 768–1023 | Shallower chamber; 2–5 doorways around the core, ≥44px |
| ≥ 1024 | Full dusk hall, generous negative space, doorways as architecture |

## Motion

- Enter: doorways gather from the core (400–600ms, `power2.out`) — 1–2 motion ideas only
- Selected doorway: light, not a layout-shifting scale of neighbors
- Exit into story: **one** shared-element Flip if motion allowed; else 200ms fade
- Reduced motion: painted final room

## A11y

- Region named “Story Room”
- Heading = the experience
- Doorways are buttons; selected `aria-current="true"`
- Focus 2px, never covered by sticky chrome

## Empty / blocked

No verified story for this path × context: stay in the room, explain, invite another **discovered** doorway. **Never generate a story.**

## Forbidden

Card grid, dashboard, mind map / node graph, glass HUD, a values wheel, floating value chips, orbiting circles, generic AI 3D, mosque imagery, figurative depiction of sacred figures, minarets, arabesque wallpaper, chat dock, gold rings.
