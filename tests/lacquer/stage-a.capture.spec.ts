import { test } from '@playwright/test';

import { capture, launchLacquer, settle } from './harness';

/**
 * Stage A's screenshot gate.
 *
 * The capture list comes from `docs/lacquer/plans/STAGE_A.md`. A stage is not
 * complete until these files exist in `test-results/capture/` and have been
 * looked at — that is the whole mechanism preventing another round of
 * "acceptance" declared without visual evidence.
 *
 * Captures are deliberately not asserted against golden images. Stage A
 * intentionally makes the app look *plainer* than before, so a pixel baseline
 * would only encode the state we are moving away from. The gate is human
 * review of named evidence, not automated diffing.
 *
 *   pnpm test:capture
 */

test.describe.configure({ mode: 'serial' });

test('Stage A — shell captures at 1280x800', async () => {
  const { app, window } = await launchLacquer({
    size: { width: 1280, height: 800 },
  });

  await settle(window);
  await capture(window, 'a2-home-1280x800');

  // The rail's top edge: back/forward live here after A5, and this is where
  // the shipped build clipped its first item.
  await capture(window, 'a3-rail-top');

  await window.keyboard.press('Control+KeyL').catch(() => undefined);
  await settle(window, 600);
  await capture(window, 'a7-search-focused');

  await app.close();
});

test('Stage A — shell captures maximised', async () => {
  const { app, window } = await launchLacquer();

  await settle(window);
  await capture(window, 'a1-home-maximised');

  await app.close();
});
