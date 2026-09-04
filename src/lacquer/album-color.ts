/**
 * Lacquer — album-reactive colour engine (Stage B, B1).
 *
 * `album-color-theme` extracts a dominant colour from the artwork and writes
 * `--ytmusic-album-color` / `--ytmusic-album-color-dark` onto `:root` as
 * comma-separated RGB triples (`"11, 23, 49"`, not a colour string).
 *
 * Lacquer does **not** consume those directly (DECISIONS.md D4). Two reasons:
 * the plugin also recolours stock YouTube Music surfaces, which fights the
 * authored shell; and raw extracted colour is unusable as-is — real artwork
 * yields near-black, blown-out white and fluorescent values within the same
 * library. This module reads them, normalises into a band that is guaranteed
 * legible against Orbit Noir, and publishes Lacquer's own `--lq-album-*` set.
 *
 * Scope is fixed by DESIGN.md §3.4 and D6: album colour drives the *emotional*
 * register only — atmosphere, bloom, scrims — plus exactly two functional
 * exceptions, the progress fill and the play/pause button, which are the
 * now-playing identity and should move with the record. Focus rings, keyboard
 * selection, active nav and every text colour stay Ion/Signal on every screen.
 * That is what makes contrast safety structural rather than a patch: the
 * elements that must never become unreadable never leave the fixed palette.
 *
 * Normalisation runs in OKLCH because it is perceptually uniform — clamping
 * lightness and chroma there does not swing the hue, which clamping in HSL
 * very much does.
 */

/* -------------------------------------------------------------------------- */
/* Colour maths                                                               */
/* -------------------------------------------------------------------------- */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  /** Perceptual lightness, 0–1. */
  l: number;
  /** Chroma. 0 is achromatic; sRGB rarely exceeds ~0.37. */
  c: number;
  /** Hue in degrees, 0–360. */
  h: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toLinear = (channel: number) => {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const toGamma = (channel: number) => {
  const v =
    channel <= 0.0031308
      ? channel * 12.92
      : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(clamp(v, 0, 1) * 255);
};

export const rgbToOklch = ({ r, g, b }: Rgb): Oklch => {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const l = 0.412_221_470_8 * lr + 0.536_332_536_3 * lg + 0.051_445_992_9 * lb;
  const m = 0.211_903_498_2 * lr + 0.680_699_545_1 * lg + 0.107_396_956_6 * lb;
  const s = 0.088_302_461_9 * lr + 0.281_718_837_6 * lg + 0.629_978_700_5 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const okL = 0.210_454_255_3 * l_ + 0.793_617_785 * m_ - 0.004_072_046_8 * s_;
  const okA = 1.977_998_495_1 * l_ - 2.428_592_205 * m_ + 0.450_593_709_9 * s_;
  const okB = 0.025_904_037_1 * l_ + 0.782_771_766_2 * m_ - 0.808_675_766 * s_;

  const hue = (Math.atan2(okB, okA) * 180) / Math.PI;

  return {
    l: okL,
    c: Math.hypot(okA, okB),
    h: hue < 0 ? hue + 360 : hue,
  };
};

/** Linear-light sRGB, unclamped — may fall outside [0,1] when out of gamut. */
const oklchToLinear = ({ l, c, h }: Oklch) => {
  const rad = (h * Math.PI) / 180;
  const okA = c * Math.cos(rad);
  const okB = c * Math.sin(rad);

  const l_ = l + 0.396_337_777_4 * okA + 0.215_803_757_3 * okB;
  const m_ = l - 0.105_561_345_8 * okA - 0.063_854_172_8 * okB;
  const s_ = l - 0.089_484_177_5 * okA - 1.291_485_548 * okB;

  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;

  return [
    4.076_741_662_1 * lc - 3.307_711_591_3 * mc + 0.230_969_929_2 * sc,
    -1.268_438_004_6 * lc + 2.609_757_401_1 * mc - 0.341_319_396_5 * sc,
    -0.004_196_086_3 * lc - 0.703_418_614_7 * mc + 1.707_614_701 * sc,
  ];
};

const IN_GAMUT_EPSILON = 0.000_1;

const isInGamut = (linear: number[]) =>
  linear.every(
    (channel) =>
      channel >= -IN_GAMUT_EPSILON && channel <= 1 + IN_GAMUT_EPSILON,
  );

/**
 * OKLCH → sRGB, gamut-mapped by chroma reduction.
 *
 * Naively clamping each channel is the obvious implementation and it is wrong:
 * clipping channels independently *rotates the hue*. A vivid yellow at
 * L 0.50 / C 0.20 is outside sRGB, and channel clipping lands it 22 degrees
 * away — visibly orange. Since preserving hue through normalisation is the
 * whole reason for working in OKLCH rather than HSL, that would defeat the
 * exercise.
 *
 * Instead, hold lightness and hue and binary-search the largest chroma that
 * fits in sRGB. This is the standard approach and keeps hue drift within a
 * degree or two.
 */
export const oklchToRgb = (color: Oklch): Rgb => {
  let linear = oklchToLinear(color);

  if (!isInGamut(linear)) {
    let lo = 0;
    let hi = color.c;
    // 20 iterations resolves chroma far finer than an 8-bit channel can show.
    for (let i = 0; i < 20; i += 1) {
      const mid = (lo + hi) / 2;
      if (isInGamut(oklchToLinear({ ...color, c: mid }))) lo = mid;
      else hi = mid;
    }
    linear = oklchToLinear({ ...color, c: lo });
  }

  const [r, g, b] = linear;
  return { r: toGamma(r), g: toGamma(g), b: toGamma(b) };
};

export const toCss = ({ r, g, b }: Rgb) => `rgb(${r}, ${g}, ${b})`;

/* -------------------------------------------------------------------------- */
/* Contrast                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * WCAG relative luminance. Deliberately separate from OKLCH lightness: they
 * are not interchangeable, and assuming they were is exactly what produced an
 * unreadable play glyph on saturated blues. A blue at OKLCH L 0.62 carries far
 * less luminance than a yellow at the same L.
 */
export const relativeLuminance = ({ r, g, b }: Rgb) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

export const contrastRatio = (a: Rgb, b: Rgb) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/* -------------------------------------------------------------------------- */
/* Normalisation                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Below this chroma the artwork is effectively greyscale. Tinting from it
 * produces a muddy wash rather than a mood, so Orbit Noir takes over —
 * DESIGN.md §3.4 requires the fallback rather than the wash.
 */
// Keep genuinely muted album colours. The previous 0.035 cutoff rejected
// mauves and warm greys that are visually coloured (for example 106,90,101),
// forcing a large part of a real library back to Ion blue. Only effectively
// neutral extraction noise should use Orbit Noir.
const MONOCHROME_CHROMA = 0.01;

/** Ion, the functional cobalt, as the fallback hue. Keeps one code path. */
const ION: Rgb = { r: 0x4f, g: 0x7d, b: 0xff };

/**
 * Bands each role is clamped into. Chosen so that, for *any* input hue:
 *  - `atmosphere` stays a mood behind the artwork — never black, never a glare.
 *  - `fill` stays clearly brighter than the Atlantic transport it sits on, so
 *    the progress bar and play button read at a glance on every record.
 *  - `veil` stays dark enough to carry Milkglass text at full contrast.
 */
const BANDS = {
  atmosphere: { l: [0.34, 0.6], c: [0.05, 0.15] },
  fill: { l: [0.62, 0.8], c: [0.11, 0.19] },
  veil: { l: [0.17, 0.29], c: [0.02, 0.07] },
} as const;

export interface AlbumTokens {
  atmosphere: string;
  fill: string;
  veil: string;
  /** Reads on top of `fill` — the play glyph, the progress knob's centre. */
  ink: string;
  /** True when the artwork was unusable and Orbit Noir took over. */
  isFallback: boolean;
}

const band = (source: Oklch, role: keyof typeof BANDS): Oklch => ({
  l: clamp(source.l, BANDS[role].l[0], BANDS[role].l[1]),
  c: clamp(source.c, BANDS[role].c[0], BANDS[role].c[1]),
  h: source.h,
});

/**
 * Turns a raw extracted colour into Lacquer's album token set.
 *
 * Pure and total: any input, including `null` and out-of-range channels,
 * yields a usable set. Exported so the invariants are testable without a
 * browser — see `tests/lacquer/album-color.smoke.spec.ts`.
 */
export const normaliseAlbumColor = (source: Rgb | null): AlbumTokens => {
  const safe: Rgb | null =
    source &&
    [source.r, source.g, source.b].every(
      (channel) => Number.isFinite(channel) && channel >= 0 && channel <= 255,
    )
      ? source
      : null;

  const raw = safe ? rgbToOklch(safe) : null;
  const isFallback = !raw || raw.c < MONOCHROME_CHROMA;
  const base = isFallback ? rgbToOklch(ION) : raw;

  const { fill, ink } = resolveFill(band(base, 'fill'));

  return {
    atmosphere: toCss(oklchToRgb(band(base, 'atmosphere'))),
    fill: toCss(fill),
    veil: toCss(oklchToRgb(band(base, 'veil'))),
    ink: toCss(ink),
    isFallback,
  };
};

/** The Atlantic transport surface the fill has to read against. */
const ATLANTIC: Rgb = { r: 0x10, g: 0x2a, b: 0x4c };
const ORBIT: Rgb = { r: 0x0b, g: 0x17, b: 0x31 };
const MILKGLASS: Rgb = { r: 0xe8, g: 0xef, b: 0xf5 };

/** Graphical-control boundary (WCAG 1.4.11) — the fill against its surface. */
const MIN_SURFACE_CONTRAST = 3;
/** Text-grade — the play glyph sitting on the fill. */
const MIN_INK_CONTRAST = 4.5;

/**
 * Picks the final fill lightness and the ink that sits on it.
 *
 * The fill has to satisfy two constraints at once — legible against the
 * Atlantic transport *and* carrying a legible glyph — and no fixed lightness
 * band can guarantee both across every hue, because OKLCH lightness is not
 * luminance. Saturated blues are the failure case: at the band's midpoint a
 * dark glyph is unreadable on them.
 *
 * So search lightness outward from the band's centre and take the first value
 * that satisfies both, trying each ink. Hue and chroma are never touched, so
 * the record's colour survives; only its brightness moves.
 */
const resolveFill = (target: Oklch): { fill: Rgb; ink: Rgb } => {
  // Start at the record's own lightness (already band-clamped) and only move
  // if a constraint actually fails. Searching from the band's centre instead
  // would darken colours that never needed it — a vivid yellow came back as
  // olive — which throws away the record's character for no benefit.
  const candidates: number[] = [target.l];
  for (let step = 0.02; step <= 0.34; step += 0.02) {
    candidates.push(target.l + step, target.l - step);
  }

  let best: { fill: Rgb; ink: Rgb; score: number } | null = null;

  for (const l of candidates) {
    if (l < 0.4 || l > 0.95) continue;
    const fill = oklchToRgb({ ...target, l });
    const surface = contrastRatio(fill, ATLANTIC);
    if (surface < MIN_SURFACE_CONTRAST) continue;

    for (const ink of [ORBIT, MILKGLASS]) {
      const score = contrastRatio(fill, ink);
      if (score >= MIN_INK_CONTRAST) return { fill, ink };
      if (!best || score > best.score) best = { fill, ink, score };
    }
  }

  // Unreachable for sRGB inputs — every hue has a lightness satisfying both —
  // but a total function must still return something sane rather than throw
  // inside a MutationObserver callback.
  return best ?? { fill: oklchToRgb(target), ink: ORBIT };
};

/* -------------------------------------------------------------------------- */
/* Runtime                                                                    */
/* -------------------------------------------------------------------------- */

/** `"11, 23, 49"` → `{ r: 11, g: 23, b: 49 }`. */
export const parseTriple = (value: string | null | undefined): Rgb | null => {
  if (!value) return null;
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const [r, g, b] = parts;
  // The plugin emits "0, 0, 0" when it has nothing; that is absence, not black.
  if (r === 0 && g === 0 && b === 0) return null;
  return { r, g, b };
};

const applyTokens = (root: HTMLElement, tokens: AlbumTokens) => {
  root.style.setProperty('--lq-album-atmosphere', tokens.atmosphere);
  root.style.setProperty('--lq-album-fill', tokens.fill);
  root.style.setProperty('--lq-album-veil', tokens.veil);
  root.style.setProperty('--lq-album-ink', tokens.ink);
  root.toggleAttribute('data-lq-album-fallback', tokens.isFallback);
};

/**
 * Watches the plugin's output and republishes Lacquer's tokens.
 *
 * Cost: one MutationObserver on a single element, filtered to the `style`
 * attribute, doing a string compare and — only on an actual change — a few
 * dozen floating-point operations. No DOM scans, no polling, nothing per
 * frame. The workspace rules single out observer storms; this is the opposite
 * shape, and it is why the engine listens to the variable rather than to
 * track-change events, which would couple it to Pear's internals.
 */
export const initAlbumColor = () => {
  const root = document.documentElement;
  let last = '';

  const sync = () => {
    const value = root.style.getPropertyValue('--ytmusic-album-color');
    if (value === last) return;
    last = value;
    applyTokens(root, normaliseAlbumColor(parseTriple(value)));
  };

  sync();

  new MutationObserver(sync).observe(root, {
    attributes: true,
    attributeFilter: ['style'],
  });
};
