import { test, expect, type Locator } from '@playwright/test';

import { attachToLacquer, capture, isSignedIn, settle } from './harness';

/**
 * Stage A's screenshot gate.
 *
 * The capture list is the table in `docs/lacquer/plans/STAGE_A.md`. A stage is
 * not complete until these files exist in `test-results/capture/` and have been
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

type CapturePage = Awaited<ReturnType<typeof attachToLacquer>>['page'];

/**
 * The player page is an **overlay, not a route**.
 *
 * With a track playing, YouTube Music sits on `/watch` with the browse feed
 * already rendered underneath. Calling `ytmusic-app.navigate('/')` to "go home"
 * does not help — it produces the malformed route `/browse//`, which renders
 * nothing at all. That is what made every browse capture come back empty, and
 * it was misread first as "the feed isn't loading" and then (by me) as an
 * element covering the content. `document.elementFromPoint` at the viewport
 * centre returned `html`: nothing was covering it, the page was genuinely
 * blank because the route was broken.
 *
 * So captures never navigate. They toggle the overlay, and the correct feed is
 * revealed underneath.
 */
const setPlayerPage = async (page: CapturePage, open: boolean) => {
  await page
    .evaluate((wantOpen: boolean) => {
      const layout = document.querySelector('ytmusic-app-layout');
      if (!layout) return;
      if (layout.hasAttribute('player-page-open') === wantOpen) return;
      document
        .querySelector<HTMLElement>(
          'ytmusic-player-bar .toggle-player-page-button',
        )
        ?.click();
    }, open)
    .catch(() => undefined);

  await page
    .waitForFunction(
      (wantOpen: boolean) =>
        document
          .querySelector('ytmusic-app-layout')
          ?.hasAttribute('player-page-open') === wantOpen,
      open,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
};

/** Reveal the browse feed. */
const showBrowse = async (page: CapturePage) => {
  await setPlayerPage(page, false);

  // Wait on rendered cards. `ytmusic-browse-response` measures 0px tall even
  // when fully populated — its content sits in a scrolled child — so height is
  // never a usable readiness signal here.
  await page
    .waitForFunction(
      () => document.querySelectorAll('ytmusic-two-row-item-renderer').length > 0,
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);

  await settle(page);
};

/** Reveal the player page. */
const showPlayer = async (page: CapturePage) => {
  await setPlayerPage(page, true);
  await settle(page, 2000);
};

test('Stage A — shell captures', async () => {
  const { page, dispose } = await attachToLacquer();
  // The running app restores a playing track; navigating away from it can raise
  // a beforeunload prompt. Auto-dismiss anything that shows.
  page.on('dialog', (d) => void d.dismiss().catch(() => undefined));

  try {
    expect(
      await isSignedIn(page),
      'attached session is signed out — captures would not show real states',
    ).toBe(true);

    const written: string[] = [];
    const shot = async (name: string) => {
      written.push(await capture(page, name));
    };
    const shotOf = async (target: Locator, name: string) => {
      if (!(await target.count())) return shot(`${name}-fallback-fullpage`);
      const file = `test-results/capture/${name}.png`;
      await target.first().screenshot({ path: file });
      written.push(file);
    };

    await showBrowse(page);

    /* 1 — Home, maximised (current window size). One header row, not two; no
       stock YouTube Music wordmark. */
    await shot('01-home-maximised');

    /* 2 — Home at 1280x800. Nothing clipped, nothing overlapping. */
    await page.setViewportSize({ width: 1280, height: 800 });
    await settle(page);
    await shot('02-home-1280x800');

    /* 3 — Left rail, top. Back / forward live here after A5; this is where the
       shipped build clipped its first item. */
    await page.setViewportSize({ width: 1600, height: 1000 });
    await settle(page);
    await shotOf(
      page.locator('#guide-renderer, ytmusic-guide-renderer'),
      '03-rail-top',
    );

    /* 4 — Left rail bottom / account. Stage A keeps account access as the
       de-branded stock avatar at the right of the one-row titlebar (the rail
       footer is Stage B). Capture the nav bar so a human can see it. */
    await shotOf(page.locator('ytmusic-nav-bar'), '04-account-access');

    /* 5 — Player page, playing. Stock chrome suppressed; plain is fine. */
    await showPlayer(page);
    await settle(page, 2500);
    await shot('05-player-page');

    /* 6 — Titlebar. Window snap / drag can't be driven over CDP; this captures
       the frameless titlebar + native Windows control overlay so a human can
       confirm the region and the drag affordance. */
    await showBrowse(page);
    await shotOf(page.locator('ytmusic-nav-bar'), '06-titlebar');

    /* 7 — Search focused. Focus ring must be Ion cobalt and clearly visible. */
    await page
      .locator('ytmusic-search-box')
      .first()
      .click()
      .catch(() => undefined);
    await page.keyboard.type('radiohead');
    await settle(page);
    await shot('07-search-focused');

    /* 8 — D11 defaults. On the real profile config may carry the owner's past
       choices; the clean-profile proof is the smoke suite. Record what the
       running app resolves so a human can check it. */
    const plugins = await page.evaluate(async () => {
      const ipc = (
        window as unknown as {
          ipcRenderer?: {
            invoke: (c: string, id: string) => Promise<{ enabled?: boolean }>;
          };
        }
      ).ipcRenderer;
      if (!ipc) return null;
      const ids = [
        'album-color-theme',
        'do-not-track',
        'sponsorblock',
        'synced-lyrics',
        'in-app-menu',
        'equalizer',
        'visualizer',
        'ambient-mode',
      ];
      const out: Record<string, boolean> = {};
      for (const id of ids)
        out[id] = (await ipc.invoke('peard:get-config', id))?.enabled === true;
      return out;
    });
    console.log('  resolved plugin state:', JSON.stringify(plugins, null, 2));
    await showBrowse(page);
    await shot('08-settings-context');

    for (const file of written) console.log(`  captured ${file}`);
  } finally {
    await dispose();
  }
});
