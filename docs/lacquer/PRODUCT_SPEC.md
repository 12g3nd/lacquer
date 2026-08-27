# Lacquer Product Specification

## Mission
Lacquer is a public, installable Windows-first fork of Pear. It aims to function as a reliable daily YouTube Music client, prioritizing playback, navigation, and everyday usability while maintaining a visually distinct, calm, and highly polished interface.

## Design Philosophy

**The design section of this spec is superseded by
[`DESIGN.md`](./DESIGN.md), which is the single, binding source of truth for how
Lacquer looks** (locked 2026-08-27). It exists because an earlier build invented
its own palette — deep purple and neon — and shipped it; that palette is
discarded (DECISIONS.md D3). Read `DESIGN.md` and `DECISIONS.md` before any UI
work.

In brief, and only in brief: two surfaces (an always-stable **Operate** browse
shell and an album-reactive **Experience** player page); the **Orbit Noir**
palette — cobalt and navy ground, cyan and cobalt functional, violet and orange
expressive, ivory text, almost no pure black; four type voices each with one
job; colour first, imagery second, effects third. Everything specific is in
`DESIGN.md`.

## Key Features & Foundations
- **Seamless Library & Playback**: Preserves all core YouTube Music functionality through Pear's existing solid abstractions.
- **Cleaned Interface**: The native app menu is hidden by default (accessible via keyboard) for a cleaner shell. The stock YTM logo is replaced with a minimal Lacquer identity.
- **Extensive Plugin Support**: Built upon Pear's robust plugin architecture for modular features (e.g., Discord Rich Presence, lyrics, scrobbling).
- **Audio FX**: Integrated dynamic audio effects (Sped + Reverb, Slowed + Reverb, Night, Dream, etc.) via a unified Signal Chain directly accessible from the transport.
- **Editorial Visuals**: Dynamic, album-reactive visual presentation replacing standard Material Design elements with glassmorphism, precise typography, and restrained spacing.
- **Tiered Interaction**: An overhauled context menu prioritizing immediate musical actions (queueing, playlisting, FX), moving secondary actions out of sight to reduce clutter.
- **Minimalist Chrome**: Complete removal of unnecessary banners, duplicated metadata, and top-bar branding, with essential settings seamlessly tucked into a recoverability menu in the transport deck.
- **Robust Styling Architecture**: Core overrides and UI adjustments (e.g., sidebar clipping fixes) are done in a centralized `src/lacquer/` boundary, reducing hacks and ensuring maintainability.
