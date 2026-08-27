---
name: reference-absorption
description: Analyzes reference CSS, themes, screenshots, design experiments, prior Pear customizations, and external UI examples for Lacquer. Use when reference material is supplied or when extracting ideas from an existing customization without making Lacquer depend on that reference at runtime.
---

# Reference Absorption

Reference material is evidence and inspiration, never a production dependency.

## Purpose

Use supplied CSS, screenshots, themes, experiments, forks, or other visual references to understand:

- visual ideas worth preserving;
- interaction patterns worth preserving;
- implementation techniques worth learning from;
- failure modes worth avoiding.

Then implement the useful ideas properly inside Lacquer's native source architecture.

## Process

For each relevant reference:

1. Identify the visual or behavioral idea.
2. Determine how the reference implements it.
3. Inspect Lacquer/Pear's current architecture before reusing the technique.
4. Decide whether the idea belongs in Lacquer's design system.
5. Reimplement it using maintainable Lacquer source code.
6. Validate it against the running application.
7. Prefer one coherent implementation over accumulating overrides.

## Hard Rules

- Never require supplied reference files for Lacquer to run.
- Never dynamically load reference CSS or JavaScript in production.
- Never turn a temporary customization override into an undocumented runtime dependency.
- Do not blindly port whole stylesheets when only a few ideas are valuable.
- Do not reproduce reference bugs merely to preserve visual fidelity.
- Preserve useful upstream architecture whenever practical.
- Treat screenshots as design evidence, not exact pixel contracts unless explicitly instructed otherwise.

## When Several References Conflict

Prefer, in order:

1. explicit current user direction;
2. Lacquer's established product/design system;
3. functionality and accessibility;
4. architectural maintainability;
5. the strongest reference idea.

Document meaningful design decisions when future agents would otherwise have to rediscover them.