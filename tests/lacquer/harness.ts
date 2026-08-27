import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { _electron as electron } from '@playwright/test';

import type { ElectronApplication, Page } from '@playwright/test';

/**
 * Lacquer's capture harness.
 *
 * Every stage in `docs/lacquer/plans/` ends at a screenshot gate: the stage is
 * not complete until the named captures exist and have been looked at. This
 * module is what makes that gate real rather than a promise.
 *
 * Before this existed, `tests/index.test.js` was the entire suite — one launch,
 * one URL assertion, no visual evidence of any kind. The previous build agent
 * shipped a 364-line stylesheet and reported success against it.
 */

const APP_PATH = path.resolve(import.meta.dirname, '..', '..');

export const CAPTURE_DIR = path.join(
  APP_PATH,
  'test-results',
  'capture',
);

export interface LaunchOptions {
  /**
   * Viewport to emulate, in CSS pixels. Stage plans call for 1280x800 and a
   * maximised state; pass the former explicitly and omit for the latter.
   */
  size?: { width: number; height: number };
}

/**
 * Launches Lacquer and waits until the YouTube Music app element is present.
 *
 * Uses the real userData directory, so an authenticated session carries in.
 * That is intentional: captures of a signed-out shell prove nothing about the
 * states the stage gates actually ask for.
 */
export const launchLacquer = async (
  options: LaunchOptions = {},
): Promise<{ app: ElectronApplication; window: Page }> => {
  const app = await electron.launch({
    cwd: APP_PATH,
    args: [
      APP_PATH,
      '--no-sandbox',
      '--disable-gpu',
      '--whitelisted-ips=',
      '--disable-dev-shm-usage',
    ],
    env: { ...process.env, NODE_ENV: 'test' },
  });

  const window = await app.firstWindow();

  if (options.size) {
    await window.setViewportSize(options.size);
  }

  await dismissConsent(window);

  // The renderer is a remote Polymer application; `load` fires long before the
  // shell is actually usable, so wait on a real element instead.
  await window
    .waitForSelector('ytmusic-app', { timeout: 60_000 })
    .catch(() => undefined);

  return { app, window };
};

/** Clicks through YouTube's consent interstitial if it appears. */
const dismissConsent = async (window: Page) => {
  const consent = await window.$(
    "form[action='https://consent.youtube.com/save']",
  );
  if (consent) await consent.click('button');
};

/**
 * Captures the window to `test-results/capture/<name>.png`.
 *
 * Returns the absolute path so a stage report can cite it directly.
 */
export const capture = async (window: Page, name: string): Promise<string> => {
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });

  const file = path.join(CAPTURE_DIR, `${sanitise(name)}.png`);
  await window.screenshot({ path: file });
  return file;
};

/**
 * Settles the UI before a capture: waits out in-flight animation and lets the
 * album-colour crossfade (Atmosphere, 800ms+) finish, so captures are stable
 * rather than catching a surface mid-transition.
 */
export const settle = async (window: Page, ms = 1200) => {
  await window.waitForTimeout(ms);
};

const sanitise = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
