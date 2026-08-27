# Lacquer Architecture

## Overview
Lacquer is a maintainable layer on top of the `pear-desktop` Electron
application. It respects existing process boundaries (main, preload, renderer)
and the plugin architecture. The visual layer is being rebuilt as authored
components over three bounded stages — see `docs/lacquer/DECISIONS.md` (D1) and
`docs/lacquer/plans/`. How it should look is governed by
`docs/lacquer/DESIGN.md`, which is binding.

## Boundaries

- **Main Process** — native integration, window management, and configuration
  via `electron-store`. Lacquer-specific changes: the frameless one-row window
  shell and native Controls Overlay (`createMainWindow` in `src/index.ts`, D8),
  the D11 default plugin set (`src/config/defaults.ts` + the merge in
  `src/config/plugins.ts`), the one-time Pear session carry-over
  (`src/lacquer/session-migration.ts`, D9), identity (`package.json`,
  `electron-builder.yml`), and two IPC handlers for the settings menu
  (`src/providers/app-controls.ts`).
- **Renderer Process** — the YouTube Music web app is loaded remotely. Lacquer
  injects CSS (from the main process, in `initTheme`) and a small set of
  renderer modules under `src/lacquer/`.

## The Lacquer layer (`src/lacquer/`)

CSS does two jobs only (D1/D2): suppress stock chrome, and theme what remains.
Structure is authored in renderer modules, never in a global `!important`
sheet — the 364-line `lacquer.css` that did that is deleted.

- `tokens.css` — the Orbit Noir design tokens under `--lq-*` (palette, spacing,
  radii, motion, type roles). `:root` only. `DESIGN.md` §3/§5/§6 in
  machine-readable form.
- `fonts.css` — the four type voices (Newsreader, Space Grotesk, Inter, IBM
  Plex Mono) loaded locally via `@fontsource`. Bound to `--lq-font-*` tokens.
  No global `font-family` rule. Bundled as `data:` URIs at build time — no
  runtime network font requests.
- `suppress.css` — removes/de-brands stock YouTube Music chrome (ground colour,
  red brand custom properties, the stock wordmark, the nav-bar material, the
  focus ring). It removes; it does not author.
- `titlebar.ts` — draws the "Lacquer" wordmark and relocates back/forward to
  the rail top (Stage A slice of D8). One-shot injection.
- `dom.ts` — `whenElement(selector)`, one shared `MutationObserver` for
  "inject once this mounts", used by `titlebar.ts`, `fx-rack.ts`,
  `settings-panel.ts`.
- `settings-panel.ts` — the transport gear menu (Plugins & Options → opens
  `config.json`; Reload; Developer Tools).
- `fx-rack.ts` — the FX preset rack in the transport (full rebuild is Stage C).
- `context-menu.ts` — the tiered context menu (classifier fix is Stage C).
- `signal-chain.ts` — the unified Web Audio graph. Mid/side width and a
  bypassable limiter; **Original is neutral**. `audio-compressor`, `equalizer`,
  `playback-speed` etc. are routed through it and are off by default (D11) so
  there is never a second audio graph.
- `session-migration.ts` — one-time Pear session/cookie carry-over (D9).

*Injection*: `tokens.css`, `fonts.css` and `suppress.css` are injected in that
order during `initTheme` in `src/index.ts`. Renderer modules are initialised
from `src/renderer.ts` once the player API is ready.

## Configuration

Lacquer has its own `userData` (`<appData>/Lacquer`, D9). The D11 default
plugin set lives in `src/config/defaults.ts`, and `config.plugins.getPlugins()`
merges it underneath the stored plugin map so it survives `electron-store`'s
shallow merge of the `plugins` key (see `KNOWN_ISSUES.md`). The user's stored
choice wins on any plugin they have actually set.

## Plugin System

Lacquer retains the Pear plugin loader (`src/loader/`, `src/plugins/`). D11
fixes the default set; `album-color-theme` is on and non-optional. Plugins that
would create a competing audio graph or a competing visual layer are off by
default and must stay off.

## Extension points

- Prefer tokens and authored components over isolated DOM hacks.
- `src/lacquer/` is the safe boundary. Fragile areas: selectors that target
  stock YouTube Music DOM (`suppress.css`, the renderer injection modules), and
  observer-driven logic in upstream Pear plugins.
- Do not edit `src/plugins/in-app-menu/renderer/TitleBar.tsx` (D8) or
  `src/music-player.css` (upstream-maintained) — build alongside them.

## Commands

- `pnpm dev` — start in development mode.
- `pnpm check` — `oxlint` + `oxfmt --check` + `tsc --noEmit`.
- `pnpm build` — production bundles.
- `pnpm test` — the smoke suite (throwaway profile, hermetic).
- `pnpm test:capture` — the stage screenshot gate (real profile over CDP).
