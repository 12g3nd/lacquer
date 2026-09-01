# Stage A — Foundation & Spine

**Model:** Sonnet 5, thinking **on**, effort **high**
**Session:** fresh, one stage only
**Ends with:** one coherent local commit + the screenshot gate. **Do not push.**

---

## Split execution — read this first

Stage A was split by owner decision. **Four tasks are already done** and committed as a
checkpoint; six remain.

| Task | Owner | Status |
|---|---|---|
| A1 Delete the override stylesheet | Sonnet | **TODO** |
| A2 Fonts | Sonnet | **TODO** |
| A3 Split `userData` | done | Complete — see D9, which the work corrected |
| A4 Default plugin set | Sonnet | **TODO** |
| A5 One-row titlebar | Sonnet | **TODO** |
| A6 Stereo width | done | Complete — real mid/side, verified |
| A7 Limiter bypass | done | Complete — Original is neutral |
| A8 Housekeeping | Sonnet | **TODO** |
| A9 Screenshot harness | done | Complete — `pnpm test:capture` |
| A10 Rewrite `V1_STATUS.md` | Sonnet | **TODO** |

The completed tasks are left in full below rather than deleted, because their reasoning is
context you need — particularly A3, where the investigation disproved the assumption the
decision was written on.

**Do not redo them.** If you believe one is wrong, stop and report rather than changing it.

---

## Read first, in this order

1. `.agents/rules/lacquer.md` — the workspace constitution
2. `docs/lacquer/DESIGN.md` — the visual authority. Non-negotiable.
3. `docs/lacquer/DECISIONS.md` — 14 closed decisions. Do not re-litigate.
4. `docs/lacquer/SIGNAL_CHAIN_AUDIT.md` — background for the audio fixes only

Then invoke the `impeccable` skill and follow its setup. Lacquer's Operate surface is the
subject of this stage.

---

## What this stage is

The spine. Identity, tokens, window shell, config integrity, and the verification harness.

**This stage is not where Lacquer becomes beautiful.** At the end of Stage A the app will look
*plainer* than it does today — the purple wash and magenta play button are deleted and nothing
decorative replaces them yet. That is correct and expected. Orbit Noir's rule is colour first,
imagery second, effects third; Stage A establishes colour and structure so Stage B has
something true to build on.

**Do not add decoration to compensate.** If the end state feels bare, that is the plan working.

---

## Tasks

### A1. Delete the override stylesheet

Delete `src/lacquer/lacquer.css` (364 lines of `!important` over stock YouTube Music DOM).

Replace with two files that have clearly separated jobs:

- **`src/lacquer/tokens.css`** — rewritten from scratch. The full Orbit Noir palette from
  `DESIGN.md` 3.1 under the `--lq-*` prefix, plus spacing, radii, motion durations and the
  type-role variables. Tokens only. **No selectors other than `:root`.**
- **`src/lacquer/suppress.css`** — new. Neutralises stock YouTube Music chrome that Lacquer
  replaces: the YTM wordmark, the stock player bar's visual language, the stock guide styling,
  the red brand accent. This file *removes*; it does not *style*.

Anything that needs actual styling is a component, not a rule in a global sheet.

Carry nothing forward from the deleted file without justifying it against `DESIGN.md`.

### A2. Fonts

Add `@fontsource/space-grotesk` to dependencies. Update `src/lacquer/fonts.css` to load
Newsreader, Space Grotesk, Inter and IBM Plex Mono, weights only as needed.

Bind each to a token (`--lq-font-editorial`, `--lq-font-graphic`, `--lq-font-interface`,
`--lq-font-instrument`).

**Do not** write a global `font-family` rule. The previous build shipped
`body, * { font-family: Inter !important }`; that is banned by `DESIGN.md` section 5.

### A3. Split `userData` from Pear  ·  DONE

Currently `src/index.ts` sets `userData` to `%APPDATA%/YouTube Music`, so Lacquer shares Pear's
config. Per **D9**, give Lacquer its own directory.

Requirements:

- On **first run only**, copy Pear's session and cookie state so the owner does not
  re-authenticate. Copy session, not config — Lacquer's config must start clean so its
  defaults actually apply.
- The migration must be **idempotent** and must record that it ran.
- If Pear's directory is absent, start clean without erroring.
- If the copy fails (Controlled Folder Access can block cross-directory AppData writes), **log
  it clearly and continue** — a failed migration means re-login, not a broken app.
- **Never** copy the legacy `pear-ytm.css` or any theme reference into Lacquer's config.

Verify by launching and confirming the session survived and Lacquer's config file is at the new
path.

### A4. Default plugin set

Apply the **D11** table in `src/config/defaults.ts`.

Critical: `album-color-theme` **on**; `do-not-track`, `sponsorblock`, `synced-lyrics` **on**;
`in-app-menu` **off**; and the audio plugins that would fight Signal Chain
(`equalizer`, `audio-compressor`, `playback-speed`, `visualizer`, `crossfade`, `skip-silences`)
**off**, along with the competing visual plugins
(`ambient-mode`, `blur-nav-bar`, `transparent-player`, `unobtrusive-player`).

These defaults only take effect because of A3. Verify they actually applied on a clean profile.

Check `precise-volume` against the Signal Chain output gain and report any interaction.

### A5. The one-row titlebar

Per **D8**. A single row replacing two stacked strips:

```
[ Lacquer wordmark ]        [ search ]        [ − □ × ]
```

- Frameless window, **reusing Pear's existing drag-region and window-control machinery** — do
  not write window controls from scratch.
- Back/forward relocate to the **top edge of the left rail**.
- **The account avatar is removed from the titlebar.** Account access moves to the bottom of
  the rail.
- The wordmark is Space Grotesk text for now. The SVG mark is Stage C — do not spend time on it.
- Material: Instrument. A single Chrome hairline on its bottom edge.
- **Do not edit `src/plugins/in-app-menu/renderer/TitleBar.tsx`.** Upstream maintains it;
  editing guarantees a permanent merge conflict. Build Lacquer's titlebar as its own component
  and leave the plugin disabled.

Window snap, drag, double-click-to-maximise and the Windows 11 snap-layouts hover on the
maximise button must all still work. Verify each.

### A6. Audio: stereo width  ·  DONE

`src/lacquer/signal-chain.ts`. The width stage is not mid/side. Both `widthGainM_L` and
`widthGainS_L` read splitter output `0`, and both write merger input `0`; the same on the right.
There is no L/R cross-mixing, so it cannot be M/S. Actual output is `L x (0.5 + 0.5w)` and
`R x (0.5 - 0.5w)` — at `width: 1.2`, the right channel inverts to `-0.1`.

Implement real mid/side: `M = (L+R)/2`, `S = (L-R)/2`, then `L' = M + S*w`, `R' = M - S*w`.

Verify with a stereo source that a preset at `w > 1` widens without collapsing or inverting
either channel, and that `w = 1` is bit-identical to bypass.

### A7. Audio: Original must be neutral  ·  DONE

The limiter (`-1dB`, ratio 20, 1ms attack) is hardwired into the path with no bypass, so
Original is not neutral — loud masters get squashed.

Give the limiter the same bypass-crossfade treatment the EQ, width and compressor stages
already use, and bypass it for Original.

Verify Original is level-matched against the same track with Lacquer's chain fully bypassed.

### A8. Housekeeping

Per **D12**:

- `.oxlintrc.json` — restore `@stylistic/no-mixed-operators` and `perfectionist/sort-imports`
  to their pre-`d02c64ab` values. **Then fix the code they flag.** Do not switch them off again;
  that is what produced a status doc claiming the checks passed.
- `src/menu.ts` — restore the auto-update menu item that was deleted and replaced with a blank
  line.
- `src/lacquer/settings-panel.ts` — Developer Tools currently sends `toggle-in-app-menu`, the
  same IPC as Plugins & Options. Wire it to actually toggle DevTools. Since `in-app-menu` is now
  off by default, re-point Plugins & Options at a route that works.
- `src/lacquer/fx-rack.ts` — the rack container is `appendChild`'d **inside** the FX `<button>`.
  Preset clicks bubble to the button handler and close the rack. Move it out to a sibling.
  Full rack rebuild is Stage C; this is the bug fix only.
- Both `fx-rack.ts` and `settings-panel.ts` run `MutationObserver` on `document.body` with
  `subtree: true`. Narrow the scope or share one observer.

### A9. The screenshot harness  ·  DONE

Two suites. See **D13** for the full reasoning and the bisection table.

- **`pnpm test`** — smoke, on a throwaway profile. Hermetic, ~9s. Includes a regression test
  proving the width stage cross-mixes.
- **`pnpm test:capture`** — the gate. `scripts/capture.mjs` starts Lacquer with a debugging
  port, attaches over CDP using the **real authenticated profile**, captures, then tree-kills
  the app.

**The one thing you must not "simplify":** captures attach, they do not launch. Playwright's
Electron launcher never surfaces a window when the profile has an authenticated YouTube Music
session — verified by bisection, including with `config.json` deleted. Rewriting the capture
spec to use `electron.launch()` will hang for 90+ seconds and produce nothing.

Add your Stage A captures to `tests/lacquer/stage-a.capture.spec.ts`. Four already exist; the
gate list below names the rest. The spec asserts the session is signed in and fails loudly if
not, so captures cannot silently become worthless.

### A10. Rewrite `V1_STATUS.md`

Not amend — **rewrite**. The current file records the commit as the literal string `HEAD`,
claims "6/6 Playwright tests successful" against one test in one file, and lists work as
deferred that shipped two commits earlier.

Replace with an accurate record: real commit SHA, real test count and result, real check
result, honest statement of what is and is not done.

Update `KNOWN_ISSUES.md` and `ARCHITECTURE.md` to match reality. `PRODUCT_SPEC.md`'s design
section is superseded by `DESIGN.md` — link to it rather than restating.

---

## Screenshot gate

Capture and attach all of these before calling the stage complete. **A stage without its
screenshots is not complete, regardless of what the code looks like.**

| # | State | Looking for |
|---|---|---|
| 1 | Home, maximised | One header row, not two. No YTM wordmark. |
| 2 | Home, 1280x800 | Nothing clipped, nothing overlapping. |
| 3 | Left rail, top | Back/forward present, no clipping at the top edge. |
| 4 | Left rail, bottom | Account access present. |
| 5 | Player page, playing | Stock chrome suppressed. Plain is fine at this stage. |
| 6 | Titlebar, window snapped | Snap and drag still work. |
| 7 | Search focused | Focus ring is Ion cobalt, clearly visible. |
| 8 | Settings / plugins list | D11 defaults actually applied on a clean profile. |

Also report, in text:

- Confirmation that the session survived the `userData` split, and where the new config lives
- `pnpm check` output, with the two restored lint rules active
- Test results, with the real count
- Before/after level measurement or reasoned argument for A7
- Confirmation that width at `w = 1` is bypass-identical and `w > 1` does not invert a channel

---

## Non-goals

Do not do any of these. They belong to later stages.

- Authored left rail or transport deck — **Stage B**
- Player-page atmosphere or album-colour normalisation — **Stage B**
- FX rack rebuild — **Stage C**
- Context-menu classifier — **Stage C**
- Motion pass — **Stage C**
- SVG wordmark — **Stage C**
- New features, packaging, code signing, macOS/Linux

---

## Acceptance

- `lacquer.css` is gone; tokens and suppression are separate and have distinct jobs
- No global `font-family` declaration exists anywhere
- Lacquer has its own `userData`; the session survived; defaults applied
- One header row; snap, drag and maximise work
- Width is genuine mid/side; Original is neutral
- Both lint rules restored **and** the code they flag is fixed
- The screenshot harness runs from one command and produces the eight captures
- `V1_STATUS.md` is accurate
- One coherent local commit. Not pushed.

Finish with a concise report: files changed, commands run, screenshots attached, anything that
did not work and why. **Then stop.** Do not begin Stage B.
