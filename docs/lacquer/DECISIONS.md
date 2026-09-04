# Lacquer — Decision Record

**Settled 2026-08-27** by the repository owner, across three structured review rounds.

These decisions are **closed**. Do not re-litigate them, do not propose alternatives, and do
not quietly implement something else. If implementation reveals that a decision is unworkable,
**stop and report it** — do not substitute your own judgement.

Every session working on Lacquer reads this file and `DESIGN.md` before touching code.

---

## Why this file exists

The first build of Lacquer was produced by an autonomous agent across seven runs. It shipped a
364-line `!important` stylesheet over stock YouTube Music DOM, invented a palette nobody asked
for, disabled two lint rules rather than fixing the code they flagged, and then wrote a status
document claiming the checks passed and reporting a test count that does not exist.

The root cause was not capability. It was the absence of a written authority the agent was
required to obey. This file and `DESIGN.md` are that authority.

---

## D1 — Remediation approach: authored shell, staged

The visual layer is **rebuilt as authored components that Lacquer owns**, not patched.

CSS is confined to two jobs: *suppressing* stock YouTube Music chrome, and theming what
remains. Structure comes from real components.

*Rejected:* deepening the existing CSS layer. It is structurally capped — an authored transport
deck or left rail cannot be reached by restyling `ytmusic-player-bar`.

**Staged into exactly three runs.** This is a bounded project, not an open-ended redesign.

---

## D2 — Delete, do not patch

`src/lacquer/lacquer.css` is **deleted** in Stage A and replaced with a token layer plus a
suppression sheet.

Keeping it means every authored component fights 364 lines of `!important` for the rest of the
project's life.

---

## D3 — Orbit Noir is rebuilt to specification

The shipped palette (`#130a1f` / `#ff2a6d` / `#05d9e8`) is **discarded**. It is generic
synthwave and it violates the project's own workspace rules, which prohibit gamer-style visual
excess.

The authoritative palette is in `DESIGN.md` section 3.1. Cobalt and navy ground, cyan and
cobalt functional, violet and orange expressive, ivory text, minimal pure black.

---

## D4 — Album-reactive colour is on by default, on Lacquer's own tokens

`album-color-theme` is enabled by default. Lacquer **reads and normalises** its output and
publishes its own `--lq-album-*` tokens rather than consuming the plugin's variables directly,
because the plugin also recolours stock surfaces and would fight the authored shell.

Normalisation and contrast safety are mandatory (`DESIGN.md` 3.4).

---

## D5 — Normal Mode scopes album takeover to the player page and transport

In **Normal Mode**, the browse shell stays Orbit Noir. Only the player page and the transport
deck react to the album. **Visualizer Mode is the explicit, opt-in, owner-authorised
suspension of this rule:** while active on the player page it may take over the full window;
while armed on a browse route it auto-suspends and restores the stable shell.

*Reasoning:* a constant environment is what makes the changing one register. A shell that
restyles every three minutes while browsing is noise, not expression. The takeover is therefore
a deliberate mode rather than the default environment.

---

## D6 — Album colour drives the emotional register only, plus two exceptions

Functional colour (focus, selection, active nav, toggles, all text) stays Ion and Signal on
every screen. Album colour drives atmosphere, bloom, glow.

**The two exceptions are the progress bar fill and the play/pause button.** They are the
now-playing identity and should change with the record.

This makes contrast safety structural rather than a bolted-on patch.

---

## D7 — Four type voices, serif as the exception

| Voice | Face | Job |
|---|---|---|
| Editorial | Newsreader | Player-page album/artist title, playlist detail headers. Nowhere else. |
| Graphic | Space Grotesk | Lacquer wordmark, section heads. |
| Interface | Inter | Navigation, search, menus, rows, buttons, body. |
| Instrument | IBM Plex Mono | Time, duration, speed, FX readouts, indices. `tabular-nums`. |

The serif appears roughly six times on a player page and zero times elsewhere. No global
`font-family` declarations.

---

## D8 — Lacquer builds its own titlebar; `in-app-menu` is disabled by default

One row: **Lacquer wordmark left, search centre, window controls right.**

- Back/forward move to the top edge of the left rail — they are navigation, and navigation
  lives in the rail.
- **The account avatar is removed from the titlebar.** It is visually off and it is not a
  frequent action. Account access moves to the bottom of the rail, out of the primary sightline.
- Frameless window, **reusing Pear's existing drag-region and window-control machinery** rather
  than writing it fresh.

`src/plugins/in-app-menu/renderer/TitleBar.tsx` is **not edited**. Upstream actively maintains
that file; editing it guarantees a permanent merge conflict. Lacquer's titlebar is a separate
component and the plugin is disabled by default.

*Current state being fixed:* the app shows two stacked header strips consuming roughly 100px
before any content.

---

## D9 — Split `userData` from Pear, with one-time session copy on first run

**Implemented. The investigation corrected the premise — recorded here because the original
reasoning was wrong.**

The decision was written believing `src/index.ts`'s
`app.setPath('userData', <appData>/YouTube Music)` made Lacquer share Pear's config. It did
not. Filesystem evidence on the owner's machine:

| Path | Modified | Meaning |
|---|---|---|
| `%APPDATA%/Lacquer/config.json` | 23:34 | The dev build writes **config** here |
| `%APPDATA%/YouTube Music/DevToolsActivePort` | 23:11 | The same run's **session** lives here |

The cause is ESM evaluation order. `electron-store` is instantiated at module scope in
`src/config/store.ts` (`export const store = new Store(...)`), so importing `@/config` at the
top of `index.ts` resolved its path against Electron's default userData — `<appData>/Lacquer`,
derived from `productName` — **before** the `setPath` on line 65 ever ran. The Chromium
session, created after `app.whenReady()`, did honour the override.

So the real state was **split-brained**: config in `Lacquer/`, login in `YouTube Music/`.
Neither the shipped `V1_STATUS.md` ("Shared Settings: Plugin configurations and options are
shared") nor `KNOWN_ISSUES.md` ("Shared Config Coupling") described it accurately.

This also means the premise behind "every default is inert" was wrong in the stated way but
right in effect — `Lacquer/config.json` did receive `hideMenu: true`, while
`album-color-theme` stayed off simply because it is `enabled: false` upstream and nothing
changed it.

**What was implemented:**

- The `app.setPath` override is **removed**, so config and session both resolve to
  `<appData>/Lacquer` consistently.
- `src/lacquer/session-migration.ts` copies Pear's session — `Network/` (the cookie jar),
  `Local Storage/`, `Session Storage/`, `IndexedDB/`, and the pre-Network-folder `Cookies`
  files — into Lacquer's userData once, guarded by a `.lacquer-session-migrated` marker.
- `config.json` is deliberately **not** copied, so Lacquer's own defaults apply.
- It runs at the top of `app.whenReady()`, before the first window, so Chromium has not yet
  opened the cookie store. It is **not** an import-order dependency, because restoring
  `perfectionist/sort-imports` (D12) would silently reorder a side-effect import and break it.
- Never deletes from Pear. Never throws. A failed copy means signing in again, not a broken app.

**Operational note:** the migration copies a SQLite cookie database. **Pear/Lacquer must be
closed on first launch** or the copy can tear. Also confirm Windows Defender Controlled Folder
Access is not blocking writes between AppData directories.

---

## D10 — Rail labels: Listen / Discover / Collection

Home becomes **Listen**, Explore becomes **Discover**, Library becomes **Collection**.

These are **real text nodes with proper `aria-label`s**, not the current `font-size: 0` plus
`::after` trick, which breaks screen readers and i18n and contributes to the sidebar clipping
visible in the shipped build.

Routes and semantics are preserved exactly.

---

## D11 — Default plugin set

The owner's machine currently has **three** plugins enabled: In-App Menu, Navigation,
Performance improvement. Album Color Theme is off, which means the album-reactive premise —
the most-cited principle in the workspace rules and the product spec — has never run.

Lacquer ships these defaults:

**On:**

| Plugin | Reason |
|---|---|
| `album-color-theme` | The design anchor. Non-optional. |
| `do-not-track` | Ad blocking. An ad rendering on the Experience surface breaks the design premise. |
| `sponsorblock` | Skips non-music segments. |
| `synced-lyrics` | The inspector's Lyrics surface depends on it. Lacquer keeps precise timing, the Fancy line treatment and YT Music as the preferred provider from Pear, but hides per-line timecodes so the lyrics remain uncluttered. |
| `navigation` | Back/forward, relocated to the rail in D8. |
| `performance-improvement` | Already default-on upstream. |
| `shortcuts` | Media keys, and the FX shortcuts route through it. |
| `taskbar-mediacontrol` | Windows 11 media overlay. Cheap, and it reads as an optimised machine. |
| `precise-volume` | Finer volume and scroll-to-adjust, appropriate for a music instrument. **Verify it does not fight Signal Chain output gain.** |

**Off — superseded by Signal Chain.** These must stay off. They create competing audio graphs,
which is the exact conflict the Signal Chain audit was commissioned to prevent:

`equalizer`, `audio-compressor`, `playback-speed`, `crossfade`, `skip-silences`

**`visualizer` is mode-managed, not blanket-banned.** The original D11 reason was partially
stale: Butterchurn and Vudio created no audible destination path, while Wave did add a dry path
that bypassed Signal Chain. The safe boundary now exposes the authored Lacquer engines and
Butterchurn through one disposable post-chain analyser tap. Legacy Wave/Vudio settings resolve
to Orbital Shockwave; they are neither exposed nor bundled into the live renderer. Butterchurn
is an explicit Chaos choice, not a legacy-profile fallback. The transport gear exposes Orbital
(show artwork), Laser Basilica (hide artwork), and Butterchurn (hide artwork) without requiring
config-file editing. Butterchurn is the owner's selected artwork-free engine; like Laser Basilica,
it hides stage artwork and metadata only during takeover, restoring both on exit or engine change.
The plugin remains
off on a fresh install and Visualizer Mode enables it only while the mode is active on the
player page. Disable/recreate/unload tears down the owned tap, observer, canvas and animation
loop without changing the shared analyser's `fftSize`.

**Off — competing visual layers.** These inject their own styling and would fight the authored
shell: `ambient-mode`, `blur-nav-bar`, `transparent-player`, `unobtrusive-player`, `in-app-menu`

**Off — user-optional.** Everything else. `discord` and `scrobbler` are personal taste and are
left to the owner rather than defaulted either way.

---

## D12 — Scope: visual layer, plus audio bugs, plus housekeeping

**In scope:**

1. The visual rebuild (D1–D10).
2. Two audio defects, both provable from source:
   - **Stereo width is not mid/side.** `signal-chain.ts` routes splitter output 0 to both
     `widthGainM_L` and `widthGainS_L`, and both to merger input 0. There is no L/R
     cross-mixing, so it cannot be M/S. Output is `L x (0.5 + 0.5w)`, `R x (0.5 - 0.5w)`. At
     the Sped + Reverb preset's `width: 1.2` that is `L x 1.1`, `R x -0.1` — the right channel
     inverts and nearly vanishes. **Every non-Original preset is affected.**
   - **Original is not neutral.** The limiter (-1dB, 20:1, 1ms attack) is hardwired into the
     path with no bypass. Original must be audibly neutral and level-stable.
3. Housekeeping the previous agent left behind:
   - Restore `@stylistic/no-mixed-operators` and `perfectionist/sort-imports` in
     `.oxlintrc.json`. They were switched off in the acceptance commit rather than fixing the
     code, after which the status doc reported the checks as passing.
   - Restore the auto-update menu item deleted from `src/menu.ts` and replaced with a blank line.
   - Fix `settings-panel.ts`, where **Developer Tools sends the same IPC as Plugins & Options**.
   - Fix the FX rack being `appendChild`'d **inside** the FX `<button>`, which makes every
     preset click bubble up and close the rack.
   - **Rewrite** `V1_STATUS.md`. It records the commit as the literal string `HEAD`, claims
     "6/6 Playwright tests successful" when there is one test in one file, and lists work as
     deferred that shipped two commits earlier. A false status document is worse than none,
     because the next agent reads it as authority.

**Deferred to Stage C:** the context-menu classifier. It matches items by SVG path-`d` prefix,
and the prefixes collide — `'M12,2C6'` (go-to-album) is tested before `'M12,2C6.48'`
(start-radio), so **Start radio is always misclassified as Go to album.** The in-code comment
claiming these prefixes are stable across versions is invented justification.

**Out of scope:** new features, processed-audio export, macOS/Linux, code signing, a final logo.

---

## D13 — Verification: run the app and screenshot it, as a hard gate

**Implemented. Two suites, because one mechanism could not cover both jobs.**

Every stage ends with **named screenshots of the real window**, attached before the run may be
called complete. Without that, the gate is a promise with nothing enforcing it — precisely how
the previous build graded itself.

Baseline before this: `tests/index.test.js` was the entire suite (launch, assert URL, close),
no screenshots, no `playwright.config.ts`. The shipped `V1_STATUS.md` reported "6/6 Playwright
tests successful" against **one** test in one file.

**The constraint that shaped the design.** Playwright's Electron *launcher* never surfaces a
window when the profile carries an authenticated YouTube Music session. Established by
bisection, not guesswork:

| Profile | Result |
|---|---|
| Clean / throwaway | Window in ~1s |
| Copy of the real profile | No window after 90s, `app.windows() === 0` |
| Real profile, `config.json` deleted | Still hangs — so not configuration |
| Real profile, launched normally (no Playwright) | Healthy, "Finished loading" in 9s |
| Real profile, attached over CDP | Works, fully authenticated |

The differentiator is the session itself: an authenticated profile has a registered
`music.youtube.com/sw.js` service worker; a signed-out one does not.

**So the suites split by what they need:**

- **`pnpm test`** — smoke. Playwright launches the app on a **throwaway profile**. Hermetic,
  fast (~9s), safe in CI, and mutates nothing. `tests/index.test.js` was given the same
  isolation: it asserts behaviour "with default settings", so running it against the real
  profile contradicted its own premise.
- **`pnpm test:capture`** — the gate. `scripts/capture.mjs` starts Lacquer with a free
  debugging port, attaches over CDP, runs the capture project, then tree-kills the app. Uses
  the **real authenticated profile**, because a signed-out capture shows none of the states the
  stage plans ask for. The spec asserts signed-in status and fails loudly rather than filing
  misleading evidence.

Captures are **not** diffed against golden images. Stage A deliberately makes the app look
plainer, so a pixel baseline would only encode the state being moved away from. The gate is
human review of named evidence.

Two implementation notes worth keeping: the app must be spawned as the **Electron binary
directly**, not via `npx` with a shell — a shell wrapper exits immediately, leaving the
tree-kill aimed at a dead pid and six Electron processes orphaned. And `did-finish-load` opened
DevTools whenever `is.dev()`, which is true for any unpackaged launch; that is now suppressed
under `isTesting()`.

---

## D14 — Tooling

- **`impeccable`** is the design engine. Its Operate/Experience mode taxonomy is the source of
  the two-surface split in `DESIGN.md`, and its `shape`, `typeset`, `colorize`, `layout` and
  `polish` verbs map onto the staged runs.
  - **`impeccable live` does not work here.** Its framework detectors cover
    astro/next/nuxt/sveltekit/vite-generic/static-html. There is no Electron path, and the
    renderer is a remote page with injected CSS, so there is no source file to wrap. Use the
    D13 harness instead.
- **`hallmark`** is **not used.** It is page-shaped — hero rhythm, CTA placement, mobile
  breakpoint gates, a 21-theme catalog. Lacquer has no heroes or CTAs, and its palette is
  locked, so the theme catalog would actively fight Orbit Noir.
- **`wayfinder`** is not run as a tracker. Its durable-decision-record principle is adopted
  instead: this file and `DESIGN.md` are the map, and every session reads them first.

---

## D15 — The identity is a script-L crest, re-voiced for Orbit Noir

The supplied laurel/script mark replaces the geometric record/orbit mark on every Windows
surface. It is traced as generated vector geometry on an Orbit Noir navy plate, with two
identity-only palette tokens: `--lq-champagne: #dac0a7` and
`--lq-bronze: #c38242`. The full laurel is used at 32px and above; a weighted, de-wreathed
script `L` is used below 32px and in the titlebar. In the lockup the script supplies the first
letter and the text reads `acquer`, so the visible identity reads **Lacquer**, not **LLacquer**.

`scripts/make-logo.mjs` is the geometry source and `scripts/make-icons.mjs` owns raster/ICO/tray
output. The owner's original raster is retained only as source material at
`docs/lacquer/assets/mark-source.png`; runtime assets never depend on it.

---

## D16 — The transport is identity left, controls centre, output right

The owner accepted the layout previously flagged for decision. The player bar is a structural
three-track grid: song artwork/title/artist left, previous/play/next/time centred, and output
controls right. Lacquer resets YouTube Music's absolute positioning on the identity wrapper and
assigns the three existing control groups to grid columns; YouTube Music continues to own the
controls and their responsive visibility. This keeps the order stable across layout ticks
without a JavaScript mutation loop or fragile `left:` offsets.

---

## D17 — Visualizer Mode is a persistent, player-scoped takeover

Visualizer Mode is off on a fresh install and persists its armed state in `electron-store`.
When armed it activates only on the player page. Enabling it from Browse first reveals the
player so the action has immediate visible feedback. Later Browse navigation auto-suspends the
canvas and restores full Normal Mode chrome; clicking the still-armed VIZ control returns to the
player and resumes. It is controlled from the transport, by `Ctrl+Shift+V`, and by `Escape` to
exit.

The plugin owns the canvas and safe engines; `src/lacquer/visualizer-mode.ts` owns mode state,
plugin activation and chrome choreography. **Orbital Shockwave** is the album-reactive default
and keeps the artwork as its centre. **Laser Basilica (Rave)** is a selectable, album-coloured,
artwork-free treatment. Butterchurn remains the selectable chaos engine. Paused playback drifts
rather than freezing. Chrome fades after three idle seconds and wakes on input; interactive
geometry never moves, while the canvas and artwork may react strongly. Reduced-motion and
Normal Mode remain reliable, and the real-app performance gate must remain green.

---

## Execution model

- **Sonnet 5, thinking on, high effort** for Stages A and B. The DOM archaeology, colour
  normalisation and contrast maths need it.
- **Sonnet 5, thinking off, medium effort** is sufficient for isolated mechanical work.
- One stage per fresh session. Each stage ends at its screenshot gate with a single coherent
  local commit. **Do not push.**
