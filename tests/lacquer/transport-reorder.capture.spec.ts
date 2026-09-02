import { expect, test, type Page } from '@playwright/test';

import { attachToLacquer, capture, settle, showBrowse } from './harness';

type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type DeckLayout = {
  viewportWidth: number;
  identity: Rect;
  transport: Rect;
  output: Rect;
  titleOverflow: string;
  titleWhiteSpace: string;
  identityAncestors: string[];
  barChildren: string[];
};

const ensurePlaying = async (page: Page) => {
  const hasTrack = await page.evaluate(
    () =>
      !!document
        .querySelector('ytmusic-player-bar .title')
        ?.textContent?.trim(),
  );
  if (hasTrack) return;

  const search = page.locator('ytmusic-search-box input').first();
  await search.click();
  await search.fill('IGOR Tyler the Creator');
  await page.keyboard.press('Enter');
  await settle(page, 3500);
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>(
        'ytmusic-responsive-list-item-renderer #play-button, ' +
          'ytmusic-responsive-list-item-renderer ytmusic-play-button-renderer',
      )
      ?.click();
  });
  await settle(page, 4000);
};

const deckLayout = (page: Page): Promise<DeckLayout> =>
  page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('ytmusic-player-bar');
    const play = bar?.querySelector<HTMLElement>('#play-pause-button');
    const identity = bar?.querySelector<HTMLElement>('.content-info-wrapper');
    const transport =
      play?.closest<HTMLElement>('.left-controls') ??
      play?.closest<HTMLElement>('.middle-controls') ??
      play?.parentElement;
    const output =
      bar?.querySelector<HTMLElement>('.right-controls') ??
      bar?.querySelector<HTMLElement>('.right-controls-buttons');
    const title = bar?.querySelector<HTMLElement>('.title');

    if (!bar || !identity || !transport || !output || !title) {
      throw new Error(
        JSON.stringify({
          bar: !!bar,
          identity: identity?.className ?? null,
          playParent: play?.parentElement?.className ?? null,
          playGrandparent:
            play?.parentElement?.parentElement?.className ?? null,
          output: output?.className ?? null,
          children: [...(bar?.children ?? [])].map((node) => node.className),
        }),
      );
    }

    const rect = (element: HTMLElement) => {
      const value = element.getBoundingClientRect();
      return {
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };

    const titleStyle = getComputedStyle(title);
    return {
      viewportWidth: innerWidth,
      identity: rect(identity),
      transport: rect(transport),
      output: rect(output),
      titleOverflow: titleStyle.overflow,
      titleWhiteSpace: titleStyle.whiteSpace,
      identityAncestors: [
        identity,
        identity.parentElement,
        identity.parentElement?.parentElement,
      ]
        .filter(
          (element): element is HTMLElement => element instanceof HTMLElement,
        )
        .map(
          (element) => `${element.tagName.toLowerCase()}.${element.className}`,
        ),
      barChildren: [...bar.children].map(
        (element) => `${element.tagName.toLowerCase()}.${element.className}`,
      ),
    };
  });

const expectReordered = (layout: DeckLayout) => {
  const centre = (layout.transport.left + layout.transport.right) / 2;
  expect(
    layout.identity.right,
    `identity must end before transport starts at ${layout.viewportWidth}px`,
  ).toBeLessThanOrEqual(layout.transport.left + 1);
  expect(
    layout.transport.right,
    `transport must end before output starts at ${layout.viewportWidth}px`,
  ).toBeLessThanOrEqual(layout.output.left + 1);
  expect(
    Math.abs(centre - layout.viewportWidth / 2),
    `transport must remain centred at ${layout.viewportWidth}px`,
  ).toBeLessThanOrEqual(Math.max(48, layout.viewportWidth * 0.055));
  expect(layout.titleOverflow).toBe('hidden');
  expect(layout.titleWhiteSpace).toBe('nowrap');
};

test('transport deck is identity-left, controls-centre, output-right at every supported width', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));

  try {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.waitForSelector('ytmusic-player-bar', {
      state: 'attached',
      timeout: 30_000,
    });
    await ensurePlaying(page);
    await showBrowse(page);

    for (const width of [1920, 1280, 760]) {
      await page.setViewportSize({ width, height: width === 760 ? 800 : 1000 });
      await settle(page, 500);
      if (width === 760) {
        await page.evaluate(() => {
          const bar = document.querySelector('ytmusic-player-bar');
          const title = bar?.querySelector<HTMLElement>('.title');
          const byline = bar?.querySelector<HTMLElement>('.byline, .subtitle');
          if (title)
            title.textContent =
              'A deliberately, extravagantly long song title that must truncate';
          if (byline)
            byline.textContent =
              'An equally long artist name featuring several guests';
        });
      }
      const layout = await deckLayout(page);
      console.log(`  transport ${width}: ${JSON.stringify(layout)}`);
      expectReordered(layout);
      await capture(page, `transport-reordered-playing-${width}`);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('ytmusic-player-bar #play-pause-button').click();
    await settle(page, 500);
    expectReordered(await deckLayout(page));
    await capture(page, 'transport-reordered-paused-1280');

    await page.evaluate(() =>
      document.documentElement.toggleAttribute('data-lq-ad', true),
    );
    expectReordered(await deckLayout(page));
    await page.evaluate(() =>
      document.documentElement.toggleAttribute('data-lq-ad', false),
    );
  } finally {
    await page
      .evaluate(() => {
        const video = document.querySelector<HTMLVideoElement>('video');
        if (video?.paused) {
          document
            .querySelector<HTMLElement>('ytmusic-player-bar #play-pause-button')
            ?.click();
        }
      })
      .catch(() => undefined);
    await dispose();
  }
});
