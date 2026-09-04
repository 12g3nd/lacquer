import { test, expect } from '@playwright/test';

import {
  normaliseAlbumColor,
  parseTriple,
  rgbToOklch,
  oklchToRgb,
  type Rgb,
} from '../../src/lacquer/album-color';

/**
 * Invariants for the album-colour engine (B1).
 *
 * The engine's whole job is that *no* artwork can produce an unreadable or
 * ugly shell. That is a property over the entire input space, not something a
 * handful of screenshots can establish — so it is asserted here, across a wide
 * sweep of hues and lightnesses, and the captures are left to judge whether it
 * looks good rather than whether it is safe.
 *
 * Pure functions, no browser needed.
 */

const contrast = (a: Rgb, b: Rgb) => {
  const lum = ({ r, g, b: bb }: Rgb) => {
    const ch = (v: number) => {
      const s = v / 255;
      return s <= 0.039_28 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(bb);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const parseRgb = (css: string): Rgb => {
  const [r, g, b] = css.match(/\d+/g)!.map(Number);
  return { r, g, b };
};

/** The Atlantic transport surface that `fill` has to read against. */
const ATLANTIC: Rgb = { r: 0x10, g: 0x2a, b: 0x4c };

/** A sweep across the whole hue circle at several lightnesses and chromas. */
const sweep: Rgb[] = [];
for (let h = 0; h < 360; h += 15) {
  for (const l of [0.15, 0.35, 0.55, 0.75, 0.95]) {
    for (const c of [0.05, 0.12, 0.25]) {
      sweep.push(oklchToRgb({ l, c, h }));
    }
  }
}

test('OKLCH conversion round-trips', () => {
  for (const source of [
    { r: 255, g: 0, b: 0 },
    { r: 11, g: 23, b: 49 },
    { r: 79, g: 125, b: 255 },
    { r: 232, g: 239, b: 245 },
    { r: 128, g: 128, b: 128 },
  ]) {
    const back = oklchToRgb(rgbToOklch(source));
    expect(Math.abs(back.r - source.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.g - source.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.b - source.b)).toBeLessThanOrEqual(1);
  }
});

test('fill always reads against the transport it sits on', () => {
  // 3:1 is the WCAG floor for a graphical control boundary. The progress fill
  // and play button are exactly that.
  for (const source of sweep) {
    const { fill } = normaliseAlbumColor(source);
    expect(
      contrast(parseRgb(fill), ATLANTIC),
      `fill ${fill} from rgb(${source.r},${source.g},${source.b})`,
    ).toBeGreaterThanOrEqual(3);
  }
});

test('ink always reads on top of fill', () => {
  for (const source of sweep) {
    const { fill, ink } = normaliseAlbumColor(source);
    expect(
      contrast(parseRgb(fill), parseRgb(ink)),
      `ink ${ink} on fill ${fill} from rgb(${source.r},${source.g},${source.b})`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('veil always carries Milkglass text', () => {
  const MILKGLASS: Rgb = { r: 232, g: 239, b: 245 };
  for (const source of sweep) {
    const { veil } = normaliseAlbumColor(source);
    expect(contrast(parseRgb(veil), MILKGLASS)).toBeGreaterThanOrEqual(7);
  }
});

test('atmosphere is never black, never a glare', () => {
  for (const source of sweep) {
    const { atmosphere } = normaliseAlbumColor(source);
    const { l } = rgbToOklch(parseRgb(atmosphere));
    expect(l).toBeGreaterThan(0.3);
    expect(l).toBeLessThan(0.65);
  }
});

test('near-monochrome artwork falls back to Orbit Noir, not a grey wash', () => {
  for (const grey of [
    { r: 0, g: 0, b: 0 },
    { r: 60, g: 60, b: 60 },
    { r: 128, g: 128, b: 130 },
    { r: 200, g: 199, b: 201 },
    { r: 255, g: 255, b: 255 },
  ]) {
    const tokens = normaliseAlbumColor(grey);
    expect(tokens.isFallback, `rgb(${grey.r},${grey.g},${grey.b})`).toBe(true);
    // Fallback runs Ion through the same bands, so it is cobalt — hue near
    // 264 degrees — rather than a desaturated smear.
    const { h, c } = rgbToOklch(parseRgb(tokens.fill));
    expect(c).toBeGreaterThan(0.1);
    expect(Math.abs(h - 264)).toBeLessThan(20);
  }
});

test('saturated artwork does not fall back', () => {
  for (const vivid of [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 200, b: 80 },
    { r: 180, g: 22, b: 214 },
    { r: 255, g: 200, b: 40 },
  ]) {
    expect(normaliseAlbumColor(vivid).isFallback).toBe(false);
  }
});

test('muted but chromatic artwork keeps its album hue', () => {
  // Captured from the real "We Can't Stop" artwork. This used to be rejected
  // as monochrome and made both the play control and Butterchurn Ion blue.
  const source = { r: 106, g: 90, b: 101 };
  const tokens = normaliseAlbumColor(source);
  expect(tokens.isFallback).toBe(false);
  const sourceHue = rgbToOklch(source).h;
  const outputHue = rgbToOklch(parseRgb(tokens.fill)).h;
  const drift = Math.min(
    Math.abs(outputHue - sourceHue),
    360 - Math.abs(outputHue - sourceHue),
  );
  expect(drift).toBeLessThan(12);
});

test('hue survives normalisation', () => {
  // Clamping in OKLCH must move lightness and chroma without swinging hue —
  // that is the entire reason for not doing this in HSL.
  for (let h = 0; h < 360; h += 30) {
    const source = oklchToRgb({ l: 0.5, c: 0.2, h });
    const { fill } = normaliseAlbumColor(source);
    const out = rgbToOklch(parseRgb(fill));
    const drift = Math.min(Math.abs(out.h - h), 360 - Math.abs(out.h - h));
    expect(drift, `hue ${h} drifted to ${out.h}`).toBeLessThan(12);
  }
});

test('is total: bad input still yields a usable set', () => {
  for (const bad of [
    null,
    { r: Number.NaN, g: 0, b: 0 },
    { r: -5, g: 0, b: 0 },
    { r: 999, g: 0, b: 0 },
  ]) {
    const tokens = normaliseAlbumColor(bad as Rgb | null);
    expect(tokens.isFallback).toBe(true);
    expect(tokens.fill).toMatch(/^rgb\(/);
  }
});

test('parseTriple reads the plugin format, and treats 0,0,0 as absence', () => {
  expect(parseTriple('11, 23, 49')).toEqual({ r: 11, g: 23, b: 49 });
  expect(parseTriple('  255,0,128 ')).toEqual({ r: 255, g: 0, b: 128 });
  // The plugin emits "0, 0, 0" when it has nothing to report. Treating that as
  // black would tint the whole shell from a non-answer.
  expect(parseTriple('0, 0, 0')).toBeNull();
  expect(parseTriple('')).toBeNull();
  expect(parseTriple(null)).toBeNull();
  expect(parseTriple('not, a, colour')).toBeNull();
  expect(parseTriple('1, 2')).toBeNull();
});
