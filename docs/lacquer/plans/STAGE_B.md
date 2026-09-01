# Stage B — The Two Surfaces

**Model:** Sonnet 5, thinking **on**, effort **high**
**Session:** fresh, one stage only
**Prerequisite:** Stage A complete and its screenshot gate passed
**Ends with:** one coherent local commit + the screenshot gate. **Do not push.**

---

## Split execution — read this first

Same split as Stage A, by owner decision. **B1 is done and committed**; the four
authored surfaces remain.

| Task | Owner | Status |
|---|---|---|
| B1 Album-colour engine | done | Complete — `src/lacquer/album-color.ts` |
| B2 Authored left rail | Sonnet | **Done** — `rail.css` + `rail.ts` |
| B3 Authored transport deck | Sonnet | **Done** — `transport.css` (layout-order deviation, see report) |
| B4 Player stage (Experience) | Sonnet | **Done** — `player-stage.css` + `player-stage.ts` |
| B5 Inspector | Sonnet | **Done** — `inspector.css` |

**Completion report:** `docs/lacquer/V1_STATUS.md` (Stage B section) and the commit
message. Screenshot gate: `pnpm test:capture` writes the twelve shots to
`test-results/capture/`; `tests/lacquer/stage-b.capture.spec.ts`.

**B1 publishes the tokens the rest of the stage consumes.** Do not recompute
album colour, do not read `--ytmusic-album-color` directly, and do not widen the
token set without checking DESIGN.md §3.4 first. What is available:

| Token | Use |
|---|---|
| `--lq-album-atmosphere` | Player-page gradient and bloom |
| `--lq-album-fill` | **Progress fill and play/pause button only** (the D6 exceptions) |
| `--lq-album-veil` | Scrim under text laid over artwork — carries Milkglass at 7:1 |
| `--lq-album-ink` | The glyph colour that reads on `--lq-album-fill` |

`[data-lq-album-fallback]` is set on `:root` when artwork was unusable and Orbit
Noir took over. All four tokens are contrast-guaranteed for *any* artwork by
property tests over a 360-colour sweep — so if a surface looks unreadable, the
consuming rule is wrong, not the token.

The three colour tokens are registered with `@property` and crossfade over 900ms
on `:root`. Do not add a second transition for them in a component.

### The capture gate changed

Two things that cost a lot of time to find, both now fixed in
`tests/lacquer/stage-a.capture.spec.ts`:

- **Captures never navigate.** The player page is an *overlay, not a route*:
  with a track playing the browse feed is already rendered underneath it, and
  `ytmusic-app.navigate('/')` produces the malformed route `/browse//`, which
  renders nothing. Use the `showBrowse` / `showPlayer` helpers, which toggle the
  overlay.
- **`ytmusic-browse-response` measures 0px tall even when fully populated.**
  Never gate readiness on its height; wait on rendered cards.

Write Stage B's captures as a new `stage-b.capture.spec.ts` reusing those
helpers. The twelve-shot table below is the gate.

---

## Read first, in this order

1. `.agents/rules/lacquer.md`
2. `docs/lacquer/DESIGN.md` — especially section 2 (the two surfaces) and 3.4 (album colour)
3. `docs/lacquer/DECISIONS.md`
4. `docs/lacquer/plans/STAGE_A.md` and the Stage A completion report

Then invoke `impeccable`. This stage covers **both** modes: the rail is Operate, the player
page is Experience. Treat them as two design problems with different success criteria.

---

## What this stage is

Where Lacquer stops looking like YouTube Music.

Stage A built the spine and deliberately left the app plain. This stage authors the three
regions the user actually looks at: the **left rail**, the **transport deck**, and the
**player stage** — plus the album-colour engine that makes the stage react.

This is the stage that determines whether the project succeeded.

---

## Tasks

### B1. The album-colour engine  ·  DONE

Build this **first**. Everything visual downstream depends on it.

`album-color-theme` emits `--ytmusic-album-color` and `--ytmusic-album-color-dark` on `:root`
as comma-separated RGB triples (format `11, 23, 49`), not colour strings. Confirm the format in
`src/plugins/album-color-theme/index.ts` before consuming it.

Per **D4**, Lacquer does **not** use those variables directly. Build a module that:

1. Reads the emitted values on track change
2. **Normalises** them — convert to a perceptual space, clamp lightness and chroma into a band
   that is guaranteed usable against Instrument surfaces. Raw album colour spans near-black,
   blown-out white and fluorescent; none of those are directly usable.
3. Falls back to Orbit Noir when artwork normalises to near-monochrome, rather than emitting a
   grey wash
4. Publishes Lacquer's own `--lq-album-*` token set
5. Crossfades on track change at the **Atmosphere** duration (800ms+) so it reads as light
   changing, not a theme switching

Respect the **D6** scope strictly. The engine publishes tokens; it is the *consumers* that must
never apply them to functional elements. Make that hard to get wrong — consider naming tokens so
misuse is obvious (`--lq-album-atmosphere`, `--lq-album-identity`) rather than a generic
`--lq-album-accent` that invites use anywhere.

**Do not** let this module recolour stock YouTube Music surfaces. That is what the upstream
plugin does and it will fight the authored components.

Performance: this runs on every track change. No full-DOM scans, no observer storms, no
per-frame work. Measure it.

### B2. The left collection rail — Operate

Replace the stock `ytmusic-guide-renderer` presentation with an authored rail.

- Primary items: **Listen / Discover / Collection** (**D10**) as real text nodes with proper
  `aria-label`s. Routes and semantics preserved exactly. Not `font-size: 0` plus `::after`.
- Back/forward at the top edge (placed there in Stage A).
- Account access at the bottom.
- Library and playlists below the primary items: calmer, typographic, denser than stock. This
  is a list of the user's records, not a nav menu — treat it that way.
- Selected and hover states in **Ion**, per **D6**. Not giant pills.
- Material: Instrument. Chrome hairlines separating sections.
- Type: Interface (Inter) throughout. **No serif in the rail.**
- Long playlist names truncate cleanly. The owner has playlists like
  "A PURGATORY OF SAFE & INS…" and "Underrated Songs That A…" — verify those specific rows.
- Fix the clipping visible in the shipped build, where the first item is cut off at the top.
- Collapses responsively at narrow widths without losing reachability.

**Never reacts to album colour.** This is the stable spine.

### B3. The transport deck — Operate structure, Experience tint

Replace the stock player bar's visual language.

Layout: song identity left, transport centred, output and FX right.

- **Progress:** a thin integrated line, not a chunky slider. Fill takes **album colour**
  (**D6** exception). Knob appears on hover only.
- **Play/pause:** takes **album colour** (**D6** exception). Must maintain contrast against its
  own background across dark, bright and saturated artwork — verify, do not assume.
- **Time:** Instrument voice (IBM Plex Mono), `tabular-nums`, so digits do not jitter.
- **Everything else** — skip, repeat, shuffle, volume, the FX affordance — stays Orbit Noir.
- Material: Instrument, with a diluted album tint. A Chrome hairline on the top edge.
- Preserve media keys, the Windows 11 taskbar media overlay, and keyboard control. Verify each.
- The FX button keeps its slot and its active indicator. **Do not rebuild the rack — Stage C.**

### B4. The player stage — Experience

The record possesses the room.

- **Artwork leads.** It is the first thing the eye lands on and it is the largest element.
  Responsive, roughly 360–520px, stably centred, no layout jump on track change.
- **Atmosphere** behind it derives from the normalised album tokens. This is where the night-city
  and orbital vocabulary lives: warm light against cool ground, a bloom that reads as the record
  lighting the room. Not a flat radial gradient with 0.7 alpha, which is what shipped.
- **The serif moment.** Album and artist title in Newsreader (**D7**). Roughly six serif
  instances on this page, zero elsewhere. Everything else on the page is Interface or Instrument.
- Metadata hierarchy is editorial — treat it like a record sleeve, not a data table.
- Preserve video mode behaviour.
- **Degrade gracefully when an ad plays.** `do-not-track` is on by default now, but no blocker
  is perfect. When an ad renders, the stage must fall back to Orbit Noir cleanly rather than
  exposing raw YouTube chrome. Verify this — it is a real state, visible in the owner's own
  screenshots.

### B5. The inspector

Queue, Lyrics, Related, Credits.

- One clear mode switch, not four equally loud stock tabs. Active state in **Ion** or
  **Signal** — functional, not album-derived.
- Queue: compact, readable, unambiguous current and next.
- Lyrics: preserve synced lyrics and provider behaviour. The current line must stay readable
  over the album atmosphere — **use a surface or scrim, not a `text-shadow`**, which is what
  shipped. `DESIGN.md` 3.4: text never sits on raw album colour.
  - The reference vocabulary includes cream paper stock. A light Instrument surface for lyrics
    is legitimate and worth trying.
- Material: Instrument. Blueglass only if the panel genuinely floats.
- Do not permanently hide any view.

---

## Screenshot gate

Album-colour edge cases are the point of this gate. Pick real tracks whose artwork is
**dark**, **bright**, **saturated**, and **near-monochrome**, and name which track produced
each capture.

| # | State | Looking for |
|---|---|---|
| 1 | Player page — dark artwork | Atmosphere reads; text legible |
| 2 | Player page — bright artwork | Nothing blown out; controls still visible |
| 3 | Player page — saturated artwork | No muddy mix; progress and play still contrast |
| 4 | Player page — near-monochrome artwork | Clean Orbit Noir fallback, not a grey wash |
| 5 | Player page during an ad | Degrades to Orbit Noir, no raw YouTube chrome |
| 6 | Rail, full height, real playlists | Long names truncate; nothing clipped top or bottom |
| 7 | Rail, narrow width | Collapses without losing reachability |
| 8 | Transport, close crop | Mono time aligned; hairline present; album fill correct |
| 9 | Inspector — Queue | Current and next unambiguous |
| 10 | Inspector — Lyrics over bright artwork | Current line readable on a surface, not shadowed |
| 11 | Full window, 1280x800 | Intentional, not cramped |
| 12 | Full window, maximised | Composition holds at width |

Also report:

- Measured cost of the album-colour engine per track change
- Confirmation that no functional element takes album colour (**D6**)
- Confirmation that media keys and the taskbar overlay still work
- `pnpm check` and test results

---

## Non-goals

- FX rack rebuild — **Stage C**
- Context-menu classifier — **Stage C**
- Motion beyond the album crossfade — **Stage C**
- SVG wordmark — **Stage C**
- New features, packaging, audio work beyond what Stage A fixed

---

## Acceptance

- At a glance, Lacquer does not resemble stock YouTube Music
- The rail never changes colour with the album; the stage always does
- No functional element takes album colour, verified
- The serif appears only where **D7** allows
- All four artwork classes are legible, plus the ad state
- Core flows work: search, navigation, queue, lyrics, library, playlists, transport, volume,
  resize, media keys
- No observer storms or per-frame work introduced
- One coherent local commit. Not pushed.

Finish with a concise report and **stop.** Do not begin Stage C.
