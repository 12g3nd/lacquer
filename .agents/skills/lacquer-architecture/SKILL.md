---
name: lacquer-architecture
description: Concise architecture reference for Lacquer (a Pear-desktop fork). Use this when navigating or modifying the Lacquer codebase.
---

# Lacquer Architecture

Lacquer is a Windows-first fork of Pear (a YouTube Music client). 
It relies on Pear's architecture but introduces a `src/lacquer/` stylistic layer.

## Process Boundaries
- **Main**: Sets up the Electron window (`src/index.ts`), manages the native menu (`src/menu.ts`), handles config (`src/config/`), and loads plugins (`src/loader/main.ts`).
- **Preload**: Bridges the node environment to the renderer.
- **Renderer**: The actual YouTube Music DOM. Styles and scripts are injected by Pear's plugin loader.

## Plugin Lifecycle
- Plugins are located in `src/plugins/`.
- They are loaded dynamically. Each plugin has a `config` (in `package.json` or defined internally) and can inject CSS/JS into the renderer.
- The `album-color-theme` plugin is critical for the visual atmosphere.

## Renderer/Style Injection Architecture
- CSS files are injected into `win.webContents` using `injectCSS(webContents, cssString)`.
- Core Lacquer styling is located in `src/lacquer/` (tokens, fonts, layout fixes) and is injected during `initTheme` in `src/index.ts`.

## Configuration/State Persistence
- Driven by `electron-store` (see `src/config/`).
- The `name` in `package.json` (`youtube-music`) remains unchanged to preserve `userData` (session, login, config) consistency.

## Lacquer-Owned Source Boundaries
- `src/lacquer/`: Safe space for new CSS tokens, font declarations, and visual overrides.
- `docs/lacquer/`: Lacquer specific documentation.
- When modifying the UI, prefer adding to `src/lacquer/lacquer.css` over creating new upstream plugins.

## Fragile Areas
- `src/index.ts` lifecycle hooks (window creation, webRequest interception).
- Extracted data providers (`src/providers/`).
- Pear's complex MutationObserver logic in certain plugins.

## Canonical Commands
- Development: `pnpm dev`
- Checks: `pnpm check` (linting, formatting, typecheck)
- Tests: `pnpm test` (Playwright)
- Build: `pnpm build`
