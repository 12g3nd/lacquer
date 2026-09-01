/*
 * Rasterises `assets/icon.svg` into the PNG + ICO the app and installer need
 * (Stage C, C4).
 *
 * There is no ImageMagick / sharp in this toolchain, so the rasteriser is
 * Chromium itself: load the SVG in an offscreen Electron window, `capturePage`,
 * then `nativeImage.resize` down to each size. The `.ico` is assembled by hand
 * from PNG-encoded entries, which Windows 10/11 read directly.
 *
 *   pnpm make:icons      (runs `electron scripts/make-icons.mjs`)
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow } from 'electron';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PNG_DIR = path.join(ROOT, 'assets/generated/icons/png');
const WIN_DIR = path.join(ROOT, 'assets/generated/icons/win');

const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** A minimal ICO wrapping PNG-encoded images (valid on Windows Vista+). */
const buildIco = (entries) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  for (const [i, entry] of entries.entries()) {
    const at = i * 16;
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 0);
    dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1);
    dir.writeUInt16LE(1, at + 4);
    dir.writeUInt16LE(32, at + 6);
    dir.writeUInt32LE(entry.data.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += entry.data.length;
  }

  return Buffer.concat([header, dir, ...entries.map((e) => e.data)]);
};

const run = async () => {
  await app.whenReady();

  const svg = readFileSync(path.join(ROOT, 'assets/icon.svg'), 'utf8');
  const html =
    '<!doctype html><meta charset="utf-8">' +
    '<style>html,body{margin:0;padding:0;background:transparent}' +
    'svg{display:block;width:1024px;height:1024px}</style>' +
    svg;

  // One window, loaded twice. Creating and destroying a second offscreen
  // window mid-run races its own teardown and the load fails with ERR_FAILED.
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    useContentSize: true,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });

  const render = async (svgSource) => {
    const page =
      '<!doctype html><meta charset="utf-8">' +
      '<style>html,body{margin:0;padding:0;background:transparent}' +
      'svg{display:block;width:1024px;height:1024px}</style>' +
      svgSource;
    await win.loadURL(
      'data:text/html;charset=utf-8,' + encodeURIComponent(page),
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    const captured = await win.webContents.capturePage();
    const { width } = captured.getSize();
    const image =
      width === 1024
        ? captured
        : captured.resize({ width: 1024, height: 1024, quality: 'best' });
    if (image.isEmpty()) throw new Error('capturePage returned an empty image');
    return image;
  };

  const full = await render(svg);
  // A wreath turns to mush below ~32px, so the small icon sizes get the
  // de-wreathed glyph. Windows picks the nearest size out of the .ico, so the
  // taskbar and title bar get the legible one without any extra plumbing.
  const smallSvg = readFileSync(
    path.join(ROOT, 'assets/icon-small.svg'),
    'utf8',
  );
  const fullSmall = await render(smallSvg);
  const SMALL_AT_OR_BELOW = 32;
  const sourceFor = (size) => (size <= SMALL_AT_OR_BELOW ? fullSmall : full);

  mkdirSync(PNG_DIR, { recursive: true });
  mkdirSync(WIN_DIR, { recursive: true });

  const pngs = new Map();
  for (const size of PNG_SIZES) {
    const source = sourceFor(size);
    const image =
      size === 1024
        ? source
        : source.resize({ width: size, height: size, quality: 'best' });
    const data = image.toPNG();
    pngs.set(size, data);
    writeFileSync(path.join(PNG_DIR, `${size}x${size}.png`), data);
  }

  writeFileSync(path.join(ROOT, 'assets/icon.png'), pngs.get(1024));
  writeFileSync(
    path.join(WIN_DIR, 'icon.ico'),
    buildIco(ICO_SIZES.map((size) => ({ size, data: pngs.get(size) }))),
  );

  console.log(
    `[icons] wrote ${PNG_SIZES.length} PNGs, assets/icon.png, icon.ico ` +
      `(<=${SMALL_AT_OR_BELOW}px use the de-wreathed glyph)`,
  );
  win.destroy();
  app.quit();
};

run().catch((error) => {
  console.error(`[icons] ${error.stack ?? error}`);
  app.exit(1);
});
