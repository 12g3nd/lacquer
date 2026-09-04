/** A small text-only bridge: the lyrics plugin owns timing and providers. */
interface TimedLine {
  timeInMs: number;
  duration: number;
  text: string;
}
interface OverlayLyrics {
  current: string;
  next: string;
}

export function selectVisualizerLyrics(
  lines: readonly TimedLine[] | undefined,
  time: number,
): OverlayLyrics {
  const index =
    lines?.findIndex(
      (line) => time >= line.timeInMs && time < line.timeInMs + line.duration,
    ) ?? -1;
  if (!lines || index < 0) return { current: '', next: '' };
  return { current: lines[index].text, next: lines[index + 1]?.text ?? '' };
}

let latest: OverlayLyrics = { current: '', next: '' };
let overlay: HTMLElement | undefined;
let currentLine: HTMLElement | undefined;
let nextLine: HTMLElement | undefined;

export function publishVisualizerLyrics(lyrics: OverlayLyrics) {
  if (lyrics.current === latest.current && lyrics.next === latest.next) return;
  latest = lyrics;
  renderLyrics();
}

function renderLyrics() {
  if (!overlay || !currentLine || !nextLine) return;
  currentLine.textContent = latest.current;
  nextLine.textContent = latest.next;
  overlay.hidden = !latest.current.trim();
}

export function initVisualizerLyrics() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'lq-viz-lyrics';
  overlay.setAttribute('aria-label', 'Now singing');
  currentLine = document.createElement('div');
  currentLine.className = 'lq-viz-lyric-current';
  nextLine = document.createElement('div');
  nextLine.className = 'lq-viz-lyric-next';
  overlay.append(currentLine, nextLine);
  document.body.appendChild(overlay);
  renderLyrics();
}
