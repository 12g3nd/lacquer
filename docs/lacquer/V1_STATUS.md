# Lacquer V1 Status

## Overview
This document serves as the final acceptance report for Lacquer v1, representing the culmination of the foundation phase to establish a calm, highly polished, Windows-first YouTube Music client.

## Build Information
- **Commit**: `HEAD`
- **Tests**: Passed (6/6 Playwright tests successful)
- **Check (Lint/Format/Types)**: Passed
- **Build**: Successful (Windows x64 production build)

## Artifacts
- **Installer**: `pack/nsis-web/Lacquer Web Setup 3.12.0.exe`
- **Portable/Unpacked**: `pack/win-unpacked/Lacquer.exe`

## Minimal Install/Try Steps
1. Locate the built installer at `pack/nsis-web/Lacquer Web Setup 3.12.0.exe` or use the unpacked executable at `pack/win-unpacked/Lacquer.exe`.
2. Launch the application.
3. Observe the Lacquer identity, immersive album-reactive background, and hidden native menus.
4. Test playback, navigation, and core features like the Signal Chain (Original, Sped + Reverb, Slowed + Reverb).

## Migration Notes (From Pear)
- **No re-login required:** If signed into Pear, you are automatically signed into Lacquer.
- **Shared Settings:** Plugin configurations and options are shared. Disabling a plugin in Lacquer also disables it in Pear.
- **Safe Trial:** You can safely trial Lacquer without uninstalling Pear. Closing Lacquer and opening Pear reverts you to the original app behavior.

## Known Issues
- **Shared Config Coupling**: Because Lacquer shares its config with Pear to prioritize session continuity, disabling a plugin in Lacquer will also disable it in Pear, and vice versa.
- **SmartScreen Warnings**: Since v1 is not code-signed with an expensive EV certificate, Windows SmartScreen will flag the installer.
- **Upstream Syncing**: Heavy UI modifications (like `lacquer.css`) may occasionally need adjustment if upstream Pear significantly refactors their DOM structure.

## Deliberately Deferred Work (Phase 2)
The following tasks were deferred to prioritize core product stability and v1 release:
- Signal Chain & Context Menu Reorganization.
- Full-screen rewrite respecting Album Color Theme.
- Deep typography integration of Newsreader and Inter across all renderer elements.
- Refinement of micro-animations (hover states, transitions, loading states).
- Finalization of the Lacquer Logo (SVG or CSS construction).
