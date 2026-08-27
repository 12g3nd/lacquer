# Known Issues

- **Shared Config Coupling**: Because Lacquer shares its config with Pear to prioritize session continuity, disabling a plugin in Lacquer will also disable it in Pear, and vice versa.
- **SmartScreen Warnings**: Since v1 is not code-signed with an expensive EV certificate, Windows SmartScreen will flag the installer.
- **Upstream Syncing**: Heavy UI modifications (like `lacquer.css`) may occasionally need adjustment if upstream Pear significantly refactors their DOM structure.
