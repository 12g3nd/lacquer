import { expect, test, type Page } from '@playwright/test';

import { attachToLacquer, capture, settle, showBrowse } from './harness';

type ConfigBridge = {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  plugins: {
    getOptions(id: string): Record<string, unknown>;
    setOptions(
      id: string,
      value: Record<string, unknown>,
      defaults?: unknown[],
    ): void;
  };
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

test('shell-polish-titlebar: search is one bounded Instrument surface and the lockup is legible', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));

  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForSelector('ytmusic-search-box input', { timeout: 30_000 });
    await page.locator('ytmusic-search-box input').first().click();
    await settle(page, 500);

    const state = await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>(
        'ytmusic-search-box input',
      )!;
      const host = input.closest('ytmusic-search-box')!;
      const hostRect = host.getBoundingClientRect();
      const paintedAncestors: Array<{
        selector: string;
        background: string;
        top: number;
        bottom: number;
        height: number;
      }> = [];

      for (
        let element: Element | null = input;
        element;
        element = element.parentElement
      ) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          paintedAncestors.push({
            selector: `${element.tagName.toLowerCase()}#${element.id}.${[
              ...element.classList,
            ].join('.')}`,
            background: style.backgroundColor,
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
          });
        }
        if (element === host) break;
      }

      const wordmark = document.querySelector<SVGElement>('.lq-wordmark-svg');
      const details = [
        host,
        host.querySelector('.search-box'),
        host.parentElement,
        document.querySelector('ytmusic-nav-bar #center-content'),
      ]
        .filter((element): element is Element => element !== null)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const before = getComputedStyle(element, '::before');
          const after = getComputedStyle(element, '::after');
          return {
            selector: `${element.tagName.toLowerCase()}#${element.id}.${[
              ...element.classList,
            ].join('.')}`,
            rect: {
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            },
            background: style.backgroundColor,
            borderRadius: style.borderRadius,
            overflow: style.overflow,
            before: {
              content: before.content,
              background: before.background,
              boxShadow: before.boxShadow,
            },
            after: {
              content: after.content,
              background: after.background,
              boxShadow: after.boxShadow,
            },
          };
        });
      const paintedDescendants = [...host.querySelectorAll('*')]
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            selector: `${element.tagName.toLowerCase()}#${element.id}.${[
              ...element.classList,
            ].join('.')}`,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            background: style.backgroundColor,
            display: style.display,
            visibility: style.visibility,
          };
        })
        .filter(
          ({ background, display, visibility, width, height }) =>
            background !== 'rgba(0, 0, 0, 0)' &&
            display !== 'none' &&
            visibility !== 'hidden' &&
            width > 0 &&
            height > 0,
        );
      return {
        host: {
          top: hostRect.top,
          bottom: hostRect.bottom,
          height: hostRect.height,
        },
        paintedAncestors,
        paintedDescendants,
        details,
        inputOutline: getComputedStyle(input).outlineStyle,
        wordmarkHeight: wordmark ? getComputedStyle(wordmark).height : null,
      };
    });

    console.log(`  shell polish before: ${JSON.stringify(state)}`);
    await capture(page, 'shell-polish-titlebar-before');
    expect(state.host.height).toBeLessThanOrEqual(48);
    expect(state.inputOutline).toBe('none');
    expect(
      state.details.find(({ selector }) => selector.includes('.search-box')),
    ).toMatchObject({
      background: 'rgb(23, 58, 106)',
      borderRadius: '999px',
      overflow: 'hidden',
    });
    expect(
      state.paintedDescendants.every(
        ({ top, bottom }) =>
          top >= state.host.top - 1 && bottom <= state.host.bottom + 1,
      ),
    ).toBe(true);
    expect(
      state.paintedAncestors.every(
        ({ background, top, bottom }) =>
          background !== 'rgb(0, 0, 0)' &&
          top >= state.host.top - 1 &&
          bottom <= state.host.bottom + 1,
      ),
    ).toBe(true);
    expect(state.wordmarkHeight).toBe('28px');
    await capture(page, 'shell-polish-titlebar');

    await page.setViewportSize({ width: 760, height: 720 });
    await settle(page, 350);
    const narrow = await page.evaluate(() => {
      const wordmark = document
        .querySelector('#lacquer-wordmark')!
        .getBoundingClientRect();
      const search = document
        .querySelector('ytmusic-search-box')!
        .getBoundingClientRect();
      return {
        wordmarkRight: wordmark.right,
        wordmarkVisibility: getComputedStyle(
          document.querySelector('#lacquer-wordmark')!,
        ).visibility,
        searchLeft: search.left,
      };
    });
    expect(
      narrow.wordmarkVisibility === 'hidden' ||
        narrow.wordmarkRight <= narrow.searchLeft - 8,
    ).toBe(true);
    await capture(page, 'shell-polish-titlebar-narrow');
  } finally {
    await dispose();
  }
});

test('shell-polish-viz: enabling from browse reveals the player and starts the visualizer', async () => {
  test.setTimeout(120_000);
  const { page, dispose } = await attachToLacquer();
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));
  const original = await page.evaluate(() => {
    const config = window.mainConfig as unknown as ConfigBridge;
    return {
      mode: config.get('lacquer.visualizerMode'),
      visualizer: config.plugins.getOptions('visualizer'),
    };
  });

  try {
    await page.evaluate(() => {
      const config = window.mainConfig as unknown as ConfigBridge;
      config.set('lacquer.visualizerMode', false);
      config.plugins.setOptions('visualizer', { enabled: false }, []);
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#lacquer-viz-button', {
      state: 'attached',
      timeout: 30_000,
    });
    await ensurePlaying(page);
    await showBrowse(page);

    await page.locator('#lacquer-viz-button').click();

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .querySelector('ytmusic-app-layout')
              ?.hasAttribute('player-page-open') ?? false,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          active: document.documentElement.hasAttribute('data-lq-viz'),
          canvasCount: document.querySelectorAll('#visualizer').length,
        })),
      )
      .toEqual({ active: true, canvasCount: 1 });

    await showBrowse(page);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          armed: document.documentElement.hasAttribute('data-lq-viz-suspended'),
          active: document.documentElement.hasAttribute('data-lq-viz'),
        })),
      )
      .toEqual({ armed: true, active: false });

    await page.locator('#lacquer-viz-button').click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .querySelector('ytmusic-app-layout')
              ?.hasAttribute('player-page-open') ?? false,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          active: document.documentElement.hasAttribute('data-lq-viz'),
          canvasCount: document.querySelectorAll('#visualizer').length,
        })),
      )
      .toEqual({ active: true, canvasCount: 1 });
  } finally {
    await page
      .evaluate(({ mode, visualizer }) => {
        const config = window.mainConfig as unknown as ConfigBridge;
        config.set('lacquer.visualizerMode', mode ?? false);
        config.plugins.setOptions('visualizer', visualizer, []);
      }, original)
      .catch(() => undefined);
    await dispose();
  }
});
