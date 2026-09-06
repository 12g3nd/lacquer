import { expect, test } from '@playwright/test';
import { attachToLacquer, capture } from './harness';

test('global effects survive a track change and full-screen visualizer exits with Escape', async () => {
  const { page, dispose } = await attachToLacquer();
  const saved = await page.evaluate(() => localStorage.getItem('lacquer.fx'));
  try {
    await page.locator('#lacquer-fx-button').click();
    await page.getByRole('button', { name: 'Tape', exact: true }).click();
    await page
      .getByRole('slider', { name: 'Playback speed', exact: true })
      .fill('0.83');
    await page
      .getByRole('slider', { name: 'Reverb amount', exact: true })
      .fill('0.54');
    await page
      .getByRole('slider', { name: 'Stereo width', exact: true })
      .fill('1.75');
    await page
      .getByRole('slider', { name: 'Pitch mode', exact: true })
      .press('Home');
    const state = await page.evaluate(() => localStorage.getItem('lacquer.fx'));
    await page.evaluate(() => {
      document.querySelector('video')!.playbackRate = 1;
    });
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('video')?.playbackRate),
      )
      .toBe(0.83);
    await page.keyboard.press('Escape');
    const title = page.locator('ytmusic-player-bar .title').first();
    const before = await title.textContent();
    await page.locator('ytmusic-player-bar .next-button').click();
    await expect(title).not.toHaveText(before!);
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector('video')?.playbackRate),
      )
      .toBe(0.83);
    expect(
      await page.evaluate(
        () => document.querySelector('video')?.preservesPitch,
      ),
    ).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('lacquer.fx'))).toBe(
      state,
    );
    await page.locator('#lacquer-fx-button').click();
    await capture(page, 'global-effects-next-track');
    await page.keyboard.press('Escape');

    await page.locator('#lacquer-viz-fullscreen').click();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.fullscreenElement === document.documentElement,
        ),
      )
      .toBe(true);
    await expect(page.locator('html')).toHaveAttribute(
      'data-lq-viz-fullscreen',
      '',
    );
    await expect(page.locator('#lq-viz-song-header h1')).toHaveText(
      (await title.textContent())!.trim(),
    );
    await expect(page.locator('ytmusic-app')).toHaveCSS('opacity', '0');
    await expect(page.locator('#visualizer')).toBeAttached();
    await page.evaluate(() => {
      document.querySelector('video')!.currentTime = 65;
    });
    await expect(page.locator('#lq-viz-lyrics')).toBeVisible();
    await expect(page.locator('ytmusic-app')).toHaveAttribute('inert', '');
    await page.waitForTimeout(1500);
    await capture(page, 'visualizer-fullscreen');
    await page.keyboard.press('Escape');
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement))
      .toBe(null);
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-lq-viz-fullscreen',
    );
    await expect(page.locator('#lacquer-viz-fullscreen')).toBeFocused();
    await expect(page.locator('ytmusic-player-bar .menu')).toBeHidden();
    for (const width of [1440, 1100, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      await capture(page, `metadata-fields-${width}`);
    }
  } finally {
    if (await page.evaluate(() => !!document.fullscreenElement))
      await page.evaluate(() => document.exitFullscreen());
    await page.evaluate((value) => {
      if (value === null) localStorage.removeItem('lacquer.fx');
      else localStorage.setItem('lacquer.fx', value);
    }, saved);
    await dispose();
  }
});
