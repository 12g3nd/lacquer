# Lacquer — Design Authority

**Status:** Locked, 2026-08-27. Supersedes all visual direction in `PRODUCT_SPEC.md`.

This document is the single source of truth for how Lacquer looks. It exists because the
previous build agent invented its own palette and shipped it. **Every session that touches
visual code reads this file first and does not deviate from it without the owner's approval.**

If something here conflicts with existing code, this file wins and the code is wrong.

---

## 1. Context: Lacquer's place

Lacquer is the audio module of **Orbit Noir**, a personal retrofuturist workstation that also
covers Windows, Firefox, VS Code and Wave Terminal. Lacquer inherits Orbit Noir's colour,
material, motion and typographic language.

Lacquer is also the **most colourful member** of Orbit Noir. Music is the excuse for the
environment to breathe dramatically. The other modules are more restrained; this one is not.

Reference vocabulary, in priority order:

- Night city with warm interior light read against cool exterior — headlights, lit windows, sunset
- Orbital and planetary science imagery — Saturn, star fields, stellar diagrams
- Spectral and rainbow diffraction on dark ground — CD surfaces, prism edges, optical streaks
- Chrome wireframe linework — grids, vector hands, mesh figures
- Y2K magazine-ad layout energy — Seiko ads, COMPUTER cover stock, confident type on cream
- Analog hi-fi equipment — instrument faces, precise readouts, machined controls

**Not** in the vocabulary: grimy cyberpunk, gamer RGB, neon-on-black synthwave, hacker terminal
cosplay, Material Design, glassmorphism for its own sake, Mac imitation.

---

## 2. The two surfaces

Lacquer is not one design. It is two, and conflating them is what made the previous attempt
feel undirected.

### Operate — the browse shell

Left rail, titlebar, search, library grids, playlist lists, settings, menus.

The visitor is completing a task: find a thing, queue a thing, navigate. **Scanability,
consistency and predictability outrank expression.** Brand lives in precise details — the
hairline, the tabular figure, the exact hover state — not in atmosphere.

In **Normal Mode**, this surface is Orbit Noir and does not react to the album. It is the stable
spine. Visualizer Mode is the explicit exception: it may cover the full window while the player
is open, but auto-suspends on browse routes so library work always returns to this stable state.

### Experience — the player page

Album stage, artwork, now-playing metadata, the atmosphere behind it.

The visitor is inside the work itself. **The artwork leads from the first pixel and the
interface recedes.** This is the record-sleeve moment and the only place the display serif
appears.

This surface is **album-reactive**. The record possesses the room.

The **transport deck** straddles both. It is Operate in structure — always present, always
legible, always in the same place — but takes a diluted album tint and carries the two
album-coloured controls (section 3.4). Its structural order is song identity left, playback
controls centre, output controls right.

---

## 3. Colour

### 3.1 The Orbit Noir palette

| Token | Name | Hex | Role |
|---|---|---|---|
| `--lq-orbit` | Orbit | `#0B1731` | Deepest surface, app ground |
| `--lq-atlantic` | Atlantic | `#102A4C` | Panels, rail, transport, raised surfaces |
| `--lq-ion` | Ion | `#4F7DFF` | **Primary functional accent** — focus, selection, active nav |
| `--lq-signal` | Signal | `#39D4D0` | **Secondary functional** — active states, data, readouts |
| `--lq-ultraviolet` | Ultraviolet | `#8A63F6` | Expressive accent |
| `--lq-solar` | Solar | `#FF9654` | Expressive warm — attention, contrast, highlight |
| `--lq-flare` | Flare | `#FF647C` | Rare expressive accent, use sparingly |
| `--lq-milkglass` | Milkglass | `#E8EFF5` | Primary text |
| `--lq-moondust` | Moon Dust | `#A8B8CA` | Secondary text |
| `--lq-champagne` | Champagne | `#DAC0A7` | Identity ink — crest and script mark only |
| `--lq-bronze` | Bronze | `#C38242` | Identity offset stroke only |

Champagne and Bronze make the supplied mark an intentional part of Orbit Noir; they do not
expand the shell's functional or emotional colour systems. Re-theming controls around them is
out of scope.

### 3.2 The functional / emotional rule

**Cobalt and cyan are functional. Violet and orange are emotional.**

This is the rule that prevents rainbow soup, and it is non-negotiable.

- **Functional** colour communicates state a user must be able to trust: focus rings, keyboard
  selection, active navigation item, toggle-on, form validity. These are **Ion** and **Signal**,
  always, on every screen, regardless of what is playing.
- **Emotional** colour communicates mood: atmosphere, glow, bloom, decorative linework, the
  visualizer. These are **Ultraviolet**, **Solar**, **Flare**, and album-derived colour.

A user must never have to ask whether something is blue because it is selected or because the
album is blue.

### 3.3 Target distribution

Across any full-screen composition, approximately:

```
35%  midnight / navy          (Orbit, Atlantic)
20%  cobalt / royal blue      (Ion)
10%  cyan / teal              (Signal)
10%  violet                   (Ultraviolet)
 5%  orange / coral           (Solar, Flare)
10%  ivory / silver           (Milkglass, Chrome linework)
10%  album artwork
```

**Very little pure black.** `#000` is not in the palette. The darkest surface is `#0B1731`.
Noir describes the setting, not the palette — the machine lives at night, but the lights are on.

### 3.4 Album-reactive colour

Driven by the `album-color-theme` plugin, which emits `--ytmusic-album-color` and
`--ytmusic-album-color-dark` on `:root` as comma-separated RGB triples (format: `11, 23, 49`).

**Lacquer does not consume those variables directly.** It reads them, normalises them, and
publishes its own `--lq-album-*` token set. This decoupling is deliberate: the upstream plugin
also recolours stock YouTube Music surfaces, which would fight the authored shell.

**Normalisation is mandatory before use.** Raw extracted colour is unusable — album art
produces near-black, blown-out white and fluorescent values. Convert to a perceptual space,
clamp lightness and chroma into a usable band, then publish. Artwork that normalises to
near-monochrome falls back to Orbit Noir rather than producing a grey wash.

**Scope — what album colour may touch:**

| May be album-coloured | Must stay Orbit Noir |
|---|---|
| Player-page atmosphere / gradient | Focus rings |
| Artwork bloom and shadow | Keyboard selection |
| Transport deck tint (diluted) | Active nav item in the rail |
| **Progress bar fill** | Toggle and checkbox on-states |
| **Play/pause button** | Titlebar, rail, search |
| Visualizer Mode field while active | Menu and dialog surfaces |
| | Any text colour |

The progress fill and play button are the two exceptions. They *are* the now-playing identity
and should change with the record. Everything with functional meaning stays fixed, which makes
contrast safety structural rather than a patch: the elements that must never become unreadable
simply never leave the fixed palette.

**Text never sits on raw album colour.** Text sits on an Instrument surface, or on a scrim.

---

## 4. Materials

Three, and only three. Target ratio across the application: **80% solid, 20% glass.**

### Blueglass
Translucent navy with blur. **Floating and transient surfaces only** — menus, the FX rack,
dialogs, tooltips, popovers. Never a large persistent region.

### Instrument
Opaque blue-grey/navy, slightly brighter than its surroundings. **Used whenever legibility
matters** — the rail, the transport deck, list rows, the inspector, anything carrying text.
This is the default. Most of Lacquer is Instrument.

### Chrome
Silver/white hairlines, borders, linework, tiny highlights. **Linework only — never a filled
chrome panel.** This is where the wireframe and diffraction vocabulary lives: a 1px highlight
on the top edge of the transport, a hairline separating rail sections, a thin bright rule
under an active tab.

**Banned:** frosted glass everywhere, blur on persistent surfaces, drop shadows used as
decoration rather than elevation, gradients on small controls, glow on text.

---

## 5. Typography

Four voices. Each has exactly one job. A voice appearing outside its job is a defect.

| Voice | Face | Job |
|---|---|---|
| **Editorial** | Newsreader | Player-page album/artist title. Playlist detail headers. **Nowhere else.** |
| **Graphic** | Space Grotesk | The `acquer` portion of the titlebar lockup and section heads. The script mark supplies the initial `L`. |
| **Interface** | Inter | Navigation, search, menus, list rows, buttons, labels, body. The workhorse. |
| **Instrument** | IBM Plex Mono | Time, duration, speed, semitones, FX readouts, track indices. Always `tabular-nums`. |

**The editorial serif is the exception, not the default.** It should appear roughly six times
on a full player page and zero times anywhere else. A global font declaration that reaches
every element is the failure mode to avoid — it is how the previous build made everything look
uniformly wrong at once.

**Never** set `font-family` on `*`, or on `body` with `!important`. Scope every declaration to
the component that owns it.

All faces are bundled locally via `@fontsource`. **No runtime network font requests, ever.**

Headings are always roman. No italic display type — it is the single most reliable
generated-design tell.

---

## 6. Motion

- **Fast** — 150ms, `cubic-bezier(0.4, 0, 0.2, 1)`. Hover, focus, small state changes.
- **Normal** — 300ms, same curve. Panel open/close, surface transitions.
- **Atmosphere** — 800ms+, ease-out. Album colour crossfade on track change. Slow enough to
  feel like light changing rather than a theme switching.

Motion must never delay input response. Nothing animates on scroll. No parallax. No entrance
animations on list items — they make a library feel slow.

`prefers-reduced-motion` collapses everything except opacity.

---

## 7. The order of operations

From Orbit Noir, and it governs every decision on this project:

> **Colour first. Imagery second. Effects third.**

Get the palette right before adding artwork. Get artwork right before adding blur, bloom or
motion. A surface that does not work in flat colour will not be rescued by an effect.

---

## 8. Explicit non-goals

These have been considered and rejected. Do not reintroduce them.

- Neon pink and cyan on near-black. This is generic synthwave and it is what the previous
  attempt shipped. Orbit Noir is cobalt and navy with warm accents.
- Pure black surfaces.
- Restyling stock YouTube Music DOM with `!important` overrides in place of authored components.
- Renaming UI via `font-size: 0` plus `::after` content. Breaks screen readers and i18n.
- Album colour driving functional state.
- The display serif as a global or default face.
- Effects (blur, glow, shadow) compensating for weak colour or layout.
- Any runtime dependency on an external stylesheet or the owner's legacy `pear-ytm.css`.
