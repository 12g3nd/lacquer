# Known Issues

Accurate as of the end of Stage A. See `docs/lacquer/V1_STATUS.md` for what
Stage A changed and `docs/lacquer/plans/` for what B and C will address.

## Current

- **The app is plain right now, on purpose.** Stage A removed the shipped
  purple wash and magenta play button and replaced them with the Orbit Noir
  ground and functional cobalt only. Atmosphere, the authored rail and the
  authored transport deck are Stage B. If the shell looks bare, that is the
  plan (`DESIGN.md` §7: colour first, imagery second, effects third).

- **Album-reactive colour is enabled but not yet consumed.** `album-color-theme`
  is on by default (D11), but Lacquer's `--lq-album-*` tokens still hold their
  Orbit Noir fallbacks — normalisation, contrast clamping and the crossfade on
  track change are Stage B (`DESIGN.md` §3.4). Until then the player page is
  Orbit Noir regardless of artwork, which is the correct plain baseline.

- **Account access is in the titlebar, not the rail.** D8 puts account access
  at the bottom of the rail; Stage A leaves it as the de-branded stock avatar
  at the right of the one-row titlebar because the authored rail is Stage B.

- **Menus, popovers and the search-suggestions panel are unstyled.** They read
  as plain dark YouTube Music surfaces. The Blueglass material for transient
  surfaces (DESIGN.md §4) is Stage B — the shipped build's menu styling lived
  in the deleted `lacquer.css` and is not carried forward.

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

- **Upstream merge surface.** The suppression sheet and the renderer injection
  modules target stock YouTube Music selectors and may need adjustment if
  upstream Pear or YouTube Music refactors that DOM. This is contained to
  `src/lacquer/` and `suppress.css`; no `!important` component sheet remains.

## Deferred by plan

- **Stage B** — authored left rail and transport deck; player-page atmosphere;
  album-colour normalisation and structural contrast safety.
- **Stage C** — FX rack rebuild; the context-menu classifier (it matches menu
  items by SVG path-`d` prefix and the prefixes collide, so "Start radio" is
  currently misclassified as "Go to album"); motion pass; the SVG wordmark.
- **Out of scope entirely** (D12) — new features, processed-audio export,
  macOS/Linux, code signing, a final logo.
