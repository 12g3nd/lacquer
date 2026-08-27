# Lacquer Product Specification

## Mission
Lacquer is a public, installable Windows-first fork of Pear. It aims to function as a reliable daily YouTube Music client, prioritizing playback, navigation, and everyday usability while maintaining a visually distinct, calm, and highly polished interface.

## Design Philosophy
- **Album-reactive Atmosphere**: The primary aesthetic is driven by the currently playing album's artwork. Large, centered artwork and deeply tinted surfaces form the core visual identity.
- **Calm & Polished**: Avoid generic web styling and unnecessary clutter. Provide a premium, focused experience that feels native and purposeful.
- **Fallback (Orbit Noir)**: When album artwork is unavailable, the fallback design is "Orbit Noir"—a colorful, retrofuturist look (incorporating deep purples and neon accents), moving away from generic dark grey.
- **Restrained Typography**: Utilizes a combination of high-quality local fonts (Inter for UI, Newsreader for accents/serifs, IBM Plex Mono for monospace), avoiding network runtime imports.
- **Reliability First**: Visual experiments must never compromise readability, discoverability, or interaction reliability.

## Key Features & Foundations
- **Seamless Library & Playback**: Preserves all core YouTube Music functionality through Pear's existing solid abstractions.
- **Cleaned Interface**: The native app menu is hidden by default (accessible via keyboard) for a cleaner shell. The stock YTM logo is replaced with a minimal Lacquer identity.
- **Extensive Plugin Support**: Built upon Pear's robust plugin architecture for modular features (e.g., Discord Rich Presence, lyrics, scrobbling).
- **Audio FX**: Integrated dynamic audio effects (Sped + Reverb, Slowed + Reverb, Night, Dream, etc.) via a unified Signal Chain directly accessible from the transport.
- **Editorial Visuals**: Dynamic, album-reactive visual presentation replacing standard Material Design elements with glassmorphism, precise typography, and restrained spacing.
- **Tiered Interaction**: An overhauled context menu prioritizing immediate musical actions (queueing, playlisting, FX), moving secondary actions out of sight to reduce clutter.
- **Minimalist Chrome**: Complete removal of unnecessary banners, duplicated metadata, and top-bar branding, with essential settings seamlessly tucked into a recoverability menu in the transport deck.
- **Robust Styling Architecture**: Core overrides and UI adjustments (e.g., sidebar clipping fixes) are done in a centralized `src/lacquer/` boundary, reducing hacks and ensuring maintainability.
