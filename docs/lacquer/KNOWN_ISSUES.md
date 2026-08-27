# Known Issues

- **Shared Config Coupling**: Because Lacquer shares its config with Pear to prioritize session continuity, disabling a plugin in Lacquer will also disable it in Pear, and vice versa.
- **SmartScreen Warnings**: Since v1 is not code-signed with an expensive EV certificate, Windows SmartScreen will flag the installer.
- **Upstream Syncing**: Heavy UI modifications (like `lacquer.css`) may occasionally need adjustment if upstream Pear significantly refactors their DOM structure.
- **Typography and UI Micro-Animations**: Typography passes (deep integration of Newsreader and Inter) and micro-animations for hover states and transitions are deferred to Phase 2.
- **Full-Screen Rewrite**: The immersive full-screen view respecting Album Color Theme is deferred to Phase 2.
- **Signal Chain & Context Menu Reorganization**: Clean-up of context menus is deferred.
- **Lacquer Logo**: The logo is a placeholder and is yet to be finalized (SVG or CSS construction).
