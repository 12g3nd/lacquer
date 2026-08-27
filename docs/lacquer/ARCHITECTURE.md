# Lacquer Architecture

## Overview
Lacquer is built as a maintainable layer on top of the `pear-desktop` Electron application. It respects existing process boundaries (main, preload, renderer) and the plugin architecture.

## Boundaries
- **Main Process**: Handles native integration, window management, and configuration via `electron-store`. Lacquer-specific changes here are minimal, mainly concerning the window title, menu defaults (`src/config/defaults.ts`), and identity (`package.json`, `electron-builder.yml`).
- **Renderer Process**: The YouTube Music web application is loaded in the renderer. Pear injects custom CSS and JavaScript.
- **Lacquer Layer (`src/lacquer/`)**: 
  - `tokens.css`: Core design variables and Orbit Noir fallbacks.
  - `fonts.css`: Local font definitions imported via `@fontsource`.
  - `lacquer.css`: The primary styling entry point. It hides stock branding, applies foundational fixes, and sets global typography.
  - *Injection*: `lacquer.css` is statically injected into the renderer during the `initTheme` phase in `src/index.ts`.

## Plugin System
Lacquer retains the robust Pear plugin loader (`src/plugins/`).
- **Album Color Theme**: Used to drive the primary album-reactive design. Lacquer's UI elements are built to adapt to the `--ytmusic-album-color-*` variables emitted by this plugin.

## Extension Points
- Visual changes should prefer centralized CSS tokens over isolated DOM hacks.
- The `src/lacquer/` boundary is safe for most UI modifications. Fragile areas include complex observer-driven logic in Pear plugins.

## Commands
- `pnpm dev`: Start the application in development mode.
- `pnpm check`: Run linting, formatting, and type-checking.
- `pnpm build`: Create production bundles.
