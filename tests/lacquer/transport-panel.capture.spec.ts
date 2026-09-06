import { expect, test } from '@playwright/test';
import { attachToLacquer, capture } from './harness';

test('transport panel stays above lyrics and pitch slider works at both ends', async () => {
  const { page, dispose } = await attachToLacquer();
  const saved = await page.evaluate(() => localStorage.getItem('lacquer.fx'));
  try {
    await page.locator('#lacquer-fx-button').waitFor();
    await page.locator('#lacquer-fx-button').click();
    const rack = page.locator('#lacquer-fx-rack');
    // Put the real lyric surface across the rack to exercise the reported overlap.
    const lyricStyle = await page.addStyleTag({
      content:
        '#lq-viz-lyrics { display: block !important; inset: auto 16px 210px auto !important; width: 340px; z-index: 2147483647 !important; }',
    });
    await expect(rack).toBeVisible();
    expect(await rack.evaluate((el) => el.matches(':popover-open'))).toBe(true);
    const pitch = page.getByRole('slider', { name: 'Pitch mode', exact: true });
    await pitch.focus();
    await pitch.press('Home');
    await expect(pitch).toHaveAttribute('aria-valuetext', 'Variable');
    expect(
      await page.evaluate(
        () => document.querySelector('video')?.preservesPitch,
      ),
    ).toBe(false);
    await pitch.press('End');
    await expect(pitch).toHaveAttribute('aria-valuetext', 'Lock');
    expect(
      await page.evaluate(
        () => document.querySelector('video')?.preservesPitch,
      ),
    ).toBe(true);
    for (const width of [1440, 1100, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(400);
      const bounds = await rack.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(
        await rack.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            ),
          );
        }),
      ).toBe(true);
      await capture(page, `transport-polish-${width}`);
    }
    await lyricStyle.evaluate((el) => el.remove());
    await pitch.press('Escape');
    await expect(page.locator('#lacquer-fx-button')).toBeFocused();
    await expect(rack).not.toBeVisible();
  } finally {
    await page.evaluate((value) => {
      if (value === null) localStorage.removeItem('lacquer.fx');
      else localStorage.setItem('lacquer.fx', value);
    }, saved);
    await dispose();
  }
});
