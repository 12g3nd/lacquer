# Lacquer — Status

**Rewritten at the end of Stage A.** The previous version of this file recorded
the commit as the literal string `HEAD`, claimed "6/6 Playwright tests
successful" against a single test in a single file, said settings were "shared"
with Pear when they are not, and listed as deferred several things that had
already shipped. This is the accurate record.

---

## Where the work is

Lacquer's visual layer is being rebuilt as authored components across three
bounded stages (DECISIONS.md D1). The authority for how it should look is
`docs/lacquer/DESIGN.md`; the closed decisions are in `docs/lacquer/DECISIONS.md`.

| Stage | Scope | State |
|---|---|---|
| **A** | Foundation & spine — tokens, fonts, window shell, config integrity, audio bug fixes, verification harness, housekeeping | **complete** (this commit) |
| **B** | Authored left rail and transport deck; player-page atmosphere; album-colour normalisation and contrast safety | not started |
| **C** | FX rack rebuild; context-menu classifier; motion pass; SVG wordmark | not started |

**Stage A deliberately makes the app look plainer than the shipped build.** The
purple wash and magenta play button are gone and nothing decorative replaces
them yet. That is the plan working: Orbit Noir's order is colour first, imagery
second, effects third.

---

## Build information

- **Branch:** `lacquer/orbit-noir`
- **Parent commit:** `539b53d9` (`fix(lacquer): make the capture gate actually work against a real session`)
- **App version:** `3.12.0` (unchanged — Stage A is not a release)
- **`pnpm build`:** succeeds (`electron-vite build`, Windows x64).
- **`pnpm check`:** passes — `oxlint` (0 errors; 17 pre-existing `solid(reactivity)` warnings, unchanged from the parent), `oxfmt --check` clean, `tsc --noEmit` clean.
- **`pnpm test`** (smoke, throwaway profile): **7 passed** —
  - `tests/index.test.js` — app launches and is visible with default settings.
  - `tests/lacquer/signal-chain-width.smoke.spec.ts` — proves the width stage cross-mixes (mid/side), the regression guard for A6.
  - `tests/lacquer/plugin-defaults.smoke.spec.ts` (×4) — the D11 table is complete in `defaults.ts`, applies on a clean profile, survives a profile that already has a `plugins` key, and yields to an explicit user choice.
  - `tests/lacquer/shell.smoke.spec.ts` — `in-app-menu` does not mount (the two-strips-to-one collapse) and the stock wordmark is suppressed.
- **`pnpm test:capture`** (the gate, real authenticated profile over CDP): `tests/lacquer/stage-a.capture.spec.ts` passes and writes the eight named states from the Stage A screenshot-gate table into `test-results/capture/`, plus a resolved-plugin-state dump. On the owner's real profile that dump reads
  `album-color-theme / do-not-track / sponsorblock / synced-lyrics: true`,
  `in-app-menu / equalizer / visualizer / ambient-mode: false` — i.e. the D11
  merge reaches the polluted config. See the stage report for the attached
  images.
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
  row: the de-branded stock `ytmusic-nav-bar` with the "Lacquer" wordmark
  (Space Grotesk) where the stock logo was. Window controls are the native
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
