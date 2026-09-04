type Rgb = readonly [number, number, number];
const FALLBACK: Rgb = [82, 126, 249];

/** Interpolate the same album token used by Lacquer's play button. */
export class AlbumColorTransition {
  private from: Rgb = FALLBACK;
  private target: Rgb = FALLBACK;
  private started = 0;

  sample(now: number): Rgb {
    const t = Math.min(1, Math.max(0, (now - this.started) / 900));
    const eased = 1 - (1 - t) ** 3;
    return [
      this.from[0] + (this.target[0] - this.from[0]) * eased,
      this.from[1] + (this.target[1] - this.from[1]) * eased,
      this.from[2] + (this.target[2] - this.from[2]) * eased,
    ];
  }

  setTarget(css: string, now: number) {
    const values = css
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number);
    if (
      !values ||
      values.length !== 3 ||
      values.some((n) => !Number.isFinite(n))
    )
      return;
    if (values.every((n, i) => n === this.target[i])) return;
    this.from = this.sample(now);
    this.target = [values[0], values[1], values[2]];
    this.started = now;
  }
}

/** Two native canvas passes, with no pixel readback or JavaScript pixel loop. */
export function drawAlbumFrame(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  colour?: Rgb,
) {
  context.save();
  context.globalCompositeOperation = 'copy';
  context.filter = colour ? 'grayscale(1)' : 'none';
  context.drawImage(source, 0, 0);
  if (colour) {
    context.filter = 'none';
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = `rgb(${colour.join(',')})`;
    context.fillRect(0, 0, source.width, source.height);
  }
  context.restore();
}
