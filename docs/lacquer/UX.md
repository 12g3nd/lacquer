# Lacquer UX Architecture

## Context Menu

The track / item context menu is reorganised from the stock YouTube Music
implementation into two tiers that put the immediate musical actions first.
Items are identified by the classifier in `context-menu-classify.ts` — `iconType`
first, then the navigation/service endpoint (with a `pageType` on browse
endpoints) — never by icon path geometry.

### Tier 1 (always visible)

- Play next, Add to queue, Save to playlist
- **FX**: Sped + Reverb, Slowed + Reverb, FX… (opens the rack)
- **Navigation**: Go to album, Go to artist
- **More…** — reveals the secondary tier

### Tier 2 (revealed by More…)

Remove from library / liked, Remove from queue, Dismiss queue, Download,
Credits, Share, Report, Start radio, Shuffle, Play — and anything the classifier
could not place. Nothing is ever dropped; every stock action stays reachable
under More…

Lacquer does **not** second-guess which items are relevant — YouTube Music
already composes each menu for its own context (it omits "Go to album" on an
album page, and only includes "Remove from queue" for a queued item). The
earlier `isContextRelevant` gate was removed: it hid "Remove from queue" unless
the inspector tab read "queue", but that tab is labelled "Up next", so the
action was unreachable everywhere.

### Keyboard

The `tp-yt-paper-listbox` stays flat (tier 2 items are just `hidden`), and
`context-menu.ts` runs its own roving-focus keyboard controller: Up/Down with
wrap, Home/End, Escape (proper close, restoring focus to the trigger),
Enter/Space to activate, and type-ahead. Focus is Ion, from the global
`:focus-visible` ring.

Styling: Blueglass (§4 — a transient floating surface), Interface voice.

## FX Rack

The FX rack (opened from the transport's **FX** button, the context menu's
**FX…**, or the `fxRackToggle` shortcut) is an analog-hi-fi instrument panel in
Blueglass:

- **Presets** — Original, Sped + Reverb, Slowed + Reverb, Dream, Tape, Night.
  The active preset is a filled Ion chip. Switching a preset is immediate and
  clears any parameter overrides.
- **Speed** slider + mono readout, and a **Pitch** mode toggle (Varispeed /
  Lock — `preservesPitch`).
- **Reverb** wet slider + readout, and a **Room** character toggle
  (Off / Room / Hall / Cath).
- **Width** slider + readout.
- **EQ** — a summary (Flat / _n_ bands); full EQ editing is not surfaced.
- **Bypass** — forces Original; pressed while on Original restores the last
  preset.
- A restrained output meter off the shared analyser tap, running only while the
  rack is open.

Parameter tweaks ride on top of the active preset (a Solar dot marks a moved
parameter) and engage the limiter for clip safety. Preset + overrides persist
in `localStorage` (`lacquer.fx`). The panel is a proper popover: focus enters on
open, Tab is trapped, Escape closes and returns focus to the FX button,
click-outside dismisses.

## Settings & Recoverability

The native menu bar is hidden by default (`in-app-menu` off, D8). A gear button
next to the FX button opens a quick menu:

- Plugins & Options (opens `config.json` via `lacquer:edit-config` — works with
  `in-app-menu` off)
- Reload
- Developer Tools (`lacquer:toggle-dev-tools`)

Pressing `Alt` on Windows still reveals the native system menu. Account access
lives in the rail footer (D8).

## Wordmark

The titlebar wordmark is a real inline SVG mark (`titlebar.ts`) — a lacquered
record against a tilted orbit, with a spectral-diffraction arc off the disc
edge — beside "Lacquer" in Space Grotesk. All colour lives in `titlebar.css`.
`assets/icon.svg` is the standalone glyph; `pnpm make:icons` rasterises it into
the PNG and ICO the app and installer use.

## Album-Color Contrast Strategy

**Superseded by `DESIGN.md` §3.4 and the Stage B implementation.** Lacquer does
**not** consume `--ytmusic-album-color*` directly. `src/lacquer/album-color.ts`
(B1) reads the plugin's raw triple, normalises it in OKLCH into contrast-safe
bands, and publishes its own `--lq-album-*` set (`atmosphere`, `fill`, `veil`,
`ink`), falling back to Orbit Noir for near-monochrome extraction.

- Only the player-page atmosphere, the transport tint, the progress fill and the
  play/pause button take album colour (D6). Focus rings, keyboard selection,
  active nav, toggles, every text colour, the rail, the browse shell and the FX
  rack stay Ion/Signal on every screen.
- Text laid over artwork sits on an Instrument surface or a `--lq-album-veil`
  scrim — never a `text-shadow`.

## Shortcuts

Configurable in Options > Shortcuts:

- `fxRackToggle`: open/close the FX rack
- `fxOriginal`: reset to Original
- `fxSpedReverb`: apply Sped + Reverb
- `fxSlowedReverb`: apply Slowed + Reverb

These map to IPC events that instruct the Signal Chain to switch instantly.
