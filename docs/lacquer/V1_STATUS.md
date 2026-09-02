# Lacquer — Status

**Updated after the mark, deck and Visualizer Mode shipment.** Originally
rewritten at the end of Stage A because the prior version recorded the commit
as the literal string `HEAD`,
claimed "6/6 Playwright tests successful" against a single test, said settings
were "shared" with Pear when they are not, and listed shipped work as deferred.
This is the accurate record.

---

## Where the work is

Lacquer's visual layer is being rebuilt as authored components across three
bounded stages (DECISIONS.md D1). The authority for how it should look is
`docs/lacquer/DESIGN.md`; the closed decisions are in `docs/lacquer/DECISIONS.md`.

| Stage | Scope | State |
|---|---|---|
| **A** | Foundation & spine — tokens, fonts, window shell, config integrity, audio bug fixes, verification harness, housekeeping | **complete** |
| **B** | Album-colour engine (B1); authored left rail, transport deck, player stage, inspector | **complete** |
| **C** | FX rack as an instrument panel; context-menu keyboard nav + proper close; motion pass; first-generation SVG wordmark + Windows icons; consistency sweep; carried-over housekeeping | **complete** |
| **Identity / deck / visualizer** | Script-L crest on every Windows surface; structural transport reorder; persistent full-window Visualizer Mode | **complete** |

**Stage B is where Lacquer stops looking like YouTube Music.** The rail is
relabelled and re-materialised, the transport carries the album-coloured play
button and progress line over a diluted tint, the player page has a composed
atmosphere derived from the normalised `--lq-album-*` tokens, and the inspector
is an Instrument panel with an Ion mode switch. Stage A's deliberately-plain
baseline is gone.

---

## Build information

- **Branch:** `lacquer/orbit-noir`
- **App version:** `3.12.0` (unchanged — no stage is a release)
- **`pnpm build`:** succeeds (`electron-vite build`, Windows x64).
- **`pnpm check`:** passes — `oxlint` (0 errors; the same pre-existing
  `solid(reactivity)` / `no-misused-spread` warnings in `src/plugins/*`, none
  in Lacquer's files), `oxfmt --check` clean, `tsc --noEmit` clean.
- **`pnpm test`** (smoke, throwaway profile): **32 passed**, including permanent
  regressions for the generated mark, Visualizer Mode state/chrome, renderer
  selection and the existing shell/audio behavior. Structural deck and live
  visualizer ownership checks remain in the authenticated capture suite.
- **`pnpm test:capture`** (the gate, real authenticated profile over CDP):
  **5 tests pass** — `stage-a` (8 shots), `stage-b` ×2 (12 shots), and
  `stage-c.capture.spec.ts` ×2 (10 gate shots + `03b`). Stage C's logs confirm
  the FX rack surface (`rgba(16,42,76,0.72)` Blueglass, `blur(24px)`, IBM Plex
  Mono readouts), context-menu keyboard nav (ArrowDown/Up, `End` reaching *Pin
  to Listen again*, type-ahead, Escape-close), the then-current Stage C
  geometric wordmark, and `#background.immersive-background` resolving to
  `display: none` on an album detail route.
- Visualizer is off on a fresh profile. Visualizer Mode temporarily owns its
  activation on the player page and unloads it while browsing or when the mode exits.
  - **Harness fix:** `scripts/capture.mjs` set `NODE_ENV=test` purely to
    suppress the dev-mode DevTools auto-open (which deadlocks Playwright's CDP
    attach). That flag also left the preload sandboxed, so
    `require('electron-store')` failed, `window.mainConfig` never existed, and
    the entire `src/lacquer/*` renderer shell failed to initialise — every
    prior capture was a screenshot of a half-dead app. It now sets
    `LACQUER_CAPTURE=1`, which suppresses only the DevTools open. The
    attach-not-launch invariant (A9) is untouched.

### The two restored lint rules (D12)

Commit `d02c64ab` switched off `@stylistic/no-mixed-operators` and
`perfectionist/sort-imports` rather than fixing what they flagged, then this
file reported the checks as passing.

- **`perfectionist/sort-imports`** — restored to its pre-`d02c64ab` value
  (`natural`, ascending, builtin → external → internal → index/sibling → parent
  → type). The tree already satisfies it; **zero** code changes were needed.
- **`@stylistic/no-mixed-operators`** — restored to `error`, but with `groups`
  narrowed to the genuinely ambiguous operator families (`&&`/`||`, comparison,
  `in`/`instanceof`, bitwise). The arithmetic family is intentionally excluded
  because it is **irreconcilable with `oxfmt`**: the rule wants
  `(a * b) + c`, `oxfmt --write` strips the parentheses straight back, and
  `oxfmt --check` then fails — so `pnpm check` cannot be green with the bare
  rule. All 48 arithmetic violations were introduced by commit `156fd948`
  running the formatter tree-wide and removing parentheses upstream Pear had
  placed deliberately; pristine upstream has zero violations of this rule.
  Excluding arithmetic (which `oxfmt` normalises consistently anyway) keeps the
  rule meaningfully enforced without a dozen upstream-file rewrites or a
  per-file `overrides` exception for `in-app-menu/TitleBar.tsx` (which D8
  forbids editing). This was raised with the owner and is the agreed approach.

---

## The mark, deck and Visualizer Mode shipment

- **Identity:** the owner-supplied script `L` and laurel were traced and re-voiced
  on an Orbit Noir plate. One generator now owns the full crest (32px+), weighted
  de-wreathed small glyph (16–24px), titlebar lockup, Windows PNG/ICO, installer
  and stateful tray assets. The titlebar script supplies the initial `L`; the
  adjacent text is `acquer`, avoiding the earlier **LLacquer** reading.
- **Deck:** `ytmusic-player-bar` is a structural grid with identity left,
  transport centred and output right. This replaces the deliberately deferred B3
  layout and stays stable under YTM's responsive class changes without a DOM loop.
- **Mode:** `src/lacquer/visualizer-mode.ts` persists an armed state, owns the
  transport VIZ control and `Ctrl+Shift+V`/Escape lifecycle, activates the plugin
  only on the player page, and restores Normal Mode while browsing. Chrome fades
  after three idle seconds and wakes on input while hover, focus and open popovers
  pin it visible.
- **Renderers:** Orbital Shockwave is the default album-reactive field and retains
  the artwork. Laser Basilica (Rave) is an artwork-free, album-coloured light room;
  Butterchurn remains the selectable chaos engine. Paused playback uses idle drift.
- **Audio safety:** the old D11 ban was partially stale. The live plugin now owns
  one disposable post-Signal-Chain analyser tap. Wave/Vudio are no longer exposed
  or bundled and saved legacy values fall back to Butterchurn. The shared analyser
  remains at `fftSize === 2048`; disable/recreate/unload releases the tap, canvas,
  observer, listener and animation loop.
- **Measured on the target ThinkPad on battery:** Normal playing held 56.3 FPS,
  Rave playing 55.1 FPS, Rave idle drift 56.2 FPS, and album crossfade 50.9 FPS.
  Twenty enter/exit cycles returned listeners and observers to baseline, left no
  disabled render work, and added only 486KB after forced GC.

---

## What Stage C changed

The details that separate "well themed" from "someone built this." All of it is
`src/lacquer/` and the suppression sheet; no `!important` component sheet, and
the classifier is unchanged from its own commit.

### The FX rack — C1 (`fx-rack.ts`, `fx-rack.css`)

Rebuilt from six preset buttons in a `#1a1a1a` box into an analog-hi-fi
instrument panel: a Blueglass popover with a "Signal Chain" head, a 3×2 preset
grid (active = a filled Ion chip + inset ring, unambiguous with focus
elsewhere), machined Signal-filled sliders for **speed**, **reverb wet** and
**stereo width**, segmented readouts for **pitch mode** (Varispeed / Lock) and
**room character** (Off / Room / Hall / Cath), an **EQ** summary, a master
**Bypass**, and a cheap output meter driven off the shared analyser tap **only
while the rack is open** (`requestAnimationFrame` cancelled on close). Every
numeric readout is IBM Plex Mono, `tabular-nums`.

Preset switching stays immediate and authoritative — it calls
`signalChain.setPreset` and clears overrides. Parameter controls ride on top of
the active preset through the chain's existing public setters; a moved
parameter shows a Solar dot on its preset and engages the limiter for clip
safety. Preset + overrides persist in `localStorage` under `lacquer.fx` (the
legacy `lacquer.fxPreset` key is still written and read for the context menu
and the shortcut IPC). The popover has real focus management: focus enters on
open, Tab is trapped, Escape closes and returns focus to the FX button,
pointer-down outside dismisses, and `inert` removes it from the a11y tree when
closed. `renderer.ts`'s `peard:fx-rack-toggle` and `context-menu.ts` now route
through the exported `setFXRackOpen()` instead of poking `.style.display`.

### The context menu — C2 keyboard nav + close (`context-menu.ts`, `.css`)

The classifier itself was done in its own commit and is untouched (icon type
first, endpoint/pageType as the fallback; a test asserts it cannot classify
from path geometry). This stage fixed the two defects the classifier rewrite
did not touch:

- **Keyboard navigation.** The reorg no longer wraps items in `<div>`s or nests
  tier 2 in a sub-container. The `tp-yt-paper-listbox` stays flat — tier 2
  items are direct children, just `hidden` until More… is opened — and this
  module runs its own roving-focus keyboard controller in the capture phase
  (`stopImmediatePropagation` so `IronMenuBehavior` never double-moves):
  ArrowUp/Down with wrap, Home/End, Escape, Enter/Space (activates via
  `.click()`), and type-ahead. Verified in the gate: `End` reaches *Pin to
  Listen again*, `s` jumps to *Save to playlist*, the focus ring is Ion.
- **`closeMenu()`** calls the dropdown's own `close()` (which restores focus to
  the trigger), with an Escape-key fallback — not the old `display:none` /
  restore-next-frame flicker that left Polymer's model open.

Only real item renderers are classified and moved; anything else in the listbox
is left in place, and any item the classifier cannot place lands in tier 2,
never dropped. The popup is Blueglass with the Interface voice, and Lacquer's
own rows are inset to line up with the stock rows' icon column. The reorg
re-runs when a fresh (untagged) stock menu repopulates the reused listbox, so
plugin-injected items (the downloader's *Download*) self-heal into tier 2.

### Motion — C3 (`tokens.css`, `suppress.css`, per-component sheets)

Every Lacquer transition already referenced `--lq-motion-{fast,normal}`; the
album crossfade on `:root` now references `--lq-motion-atmosphere` (raised to
`900ms` to match what it always was). Nothing in Lacquer animates on scroll or
on list-item entrance, and there are no keyframe animations. `suppress.css`
adds a `prefers-reduced-motion` block that zeroes every transition/animation
duration across the app — `:root` excepted, because its only transition is the
opacity-equivalent album crossfade, which §6 keeps — and the FX rack and
progress knob pin their transforms in their own sheets.

### The current mark + icons (`titlebar.ts`, `titlebar.css`, `assets/`)

`ytmusic-logo::after { content: 'Lacquer' }` is gone. `titlebar.ts` injects a
real inline SVG lockup: the weighted champagne/bronze script `L` beside `acquer`
in Space Grotesk, so the visible name reads **Lacquer** once. The full mark places
that script inside its laurel on an Orbit Noir plate; below 32px the laurel drops
away so the letter remains legible. `--lq-champagne` and `--lq-bronze` are
identity-only tokens, not new control colours.

`scripts/make-logo.mjs` is the single geometry source for the full, small and
titlebar marks. `scripts/make-icons.mjs` (`pnpm make:icons`) rasterises those
sources through an offscreen Electron window — there is no ImageMagick/sharp in
the toolchain — and writes
`assets/icon.png` (used by the dev window, `electron-builder`'s `win.icon`, and
the notifications / touchbar plugins), the `assets/generated/icons/png/*` set,
stateful tray assets and a hand-assembled PNG-in-ICO at
`assets/generated/icons/win/icon.ico` (the packaged Windows window icon). The
owner's original raster is source material at `docs/lacquer/assets/mark-source.png`.
macOS `.icns` is untouched (out of scope, D12).

### Consistency sweep — C5

`titlebar.ts`, `settings-panel.ts` and `context-menu.ts` no longer carry inline
`.style` colour or `font-family` — each has an adopted sheet
(`titlebar.css`, `settings-panel.css`, `context-menu.css`) and sets classes.
`fx-rack.ts` was rewritten class-first. The only inline `.style` left in
`src/lacquer/*.ts` are computed, non-cosmetic: the album engine publishing
`--lq-album-*`, the slider fill percentage (`--lq-fx-fill`), and a couple of
`display` toggles. Elevation shadows in the CSS use the same
`rgba(6, 12, 26, …)` cast Stage B's `player-stage.css` established. No Lacquer
`TODO`/`FIXME` remains; no `!important` that is not suppressing stock or plugin
chrome.

### Carried-over housekeeping

- **Lyrics provider strip.** The stock picker is item 0 of the virtualised
  lyrics list — an ~80px sticky block whose lower half (a redundant dot row)
  hung below the tab strip as a stray band. Lacquer collapses it to one compact
  opaque row (chevrons + provider name) with a bottom hairline, flush under the
  tabs; the dot row is removed and hide-on-scroll still works. The stray band
  is gone; the provider-name carousel is a little tight mid-transition.
- **Browse immersive header.** Album and playlist detail routes showed
  `album-color-theme`'s un-hidden `#background.immersive-background` (a blurred
  full-bleed `<img>`, not a CSS background — which is why Stage A's
  `background-image: none` missed it). `suppress.css` now removes the layer, so
  Normal Mode's browse shell is Orbit Noir on every route (D5). Visualizer Mode
  is the explicit player-only exception and auto-suspends on browse routes.

---

## What Stage B changed

The four authored surfaces. CSS is delivered as **adopted stylesheets applied
from the renderer** (`adoptLacquerRegionSheets` in `src/renderer.ts`), not
`injectCSS` from main — `document.adoptedStyleSheets` always cascade *after*
`insertCSS` sheets, and `album-color-theme` (on by default, D11) recolours stock
`.time-info` / `.duration` / `#mini-guide-background` through one. Putting
Lacquer's sheets last wins that cascade without a per-rule specificity fight
(D4's "the plugin would fight the authored shell", resolved by ordering). Tokens
+ fonts + suppression stay in `initTheme`.

### The left rail — B2 (`rail.css`, `rail.ts`)

- **Relabelled** Home / Explore / Library → **Listen / Discover / Collection**
  (D10) as real text nodes + `aria-label`s, by index so it survives locale, in
  both `#guide-renderer` and the narrow-width `#mini-guide-renderer` (re-asserted
  by a single `ResizeObserver`, not a persistent subtree observer). Routes and
  click behaviour untouched.
- **Re-materialised:** Instrument ground (Stage A) + a Chrome hairline on the
  right edge and between the primary nav and the record list; Inter throughout,
  no serif; primary rows 44px, playlist rows 34px and stripped of the repeated
  owner-name subtitle; long names truncate with an ellipsis; hover is a quiet
  raised fill, active is Ion text + icon + a 3px inset Ion bar + a 9% Ion wash —
  not the stock full-width pill. Custom scrollbar in Chrome linework.
- **Account footer** (`#lacquer-rail-account`, injected) pinned to the bottom of
  the rail (D8), clear of the fixed transport (`padding-bottom` = transport
  height), proxying clicks to the now-hidden stock `ytmusic-settings-button`.
- **Upgrade nag** removed: `options.removeUpgradeButton` defaulted **on** in
  `config/defaults.ts` (Pear's own mechanism) *and* `rail.ts` drops any primary
  entry past the three real items, for profiles that already stored the option
  off.
- **Never** references an `--lq-album-*` token. The rail is the stable spine.

### The transport deck — B3 (`transport.css`)

- Surface: Instrument with a **diluted album tint** —
  `color-mix(instrument 92%, atmosphere 8%)` — and a Chrome hairline on the top
  edge.
- **Progress line:** thin (`--paper-slider-height: 3px`) integrated line at the
  top edge; fill and knob take `--lq-album-fill` (D6 exception); knob hidden
  until hover/focus; track and buffer are Chrome hairlines.
- **Play/pause:** a filled disc in `--lq-album-fill` with the glyph in
  `--lq-album-ink` (D6 exception). B1 guarantees fill↔ink and fill↔surface
  contrast for any artwork, verified across the dark / bright / saturated shots.
- **Time:** IBM Plex Mono, `tabular-nums`, Moondust — `!important` to beat
  `album-color-theme`'s 50%-white pin.
- Everything else — skip, shuffle, repeat, volume, FX, the gear — stays Orbit
  Noir (Milkglass glyphs, Ion toggle-on). The FX/gear buttons are re-themed from
  their `fx-rack.ts` inline placeholder styling to bordered ghost buttons; the
  FX active indicator is Solar (expressive "on", not Ion — not a selected state).
  The rack itself is Stage C.
- **Structure:** identity left, transport centre, output right. The player bar is
  a three-track grid; the identity wrapper's stock absolute positioning is reset
  and the existing YTM control groups are assigned to columns. YTM still owns
  every button and its responsive visibility, but its layout JS cannot silently
  put the old order back. Verified at 1920, 1280 and 760px with long metadata and
  playing/paused states.

### The player stage — B4 (`player-stage.css`, `player-stage.ts`)

- **Atmosphere** from the normalised `--lq-album-*` tokens (never the raw plugin
  output): a defined bloom behind the artwork reading as the record lighting the
  room, an overhead wash, a low warm floor-bounce, a Signal counter-glow, on the
  Orbit ground. Every layer is a `color-mix` toward transparent — it reads as
  flat colour first (§7). The three colour tokens crossfade on `:root` at 900ms
  (B1's `@property` registration); nothing here adds a second transition.
- **Fallback sky** for near-monochrome art and ads (`[data-lq-album-fallback]`):
  Ion bloom + Ultraviolet warmth + Signal counter-glow on Orbit. Colourful and
  retrofuturist, not a grey wash.
- **Artwork leads:** `min(52vh, 46vw, 560px)`, centred in `#main-panel` (turned
  into a column), with a wide offset coloured bloom + honest dark elevation
  shadow.
- **The serif moment:** YouTube Music renders no title on the player page, so
  `player-stage.ts` injects `#lacquer-now` — album/song title and artist in
  Newsreader (D7), album·year in IBM Plex Mono — below the artwork on a soft
  `--lq-album-veil` vignette (the veil token carries Milkglass at 7:1 for any
  artwork). Two serif instances; zero elsewhere.
- **Video and ads degrade:** `player-stage.ts` sets `[data-lq-video]` /
  `[data-lq-ad]` on `:root` from one observer scoped to the transport's info
  block (fires on track/ad transitions only — no polling). Both hide
  `#lacquer-now`; the ad path also drops the artwork bloom. Verified: an ad's
  `0, 0, 0` triple already routes B1 to the fallback sky, so no raw YouTube
  chrome shows. (A real ad can't be forced with `do-not-track` on; shot 5 sets
  the state the plugin would emit.)

### The inspector — B5 (`inspector.css`)

- `#side-panel` becomes an opaque **Instrument** card (rounded, hairline, inset
  from the stage) so text never sits on the album atmosphere (§3.4).
- **One mode switch:** `tp-yt-paper-tabs` restyled — active tab is **Ion** (§3.2,
  functional, never album-derived) with the previously-invisible `#selectionBar`
  given a 2px Ion underline; inactive tabs recede to Moondust.
- **Queue:** compact Instrument rows, mono `tabular-nums` durations, the current
  track marked unambiguously (Ion wash + inset Ion bar + Ion title).
- **Lyrics:** the `synced-lyrics` container gets the Instrument surface and Inter
  via `--lyrics-font-family`; the current line is full-strength Milkglass, other
  lines Moondust. Legibility is carried by the **surface, not a `text-shadow`**
  (§3.4 — the shipped build's approach). The plugin's glow animation is left as
  the decorative flourish it is.
- No view is hidden; Comments / Related get a light legible pass (Ion links).

### Verification

`pnpm test:capture` → `tests/lacquer/stage-b.capture.spec.ts`. The overlay
helpers (`showBrowse` / `showPlayer`) moved to `harness.ts` and are shared with
the Stage A spec. The colour-class shots (1–5) drive `--ytmusic-album-color`
directly, over real IGOR artwork, because `album-color-theme` averages the
smallest thumbnail toward grey for most covers and every music video — B1's job
is *normalisation of whatever it gets*, and this exercises every band; shot 2b
is IGOR played end-to-end with nothing driven (→ pink, non-fallback), proving
the plugin → engine → atmosphere path is live. Every shot's log confirms
`--lq-focus` and the inspector's active tab stay Ion (`#4f7dff`) in all five
colour states — **no functional element takes album colour (D6)**.

`shell.smoke.spec.ts`'s wordmark check now polls rather than sampling once —
`insertCSS` flushes on `did-finish-load`, which can land just after
`ytmusic-nav-bar` mounts (a pre-existing race, made visible under Stage B's
timing).

---

## What Stage A changed

### Identity & tokens (A1, A2)

- `src/lacquer/lacquer.css` — the 364-line `!important` sheet over stock
  YouTube Music DOM — is **deleted**.
- `src/lacquer/tokens.css` — rewritten from scratch. The full Orbit Noir
  palette (`DESIGN.md` §3.1) under `--lq-*`, plus spacing, radii, motion
  durations and the four type-role variables. `:root` only, no other selectors.
- `src/lacquer/suppress.css` — new. Removes/de-brands stock chrome: pulls the
  app onto the Orbit ground, re-points YouTube Music's red brand custom
  properties to Ion, hides the stock wordmark, gives the nav bar and transport
  the Instrument material and a Chrome hairline, gives search an Ion focus ring,
  restores an album-independent Ion focus ring globally, and **neutralises
  `album-color-theme`'s recolour of the shell** — the plugin is on by default
  (D11) but mixes the extracted album colour into ~40 stock background tokens
  (inline-`!important` on `<html>`), which was a grey/olive wash. Pinning the
  three un-`!important` inputs to the mix (`--ytmusic-album-color*` → Orbit,
  ratio → 100%) resolves every mix to pure Orbit. Actual album consumption via
  `--lq-album-*` is Stage B (D4). It removes and de-brands; it does not author.
- `src/lacquer/fonts.css` — loads the four voices (Newsreader, Space Grotesk,
  Inter, IBM Plex Mono) locally via `@fontsource`, weights only as needed.
  `@fontsource/space-grotesk` added to dependencies. **No global `font-family`
  rule anywhere.** The build inlines all 49 faces as `data:` URIs — zero remote
  font requests.
- Injection order in `src/index.ts` `initTheme`: tokens → fonts → suppress.

### Window shell (A5)

- The window is **frameless** on Windows with its titlebar collapsed to one
  row: the de-branded stock `ytmusic-nav-bar` with the Lacquer wordmark where
  the stock logo was. Stage A's plain Space Grotesk treatment was later replaced
  by the D15 script-L lockup. Window controls are the native
  Windows Controls Overlay — Pear's existing mechanism, not hand-drawn.
- `src/lacquer/titlebar.ts` (new) draws the wordmark and puts back/forward at
  the top of the rail. Each injection re-asserts itself through a narrow
  `childList`-only observer on its own host, because YouTube Music re-renders
  the nav bar and guide and wipes injected nodes.
- `src/renderer.ts` — the shell inits (`initTitleBar`, `initSettingsPanel`,
  `initContextMenu`) moved ahead of the Web Audio setup in `onApiLoaded`: the
  audio path throws when nothing has played yet (no `<video>`), and previously
  took the whole shell down with it.
- Account access for Stage A is the de-branded stock avatar at the right of the
  titlebar. Moving it into a rail footer waits for Stage B's authored rail
  (agreed with the owner).
- `src/plugins/in-app-menu/renderer/TitleBar.tsx` is **not touched** (D8).
- `backgroundColor` for the pre-paint window is now Orbit `#0b1731`, not `#000`.

### Default plugin set (A4)

- `src/config/defaults.ts` carries the D11 table. `album-color-theme` also gets
  `enableSeekbar: false` — its seekbar theme paints a pink gradient the shell
  overrides anyway.
- **`src/config/plugins.ts` `getPlugins()` now merges the D11 table underneath
  the stored plugin map**, and the three plugin loaders + `peard:get-config`
  route through it. This is necessary, not cosmetic: `electron-store`
  shallow-merges top-level keys, so any `config.json` that already has a
  `plugins` entry — which the owner's dev-built profile does (`notifications`,
  `video-toggle`, `precise-volume`, `discord`) — drops the `defaults.ts` table
  entirely. Merging it as a real default *layer* (user's stored choices still
  win per key) is what makes `album-color-theme` actually turn on. Verified on a
  clean profile by the smoke suite and on the real profile by the capture
  gate's config dump.

### Housekeeping (A8)

- `src/menu.ts` — the auto-update menu item (deleted and replaced with a blank
  line in `88d899d7`) is restored.
- `src/lacquer/settings-panel.ts` — "Developer Tools" sent `toggle-in-app-menu`,
  the *same* IPC as "Plugins & Options", so it opened nothing. It now toggles
  DevTools via `lacquer:toggle-dev-tools`; "Plugins & Options" opens
  `config.json` via `lacquer:edit-config` (both new handlers in
  `src/providers/app-controls.ts`). Works with `in-app-menu` disabled.
- `src/lacquer/fx-rack.ts` — the rack was `appendChild`'d **inside** the FX
  `<button>`, so every preset click bubbled to the button and closed the rack.
  It is now a sibling inside a positioned wrapper. `settings-panel.ts` had the
  same latent structure and got the same fix.
- `src/lacquer/dom.ts` (new) — one shared `MutationObserver` behind
  `whenElement(selector)`, replacing the two full-tree `subtree: true`
  observers `fx-rack.ts` and `settings-panel.ts` each ran for the whole session.

### Audio (A6, A7 — done before this session, verified here)

- Stereo width is genuine mid/side (`L' = M + S·w`, `R' = M − S·w`), realised as
  a 2×2 matrix with real L/R cross-mixing. `w = 1` is the exact identity
  (bit-identical to bypass); `w > 1` widens without inverting or collapsing a
  channel. Asserted by `signal-chain-width.smoke.spec.ts`.
- The limiter is bypassable and bypassed for **Original**, so Original takes no
  limiting and is level-stable. Every other preset sums reverb wet on top of
  full dry and can exceed 0 dBFS, where the limiter earns its place. The bypass
  uses the same crossfade path (`limiterBypassGain` / `limiterInputGain`,
  `setTargetAtTime`) as the EQ, width and compressor stages.

### `precise-volume` × Signal Chain

No interaction. `precise-volume` calls the YouTube Music player API's
`setVolume`, which scales the media element **upstream** of
`createMediaElementSource`. The Signal Chain's `outputGain` is a fixed unity
node it never touches for volume. They multiply cleanly; neither fights the
other.

---

## Migration from Pear (accurate — supersedes the old "shared settings" claim)

- **Config is NOT shared.** Lacquer resolves `userData` to `<appData>/Lacquer`
  (D9). The earlier `app.setPath` override never worked as its comment claimed —
  `electron-store` resolves at import time, before the override ran.
- **Session is carried over once.** `src/lacquer/session-migration.ts` copies
  Pear's cookie jar and web storage into Lacquer's `userData` on first run,
  guarded by a `.lacquer-session-migrated` marker. It never copies `config.json`
  (so Lacquer's defaults apply), never deletes from Pear, never throws. A failed
  copy means signing in again, not a broken app.
- **Disabling a plugin in Lacquer does not affect Pear**, and vice versa.
- Close Pear/Lacquer before the first launch so the SQLite cookie copy does not
  tear, and confirm Windows Defender Controlled Folder Access is not blocking
  cross-AppData writes.

---

## Known issues

See `docs/lacquer/KNOWN_ISSUES.md`.
