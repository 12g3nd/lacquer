import {
  type BandEnergies,
  isKickOnset,
  readBandEnergies,
} from './lacquer-state';
import { Visualizer } from './visualizer';

export type LacquerTreatment = 'orbital' | 'rave';

type Rgb = { r: number; g: number; b: number };
type Palette = { atmosphere: Rgb; fill: Rgb; veil: Rgb };
type Ring = { radius: number; alpha: number; phase: number };

const FALLBACK: Palette = {
  atmosphere: { r: 79, g: 125, b: 255 },
  fill: { r: 57, g: 212, b: 208 },
  veil: { r: 11, g: 23, b: 49 },
};

const parseRgb = (value: string, fallback: Rgb): Rgb => {
  const channels = value
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  return channels?.length === 3
    ? { r: channels[0], g: channels[1], b: channels[2] }
    : fallback;
};

const rgba = ({ r, g, b }: Rgb, alpha: number) =>
  `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;

const sameRgb = (a: Rgb, b: Rgb) => a.r === b.r && a.g === b.g && a.b === b.b;
const samePalette = (a: Palette, b: Palette) =>
  sameRgb(a.atmosphere, b.atmosphere) &&
  sameRgb(a.fill, b.fill) &&
  sameRgb(a.veil, b.veil);
const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => ({
  r: from.r + (to.r - from.r) * amount,
  g: from.g + (to.g - from.g) * amount,
  b: from.b + (to.b - from.b) * amount,
});
const mixPalette = (from: Palette, to: Palette, amount: number): Palette => ({
  atmosphere: mixRgb(from.atmosphere, to.atmosphere, amount),
  fill: mixRgb(from.fill, to.fill, amount),
  veil: mixRgb(from.veil, to.veil, amount),
});

export default class LacquerVisualizer extends Visualizer {
  private readonly analyser: AnalyserNode;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly treatment: LacquerTreatment;
  private readonly takeover: boolean;
  private readonly rootStyle: CSSStyleDeclaration;
  private readonly reactivityStyle: HTMLStyleElement;
  private readonly reactivityRule: CSSStyleRule;
  private readonly reducedMotion = matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  private readonly frequencyData: Uint8Array<ArrayBuffer>;
  private readonly rings: Ring[] = [];
  private frame: number | null = null;
  private width = 1;
  private height = 1;
  private lastFrame = performance.now();
  private lastOnset = -Infinity;
  private priorBass = 0;
  private bands: BandEnergies = { bass: 0.04, mids: 0.06, highs: 0.04 };
  private kick = 0;
  private video: HTMLVideoElement | null;
  private artwork: HTMLElement | null;
  private displayedPalette: Palette = FALLBACK;
  private targetPalette: Palette = FALLBACK;
  private paletteStarted = performance.now();

  constructor(
    audioContext: AudioContext,
    upstreamNode: AudioNode,
    canvas: HTMLCanvasElement,
    audioNode: GainNode,
    treatment: LacquerTreatment,
    takeover: boolean,
  ) {
    super(upstreamNode, audioNode);
    this.canvas = canvas;
    this.treatment = treatment;
    this.takeover = takeover;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Lacquer visualizer needs a 2D canvas');
    this.context = context;
    this.rootStyle = getComputedStyle(document.documentElement);
    this.video = document.querySelector('video');
    this.artwork = takeover ? document.querySelector('#song-image') : null;

    // Reactive values must reach the whole shell, but writing them onto
    // `documentElement.style` wakes album-color's style observer every frame.
    // A dedicated CSSOM rule has the same cascade/inheritance semantics without
    // producing root-attribute mutation records.
    document.getElementById('lq-viz-reactivity')?.remove();
    this.reactivityStyle = document.createElement('style');
    this.reactivityStyle.id = 'lq-viz-reactivity';
    this.reactivityStyle.textContent = ':root {}';
    document.head.appendChild(this.reactivityStyle);
    this.reactivityRule = this.reactivityStyle.sheet!
      .cssRules[0] as CSSStyleRule;

    // The plugin owns one shared-analyser → gain spur. This local analyser is
    // fed from that disposable gain and never touches the audible destination.
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.68;
    audioNode.connect(this.analyser);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

    document.documentElement.dataset.lqVizTreatment = treatment;
    this.frame = requestAnimationFrame(this.render);
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const scale = Math.min(devicePixelRatio || 1, this.takeover ? 0.6 : 1.25);
    this.canvas.width = Math.ceil(this.width * scale);
    this.canvas.height = Math.ceil(this.height * scale);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  protected destroyVisualizer() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.reactivityStyle.remove();
    document.documentElement.removeAttribute('data-lq-viz-treatment');
    for (const token of ['kick', 'mid', 'high', 'art-scale']) {
      document.documentElement.style.removeProperty(`--lq-viz-${token}`);
    }
  }

  private palette(now: number): Palette {
    const next = {
      atmosphere: parseRgb(
        this.rootStyle.getPropertyValue('--lq-album-atmosphere'),
        FALLBACK.atmosphere,
      ),
      fill: parseRgb(
        this.rootStyle.getPropertyValue('--lq-album-fill'),
        FALLBACK.fill,
      ),
      veil: parseRgb(
        this.rootStyle.getPropertyValue('--lq-album-veil'),
        FALLBACK.veil,
      ),
    };
    if (!samePalette(next, this.targetPalette)) {
      this.displayedPalette = this.paletteAt(now);
      this.targetPalette = next;
      this.paletteStarted = now;
    }
    this.displayedPalette = this.paletteAt(now);
    return this.displayedPalette;
  }

  private paletteAt(now: number) {
    const linear = Math.min(1, Math.max(0, (now - this.paletteStarted) / 900));
    const eased = 1 - (1 - linear) ** 3;
    return mixPalette(this.displayedPalette, this.targetPalette, eased);
  }

  private updateAudio(now: number, delta: number) {
    if (!this.video?.isConnected) {
      this.video = document.querySelector('video');
    }
    const playing = !this.video?.paused;
    if (playing) {
      this.analyser.getByteFrequencyData(this.frequencyData);
      const target = readBandEnergies(
        this.frequencyData,
        this.analyser.context.sampleRate,
      );
      this.bands.bass += (target.bass - this.bands.bass) * 0.46;
      this.bands.mids += (target.mids - this.bands.mids) * 0.32;
      this.bands.highs += (target.highs - this.bands.highs) * 0.4;
    } else {
      const drift = now * 0.0004;
      this.bands.bass +=
        (0.035 + Math.sin(drift) * 0.012 - this.bands.bass) * 0.04;
      this.bands.mids +=
        (0.07 + Math.sin(drift * 0.73 + 1) * 0.025 - this.bands.mids) * 0.035;
      this.bands.highs +=
        (0.045 + Math.sin(drift * 1.3 + 2) * 0.015 - this.bands.highs) * 0.05;
    }

    if (
      playing &&
      isKickOnset(this.bands.bass, this.priorBass, now - this.lastOnset)
    ) {
      this.kick = 1;
      this.lastOnset = now;
      this.rings.push({ radius: 0, alpha: 1, phase: Math.random() * Math.PI });
      if (this.rings.length > 12) this.rings.shift();
    }
    this.priorBass = this.bands.bass;
    this.kick *= Math.pow(0.001, delta / 420);
    if (this.reducedMotion) this.kick = Math.min(this.kick, 0.16);

    const style = this.reactivityRule.style;
    style.setProperty('--lq-viz-kick', this.kick.toFixed(3));
    style.setProperty('--lq-viz-mid', this.bands.mids.toFixed(3));
    style.setProperty('--lq-viz-high', this.bands.highs.toFixed(3));
    style.setProperty('--lq-viz-art-scale', (1 + this.kick * 0.075).toFixed(4));
  }

  private orbitalCentre() {
    if (this.takeover && !this.artwork?.isConnected) {
      this.artwork = document.querySelector('#song-image');
    }
    const rect = this.takeover ? this.artwork?.getBoundingClientRect() : null;
    return rect && rect.width > 0
      ? {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          radius: rect.width / 2,
        }
      : {
          x: this.width / 2,
          y: this.height / 2,
          radius: Math.min(this.width, this.height) * 0.24,
        };
  }

  private baseField(palette: Palette, x: number, y: number, radius: number) {
    const gradient = this.context.createRadialGradient(
      x,
      y,
      radius * 0.1,
      x,
      y,
      Math.max(this.width, this.height) * 0.82,
    );
    gradient.addColorStop(0, rgba(palette.atmosphere, 0.56));
    gradient.addColorStop(0.48, rgba(palette.veil, 0.88));
    gradient.addColorStop(1, '#071127');
    this.context.globalCompositeOperation = 'source-over';
    this.context.fillStyle = gradient;
    this.context.fillRect(0, 0, this.width, this.height);
  }

  private drawOrbital(palette: Palette, now: number, delta: number) {
    const centre = this.orbitalCentre();
    this.baseField(palette, centre.x, centre.y, centre.radius);
    const context = this.context;
    context.save();
    context.globalCompositeOperation = 'screen';
    const spectrumRadius = centre.radius * (1.08 + this.kick * 0.08);

    for (let index = 0; index < 96; index += 1) {
      const angle = (index / 96) * Math.PI * 2 - Math.PI / 2;
      const wave = Math.sin(index * 0.47 + now * 0.0026) * 0.5 + 0.5;
      const energy = 7 + wave * 15 + this.bands.highs * 54 + this.kick * 24;
      const inner = spectrumRadius + Math.sin(index * 0.31 + now * 0.001) * 5;
      context.strokeStyle =
        index % 3 === 0 ? rgba(palette.fill, 0.72) : 'rgba(57, 212, 208, .28)';
      context.lineWidth = index % 3 === 0 ? 1.4 : 0.75;
      context.beginPath();
      context.moveTo(
        centre.x + Math.cos(angle) * inner,
        centre.y + Math.sin(angle) * inner,
      );
      context.lineTo(
        centre.x + Math.cos(angle) * (inner + energy),
        centre.y + Math.sin(angle) * (inner + energy),
      );
      context.stroke();
    }

    for (let index = this.rings.length - 1; index >= 0; index -= 1) {
      const ring = this.rings[index];
      ring.radius += delta * 0.72;
      ring.alpha *= Math.pow(0.06, delta / 1300);
      const radius = centre.radius * 1.02 + ring.radius;
      context.strokeStyle = rgba(palette.fill, ring.alpha * 0.72);
      context.lineWidth = 1.2 + ring.alpha * 4;
      context.beginPath();
      context.ellipse(
        centre.x,
        centre.y,
        radius,
        radius * (0.985 + Math.sin(ring.phase) * 0.025),
        ring.phase * 0.08,
        0,
        Math.PI * 2,
      );
      context.stroke();
      if (ring.alpha < 0.025 || ring.radius > Math.max(this.width, this.height))
        this.rings.splice(index, 1);
    }

    for (let orbit = 0; orbit < 4; orbit += 1) {
      const radius =
        centre.radius * (1.23 + orbit * 0.16) +
        Math.sin(now * 0.0007 + orbit) * 9;
      context.strokeStyle = rgba(palette.fill, 0.1 + this.bands.highs * 0.2);
      context.lineWidth = 0.8;
      context.setLineDash([2 + orbit, 13 + orbit * 4]);
      context.lineDashOffset = now * (orbit % 2 ? -0.008 : 0.006);
      context.beginPath();
      context.ellipse(
        centre.x,
        centre.y,
        radius,
        radius * (0.88 + orbit * 0.02),
        orbit * 0.18,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    context.restore();
  }

  private drawRave(palette: Palette, now: number, delta: number) {
    const context = this.context;
    const x = this.width * 0.52;
    const phase = this.reducedMotion ? 0 : now * 0.00024;
    const horizon = this.height * 0.45 + Math.sin(phase * 1.7) * 16;
    const radius = Math.min(this.width, this.height) * 0.12;
    const pulse = 1 + this.kick * 0.32;
    this.baseField(palette, x, horizon, radius);

    context.save();
    context.globalCompositeOperation = 'screen';
    // Shadow blur on every full-screen ray was the dominant raster cost on the
    // target ThinkPad. The radial gate and screen blend retain the luminous
    // read without forcing Chromium to blur twenty-seven long paths per frame.
    context.shadowBlur = 0;
    for (let ray = -7; ray <= 7; ray += 1) {
      const spread = ray / 7;
      const sway =
        Math.sin(phase * 11 + ray * 0.72) * (18 + this.bands.mids * 60);
      context.strokeStyle =
        ray % 4 === 0
          ? rgba(palette.fill, 0.34 + this.bands.highs * 0.5)
          : 'rgba(57, 212, 208, .15)';
      context.lineWidth = ray % 4 === 0 ? 1.5 + this.kick * 2.4 : 0.7;
      context.beginPath();
      context.moveTo(x, horizon);
      context.lineTo(
        x + spread * this.width * 0.76 * pulse + sway,
        ray % 2 === 0 ? this.height + 40 : -40,
      );
      context.stroke();
    }

    for (let depth = 0; depth < 8; depth += 1) {
      const progress = ((depth / 8 + phase * 0.65) % 1) ** 2;
      const y = horizon + progress * (this.height - horizon + 80);
      const halfWidth = progress * this.width * 0.68;
      context.strokeStyle = rgba(
        depth % 3 === 0 ? palette.fill : FALLBACK.fill,
        0.08 + progress * 0.25 + this.bands.mids * 0.14,
      );
      context.lineWidth = 0.6 + progress * 1.5;
      context.beginPath();
      context.moveTo(x - halfWidth, y);
      context.lineTo(x + halfWidth, y);
      context.stroke();
    }

    for (let fan = 0; fan < 4; fan += 1) {
      const angle = -0.96 + fan * 0.64 + Math.sin(phase * 9 + fan) * 0.12;
      const length =
        Math.max(this.width, this.height) * (0.62 + this.kick * 0.18);
      const beam = context.createLinearGradient(
        x,
        horizon,
        x + Math.cos(angle) * length,
        horizon + Math.sin(angle) * length,
      );
      beam.addColorStop(0, rgba(palette.fill, 0.46 + this.kick * 0.2));
      beam.addColorStop(0.4, rgba(palette.fill, 0.1));
      beam.addColorStop(1, rgba(palette.fill, 0));
      context.strokeStyle = beam;
      context.lineWidth = 3 + this.kick * 8;
      context.beginPath();
      context.moveTo(x, horizon);
      context.lineTo(
        x + Math.cos(angle) * length,
        horizon + Math.sin(angle) * length,
      );
      context.stroke();
    }

    for (let index = this.rings.length - 1; index >= 0; index -= 1) {
      const ring = this.rings[index];
      ring.radius += delta * 0.86;
      ring.alpha *= Math.pow(0.04, delta / 1050);
      context.strokeStyle = rgba(palette.fill, ring.alpha * 0.78);
      context.lineWidth = 2 + ring.alpha * 8;
      context.beginPath();
      context.ellipse(
        x,
        horizon,
        ring.radius * 1.9,
        ring.radius * 0.72,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
      if (ring.alpha < 0.02 || ring.radius > this.width)
        this.rings.splice(index, 1);
    }

    const gate = context.createRadialGradient(
      x,
      horizon,
      0,
      x,
      horizon,
      radius * (1.4 + this.kick * 0.8),
    );
    gate.addColorStop(0, 'rgba(232, 239, 245, .9)');
    gate.addColorStop(0.06, rgba(palette.fill, 0.84));
    gate.addColorStop(0.33, rgba(palette.fill, 0.16));
    gate.addColorStop(1, rgba(palette.fill, 0));
    context.fillStyle = gate;
    context.fillRect(0, 0, this.width, this.height);
    context.restore();
  }

  private readonly render = (now: number) => {
    // Keep the audio field responsive at a stable cinematic cadence while the
    // UI/compositor continues at display rate. Drawing the full takeover at
    // every display tick starved input and album crossfades on the ThinkPad.
    const frameInterval = this.takeover ? 1000 / 24 : 1000 / 45;
    if (now - this.lastFrame < frameInterval) {
      this.frame = requestAnimationFrame(this.render);
      return;
    }
    const delta = Math.min(64, now - this.lastFrame || 16);
    this.lastFrame = now;
    this.updateAudio(now, delta);
    const palette = this.palette(now);
    if (this.treatment === 'rave') this.drawRave(palette, now, delta);
    else this.drawOrbital(palette, now, delta);
    this.frame = requestAnimationFrame(this.render);
  };
}
