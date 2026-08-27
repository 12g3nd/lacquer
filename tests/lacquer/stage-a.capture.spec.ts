import { test, expect } from '@playwright/test';

import { attachToLacquer, capture, isSignedIn, settle } from './harness';

/**
 * Stage A's screenshot gate.
 *
 * The capture list comes from `docs/lacquer/plans/STAGE_A.md`. A stage is not
 * complete until these files exist in `test-results/capture/` and have been
 * looked at — that is the whole mechanism preventing another round of
 * "acceptance" declared without visual evidence.
 *
 * Captures are deliberately not diffed against golden images. Stage A
 * intentionally makes the app look *plainer* than before, so a pixel baseline
 * would only encode the state we are moving away from. The gate is human review
 * of named evidence.
 *
 * Run with `pnpm test:capture`, which starts the app and attaches. Running this
 * spec directly will fail with a clear message: it attaches rather than
 * launches, for the reasons in `harness.ts`.
 */

test.describe.configure({ mode: 'serial' });

test('Stage A — shell captures', async () => {
  const { page, dispose } = await attachToLacquer();

  try {
    // A signed-out capture proves nothing about the states the gate asks for,
    // so fail loudly rather than filing misleading evidence.
    expect(
      await isSignedIn(page),
      'attached session is signed out — captures would not show real states',
    ).toBe(true);

    await settle(page);
    const written: string[] = [];

    written.push(await capture(page, 'a1-shell-current-size'));

    await page.setViewportSize({ width: 1280, height: 800 });
    await settle(page);
    written.push(await capture(page, 'a2-shell-1280x800'));

    // The rail's top edge: back/forward live here after A5, and this is where
    // the shipped build clipped its first item.
    written.push(await capture(page, 'a3-rail-top'));

    await page.setViewportSize({ width: 1600, height: 1000 });
    await settle(page);
    written.push(await capture(page, 'a4-shell-wide'));

    for (const file of written) console.log(`  captured ${file}`);
  } finally {
    await dispose();
  }
});
