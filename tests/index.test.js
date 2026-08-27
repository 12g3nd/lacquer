import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { test, expect, _electron as electron } from '@playwright/test';

process.env.NODE_ENV = 'test';

const appPath = path.resolve(import.meta.dirname, '..');

test('Pear Desktop App - With default settings, app is launched and visible', async () => {
  // Lacquer: run on a throwaway profile. This test asserts behaviour "with
  // default settings", so the real profile contradicts its own premise — and
  // Playwright's Electron launcher never surfaces a window when the profile
  // carries an authenticated YouTube Music session. See tests/lacquer/harness.ts.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lacquer-smoke-'));

  const app = await electron.launch({
    cwd: appPath,
    args: [
      appPath,
      `--user-data-dir=${profile}`,
      '--no-sandbox',
      '--disable-gpu',
      '--whitelisted-ips=',
      '--disable-dev-shm-usage',
    ],
  });

  const window = await app.firstWindow();

  const consentForm = await window.$(
    "form[action='https://consent.\u0079\u006f\u0075\u0074\u0075\u0062\u0065.com/save']",
  );
  if (consentForm) {
    await consentForm.click('button');
  }

  // const title = await window.title();
  // expect(title.replaceAll(/\s/g, ' ')).toEqual('Pear Desktop');

  const url = window.url();
  expect(
    url.startsWith(
      'https://music.\u0079\u006f\u0075\u0074\u0075\u0062\u0065.com',
    ),
  ).toBe(true);

  await app.close();
  fs.rmSync(profile, { recursive: true, force: true });
});
