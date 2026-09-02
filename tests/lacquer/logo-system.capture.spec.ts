import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { attachToLacquer, CAPTURE_DIR, capture, settle } from './harness';

test('production titlebar carries the approved script-L lockup', async () => {
  const { page, dispose } = await attachToLacquer();

  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    const lockup = page.locator('#lacquer-wordmark');
    await expect(lockup).toBeVisible({ timeout: 30_000 });
    await settle(page, 500);

    await expect(lockup.locator('.lq-mark-script-champagne')).toHaveCount(1);
    await expect(lockup.locator('.lq-mark-script-bronze')).toHaveCount(1);
    await expect(lockup.locator('.lq-mark-plate')).toHaveCount(1);
    await expect(lockup.locator('.lq-mark-spectrum')).toHaveCount(0);
    await expect(lockup.locator('[data-lq-layer="laurel"]')).toHaveCount(0);

    const result = await lockup.evaluate((element) => {
      const svg = element.querySelector<SVGElement>('.lq-wordmark-svg');
      const champagne = element.querySelector<SVGElement>(
        '.lq-mark-script-champagne',
      );
      const bronze = element.querySelector<SVGElement>(
        '.lq-mark-script-bronze',
      );
      return {
        height: svg ? getComputedStyle(svg).height : null,
        champagne: champagne ? getComputedStyle(champagne).stroke : null,
        bronze: bronze ? getComputedStyle(bronze).stroke : null,
      };
    });
    expect(result).toEqual({
      height: '22px',
      champagne: 'rgb(218, 192, 167)',
      bronze: 'rgb(195, 130, 66)',
    });

    fs.mkdirSync(CAPTURE_DIR, { recursive: true });
    await lockup.screenshot({
      path: path.join(CAPTURE_DIR, 'ticket-02-titlebar-lockup.png'),
    });
    await capture(page, 'ticket-02-titlebar-in-app');
  } finally {
    await dispose();
  }
});
