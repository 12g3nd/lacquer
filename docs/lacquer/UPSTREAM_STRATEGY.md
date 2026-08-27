# Upstream Strategy

Lacquer is a fork of [Pear (YouTube Music Desktop App)](https://github.com/pear-devs/pear-desktop).

## Philosophy
We aim to maintain a small, intentional diff against Pear. This allows us to pull upstream bug fixes, new plugins, and YouTube Music API adaptations with minimal conflict, while layering on our Windows 11 UI optimizations.

## Rules
- Keep core electron IPC and architectural patterns intact.
- Avoid large monolithic rewrites of Pear's core plugin system.
- Prefer CSS changes and isolated React component injections for UI modifications.
- Explicitly disable features (like the auto-updater) that are dangerous in a fork environment.
