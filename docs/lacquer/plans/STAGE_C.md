# Stage C — Instrument & Detail

**Model:** Sonnet 5, thinking **on**, effort **high**
**Session:** fresh, one stage only
**Prerequisite:** Stage B complete and its screenshot gate passed
**Ends with:** one coherent local commit + the screenshot gate. **Do not push.**

---

## Read first, in this order

1. `.agents/rules/lacquer.md`
2. `docs/lacquer/DESIGN.md`
3. `docs/lacquer/DECISIONS.md`
4. `docs/lacquer/plans/STAGE_B.md` and the Stage B completion report
5. `docs/lacquer/SIGNAL_CHAIN.md` — for the rack's actual parameter surface

Then invoke `impeccable`. The FX rack is an **Operate** surface with unusually high expression
tolerance — it is an instrument panel, and instrument panels are allowed personality.

---

## What this stage is

The details that separate "well themed" from "someone built this."

Three of the four tasks are things the previous build left in a state that will break or
embarrass: a rack that is six buttons in a grey box, a context menu that misclassifies items by
matching SVG path strings, and a wordmark that is a CSS pseudo-element.

---

## Tasks

### C1. The FX rack as an instrument panel

The current rack is six preset buttons in a `#1a1a1a` box using `--ytmusic-color-black4` — it
does not use a single Lacquer token. It exposes none of the parameters the Signal Chain actually
implements.

The engine supports: preset, speed, pitch mode (`preservesPitch` vs varispeed), EQ filter
chain, reverb wet plus three impulse responses, stereo width, compressor, limiter, and an
analyser tap. The rack surfaces none of it.

Build a real rack:

- **Presets** — Original, Sped + Reverb, Slowed + Reverb, Dream, Tape, Night
- **Speed** with a mono readout (`1.18x`), and the pitch-mode choice
- **Reverb** wet, and room character
- **Width**
- **EQ** entry or summary — full EQ editing may stay behind a disclosure
- **Bypass / output**
- Optionally a restrained meter from the existing analyser tap, **only if it is genuinely cheap**

Design direction: analog hi-fi, from the reference vocabulary. Precise readouts, machined
controls, Chrome linework, Instrument material. **Instrument voice (IBM Plex Mono) for every
numeric readout**, `tabular-nums` so values do not jitter while dragging.

It is a compact rack, not a settings page. Blueglass is appropriate here — it genuinely floats.

Stage A moved the container out of the `<button>`; keep it a proper popover with correct focus
management, Escape to close, and click-outside to dismiss.

Persist state. Preset switching stays immediate.

### C2. Context menu — replace the classifier

**D12** deferred this to here. It is now due.

`src/lacquer/context-menu.ts` classifies menu items by matching the first characters of an SVG
`path` `d` attribute. The prefixes collide: `'M12,2C6'` (go-to-album) is tested before
`'M12,2C6.48'` (start-radio) in insertion order, so **Start radio is always misclassified as
Go to album.** Verify this before fixing — it should reproduce immediately.

The in-code comment asserting these prefixes are "stable across versions because the icons are
baked into the iron-iconset-svg bundle" is invented justification. Delete it.

Replace with identification that does not depend on icon geometry. Investigate, in order of
preference:

1. The navigation or service endpoint attached to the item — the most stable signal, since it
   encodes what the item *does*
2. `aria-label` or accessible name, mapped through the existing i18n resources so it survives
   language changes
3. Icon name, if YTM exposes a semantic name rather than raw path data

Pick based on what the DOM actually offers. **Report what you found before implementing.**

Preserve the **D12**-era tier structure (it is good):

- **Tier 1:** Play next · Add to queue · Save to playlist · — · Sped + Reverb · Slowed + Reverb ·
  FX… · — · Go to album · Go to artist · More…
- **Tier 2 (More…):** remove from library/liked, remove from queue, download, credits, share,
  report, start radio, shuffle, play

Two further defects to fix:

- The menu is destroyed and rebuilt, and items are wrapped in plain `<div>`s. This breaks
  `tp-yt-paper-listbox` keyboard navigation. Arrow keys, Home/End, Escape and type-ahead must
  work.
- `closeMenu()` sets `display: none` then restores it on the next frame. That is a flicker, not
  a close — the dropdown remains open in Polymer's model. Close it properly.

Any item that cannot be classified must still be **reachable** under More…, never dropped.

Style the menu in Blueglass with Interface type.

### C3. Motion pass

Apply `DESIGN.md` section 6 consistently. Fast (150ms) for hover and focus, Normal (300ms) for
panels, Atmosphere (800ms+) for album crossfade only.

- Nothing animates on scroll. No parallax. No entrance animation on list items.
- Motion never delays input response.
- `prefers-reduced-motion` collapses everything except opacity.

Audit for motion the previous build added ad hoc via inline styles, and route it through tokens.

### C4. The Lacquer wordmark

Currently `ytmusic-logo::after { content: 'Lacquer' }` — a pseudo-element.

Replace with a real inline SVG mark in the titlebar. Concept from the earlier brief: a lacquered
record, an orbit, a groove. Chrome linework and the spectral-diffraction motif are both in the
reference vocabulary and both suit a record.

Must read cleanly at titlebar size and as a Windows icon. Also produce the Windows icon assets —
`assets/icon.png` is still Pear's.

**Bounded: this is a mark, not a brand identity project.** If it is not working, ship the Space
Grotesk wordmark from Stage A and note it. Do not spend the session here.

### C5. Final consistency sweep

- Every colour and `font-family` in Lacquer source references a token. No inline hex, no
  inline `font-family`. The previous build styled entire components with inline JS `.style`
  assignments — route those through classes and tokens.
- Remove any remaining `!important` that is not strictly required to suppress stock chrome.
- Confirm no Lacquer TODO/FIXME remains.
- Update `docs/lacquer/UX.md` to match what actually shipped.
- Update `V1_STATUS.md` and `KNOWN_ISSUES.md` honestly.

---

## Screenshot gate

| # | State | Looking for |
|---|---|---|
| 1 | FX rack open, Original | Instrument material, mono readouts, Lacquer tokens |
| 2 | FX rack open, Slowed + Reverb | Active preset unambiguous; parameters reflect it |
| 3 | FX rack over bright artwork | Blueglass legible against the stage |
| 4 | FX button, effect active | Indicator quiet but clear |
| 5 | Context menu on a queue item | Tier 1 short; correct items for the context |
| 6 | Context menu, More… expanded | Tier 2 reachable; nothing dropped |
| 7 | Context menu, keyboard-focused | Visible focus ring; arrow-key navigation works |
| 8 | Titlebar close crop | SVG wordmark at real size |
| 9 | Full window, maximised | Everything holds together |
| 10 | Full window, 1280x800 | Everything holds together |

Also report:

- **Proof that Start radio now classifies correctly** — the specific bug this stage fixes
- What DOM signal you chose for classification, and why
- Confirmation that menu keyboard navigation works: arrows, Home/End, Escape, type-ahead
- Confirmation that no inline hex or `font-family` remains in Lacquer source
- `pnpm check` and test results

---

## Non-goals

- New DSP effects or processed-audio export
- Packaging, code signing, release, macOS/Linux
- Refactoring stable code for taste
- Turning the wordmark into a multi-session identity project
- Any new product feature

---

## Acceptance

- The rack is a real instrument panel using Lacquer tokens and Instrument type
- Context menu classification no longer depends on SVG path geometry, and Start radio is correct
- Menu keyboard navigation works
- Motion is consistent and token-driven; `prefers-reduced-motion` respected
- A real wordmark exists, or its absence is documented
- No inline colour or type left in Lacquer source
- Docs match reality
- One coherent local commit. Not pushed.

Finish with a concise report and **stop.**

---

## After Stage C

The owner uses Lacquer as a daily driver for a week before anything else is planned. Deferred
by decision: processed-audio export, per-song preset sync, a larger effect library, research-
grade tape wow/flutter, macOS/Linux, plugin marketplace.
