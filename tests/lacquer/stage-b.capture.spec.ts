import { test, expect, type Locator, type Page } from '@playwright/test';

import {
  attachToLacquer,
  capture,
  isSignedIn,
  settle,
  showBrowse,
} from './harness';

/**
 * Stage B's screenshot gate — the twelve-shot table in
 * `docs/lacquer/plans/STAGE_B.md`, plus the album-colour engine cost.
 *
 * Split into two tests so each stays inside the capture project's timeout:
 * `player stage` drives the Experience surface, `operate surfaces` covers the
 * rail, transport and window compositions. Serial — the second reuses the
 * track the first left playing.
 *
 * Captures toggle the player-page overlay (`showBrowse` / `showPlayer`); they
 * never navigate to switch views.
 *
 * **Why shots 1–5 drive `--ytmusic-album-color` directly.** `album-color-theme`
 * averages the *smallest* thumbnail with `fast-average-color` and darkens it
 * hard; for most covers — and every track that resolves to a music video —
 * that lands near grey, so B1 (correctly) falls back. B1's job is
 * *normalisation*: any triple → a legible token set. So the colour-class shots
 * set the triple the plugin would emit for a dark / bright / saturated /
 * monochrome / ad frame, over the same real IGOR artwork, and screenshot what
 * B1 + the stage do with it. Shot 2b is IGOR played end-to-end with nothing
 * driven — proof the plugin → engine → atmosphere path is live. Every shot logs
 * the resolved `--lq-album-*` tokens so the report can say what each image is.
 */

test.describe.configure({ mode: 'serial' });

const RAIL = '#guide-renderer, ytmusic-guide-renderer#guide-renderer';
const INSPECTOR = 'ytmusic-player-page #side-panel';

const written: string[] = [];
const shot = async (page: Page, name: string) => {
  written.push(await capture(page, name));
};
const shotOf = async (page: Page, target: Locator, name: string) => {
  const el = target.first();
  const file = `test-results/capture/${name}.png`;
  const ok = await el
    .screenshot({ path: file, timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  written.push(ok ? file : await capture(page, `${name}-fallback-fullpage`));
};

/** Drive B1: set the plugin's output triple and wait out the 900ms crossfade. */
const driveAlbumColor = async (page: Page, triple: string, ad = false) => {
  await page.evaluate(
    ([value, isAd]) => {
      document.documentElement.style.setProperty(
        '--ytmusic-album-color',
        value as string,
      );
      document.documentElement.toggleAttribute('data-lq-ad', Boolean(isAd));
    },
    [triple, ad] as const,
  );
  await settle(page, 1100);
};

/** The resolved Lacquer album tokens + the functional-element check. */
const albumState = (page: Page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const get = (name: string) => cs.getPropertyValue(name).trim();
    const colorOf = (selector: string) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).color : null;
    };
    return {
      playerPageOpen: !!document
        .querySelector('ytmusic-app-layout')
        ?.hasAttribute('player-page-open'),
      inputTriple: document.documentElement.style.getPropertyValue(
        '--ytmusic-album-color',
      ),
      atmosphere: get('--lq-album-atmosphere'),
      fill: get('--lq-album-fill'),
      veil: get('--lq-album-veil'),
      fallback: document.documentElement.hasAttribute('data-lq-album-fallback'),
      playPauseBg: (() => {
        const b = document.querySelector('#play-pause-button');
        return b ? getComputedStyle(b).backgroundColor : null;
      })(),
      // Functional elements that must stay Ion/Signal regardless of album (D6).
      focusRing: getComputedStyle(document.documentElement).getPropertyValue(
        '--lq-focus',
      ),
      railActive: colorOf(
        '#guide-renderer ytmusic-guide-entry-renderer[active] tp-yt-paper-item',
      ),
      tabActive: colorOf('ytmusic-player-page tp-yt-paper-tab.iron-selected'),
    };
  });

/** Search → open the album → play track 1 → force artwork (Song) mode. */
const playAlbum = async (page: Page, query: string) => {
  const box = page.locator('ytmusic-search-box input').first();
  await box.click().catch(() => undefined);
  await box.fill(query).catch(() => undefined);
  await page.keyboard.press('Enter');
  await settle(page, 3500);
  await page.keyboard.press('Escape');
  await settle(page, 1000);

  await page
    .evaluate(() => {
      const items = [
        ...document.querySelectorAll(
          'ytmusic-responsive-list-item-renderer:not([id^="suggestion"]), ytmusic-card-shelf-renderer',
        ),
      ];
      const album = items.find((el) => /Album|EP/.test(el.textContent ?? ''));
      (album ?? items[0])
        ?.querySelector<HTMLElement>('a[href*="browse/"], a.yt-simple-endpoint')
        ?.click();
    })
    .catch(() => undefined);
  await settle(page, 3500);

  await page
    .evaluate(() => {
      document
        .querySelector<HTMLElement>(
          'ytmusic-responsive-list-item-renderer #play-button, ytmusic-responsive-list-item-renderer ytmusic-play-button-renderer',
        )
        ?.click();
    })
    .catch(() => undefined);
  await settle(page, 4000);
};

/** Open the overlay and confirm it — a player-page shot is worthless without. */
const ensurePlayerPage = async (page: Page) => {
  const isOpen = () =>
    page.evaluate(
      () =>
        !!document
          .querySelector('ytmusic-app-layout')
          ?.hasAttribute('player-page-open'),
    );

  console.log(
    `  ensurePlayerPage: url=${page.url()} playing=${await page.evaluate(
      () => document.querySelector('ytmusic-player-bar .title')?.textContent,
    )}`,
  );

  const triggers = [
    'ytmusic-player-bar .toggle-player-page-button',
    'ytmusic-player-bar .thumbnail-image-wrapper',
    'ytmusic-player-bar .content-info-wrapper .title',
    'ytmusic-player-bar .middle-controls',
  ];
  for (let round = 0; round < 3 && !(await isOpen()); round += 1) {
    // The overlay toggle is unreliable from a playlist/album *detail* route;
    // stepping back to the results/home route first makes it deterministic.
    if (round === 1) {
      await page.goBack().catch(() => undefined);
      await settle(page, 2500);
    }
    for (const selector of triggers) {
      if (await isOpen()) break;
      const present = await page.evaluate(
        (s) => !!document.querySelector(s),
        selector,
      );
      await page
        .evaluate(
          (s) => document.querySelector<HTMLElement>(s)?.click(),
          selector,
        )
        .catch(() => undefined);
      await settle(page, 2500);
      console.log(
        `  round ${round} ${selector} present=${present} open=${await isOpen()}`,
      );
    }
  }

  const open = await isOpen();
  // Force artwork over video where the track resolved to a music video.
  await page
    .evaluate(() => {
      document
        .querySelector<HTMLElement>('button.song-button.ytmusic-av-toggle')
        ?.click();
    })
    .catch(() => undefined);
  await settle(page, 1500);
  return open;
};

test('Stage B — player stage', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (d) => void d.dismiss().catch(() => undefined));

  try {
    expect(
      await isSignedIn(page),
      'attached session is signed out — captures would not show real states',
    ).toBe(true);

    // Hard-reset to home so a prior spec's route / focus / open overlay cannot
    // leave the player-page toggle in a state where it will not fire. This is a
    // real browser navigation for test *setup*, not the in-app `navigate()`
    // that produces `/browse//`, and not a browse↔player view switch (those
    // still toggle the overlay).
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page
      .goto('https://music.youtube.com/', { waitUntil: 'domcontentloaded' })
      .catch(() => undefined);
    await page
      .waitForSelector('ytmusic-player-bar', { timeout: 30_000 })
      .catch(() => undefined);
    await settle(page, 2500);
    await showBrowse(page);
    await playAlbum(page, 'IGOR Tyler the Creator');

    const opened = await ensurePlayerPage(page);
    console.log(`  player-page overlay open: ${opened}`);
    expect(opened, 'player-page overlay did not open').toBe(true);

    const logShot = async (label: string, name: string) => {
      console.log(`  [${label}]`, JSON.stringify(await albumState(page)));
      await shot(page, name);
    };

    /* 2b — IGOR played end-to-end, nothing driven: `--ytmusic-album-color` is
       still whatever `album-color-theme` extracted from the sleeve. Captured
       before the cost loop below, which then overwrites the variable. */
    await logShot('02b-igor-real', '02b-player-igor-real');

    /* Album-colour engine cost — the full observer round-trip (style mutation
       → normalise → republish) over 30 synthetic track changes. */
    const cost = await page.evaluate(() => {
      const root = document.documentElement;
      const samples: number[] = [];
      for (let i = 0; i < 30; i += 1) {
        const r = 20 + ((i * 37) % 220);
        const g = 30 + ((i * 53) % 200);
        const b = 40 + ((i * 71) % 190);
        const start = performance.now();
        root.style.setProperty('--ytmusic-album-color', `${r}, ${g}, ${b}`);
        void getComputedStyle(root).getPropertyValue('--lq-album-atmosphere');
        samples.push(performance.now() - start);
      }
      samples.sort((a, b) => a - b);
      return { median: samples[15], max: samples[samples.length - 1] };
    });
    console.log(
      `  album-colour engine per track change: median ${cost.median.toFixed(
        3,
      )}ms, max ${cost.max.toFixed(3)}ms (30 samples)`,
    );

    /* 1 — dark artwork (measured plausible: Joji — Nectar → "120, 55, 23"). */
    await driveAlbumColor(page, '110, 52, 30');
    await logShot('01-dark', '01-player-dark');

    /* 2 — bright artwork. Light low-saturation cover; nothing blows out. */
    await driveAlbumColor(page, '196, 150, 120');
    await logShot('02-bright', '02-player-bright');

    /* 3 — saturated artwork (measured: Frank Ocean — channel ORANGE →
       "231, 96, 14"). No muddy mix; progress + play still contrast. */
    await driveAlbumColor(page, '231, 96, 14');
    await logShot('03-saturated', '03-player-saturated');

    /* 4 — near-monochrome. Grey average → B1 falls back to Orbit Noir. */
    await driveAlbumColor(page, '128, 126, 129');
    await logShot('04-monochrome', '04-player-monochrome');

    /* 5 — during an ad. `album-color-theme` emits `0, 0, 0`; B1 falls back and
       `[data-lq-ad]` hides the sleeve metadata. (do-not-track blocks a real
       ad — the state flags are real, the trigger is simulated.) */
    await driveAlbumColor(page, '0, 0, 0', true);
    await logShot('05-ad', '05-player-ad');
    await page.evaluate(() =>
      document.documentElement.toggleAttribute('data-lq-ad', false),
    );

    /* The player page is open and IGOR is playing — do the inspector and
       full-window shots here rather than fighting to re-open the overlay in a
       second test. */
    const selectTab = (label: RegExp) =>
      page
        .locator('ytmusic-player-page tp-yt-paper-tab', { hasText: label })
        .first()
        .click({ timeout: 8000 })
        .catch(() => undefined);

    /* 9 — Inspector, Queue. Current and next unambiguous. */
    await driveAlbumColor(page, '164, 109, 125');
    await selectTab(/up next/i);
    await settle(page, 1500);
    await shotOf(page, page.locator(INSPECTOR), '09-inspector-queue');

    /* 10 — Inspector, Lyrics over bright artwork. Current line on a surface,
       not a text-shadow. */
    await driveAlbumColor(page, '196, 150, 120');
    await selectTab(/lyrics/i);
    await settle(page, 3500);
    await shotOf(page, page.locator(INSPECTOR), '10-inspector-lyrics');
    await selectTab(/up next/i);

    /* 11 — Full window, 1280x800. Intentional, not cramped. */
    await driveAlbumColor(page, '231, 96, 14');
    await page.setViewportSize({ width: 1280, height: 800 });
    await settle(page, 1500);
    await shot(page, '11-window-1280x800');

    /* 12 — Full window, maximised. Composition holds at width. */
    await page.setViewportSize({ width: 1920, height: 1080 });
    await settle(page, 1500);
    await shot(page, '12-window-maximised');

    await page.evaluate(() =>
      document.documentElement.style.removeProperty('--ytmusic-album-color'),
    );
    for (const file of written) console.log(`  captured ${file}`);
  } finally {
    await dispose();
  }
});

test('Stage B — operate surfaces', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (d) => void d.dismiss().catch(() => undefined));

  try {
    // Reset a prior spec's viewport / focus / open overlay.
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.keyboard.press('Escape');
    await showBrowse(page);
    await settle(page);

    /* 6 — Rail, full height. Long names truncate; nothing clipped; account
       footer clear of the transport. */
    await shotOf(page, page.locator(RAIL), '06-rail-full');
    console.log('  [rail]', JSON.stringify(await albumState(page)));

    /* 7 — Rail, narrow. Collapses to the icon rail; the full drawer with the
       account footer is one hamburger click away. */
    await page.setViewportSize({ width: 760, height: 900 });
    await settle(page, 1500);
    await shot(page, '07-rail-narrow');
    await page.setViewportSize({ width: 1600, height: 1000 });
    await settle(page);

    /* 8 — Transport, close crop. Mono time; Chrome hairline; album fill on the
       progress line and play button, Orbit Noir on everything else. Clipped
       from the page bottom — the bar's progress slider advances every second,
       so an element screenshot never reaches Playwright's stability check. */
    await driveAlbumColor(page, '231, 96, 14');
    const vp = page.viewportSize() ?? { width: 1600, height: 1000 };
    const transportFile = 'test-results/capture/08-transport.png';
    await page.screenshot({
      path: transportFile,
      clip: { x: 0, y: vp.height - 96, width: vp.width, height: 96 },
    });
    written.push(transportFile);

    await page.evaluate(() =>
      document.documentElement.style.removeProperty('--ytmusic-album-color'),
    );
    for (const file of written) console.log(`  captured ${file}`);
  } finally {
    await dispose();
  }
});
