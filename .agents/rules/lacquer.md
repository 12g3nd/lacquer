---
trigger: always_on
---

# Lacquer Workspace Constitution

## Product
- Lacquer is a public, installable Windows-first fork of Pear and should function as a reliable daily YouTube Music client.
- Preserve useful Pear and YouTube Music functionality. Reliability, playback, navigation, authentication, library behavior, and everyday usability take precedence over visual experimentation.
- Lacquer should ultimately feel visually distinct from stock YouTube Music and Pear, not merely like a CSS skin.

## Design
- Preserve the large centered artwork and album-reactive visual atmosphere as core Lacquer design anchors unless explicitly instructed otherwise.
- Aim for a beautiful, calm, highly polished interface with personality. Avoid generic YouTube styling, unnecessary clutter, gratuitous dashboard UI, and gamer-style visual excess.
- Prefer album-tinted surfaces, intentional typography, restrained spacing/radii, subtle motion, and strong contrast across dark, bright, and highly saturated album artwork.
- Orbit Noir is the fallback visual language when album-derived color is unavailable. It should be colorful and retrofuturist, not predominantly black or grey.
- Visual ambition must not compromise readability, discoverability, accessibility, or interaction reliability.

## Architecture
- Inspect the existing architecture before making substantial changes.
- Prefer maintainable source-level changes over hacks, patches, injected overrides, or fragile DOM manipulation.
- Respect Electron process boundaries and existing Pear architecture unless there is a strong reason to change them.
- Avoid unnecessary large rewrites when a well-contained architectural change will accomplish the goal.
- Keep Lacquer reasonably mergeable with future Pear upstream changes.

## References
- Supplied CSS, configuration files, screenshots, themes, and other prior customizations are reference material only.
- Extract useful ideas and implementation techniques from references, then implement them properly in Lacquer's source.
- Never create a runtime dependency on local reference files or require reference CSS/config overrides for Lacquer to function.
- Do not blindly reproduce every attractive reference detail. Prefer a coherent Lacquer design system.

## Performance
- Optimize for Windows 11 daily use on the target ThinkPad.
- Keep animations, blur, album-reactive effects, DOM work, and observers lightweight.
- Avoid expensive polling, MutationObserver storms, repeated full-DOM scans, unnecessary listeners, duplicated audio graphs, memory leaks, and uncontrolled background work.
- Measure or profile when the performance impact of an implementation is uncertain.
- Effects described as real-time must actually respond in real time.

## Validation
- Do not declare meaningful changes complete solely because the code compiles.
- Run the relevant lint, typecheck, tests, build, and application smoke tests when available.
- For UI changes, visually inspect the real application.
- Check maximized, normal/resized, and narrower supported window states where relevant.
- Test important scroll positions, long titles, playback states, album/playlist views, and dark/bright/saturated album art.
- Specifically watch for clipping, sticky-header collisions, occlusion, overflow, layout jumps, unreadable contrast, broken hit targets, and displaced artwork.
- Use bounded validation passes rather than endless pixel-polishing loops.

## Git and Safety
- Preserve repository history and the intended upstream relationship.
- Never force-push, rewrite history, destructively reset, delete important branches, publish releases, or push remote changes without explicit user approval.
- Coherent local commits are allowed when they improve checkpointing and reviewability.
- Keep generated files, local reference material, credentials, secrets, and machine-specific artifacts out of version control unless explicitly intended.

## Working Style
- Be autonomous on small, reversible implementation decisions.
- Ask before decisions that materially change product direction, architecture, public API behavior, repository history, or irreversible state.
- Prefer evidence from the codebase and running application over assumptions.
- When several solutions work, prefer the one that is maintainable, understandable, performant, and least likely to create future upstream conflicts.