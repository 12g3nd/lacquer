import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { chromium, _electron as electron } from '@playwright/test';

import type { Browser, ElectronApplication, Page } from '@playwright/test';

/**
 * Lacquer's test harness.
 *
 * Every stage in `docs/lacquer/plans/` ends at a screenshot gate: the stage is
 * not complete until the named captures exist and have been looked at. This
 * module is what makes that gate real rather than a promise. Before it existed,
 * `tests/index.test.js` was the entire suite — one launch, one URL assertion, no
 * visual evidence of any kind.
 *
 * There are two ways in, because one does not cover both jobs:
 *
 *   launchLacquer()  — Playwright launches the app on a throwaway profile.
 *                      Hermetic and fast. Use for behavioural tests.
 *
 *   attachToLacquer() — Playwright connects over CDP to an already-running app
 *                      using the real profile. Use for captures.
 *
 * Why the split, in full, because it is not obvious and will otherwise be
 * "simplified" back into a bug:
 *
 * Playwright's Electron *launcher* never surfaces a window when the profile
 * carries an authenticated YouTube Music session. Verified by bisection: a
 * clean profile launches in about a second; a copy of the real profile hangs
 * past 90 seconds with `app.windows() === 0`, and still hangs with
 * `config.json` deleted, which rules out configuration. The differentiator is
 * the session itself — an authenticated profile has a registered
 * `music.youtube.com/sw.js` service worker, which a signed-out profile does
 * not. The app is entirely healthy outside Playwright's launcher, and attaching
 * over CDP to that same profile works perfectly.
 *
 * So: behavioural tests get isolation they wanted anyway, and captures — which
 * are worthless signed out, since they would show none of the states the stage
 * gates ask for — attach instead. `scripts/capture.mjs` wires up the second
 * path; do not call `attachToLacquer` without it.
 */

const APP_PATH = path.resolve(import.meta.dirname, '..', '..');

export const CAPTURE_DIR = path.join(APP_PATH, 'test-results', 'capture');

/** Set by `scripts/capture.mjs` so the spec knows where to attach. */
export const CDP_ENDPOINT = process.env.LACQUER_CDP_ENDPOINT;

/* -------------------------------------------------------------------------- */
/* Hermetic launch — behavioural tests                                         */
/* -------------------------------------------------------------------------- */

export interface LaunchResult {
  app: ElectronApplication;
  window: Page;
  /** Removes the throwaway profile. Always call this. */
  dispose: () => Promise<void>;
}

/**
 * Launches Lacquer on a fresh, disposable profile.
 *
 * The isolation is not incidental: it keeps the run reproducible, keeps the
 * single-instance lock uncontended, avoids mutating real user data, and avoids
 * the authenticated-session hang described above.
 */
export const launchLacquer = async (
  options: { size?: { width: number; height: number } } = {},
): Promise<LaunchResult> => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lacquer-test-'));

  const app = await electron.launch({
    cwd: APP_PATH,
    args: [
      APP_PATH,
      `--user-data-dir=${profile}`,
      '--no-sandbox',
      '--disable-gpu',
      '--whitelisted-ips=',
      '--disable-dev-shm-usage',
    ],
    env: { ...process.env, NODE_ENV: 'test' },
  });

  const window = await app.firstWindow();
  if (options.size) await window.setViewportSize(options.size);
  await dismissConsent(window);
  await window
    .waitForSelector('ytmusic-app', { timeout: 60_000 })
    .catch(() => undefined);

  return {
    app,
    window,
    dispose: async () => {
      await app.close().catch(() => undefined);
      fs.rmSync(profile, { recursive: true, force: true });
    },
  };
};

/* -------------------------------------------------------------------------- */
/* CDP attach — captures                                                       */
/* -------------------------------------------------------------------------- */

export interface AttachResult {
  browser: Browser;
  page: Page;
  dispose: () => Promise<void>;
}

/**
 * Connects to a running Lacquer started by `scripts/capture.mjs`, and returns
 * the YouTube Music page.
 */
export const attachToLacquer = async (): Promise<AttachResult> => {
  if (!CDP_ENDPOINT) {
    throw new Error(
      'No CDP endpoint. Captures attach to a running app rather than ' +
        'launching one — run `pnpm test:capture`, which starts Lacquer with a ' +
        'debugging port and sets LACQUER_CDP_ENDPOINT.',
    );
  }

  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  const context = browser.contexts()[0];

  const page = context
    .pages()
    .find((candidate) => candidate.url().includes('music.youtube.com'));

  if (!page) {
    await browser.close();
    throw new Error(
      `Attached to Lacquer but found no music.youtube.com page. Open pages: ${
        context
          .pages()
          .map((candidate) => candidate.url())
          .join(', ') || '(none)'
      }`,
    );
  }

  await page
    .waitForSelector('ytmusic-app', { timeout: 60_000 })
    .catch(() => undefined);

  return {
    browser,
    page,
    // Only the CDP connection is closed. The app is owned by the runner script,
    // which is also responsible for stopping it.
    dispose: async () => {
      await browser.close().catch(() => undefined);
    },
  };
};

/** True when the attached session is signed in — captures are thin without it. */
export const isSignedIn = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => !!document.querySelector('#avatar-btn, ytmusic-settings-button'),
  );

/* -------------------------------------------------------------------------- */
/* Player-page overlay — captures toggle it, they never navigate               */
/* -------------------------------------------------------------------------- */

/**
 * The player page is an **overlay, not a route**. With a track playing, YouTube
 * Music sits on `/watch` with the browse feed already rendered underneath, and
 * `ytmusic-app.navigate('/')` produces the malformed route `/browse//` which
 * renders nothing. So the captures toggle the overlay and reveal the correct
 * view underneath — they never navigate to change between browse and player.
 * (Shared by every stage's capture spec; first written for Stage A.)
 */
const setPlayerPage = async (page: Page, open: boolean): Promise<boolean> => {
  const isOpen = () =>
    page.evaluate(
      () =>
        !!document
          .querySelector('ytmusic-app-layout')
          ?.hasAttribute('player-page-open'),
    );
  if ((await isOpen()) === open) return true;

  // A freshly started track sometimes needs a couple of tries before the
  // toggle registers; retry with a short wait rather than one long one.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page
      .evaluate(() => {
        document
          .querySelector<HTMLElement>(
            'ytmusic-player-bar .toggle-player-page-button',
          )
          ?.click();
      })
      .catch(() => undefined);
    const settled = await page
      .waitForFunction(
        (wantOpen: boolean) =>
          !!document
            .querySelector('ytmusic-app-layout')
            ?.hasAttribute('player-page-open') === wantOpen,
        open,
        { timeout: 3_500 },
      )
      .then(() => true)
      .catch(() => false);
    if (settled) return true;
  }
  return false;
};

/** Reveal the browse feed (close the player-page overlay). */
export const showBrowse = async (page: Page) => {
  await setPlayerPage(page, false);

  // Wait on rendered cards. `ytmusic-browse-response` measures 0px tall even
  // when fully populated — its content sits in a scrolled child — so height is
  // never a usable readiness signal here.
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('ytmusic-two-row-item-renderer').length > 0,
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);

  await settle(page);
};

/** Reveal the player page (open the overlay). */
export const showPlayer = async (page: Page, ms = 2000) => {
  await setPlayerPage(page, true);
  await settle(page, ms);
};

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

/** Clicks through YouTube's consent interstitial if it appears. */
const dismissConsent = async (window: Page) => {
  const consent = await window.$(
    "form[action='https://consent.youtube.com/save']",
  );
  if (consent) await consent.click('button');
};

/**
 * Captures the page to `test-results/capture/<name>.png` and returns the path,
 * so a stage report can cite it directly.
 */
export const capture = async (page: Page, name: string): Promise<string> => {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  const file = path.join(CAPTURE_DIR, `${sanitise(name)}.png`);
  await page.screenshot({ path: file });
  return file;
};

/**
 * Settles the UI before a capture: waits out in-flight animation and lets the
 * album-colour crossfade (Atmosphere, 800ms+) finish, so captures are stable
 * rather than catching a surface mid-transition.
 */
export const settle = (page: Page, ms = 1200) => page.waitForTimeout(ms);

const sanitise = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
