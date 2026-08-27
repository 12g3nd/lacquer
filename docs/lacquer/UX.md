# Lacquer UX Architecture

## Context Menu
The context menu in Lacquer is reorganized from the standard YouTube Music implementation to prioritize immediate musical actions.

### Tier 1 (Always Visible)
- Play next, Add to queue, Save to playlist
- **FX Actions**: Sped + Reverb, Slowed + Reverb, FX… (opens the full rack)
- **Navigation**: Go to album, Go to artist
- **More…**: Expands the secondary tier

### Tier 2 (Inside "More…")
- Remove from library / liked
- Remove from queue
- Download
- Credits
- Share
- Report
- Start radio, Shuffle play, Play

The menu dynamically hides irrelevant items (e.g., "Go to album" is hidden if already on the album page; "Remove from queue" is only shown when the queue is active).

## Settings & Recoverability
To maintain a clean, immersive interface, the native menu bar is hidden by default. A gear icon is injected into the bottom transport deck (next to the FX button). Clicking this button provides a quick-access menu for:
- Plugins & Options (toggles the in-app menu)
- Reload
- Developer Tools

Pressing `Alt` on Windows continues to reveal the native system menu.

## Album-Color Contrast Strategy
Lacquer heavily utilizes `ytmusic-album-color` and `ytmusic-album-color-dark` provided by the Pear backend. To prevent unreadable interfaces:
- The ambient background (`--lacquer-album-tint`) has a baseline opacity.
- Critical text overlays, such as lyrics, receive a `text-shadow` to ensure legibility against extremely bright or saturated artwork.
- Focus rings for accessibility use the primary accent color (`--lacquer-album-accent`) with a high-contrast offset.

## Shortcuts
Lacquer introduces new configurable shortcuts in the standard Options > Shortcuts menu:
- `fxRackToggle`: Open/close the FX rack
- `fxOriginal`: Reset to Original preset
- `fxSpedReverb`: Apply Sped + Reverb
- `fxSlowedReverb`: Apply Slowed + Reverb

These map to IPC events that instruct the Signal Chain to switch instantly.
