import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { Window } from 'happy-dom';

const decodeRgbaPng = (filename: string) => {
  const png = readFileSync(filename);
  const idat: Buffer[] = [];
  let width = 0;
  let height = 0;
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect([...data.subarray(8, 13)]).toEqual([8, 6, 0, 0, 0]);
    }
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
  }

  const filtered = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  const paeth = (left: number, up: number, upperLeft: number) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= upDistance && leftDistance <= upperLeftDistance)
      return left;
    return upDistance <= upperLeftDistance ? up : upperLeft;
  };

  let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[input++];
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[input++];
      const output = y * stride + x;
      const left = x >= 4 ? pixels[output - 4] : 0;
      const up = y > 0 ? pixels[output - stride] : 0;
      const upperLeft = x >= 4 && y > 0 ? pixels[output - stride - 4] : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? Math.floor((left + up) / 2)
                : paeth(left, up, upperLeft);
      pixels[output] = (raw + predictor) & 0xff;
    }
  }
  return { width, height, pixels };
};

test('the logo generator emits the approved full, small, and titlebar marks', async () => {
  const logoSystem = await import('../../scripts/make-logo.mjs');

  expect(typeof logoSystem.renderLogoSources).toBe('function');

  const sources = logoSystem.renderLogoSources();
  expect(sources.full).toContain('data-lq-layer="laurel"');
  expect(sources.full).toContain('#dac0a7');
  expect(sources.full).toContain('#c38242');
  expect(sources.small).not.toContain('data-lq-layer="laurel"');
  expect(sources.small).toContain('stroke-width="7.2"');
  expect(sources.titlebar).toContain('lq-mark-script-champagne');
  expect(sources.titlebar).toContain('lq-mark-script-bronze');
  expect(sources.titlebar).not.toContain('spectrum');
});

test('small Windows and tray surfaces keep the script glyph legible', async () => {
  const logoSystem = await import('../../scripts/make-logo.mjs');

  expect(typeof logoSystem.iconVariantForSize).toBe('function');
  expect(logoSystem.iconVariantForSize(16)).toBe('small');
  expect(logoSystem.iconVariantForSize(24)).toBe('small');
  expect(logoSystem.iconVariantForSize(32)).toBe('full');
  expect(logoSystem.iconVariantForSize(48)).toBe('full');

  const tray = logoSystem.renderTraySources();
  expect(Object.keys(tray).sort()).toEqual([
    'paused',
    'pausedWhite',
    'playing',
    'playingWhite',
  ]);
  expect(
    Object.values(tray).every((svg) => svg.includes('data-lq-layer="script"')),
  ).toBe(true);
  expect(tray.playing).not.toContain('data-lq-layer="pause"');
  expect(tray.paused).toContain('data-lq-layer="pause"');
  expect(tray.playingWhite).toContain('#ffffff');
  expect(
    Object.values(tray).every((svg) => !svg.includes('data-lq-layer="laurel"')),
  ).toBe(true);
});

test('the titlebar injects the de-wreathed script lockup', async () => {
  const dom = new Window();
  const originalDocument = globalThis.document;
  const originalMutationObserver = globalThis.MutationObserver;
  const originalHistory = globalThis.history;

  Object.assign(globalThis, {
    document: dom.document,
    MutationObserver: dom.MutationObserver,
    history: dom.history,
  });
  dom.document.body.innerHTML = `
    <ytmusic-nav-bar><div id="left-content"></div></ytmusic-nav-bar>
    <ytmusic-guide-renderer><div id="sections"></div></ytmusic-guide-renderer>`;

  try {
    const { initTitleBar } = await import('../../src/lacquer/titlebar');
    initTitleBar();
    await Promise.resolve();

    const lockup = dom.document.querySelector('#lacquer-wordmark');
    expect(lockup?.querySelector('.lq-mark-script-champagne')).not.toBeNull();
    expect(lockup?.querySelector('.lq-mark-script-bronze')).not.toBeNull();
    expect(lockup?.querySelector('.lq-mark-plate')).not.toBeNull();
    expect(lockup?.querySelector('.lq-mark-spectrum')).toBeNull();
    expect(lockup?.querySelector('.lq-wordmark-text')?.textContent).toBe(
      'acquer',
    );
  } finally {
    Object.assign(globalThis, {
      document: originalDocument,
      MutationObserver: originalMutationObserver,
      history: originalHistory,
    });
    dom.close();
  }
});

test('the rasterized app icon keeps a transparent margin on every edge', () => {
  const icon = decodeRgbaPng('assets/icon.png');
  const margin = 8;
  const opaqueEdges: string[] = [];
  for (let y = 0; y < icon.height; y += 1) {
    for (let x = 0; x < icon.width; x += 1) {
      const onEdge =
        x < margin ||
        x >= icon.width - margin ||
        y < margin ||
        y >= icon.height - margin;
      if (onEdge && icon.pixels[(y * icon.width + x) * 4 + 3] !== 0) {
        opaqueEdges.push(`${x},${y}`);
        if (opaqueEdges.length === 8) break;
      }
    }
    if (opaqueEdges.length === 8) break;
  }

  expect(opaqueEdges).toEqual([]);
});
