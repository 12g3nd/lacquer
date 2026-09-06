import { expect, test } from '@playwright/test';
import { attachToLacquer, capture } from './harness';

test('menus cover lyrics and long metadata retains artist album and year', async () => {
  const { page, dispose } = await attachToLacquer();
  let style: Awaited<ReturnType<typeof page.addStyleTag>> | undefined;
  try {
    await page.mouse.click(650, 350);
    if (
      (await page
        .locator('#lacquer-viz-button')
        .getAttribute('aria-pressed')) !== 'true'
    ) {
      await page.locator('#lacquer-viz-button').click();
    }
    await page.evaluate(() =>
      document
        .querySelector<HTMLElement>('ytmusic-player-bar .menu button')!
        .click(),
    );
    const menu = page.locator('ytmusic-menu-popup-renderer');
    await expect(menu).toBeVisible();
    const rect = (await menu.boundingBox())!;
    style = await page.addStyleTag({
      content: `:root[data-lq-viz] #lq-viz-lyrics { display:block !important; pointer-events:auto !important; inset:${rect.y}px auto auto ${rect.x}px !important; width:${rect.width}px; height:${rect.height}px; }`,
    });
    const front = await menu.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      );
    });
    expect(front).toBe(true);
    await capture(page, 'context-menu-over-lyrics');
    await page.mouse.click(650, 350);
    await style.evaluate((el) => el.remove());
    style = undefined;
    await page.locator('#lacquer-gear-button').click();
    const settings = page.locator('#lacquer-settings-menu-container');
    await expect(settings).toBeVisible();
    expect(
      await settings.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
    ).toBe(true);
    await capture(page, 'settings-above-lyrics');
    await page.locator('#lacquer-gear-button').click();

    const links = page.locator('ytmusic-player-bar .byline > a');
    const original = await links.allTextContents();
    try {
      await links.evaluateAll((els) =>
        els.forEach(
          (el, i) =>
            (el.textContent =
              i === 0
                ? 'An Artist With An Exceptionally Long Name'
                : 'A Very Long Album Title (Expanded Anniversary Edition)'),
        ),
      );
      for (const width of [1440, 1100, 800]) {
        await page.setViewportSize({ width, height: 900 });
        const dimensions = await page
          .locator('ytmusic-player-bar .byline')
          .evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [...el.children].map((child) => {
              const c = child.getBoundingClientRect();
              return {
                width: c.width,
                inside: c.left >= r.left - 1 && c.right <= r.right + 1,
              };
            });
          });
        expect(dimensions.every((d) => d.inside && d.width > 0)).toBe(true);
        await capture(page, `long-metadata-${width}`);
      }
    } finally {
      await links.evaluateAll(
        (els, values) => els.forEach((el, i) => (el.textContent = values[i])),
        original,
      );
    }
  } finally {
    await style?.evaluate((el) => el.remove());
    await dispose();
  }
});
