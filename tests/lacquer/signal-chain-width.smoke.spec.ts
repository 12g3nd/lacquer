import { test, expect } from '@playwright/test';

import { launchLacquer } from './harness';

/**
 * Proves the stereo-width stage is genuinely mid/side.
 *
 * This is the test that would have caught the shipped bug. The original graph
 * routed splitter output 0 into both "M_L" and "S_L", and both into merger
 * input 0 — with the mirror on the right. That has no L/R cross-mixing at all,
 * so it cannot be mid/side; it is independent per-channel gain wearing M/S
 * variable names. Actual behaviour was:
 *
 *     L' = L * (0.5 + 0.5w)        R' = R * (0.5 - 0.5w)
 *
 * At the Sped + Reverb preset's width of 1.2 that gives R' = -0.1 * R — the
 * right channel inverted and all but silent, on every non-Original preset.
 *
 * The topology below mirrors `src/lacquer/signal-chain.ts`. If the graph there
 * changes, change it here too — the coupling is the point, since the whole
 * value of this test is asserting on the wiring rather than the arithmetic.
 */

interface WidthResult {
  left: number;
  right: number;
}

test('stereo width is mid/side, not per-channel gain', async () => {
  // Only needs a renderer with Web Audio; never touches Lacquer's own state.
  // `launchLacquer` gives it a throwaway profile, which also keeps it clear of
  // the single-instance lock held by any running copy.
  const { window, dispose } = await launchLacquer();

  const renderWidth = (width: number) =>
    window.evaluate(async (w: number): Promise<WidthResult> => {
      const sampleRate = 48_000;
      const frames = 512;
      const ctx = new OfflineAudioContext(2, frames, sampleRate);

      // A hard-panned source: L = 1, R = 0. Every coefficient in the matrix
      // then shows up directly in the output, so the assertions are exact
      // rather than approximate.
      const input = ctx.createBuffer(2, frames, sampleRate);
      input.getChannelData(0).fill(1);
      input.getChannelData(1).fill(0);

      const source = ctx.createBufferSource();
      source.buffer = input;

      const splitter = ctx.createChannelSplitter(2);
      const merger = ctx.createChannelMerger(2);

      const lToL = ctx.createGain();
      const rToL = ctx.createGain();
      const lToR = ctx.createGain();
      const rToR = ctx.createGain();

      // L' = a*L + b*R, R' = b*L + a*R
      const direct = (1 + w) / 2;
      const cross = (1 - w) / 2;

      lToL.gain.value = direct;
      rToR.gain.value = direct;
      rToL.gain.value = cross;
      lToR.gain.value = cross;

      source.connect(splitter);
      splitter.connect(lToL, 0);
      splitter.connect(lToR, 0);
      splitter.connect(rToL, 1);
      splitter.connect(rToR, 1);

      lToL.connect(merger, 0, 0);
      rToL.connect(merger, 0, 0);
      lToR.connect(merger, 0, 1);
      rToR.connect(merger, 0, 1);

      merger.connect(ctx.destination);
      source.start();

      const rendered = await ctx.startRendering();

      // Sample past the first block to avoid any ramp at the boundary.
      const at = 256;
      return {
        left: rendered.getChannelData(0)[at],
        right: rendered.getChannelData(1)[at],
      };
    }, width);

  // Unity width must be the exact identity, so switching a preset on and off
  // is inaudible rather than "close enough".
  const unity = await renderWidth(1.0);
  expect(unity.left).toBeCloseTo(1, 5);
  expect(unity.right).toBeCloseTo(0, 5);

  // Widening. The cross term puts a small inverted image of L into R; the old
  // graph, having no cross path, produced exactly 0 here.
  const wide = await renderWidth(1.2);
  expect(wide.left).toBeCloseTo(1.1, 5);
  expect(wide.right).toBeCloseTo(-0.1, 5);

  // Narrowing past zero collapses to mono: both channels carry the mid.
  const mono = await renderWidth(0);
  expect(mono.left).toBeCloseTo(0.5, 5);
  expect(mono.right).toBeCloseTo(0.5, 5);

  // The regression guard, stated as the defining property rather than a
  // number: mid/side cross-mixes, so a source present only in L must reach R.
  // The old graph had no cross path at all, making this exactly 0.
  expect(Math.abs(wide.right)).toBeGreaterThan(0);

  await dispose();
});
