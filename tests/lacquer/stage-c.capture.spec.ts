import { test, expect, type Locator, type Page } from '@playwright/test';

import {
  attachToLacquer,
  capture,
  isSignedIn,
  settle,
  showBrowse,
  showPlayer,
} from './harness';

/**
 * Stage C's screenshot gate — the ten-shot table in
 * `docs/lacquer/plans/STAGE_C.md`, plus the report checks:
 *
 *   - the FX rack as an instrument panel (Original, Slowed + Reverb, over
 *     bright artwork, and the quiet active indicator on the FX button)
 *   - the reorganised context menu (tier 1, More… expanded, keyboard focus)
 *   - the SVG wordmark at titlebar size
 *   - the full window at two sizes
 *
 * Captures attach over CDP to the running signed-in app and toggle the
 * player-page overlay; they never navigate to switch views.
 */

test.describe.configure({ mode: 'serial' });

const written: string[] = [];
const shot = async (page: Page, name: string) => {
  written.push(await capture(page, name));
};
const shotOf = async (page: Page, target: Locator, name: string) => {
  const file = `test-results/capture/${name}.png`;
  const ok = await target
    .first()
    .screenshot({ path: file, timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  written.push(ok ? file : await capture(page, `${name}-fallback-fullpage`));
};

const driveAlbumColor = (page: Page, triple: string) =>
  page
    .evaluate((value) => {
      document.documentElement.style.setProperty(
        '--ytmusic-album-color',
        value,
      );
    }, triple)
    .then(() => settle(page, 1100));

/** Make sure a track is playing — the running app usually restores one. */
const ensurePlaying = async (page: Page) => {
  const playing = () =>
    page.evaluate(
      () =>
        !!document
          .querySelector('ytmusic-player-bar .title')
          ?.textContent?.trim(),
    );
  if (await playing()) return;

  const box = page.locator('ytmusic-search-box input').first();
  await box.click().catch(() => undefined);
  await box.fill('IGOR Tyler the Creator').catch(() => undefined);
  await page.keyboard.press('Enter');
  await settle(page, 3500);
  await page.keyboard.press('Escape');
  await page
    .evaluate(() => {
      document
        .querySelector<HTMLElement>(
          'ytmusic-responsive-list-item-renderer #play-button, ' +
            'ytmusic-responsive-list-item-renderer ytmusic-play-button-renderer',
        )
        ?.click();
    })
    .catch(() => undefined);
  await settle(page, 4000);
};

const openFxRack = (page: Page) =>
  page.evaluate(() => {
    const rack = document.getElementById('lacquer-fx-rack');
    if (rack?.hasAttribute('hidden')) {
      document.getElementById('lacquer-fx-button')?.click();
    }
  });

const selectPreset = (page: Page, label: string) =>
  page.evaluate((name) => {
    const button = [
      ...document.querySelectorAll<HTMLElement>(
        '#lacquer-fx-rack .lq-fx-preset',
      ),
    ].find((el) => el.textContent?.trim() === name);
    button?.focus();
    button?.click();
  }, label);

test('Stage C — FX rack', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (d) => void d.dismiss().catch(() => undefined));

  try {
    expect(await isSignedIn(page), 'attached session is signed out').toBe(true);

    await page.setViewportSize({ width: 1600, height: 1000 });
    await page
      .goto('https://music.youtube.com/', { waitUntil: 'domcontentloaded' })
      .catch(() => undefined);
    await page
      .waitForSelector('ytmusic-player-bar', { timeout: 30_000 })
      .catch(() => undefined);
    await settle(page, 2500);
    await ensurePlaying(page);

    const rack = page.locator('#lacquer-fx-rack');

    /* 1 — FX rack open, Original. Instrument material, mono readouts, tokens. */
    await selectPreset(page, 'Original');
    await openFxRack(page);
    await settle(page, 600);
    const rackState = await page.evaluate(() => {
      const el = document.getElementById('lacquer-fx-rack');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const readout = document.querySelector('#lacquer-fx-rack .lq-fx-readout');
      return {
        hidden: el.hasAttribute('hidden'),
        background: cs.backgroundColor,
        backdrop: cs.backdropFilter,
        readoutFont: readout ? getComputedStyle(readout).fontFamily : null,
      };
    });
    console.log('  [fx-rack]', JSON.stringify(rackState));
    await shotOf(page, rack, '01-fx-rack-original');

    /* 2 — FX rack open, Slowed + Reverb. Active preset unambiguous. */
    await selectPreset(page, 'Slowed + Reverb');
    await settle(page, 500);
    await shotOf(page, rack, '02-fx-rack-slowed-reverb');

    /* 3 — FX rack over bright artwork. Blueglass legible against the stage. */
    await driveAlbumColor(page, '210, 176, 140');
    await showPlayer(page).catch(() => undefined);
    await settle(page, 1200);
    await openFxRack(page);
    await settle(page, 500);
    await shotOf(page, rack, '03-fx-rack-bright-artwork');
    await shot(page, '03b-fx-rack-over-stage-fullpage');

    /* 4 — FX button, effect active. Indicator quiet but clear. */
    await page.evaluate(() => {
      const rackEl = document.getElementById('lacquer-fx-rack');
      if (!rackEl?.hasAttribute('hidden')) {
        document.getElementById('lacquer-fx-button')?.click();
      }
    });
    await settle(page, 400);
    await shotOf(
      page,
      page.locator('ytmusic-player-bar .right-controls-buttons'),
      '04-fx-button-active',
    );

    await selectPreset(page, 'Original');
    await page.evaluate(() =>
      document.documentElement.style.removeProperty('--ytmusic-album-color'),
    );
  } finally {
    await dispose();
  }
});

test('Stage C — context menu, wordmark, window', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (d) => void d.dismiss().catch(() => undefined));

  try {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.keyboard.press('Escape');
    await showBrowse(page);
    await settle(page);

    /* Open a track context menu from the browse feed. */
    const opened = await page.evaluate(() => {
      const row = document.querySelector(
        'ytmusic-responsive-list-item-renderer',
      );
      const trigger =
        row?.querySelector<HTMLElement>(
          'ytmusic-menu-renderer yt-icon-button, ' +
            'ytmusic-menu-renderer tp-yt-paper-icon-button, ' +
            'button[aria-label*="menu" i]',
        ) ??
        document
          .querySelector('ytmusic-two-row-item-renderer')
          ?.querySelector<HTMLElement>('ytmusic-menu-renderer yt-icon-button');
      trigger?.click();
      return !!trigger;
    });
    console.log(`  context-menu trigger clicked: ${opened}`);
    await settle(page, 1200);

    const menu = page.locator('ytmusic-menu-popup-renderer');
    const menuReport = await page.evaluate(() => {
      const listbox = document.querySelector(
        'ytmusic-menu-popup-renderer tp-yt-paper-listbox',
      );
      if (!listbox) return null;
      const rows = [...listbox.children].map((c) => ({
        text: (c.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24),
        role: c.getAttribute('role'),
        tier2: c.classList.contains('lacquer-tier2'),
        hidden: (c as HTMLElement).hidden,
        tagged: c.hasAttribute('data-lacquer-menuitem'),
      }));
      return {
        count: listbox.children.length,
        blueglass: getComputedStyle(listbox).backgroundColor,
        rows,
      };
    });
    console.log('  [context-menu]', JSON.stringify(menuReport, null, 1));
    console.log(
      '  [context-menu direct-children]',
      await page.evaluate(() => {
        const lb = document.querySelector(
          'ytmusic-menu-popup-renderer tp-yt-paper-listbox',
        );
        return [...(lb?.children ?? [])].map(
          (c) =>
            `${c.tagName.toLowerCase()}${c.className.includes('lacquer') ? '(lq)' : ''}` +
            `[${c.getAttribute('role')}] "${(c.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)}"` +
            `${(c as HTMLElement).hidden ? ' HIDDEN' : ''}`,
        );
      }),
    );

    /* 5 — Context menu, tier 1. */
    await shotOf(page, menu, '05-context-menu-tier1');

    /* 7 — keyboard focus + one arrow step. (Done before More… so the menu is
       still in its initial state.) */
    await page.evaluate(() => {
      const first = document.querySelector<HTMLElement>(
        'ytmusic-menu-popup-renderer [data-lacquer-menuitem]:not([hidden])',
      );
      first?.focus();
    });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await settle(page, 300);
    const kbState = await page.evaluate(() => {
      const active = document.activeElement;
      return {
        activeText: (active?.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 24),
        inMenu: !!active?.closest('ytmusic-menu-popup-renderer'),
        focusVisible: !!active?.matches(':focus-visible'),
      };
    });
    console.log('  [context-menu keyboard]', JSON.stringify(kbState));
    await shotOf(page, menu, '07-context-menu-keyboard');

    /* 6 — More… expanded. */
    await page.evaluate(() => {
      const more = document.querySelector<HTMLElement>(
        'ytmusic-menu-popup-renderer [data-lacquer-more]',
      );
      more?.click();
    });
    await settle(page, 400);
    await page.evaluate(() => {
      const lb = document.querySelector(
        'ytmusic-menu-popup-renderer tp-yt-paper-listbox',
      );
      if (lb) lb.scrollTop = lb.scrollHeight;
    });
    await settle(page, 300);
    await shotOf(page, menu, '06-context-menu-more-expanded');

    /* End key reaches the last tier-2 item — nothing dropped. */
    await page.keyboard.press('End');
    await settle(page, 200);
    const endReach = await page.evaluate(() => {
      const active = document.activeElement;
      const all = [
        ...document.querySelectorAll(
          'ytmusic-menu-popup-renderer [data-lacquer-menuitem]:not([hidden])',
        ),
      ];
      return {
        activeText: (active?.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 24),
        atLast: active === all[all.length - 1],
        visibleCount: all.length,
      };
    });
    console.log('  [context-menu End]', JSON.stringify(endReach));

    // Type-ahead check.
    await page.evaluate(() => {
      const first = document.querySelector<HTMLElement>(
        'ytmusic-menu-popup-renderer [data-lacquer-menuitem]:not([hidden])',
      );
      first?.focus();
    });
    await page.keyboard.press('s');
    await settle(page, 200);
    const typeahead = await page.evaluate(() =>
      (document.activeElement?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24),
    );
    console.log(`  [context-menu type-ahead 's'] → ${typeahead}`);

    await page.keyboard.press('Escape');
    await settle(page, 400);
    const closed = await page.evaluate(
      () =>
        !document
          .querySelector('ytmusic-menu-popup-renderer')
          ?.closest('tp-yt-iron-dropdown')
          ?.hasAttribute('aria-hidden') ||
        document
          .querySelector('ytmusic-menu-popup-renderer')
          ?.closest('tp-yt-iron-dropdown')
          ?.getAttribute('aria-hidden') === 'true',
    );
    console.log(`  context menu closed on Escape: ${closed}`);

    /* 8 — Titlebar close crop: the SVG wordmark at real size. */
    await shotOf(page, page.locator('#lacquer-wordmark'), '08-wordmark');
    const wordmark = await page.evaluate(() => {
      const svg = document.querySelector('#lacquer-wordmark .lq-wordmark-svg');
      const stop = document.querySelector('#lq-mark-spectrum-grad stop');
      return {
        svgPresent: !!svg,
        svgHeight: svg ? getComputedStyle(svg).height : null,
        stopColor: stop ? getComputedStyle(stop).stopColor : null,
      };
    });
    console.log('  [wordmark]', JSON.stringify(wordmark));

    /* Browse immersive header — housekeeping check. Navigate to an album. */
    await page.evaluate(() => {
      const link =
        document.querySelector<HTMLElement>(
          'ytmusic-two-row-item-renderer a[href*="browse/MPRE"]',
        ) ??
        document.querySelector<HTMLElement>(
          'ytmusic-two-row-item-renderer a[href*="browse/"]',
        );
      link?.click();
    });
    await settle(page, 4000);
    const immersive = await page.evaluate(() => {
      const out: string[] = [];
      const header = document.querySelector(
        'ytmusic-responsive-header-renderer, ytmusic-immersive-header-renderer, ' +
          'ytmusic-detail-header-renderer',
      );
      let el: Element | null = header;
      for (let i = 0; el && i < 7; i += 1, el = el.parentElement) {
        const cs = getComputedStyle(el);
        const bgImg = cs.backgroundImage;
        const bg = cs.backgroundColor;
        if (
          bgImg !== 'none' ||
          (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent')
        ) {
          out.push(
            `${el.tagName.toLowerCase()}#${el.id} .${[...el.classList].slice(0, 2).join('.')} :: img=${bgImg.slice(0, 60)} | bg=${bg}`,
          );
        }
      }
      const immersive = document.querySelector(
        'ytmusic-browse-response #background.immersive-background',
      );
      if (immersive) {
        const cs = getComputedStyle(immersive);
        out.push(
          `IMMERSIVE #background.immersive-background :: display=${cs.display} opacity=${cs.opacity} bg=${cs.backgroundImage.slice(0, 40)} hasImg=${!!immersive.querySelector('img')}`,
        );
      }
      document
        .querySelectorAll(
          'ytmusic-browse-response, #contents.ytmusic-section-list-renderer',
        )
        .forEach((d) => {
          const bi = getComputedStyle(d).backgroundImage;
          if (bi.includes('gradient') || bi.includes('url')) {
            out.push(
              `  DESC ${d.tagName.toLowerCase()}#${d.id} = ${bi.slice(0, 90)}`,
            );
          }
        });
      return out;
    });
    console.log(
      '  [browse immersive header]',
      JSON.stringify(immersive, null, 1),
    );
    await shot(page, '11-browse-detail');
    await showBrowse(page);

    /* 9 — Full window, maximised. */
    await page.setViewportSize({ width: 1920, height: 1080 });
    await settle(page, 1500);
    await shot(page, '09-window-maximised');

    /* 10 — Full window, 1280x800. */
    await page.setViewportSize({ width: 1280, height: 800 });
    await settle(page, 1500);
    await shot(page, '10-window-1280x800');

    for (const file of written) console.log(`  captured ${file}`);
  } finally {
    await dispose();
  }
});
