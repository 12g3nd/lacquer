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
- Plugins & Options (opens `config.json` via `lacquer:edit-config` — works with `in-app-menu` off, D8)
- Reload
- Developer Tools (`lacquer:toggle-dev-tools`)

Pressing `Alt` on Windows continues to reveal the native system menu. Account
access moved from the titlebar to the rail footer in Stage B (D8).

## Album-Color Contrast Strategy
**Superseded by `DESIGN.md` §3.4 and the Stage B implementation.** Lacquer does
**not** consume `--ytmusic-album-color*` directly. `src/lacquer/album-color.ts`
(B1) reads the plugin's raw triple, normalises it in OKLCH into contrast-safe
bands, and publishes its own `--lq-album-*` set (`atmosphere`, `fill`, `veil`,
`ink`), falling back to Orbit Noir for near-monochrome extraction.
- Only the player-page atmosphere, the transport tint, the progress fill and the
  play/pause button take album colour (D6). Focus rings, keyboard selection,
  active nav, toggles and every text colour stay Ion/Signal on every screen.
- Text laid over artwork sits on an Instrument surface or a `--lq-album-veil`
  scrim — **never a `text-shadow`** (the shipped build's approach, now removed).
  Lyrics render on an opaque Instrument panel.

## Shortcuts
Lacquer introduces new configurable shortcuts in the standard Options > Shortcuts menu:
- `fxRackToggle`: Open/close the FX rack
- `fxOriginal`: Reset to Original preset
- `fxSpedReverb`: Apply Sped + Reverb
- `fxSlowedReverb`: Apply Slowed + Reverb

These map to IPC events that instruct the Signal Chain to switch instantly.
