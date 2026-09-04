import { expect, test } from '@playwright/test';

import { attachToLacquer, capture } from './harness';

test('shell-regressions: settings exposes album-led artwork and rave modes', async () => {
  const { page, dispose } = await attachToLacquer();
  page.setDefaultTimeout(5000);
  const original = await page.evaluate(() =>
    window.mainConfig.plugins.getOptions('visualizer'),
  );
  try {
    await page.locator('#lacquer-gear-button').click();
    const rave = page.getByRole('menuitemradio', {
      name: 'Laser Basilica — hide artwork',
    });
    await expect(rave).toBeVisible();
    await rave.click();
    await expect
      .poll(() =>
        page.evaluate(
          () => window.mainConfig.plugins.getOptions('visualizer').type,
        ),
      )
      .toBe('lacquer-rave');
    await page.locator('#lacquer-gear-button').click();
    await expect(rave).toHaveAttribute('aria-checked', 'true');
    await capture(page, 'visualizer-choices-menu');
    await page
      .getByRole('menuitemradio', { name: 'Orbital Shockwave — show artwork' })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () => window.mainConfig.plugins.getOptions('visualizer').type,
        ),
      )
      .toBe('lacquer-orbital');
  } finally {
    await page.evaluate(
      (config) =>
        window.ipcRenderer.invoke('peard:set-config', 'visualizer', config),
      original,
    );
    await dispose();
  }
});

test('shell-regressions: header controls have clearance at every width', async () => {
  test.setTimeout(60_000);
  const { page, dispose } = await attachToLacquer();
  page.setDefaultTimeout(10_000);
  const originalMode = await page.evaluate(() =>
    window.mainConfig.get('lacquer.visualizerMode'),
  );
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));
  try {
    await page.waitForSelector('#lacquer-viz-button', { timeout: 30_000 });
    await page.keyboard.press('Escape');
    for (const width of [1920, 1280, 760]) {
      await page.setViewportSize({ width, height: 800 });
      await page.mouse.move(400, 40);
      const input = page.locator('ytmusic-search-box input').first();
      await input.evaluate((el) => el.blur());
      await expect
        .poll(() =>
          page.evaluate(() => {
            const menu = document
              .querySelector('ytmusic-nav-bar #guide-button')!
              .getBoundingClientRect();
            const search = document
              .querySelector('ytmusic-search-box')!
              .getBoundingClientRect();
            return search.left - menu.right;
          }),
        )
        .toBeGreaterThanOrEqual(8);
      if (!(await input.isVisible())) {
        await page
          .getByRole('button', { name: 'Initiate search', exact: true })
          .click();
      }
      await input.click();
      const overlap = await page.evaluate(() => {
        const left = document.querySelector('ytmusic-nav-bar .left-content')!;
        const search = document.querySelector('ytmusic-search-box')!;
        return (
          getComputedStyle(left).visibility !== 'hidden' &&
          left.getBoundingClientRect().right >
            search.getBoundingClientRect().left - 8
        );
      });
      expect(overlap).toBe(false);
      await capture(page, `shell-regressions-search-${width}`);
      await page.keyboard.press('Escape');
    }
  } finally {
    await page.evaluate(
      (mode) => window.mainConfig.set('lacquer.visualizerMode', mode),
      originalMode,
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await dispose();
  }
});

test('shell-regressions: every engine paints a full-window field after reload', async () => {
  test.setTimeout(120_000);
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));
  const original = await page.evaluate(() => ({
    mode: window.mainConfig.get('lacquer.visualizerMode'),
    visualizer: window.mainConfig.plugins.getOptions('visualizer'),
  }));
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press('Escape');
    await page.locator('#lacquer-viz-button').click();
    await expect(page.locator('html')).toHaveAttribute('data-lq-viz', '');
    for (const type of ['butterchurn', 'lacquer-orbital', 'lacquer-rave']) {
      await page.evaluate(
        (type) =>
          window.ipcRenderer.invoke('peard:set-config', 'visualizer', { type }),
        type,
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#lacquer-viz-button', { timeout: 30_000 });
      await page.evaluate(() =>
        document
          .querySelector('video')
          ?.play()
          .catch(() => undefined),
      );
      await expect(page.locator('html')).toHaveAttribute('data-lq-viz', '');
      await expect(
        page.locator('#player-page #player.ytmusic-player-page'),
      ).toHaveCSS('opacity', type === 'lacquer-orbital' ? '1' : '0');
      await expect(page.locator('#visualizer')).toHaveCSS('width', '1280px');
      await expect(page.locator('#visualizer')).toHaveCSS('height', '800px');
      await expect(page.locator('#player-page')).toHaveCSS(
        'background-image',
        'none',
      );
      await expect(page.locator('#content.ytmusic-app')).toHaveCSS(
        'visibility',
        'hidden',
      );
      // A correctly sized but blank canvas is still a broken visualizer.
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const canvas =
                document.querySelector<HTMLCanvasElement>('#visualizer')!;
              const ctx = canvas.getContext('2d')!;
              const colors = new Set<string>();
              for (let y = 1; y < 8; y++)
                for (let x = 1; x < 8; x++) {
                  const pixel = ctx.getImageData(
                    Math.floor((canvas.width * x) / 8),
                    Math.floor((canvas.height * y) / 8),
                    1,
                    1,
                  ).data;
                  if (pixel[3])
                    colors.add(`${pixel[0]},${pixel[1]},${pixel[2]}`);
                }
              return colors.size;
            }),
          { timeout: 10_000 },
        )
        .toBeGreaterThan(3);
      await page.mouse.move(400, 40);
      await capture(page, `shell-regressions-${type}`);
    }
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.mouse.move(650, 400);
    await expect(page.locator('html')).toHaveAttribute(
      'data-lq-viz-chrome-hidden',
      '',
    );
    await expect(page.locator('#content.ytmusic-app')).toHaveCSS(
      'visibility',
      'hidden',
    );
    await capture(page, 'shell-regressions-rave-hidden');
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).not.toHaveAttribute('data-lq-viz', '');
    await expect(page.locator('#content.ytmusic-app')).toHaveCSS(
      'visibility',
      'visible',
    );
  } finally {
    await page.evaluate(async (original) => {
      await window.ipcRenderer.invoke(
        'peard:set-config',
        'visualizer',
        original.visualizer,
      );
      window.mainConfig.set('lacquer.visualizerMode', original.mode);
    }, original);
    await dispose();
  }
});
