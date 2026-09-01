# Known Issues

Accurate as of the end of Stage C. See `docs/lacquer/V1_STATUS.md` for what
each stage changed.

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

- **Lyrics provider strip is compact but tight.** Stage C collapsed the stock
  ~80px picker (which hung a stray band below the tab strip) into a single
  opaque row — chevrons plus the provider name, dot row removed. The stray band
  is resolved. The provider-name carousel still clips the adjacent providers'
  names mid-transition; a proper single-label picker would need touching the
  plugin's Solid component, which is out of scope.

- **Search-suggestions panel is still unstyled.** It reads as a plain dark
  YouTube Music surface. The context menu and the FX rack / settings menu carry
  the Blueglass material now; the search dropdown does not.

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

- **Windows icon is a hand-assembled PNG-in-ICO.** `scripts/make-icons.mjs`
  rasterises `assets/icon.svg` through an offscreen Electron window (no
  ImageMagick / sharp in the toolchain) and writes a PNG-in-ICO, which Windows
  10/11 read directly. `electron-builder` regenerates its own installer icon
  from `assets/icon.png` at package time. macOS `.icns` is untouched (D12).

- **SmartScreen warnings.** v1 is not code-signed with an EV certificate, so
  Windows SmartScreen flags the installer. Code signing is explicitly out of
  scope (D12).

- **Upstream merge surface.** The suppression sheet, the adopted region sheets
  and the renderer injection modules target stock YouTube Music selectors and
  may need adjustment if upstream Pear or YouTube Music refactors that DOM.
  Contained to `src/lacquer/`; no `!important` component sheet remains.

- **`album-color-theme`'s extraction is grey-prone.** It averages the *smallest*
  thumbnail with `fast-average-color` and darkens hard; busy covers and every
  music-video thumbnail land near-neutral, so B1 falls back to Orbit Noir more
  often than the artwork would suggest. B1 is correct (normalise whatever it
  gets, fall back rather than wash); a better extractor is possible future work.

- **Capture harness: opening the player-page overlay over CDP is state-sensitive.**
  `stage-b.capture.spec.ts` and `stage-c.capture.spec.ts` hard-navigate to home
  (`page.goto`) as test setup before playing, because a prior spec's
  route/focus can leave the overlay toggle inert. This is a test-infra
  workaround, not app behaviour — the toggle works normally in the running app.

## Resolved in Stage C

- FX rack rebuilt as an instrument panel using Lacquer tokens and Instrument
  type; parameter surface exposed.
- Context-menu classifier no longer depends on SVG path geometry (done in its
  own commit); keyboard navigation and a proper `closeMenu()` added this stage.
- Motion is token-driven and `prefers-reduced-motion` is respected.
- The wordmark is a real inline SVG mark; Windows icon assets regenerated.
- The browse immersive-header art gradient is suppressed on every route (D5).
