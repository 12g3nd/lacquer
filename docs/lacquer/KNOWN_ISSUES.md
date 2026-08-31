# Known Issues

Accurate as of the end of Stage B. See `docs/lacquer/V1_STATUS.md` for what
Stages A and B changed and `docs/lacquer/plans/STAGE_C.md` for what remains.

## Current

- **Transport layout is YouTube Music's, not B3's.** B3 asks for identity-left /
  transport-centre; YTM positions the now-playing block absolutely at the bar
  centre and manages the bar with responsive JS. Reordering it is inert against
  the absolute positioning, and forcing it means fighting YTM every layout tick —
  against the constitution's "reliability over visual experimentation". The deck
  is kept in YTM's arrangement and made Lacquer through material, the album
  controls, the mono time and the hairline. Flagged for the owner to call.

- **The account footer can sit below the fold** on a tall window with many
  playlists — it is pinned to the bottom of `#guide-renderer` (clear of the
  transport) while `#sections` scrolls above it, so it is always reachable by
  scrolling the rail, but it is not sticky-on-top-of-the-scroll. Revisit if it
  proves annoying.

- **The browse "immersive header" is not Orbit Noir.** Some browse routes (album
  and playlist detail pages) render YTM's own art-derived gradient hero behind
  the content well. It is the browse *feed*, not the rail (which never reacts),
  and it is outside B2–B5's scope, but D5 wants the browse shell permanently
  Orbit Noir. A small suppression belongs in a later housekeeping pass.

- **Menus, popovers and the search-suggestions panel are still unstyled.** They
  read as plain dark YouTube Music surfaces. The Blueglass material for
  transient surfaces (§4) is applied to the FX rack and settings menu; the
  YTM-native context menus and search suggestions are not yet themed.

- **`@stylistic/no-mixed-operators` excludes the arithmetic operator family.**
  The rule and `oxfmt` make opposite demands about clarifying parentheses in
  arithmetic and cannot both be satisfied (see V1_STATUS.md). The rule is
  restored and enforced for logical, comparison, `in`/`instanceof` and bitwise
  mixes. Revisit if the formatter gains an option to preserve those parens.

- **D11 defaults on a pre-existing profile.** `electron-store` shallow-merges
  the `plugins` key, so `defaults.ts` alone does not reach a profile that
  already has any `plugins` entry. `config.plugins.getPlugins()` now merges the
  D11 table underneath the stored map to compensate; a genuinely clean profile
  is covered by `defaults.ts` directly and by the smoke suite.

- **SmartScreen warnings.** v1 is not code-signed with an EV certificate, so
  Windows SmartScreen flags the installer. Code signing is explicitly out of
  scope (D12).

- **Upstream merge surface.** The suppression sheet, the four adopted region
  sheets and the renderer injection modules target stock YouTube Music selectors
  and may need adjustment if upstream Pear or YouTube Music refactors that DOM.
  Contained to `src/lacquer/`; no `!important` component sheet remains.

- **`album-color-theme`'s extraction is grey-prone.** It averages the *smallest*
  thumbnail with `fast-average-color` and darkens hard; busy covers and every
  music-video thumbnail land near-neutral, so B1 falls back to Orbit Noir more
  often than the artwork would suggest. B1 is correct (normalise whatever it
  gets, fall back rather than wash); a better extractor is a possible future
  Stage C item, not a Stage B defect.

- **Capture harness: opening the player-page overlay over CDP is state-sensitive.**
  `stage-b.capture.spec.ts` hard-navigates to home (`page.goto`) as test setup
  before playing, because a prior spec's route/focus can leave the overlay
  toggle inert. This is a test-infra workaround, not app behaviour — the toggle
  works normally in the running app.

## Deferred by plan

- **Stage C** — FX rack rebuild; the context-menu classifier (it matches menu
  items by SVG path-`d` prefix and the prefixes collide, so "Start radio" is
  currently misclassified as "Go to album"); motion pass; the SVG wordmark.
- **Out of scope entirely** (D12) — new features, processed-audio export,
  macOS/Linux, code signing, a final logo.
