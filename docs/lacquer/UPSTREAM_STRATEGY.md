# Upstream Strategy

Lacquer is a fork of `pear-desktop`. To ensure long-term viability, it must remain reasonably mergeable with the upstream repository.

## Rules of Engagement
1. **Never rewrite history**: The `upstream` remote must point to `https://github.com/pear-devs/pear-desktop.git`. Upstream changes should be pulled and merged cleanly. Avoid force-pushing `main` or rebasing over merged upstream commits if possible.
2. **Minimize Upstream Conflicts**: 
   - Favor creating new files (like `src/lacquer/lacquer.css`) over directly mutating large upstream files when adding new functionality.
   - Inject these new files concisely (e.g., a one-line `injectCSS` call in `src/index.ts`).
3. **Preserve Upstream Abstractions**: 
   - Do not rebuild the plugin system, menu generation, or core Electron lifecycle unless absolutely necessary.
   - Use the `electron-store` based config manager (`src/config/`) as provided.
4. **Isolate Lacquer Identity**:
   - `productName` is changed, but `name` in `package.json` and the `appId` remain unchanged to maintain `userData` continuity for the user.
5. **Clear Commit Strategy**:
   - Lacquer-specific changes should be grouped into clear, logical commits (e.g., "feat: Lacquer foundation"). This helps isolate our changes from upstream during a `git diff`.
