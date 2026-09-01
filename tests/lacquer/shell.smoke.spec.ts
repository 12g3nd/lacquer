import { test, expect } from '@playwright/test';

import { launchLacquer } from './harness';

/**
 * Behavioural checks for the Stage A shell (A4 + A5) that a hermetic launch can
 * actually make.
 *
 * The renderer-injected shell — the wordmark, the rail back/forward, the FX and
 * settings buttons — is verified at the **capture gate**, not here. Those
 * modules run from `onApiLoaded`, which the signed-out hermetic profile does
 * not reliably reach; D13 is explicit that the hermetic suite cannot show those
 * states and the real-profile capture is what does.
 *
 * What the hermetic launch *can* prove is the parts that are config- and
 * CSS-level:
 *
 *   - `in-app-menu` is disabled by default (D8), so its titlebar panel never
 *     mounts — the collapse from two header strips to one;
 *   - `suppress.css` hides the stock YouTube Music wordmark.
 */

test('shell: in-app-menu does not mount, stock wordmark is suppressed', async () => {
  const { window, dispose } = await launchLacquer();

  try {
    await window
      .waitForSelector('ytmusic-nav-bar', { timeout: 60_000 })
      .catch(() => undefined);

    // D8 / A4: the in-app-menu plugin is off by default, so its bar is absent.
    // This is the "one header row, not two" collapse at the structural level.
    await expect(window.locator('#ytmd-title-bar-main-panel')).toHaveCount(0);

    // A1 / A5: suppress.css removes the stock YouTube Music wordmark — every
    // `ytmusic-logo` on the page renders with no box. `insertCSS` flushes on
    // `did-finish-load`, which can land just after `ytmusic-nav-bar` mounts, so
    // poll rather than sampling once.
    await expect
      .poll(
        () =>
          window.evaluate(() =>
            [...document.querySelectorAll('ytmusic-logo')].some((el) => {
              const s = getComputedStyle(el);
              return (
                s.display !== 'none' &&
                s.visibility !== 'hidden' &&
                (el as HTMLElement).offsetWidth > 0
              );
            }),
          ),
        { timeout: 15_000 },
      )
      .toBe(false);
  } finally {
    await dispose();
  }
});
