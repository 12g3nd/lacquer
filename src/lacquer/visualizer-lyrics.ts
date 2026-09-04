/** A small text-only bridge: the lyrics plugin owns timing and providers. */
interface TimedLine {
  timeInMs: number;
  duration: number;
  text: string;
}
interface OverlayLyrics {
  previous: string;
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
  if (!lines || index < 0) return { previous: '', current: '', next: '' };
  return {
    previous: lines[index - 1]?.text ?? '',
    current: lines[index].text,
    next: lines[index + 1]?.text ?? '',
  };
}

let latest: OverlayLyrics = { previous: '', current: '', next: '' };
let overlay: HTMLElement | undefined;
let previousLine: HTMLElement | undefined;
let currentLine: HTMLElement | undefined;
let nextLine: HTMLElement | undefined;

export function publishVisualizerLyrics(lyrics: OverlayLyrics) {
  if (
    lyrics.previous === latest.previous &&
    lyrics.current === latest.current &&
    lyrics.next === latest.next
  )
    return;
  const shouldAdvance = Boolean(lyrics.current.trim());
  latest = lyrics;
  renderLyrics(shouldAdvance);
}

function renderLyrics(animate = false) {
  if (!overlay || !previousLine || !currentLine || !nextLine) return;
  previousLine.textContent = latest.previous;
  currentLine.textContent = latest.current;
  nextLine.textContent = latest.next;
  overlay.hidden = !latest.current.trim();
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    overlay.classList.remove('is-advancing');
    // Restart the short choreography only when the timed line changes, never
    // on the 100ms playback clock updates that feed this bridge.
    overlay.getBoundingClientRect();
    overlay.classList.add('is-advancing');
  }
}

export function initVisualizerLyrics() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'lq-viz-lyrics';
  overlay.setAttribute('aria-label', 'Now singing');
  previousLine = document.createElement('div');
  previousLine.className = 'lq-viz-lyric-previous';
  currentLine = document.createElement('div');
  currentLine.className = 'lq-viz-lyric-current';
  nextLine = document.createElement('div');
  nextLine.className = 'lq-viz-lyric-next';
  overlay.append(previousLine, currentLine, nextLine);
  document.body.appendChild(overlay);
  renderLyrics();
}
