import { expect, test, type Page } from '@playwright/test';

import {
  attachToLacquer,
  capture,
  settle,
  showBrowse,
  showPlayer,
} from './harness';

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
  if (!hasTrack) {
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
  }
};

const expectMode = async (
  page: Page,
  expected: {
    armed: boolean;
    active: boolean;
    pluginEnabled: boolean;
    canvasCount: number;
  },
) => {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const button = document.querySelector('#lacquer-viz-button');
        const config = window.mainConfig as unknown as ConfigBridge;
        return {
          armed: button?.getAttribute('aria-pressed') === 'true',
          active: document.documentElement.hasAttribute('data-lq-viz'),
          pluginEnabled:
            config.plugins.getOptions('visualizer').enabled === true,
          canvasCount: document.querySelectorAll('#visualizer').length,
        };
      }),
    )
    .toEqual(expected);
};

test('Visualizer Mode arms, suspends on browse, resumes, and survives reload', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));

  const original = await page.evaluate(() => ({
    mode: (window.mainConfig as unknown as ConfigBridge).get(
      'lacquer.visualizerMode',
    ),
    visualizer: (
      window.mainConfig as unknown as ConfigBridge
    ).plugins.getOptions('visualizer'),
  }));

  try {
    await page.evaluate(() => {
      (window.mainConfig as unknown as ConfigBridge).set(
        'lacquer.visualizerMode',
        false,
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('ytmusic-player-bar', {
      state: 'attached',
      timeout: 30_000,
    });
    await ensurePlaying(page);
    await showPlayer(page, 800);

    const button = page.locator('#lacquer-viz-button');
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(
      await page.evaluate(() => {
        const config = window.mainConfig as unknown as ConfigBridge;
        const shortcuts = config.plugins.getOptions('shortcuts') as {
          local?: { visualizerModeToggle?: string };
        };
        return shortcuts.local?.visualizerModeToggle;
      }),
    ).toBe('CommandOrControl+Shift+V');
    const baseSheetCount = await page.evaluate(
      () => document.adoptedStyleSheets.length,
    );

    await button.click();
    await expectMode(page, {
      armed: true,
      active: true,
      pluginEnabled: true,
      canvasCount: 1,
    });
    await expect
      .poll(() => page.evaluate(() => document.adoptedStyleSheets.length))
      .toBe(baseSheetCount + 1);
    await capture(page, 'visualizer-mode-active');

    await showBrowse(page);
    await expectMode(page, {
      armed: true,
      active: false,
      pluginEnabled: false,
      canvasCount: 0,
    });
    await expect
      .poll(() => page.evaluate(() => document.adoptedStyleSheets.length))
      .toBe(baseSheetCount);

    await showPlayer(page, 800);
    await expectMode(page, {
      armed: true,
      active: true,
      pluginEnabled: true,
      canvasCount: 1,
    });
    await expect
      .poll(() => page.evaluate(() => document.adoptedStyleSheets.length))
      .toBe(baseSheetCount + 1);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('ytmusic-player-bar', {
      state: 'attached',
      timeout: 30_000,
    });
    await showPlayer(page, 800);
    await expectMode(page, {
      armed: true,
      active: true,
      pluginEnabled: true,
      canvasCount: 1,
    });

    await page.keyboard.press('Escape');
    await expectMode(page, {
      armed: false,
      active: false,
      pluginEnabled: false,
      canvasCount: 0,
    });

    await showPlayer(page, 800);
    await button.click();
    await expectMode(page, {
      armed: true,
      active: true,
      pluginEnabled: true,
      canvasCount: 1,
    });
    await button.click();
    await expectMode(page, {
      armed: false,
      active: false,
      pluginEnabled: false,
      canvasCount: 0,
    });
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

test('Visualizer Mode hides idle chrome, wakes instantly, and respects pins', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));

  const original = await page.evaluate(() => ({
    mode: (window.mainConfig as unknown as ConfigBridge).get(
      'lacquer.visualizerMode',
    ),
    visualizer: (
      window.mainConfig as unknown as ConfigBridge
    ).plugins.getOptions('visualizer'),
  }));

  try {
    await page.evaluate(() => {
      (window.mainConfig as unknown as ConfigBridge).set(
        'lacquer.visualizerMode',
        false,
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('ytmusic-player-bar', {
      state: 'attached',
      timeout: 30_000,
    });
    await ensurePlaying(page);
    await showPlayer(page, 800);

    await page.locator('#lacquer-viz-button').click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.hasAttribute('data-lq-viz'),
        ),
      )
      .toBe(true);

    // Clicking VIZ leaves the pointer over an interactive transport control,
    // which intentionally pins the chrome. Move into the visual field before
    // asserting the idle path.
    await page.mouse.move(700, 300);

    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.hasAttribute('data-lq-viz-chrome-hidden'),
        ),
      )
      .toBe(true);

    const hiddenChrome = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('ytmusic-nav-bar');
      const root = document.documentElement;
      return {
        opacity: nav ? getComputedStyle(nav).opacity : null,
        ariaHidden: nav?.getAttribute('aria-hidden') ?? null,
        cursor: getComputedStyle(root).cursor,
      };
    });
    expect(hiddenChrome).toEqual({
      opacity: '0',
      ariaHidden: null,
      cursor: 'none',
    });

    await page.mouse.move(700, 300);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            !document.documentElement.hasAttribute('data-lq-viz-chrome-hidden'),
        ),
      )
      .toBe(true);

    const fxButton = page.locator('#lacquer-fx-button');
    await fxButton.click();
    await expect(fxButton).toHaveAttribute('aria-expanded', 'true');
    await page.waitForTimeout(3400);
    expect(
      await page.evaluate(() =>
        document.documentElement.hasAttribute('data-lq-viz-chrome-hidden'),
      ),
    ).toBe(false);
    await fxButton.click();

    const gear = page.locator('#lacquer-gear-button');
    await gear.focus();
    await page.waitForTimeout(3400);
    expect(
      await page.evaluate(() =>
        document.documentElement.hasAttribute('data-lq-viz-chrome-hidden'),
      ),
    ).toBe(false);

    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.mouse.move(700, 300);
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.hasAttribute('data-lq-viz-chrome-hidden'),
        ),
      )
      .toBe(true);

    await showBrowse(page);
    expect(
      await page.evaluate(() => ({
        armed:
          document
            .querySelector('#lacquer-viz-button')
            ?.getAttribute('aria-pressed') === 'true',
        active: document.documentElement.hasAttribute('data-lq-viz'),
        hidden: document.documentElement.hasAttribute(
          'data-lq-viz-chrome-hidden',
        ),
        cursor: getComputedStyle(document.documentElement).cursor,
      })),
    ).toEqual({ armed: true, active: false, hidden: false, cursor: 'auto' });
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

test('authored treatments take over the shell and standalone mode stays local', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));

  const original = await page.evaluate(() => ({
    mode: (window.mainConfig as unknown as ConfigBridge).get(
      'lacquer.visualizerMode',
    ),
    visualizer: (
      window.mainConfig as unknown as ConfigBridge
    ).plugins.getOptions('visualizer'),
  }));

  try {
    await page.evaluate((visualizer) => {
      const config = window.mainConfig as unknown as ConfigBridge;
      config.set('lacquer.visualizerMode', false);
      config.plugins.setOptions(
        'visualizer',
        { ...visualizer, enabled: false, type: 'lacquer-orbital' },
        [],
      );
    }, original.visualizer);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('ytmusic-player-bar', {
      state: 'attached',
      timeout: 30_000,
    });
    await ensurePlaying(page);
    await showPlayer(page, 800);
    await page.locator('#lacquer-viz-button').click();
    await page.waitForSelector(
      ":root[data-lq-viz][data-lq-viz-treatment='orbital'] #visualizer",
      { timeout: 20_000 },
    );

    const orbital = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#visualizer')!;
      const rect = canvas.getBoundingClientRect();
      const artwork = document.querySelector<HTMLElement>('#player');
      return {
        parent: canvas.parentElement?.tagName,
        takeover: canvas.hasAttribute('data-lq-viz-takeover'),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        viewport: [window.innerWidth, window.innerHeight],
        artworkOpacity: artwork ? getComputedStyle(artwork).opacity : null,
        kickToken:
          document.documentElement.style.getPropertyValue('--lq-viz-kick'),
      };
    });
    expect(orbital).toMatchObject({
      parent: 'HTML',
      takeover: true,
      artworkOpacity: '1',
    });
    expect(orbital.width).toBe(orbital.viewport[0]);
    expect(orbital.height).toBe(orbital.viewport[1]);
    expect(orbital.kickToken).not.toBe('');
    await page.mouse.move(700, 300);
    await capture(page, 'visualizer-orbital-album');

    const rootTokens = await page.evaluate(() => {
      const root = document.documentElement;
      return {
        atmosphere: root.style.getPropertyValue('--lq-album-atmosphere'),
        fill: root.style.getPropertyValue('--lq-album-fill'),
        veil: root.style.getPropertyValue('--lq-album-veil'),
      };
    });
    const stressPalettes = {
      dark: ['rgb(35, 61, 102)', 'rgb(80, 132, 220)', 'rgb(8, 17, 37)'],
      bright: ['rgb(209, 165, 98)', 'rgb(245, 198, 112)', 'rgb(55, 39, 24)'],
      saturated: ['rgb(164, 62, 128)', 'rgb(232, 76, 154)', 'rgb(54, 14, 46)'],
    } as const;
    for (const [name, tokens] of Object.entries(stressPalettes)) {
      await page.evaluate(([atmosphere, fill, veil]) => {
        const root = document.documentElement;
        root.style.setProperty('--lq-album-atmosphere', atmosphere);
        root.style.setProperty('--lq-album-fill', fill);
        root.style.setProperty('--lq-album-veil', veil);
      }, tokens);
      await settle(page, 220);
      await capture(page, `visualizer-orbital-${name}`);
    }
    await page.evaluate((tokens) => {
      const root = document.documentElement;
      root.style.setProperty('--lq-album-atmosphere', tokens.atmosphere);
      root.style.setProperty('--lq-album-fill', tokens.fill);
      root.style.setProperty('--lq-album-veil', tokens.veil);
    }, rootTokens);

    await page.evaluate(async () => {
      await window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
        type: 'lacquer-rave',
      });
    });
    await page.waitForSelector(
      ":root[data-lq-viz][data-lq-viz-treatment='rave'] #visualizer",
      { timeout: 10_000 },
    );
    await settle(page, 700);
    expect(
      await page.evaluate(() => ({
        artwork: getComputedStyle(document.querySelector('#player')!).opacity,
        now: getComputedStyle(document.querySelector('#lacquer-now')!).opacity,
      })),
    ).toEqual({ artwork: '0', now: '0' });
    await page.mouse.move(700, 300);
    await capture(page, 'visualizer-rave-laser-basilica-album');

    await page.evaluate(async () => {
      await window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
        type: 'butterchurn',
      });
    });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          canvas: document.querySelectorAll('#visualizer').length,
          treatment: document.documentElement.getAttribute(
            'data-lq-viz-treatment',
          ),
        })),
      )
      .toEqual({ canvas: 1, treatment: null });

    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      await window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
        enabled: true,
        type: 'lacquer-orbital',
      });
    });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          active: document.documentElement.hasAttribute('data-lq-viz'),
          parent: document.querySelector('#visualizer')?.parentElement?.id,
          takeover: document
            .querySelector('#visualizer')
            ?.hasAttribute('data-lq-viz-takeover'),
        })),
      )
      .toEqual({ active: false, parent: 'player', takeover: false });
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
