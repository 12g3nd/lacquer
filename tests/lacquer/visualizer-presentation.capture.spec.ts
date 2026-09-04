import { expect, test } from '@playwright/test';

import { attachToLacquer, capture } from './harness';

test('presentation: independent panel, lyrics overlay, album colour and persistence', async () => {
  test.setTimeout(120_000);
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));
  const original = await page.evaluate(() => ({
    lacquer: window.mainConfig.get('lacquer'),
    visualizer: window.mainConfig.plugins.getOptions('visualizer'),
  }));
  const option = (name: string) => page.getByRole('menuitemcheckbox', { name });
  const setOption = async (name: string, checked: boolean) => {
    await page.mouse.move(1000, 700);
    await page.locator('#lacquer-gear-button').click();
    if ((await option(name).getAttribute('aria-checked')) !== String(checked)) {
      await option(name).click();
    } else {
      await page.locator('#lacquer-gear-button').click();
    }
  };
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.keyboard.press('Escape');
    await page.locator('#lacquer-viz-button').click();
    await page.evaluate(() =>
      window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
        type: 'butterchurn',
      }),
    );
    await setOption('VIZ: show side panel', false);
    await expect(page.locator('#player-page #side-panel')).toHaveCSS(
      'visibility',
      'hidden',
    );
    await setOption('VIZ: overlay lyrics', true);
    await expect(page.locator('#lq-viz-lyrics')).toBeAttached();
    await setOption('VIZ: match album colours', true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute(
      'data-lq-viz-panel-hidden',
      '',
    );
    await expect(page.locator('html')).toHaveAttribute(
      'data-lq-viz-lyrics-overlay',
      '',
    );
    await expect(page.locator('html')).toHaveAttribute(
      'data-lq-viz-album-colors',
      '',
    );
    await page.evaluate(() =>
      document
        .querySelector('video')
        ?.play()
        .catch(() => undefined),
    );
    const current = page.locator('.lq-viz-lyric-current');
    await expect(current).not.toHaveText('', { timeout: 30_000 });
    await expect
      .poll(() =>
        current.evaluate(
          (line) => getComputedStyle(line).animationIterationCount,
        ),
      )
      .toContain('infinite');
    await expect(page.locator('#lq-viz-lyrics')).toBeVisible();
    await expect(page.locator('#lq-viz-lyrics')).not.toContainText(
      /\[\d\d:\d\d/,
    );
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.mouse.move(600, 400);
    await expect(page.locator('html')).toHaveAttribute(
      'data-lq-viz-chrome-hidden',
      '',
    );
    await expect(page.locator('#lq-viz-lyrics')).toBeVisible();
    await capture(page, 'presentation-overlay-album');
    const originalFill = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--lq-album-fill'),
    );
    try {
      for (const [name, colour, dominant] of [
        ['warm', 'rgb(240, 50, 30)', 0],
        ['cool', 'rgb(30, 60, 240)', 2],
        ['green', 'rgb(40, 220, 60)', 1],
      ] as const) {
        await page.evaluate(
          (colour) =>
            document.documentElement.style.setProperty(
              '--lq-album-fill',
              colour,
            ),
          colour,
        );
        await expect
          .poll(
            () =>
              page.evaluate((dominant) => {
                const canvas =
                  document.querySelector<HTMLCanvasElement>('#visualizer')!;
                const context = canvas.getContext('2d')!;
                const totals = [0, 0, 0];
                for (let y = 1; y < 16; y++)
                  for (let x = 1; x < 16; x++) {
                    const pixel = context.getImageData(
                      Math.floor((canvas.width * x) / 16),
                      Math.floor((canvas.height * y) / 16),
                      1,
                      1,
                    ).data;
                    totals.forEach((_, i) => (totals[i] += pixel[i]));
                  }
                return (
                  totals[dominant] /
                  Math.max(1, ...totals.filter((_, i) => i !== dominant))
                );
              }, dominant),
            { timeout: 8000 },
          )
          .toBeGreaterThan(2);
        await capture(page, `presentation-colour-${name}`);
      }
    } finally {
      await page.evaluate(
        (colour) =>
          document.documentElement.style.setProperty('--lq-album-fill', colour),
        originalFill,
      );
    }
    const cadence = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let count = 0;
          const started = performance.now();
          const tick = () =>
            ++count === 60
              ? resolve((performance.now() - started) / 60)
              : requestAnimationFrame(tick);
          requestAnimationFrame(tick);
        }),
    );
    console.log(
      `Album-coloured Butterchurn frame cadence: ${cadence.toFixed(1)} ms`,
    );
    expect(cadence).toBeLessThan(100);
    await setOption('VIZ: show side panel', true);
    await page.setViewportSize({ width: 760, height: 600 });
    await expect(page.locator('#lq-viz-lyrics')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const overlay = document
            .querySelector('#lq-viz-lyrics')!
            .getBoundingClientRect();
          const panel = document
            .querySelector('#player-page #side-panel')!
            .getBoundingClientRect();
          return overlay.bottom <= panel.top || overlay.right <= panel.left;
        }),
      )
      .toBe(true);
    await capture(page, 'presentation-narrow-panel-and-overlay');
    await page.setViewportSize({ width: 1280, height: 800 });
    await setOption('VIZ: overlay lyrics', false);
    await expect(page.locator('#lq-viz-lyrics')).toBeHidden();
    await setOption('VIZ: show side panel', true);
    await expect(page.locator('#player-page #side-panel')).toHaveCSS(
      'visibility',
      'visible',
    );
    await setOption('VIZ: match album colours', false);
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-lq-viz-album-colors',
      '',
    );
    await setOption('VIZ: show side panel', false);
    await setOption('VIZ: overlay lyrics', true);
    // Escape also closes YouTube Music's player page. Toggle VIZ off while
    // keeping the player open to isolate restoration of the normal inspector.
    await page.locator('#lacquer-viz-button').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-lq-viz', '');
    await expect(page.locator('#lq-viz-lyrics')).toBeHidden();
    await expect(page.locator('#player-page #side-panel')).toHaveCSS(
      'visibility',
      'visible',
    );
  } finally {
    await page.evaluate(async (original) => {
      window.mainConfig.set('lacquer', original.lacquer);
      await window.ipcRenderer.invoke(
        'peard:set-config',
        'visualizer',
        original.visualizer,
      );
    }, original);
    await dispose();
  }
});
