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

/**
 * The line to show at `time`, or -1 for none (before the first timestamp,
 * after the final line has expired, or no timed lyrics at all).
 */
export function selectVisualizerLyricIndex(
  lines: readonly TimedLine[] | undefined,
  time: number,
): number {
  if (!lines?.length) return -1;
  let index = -1;
  for (let candidate = 0; candidate < lines.length; candidate += 1) {
    if (time < lines[candidate].timeInMs) break;
    index = candidate;
  }
  if (index < 0) return -1;
  // Timed providers often leave a short gap between one line's declared
  // duration and the next line's timestamp. The normal synced renderer keeps
  // the most recent line through that handoff; doing the same here prevents a
  // visible blank flash. The final line still expires at its own duration.
  if (
    index === lines.length - 1 &&
    time >= lines[index].timeInMs + lines[index].duration
  )
    return -1;
  return index;
}

export function selectVisualizerLyrics(
  lines: readonly TimedLine[] | undefined,
  time: number,
): OverlayLyrics {
  const index = selectVisualizerLyricIndex(lines, time);
  if (!lines || index < 0) return { previous: '', current: '', next: '' };
  return {
    previous: lines[index - 1]?.text ?? '',
    current: lines[index].text,
    next: lines[index + 1]?.text ?? '',
  };
}

/*
 * Rendering — one continuous column, Spotify-style.
 *
 * Every line of the song is laid out once in a track. Advancing moves the
 * track with a composited `transform` so the active line glides up into the
 * anchor, while the neighbours fade in and out through a mask at the edges.
 * The previous build swapped the text of three fixed slots and replayed a
 * short nudge, which read as a hard cut on every line.
 */

let lines: readonly string[] = [];
let activeIndex = -1;
let overlay: HTMLElement | undefined;
let track: HTMLElement | undefined;
let lineElements: HTMLElement[] = [];

const sameLines = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((line, index) => line === b[index]);

/** Move the active line to the anchor. `animate: false` jumps (new song, resize). */
function positionTrack(animate: boolean) {
  if (!overlay || !track) return;
  const active = lineElements[activeIndex];
  if (!active) return;
  const anchor = overlay.clientHeight / 2;
  const offset = active.offsetTop + active.offsetHeight / 2;
  track.toggleAttribute('data-instant', !animate);
  track.style.transform = `translate3d(0, ${Math.round(anchor - offset)}px, 0)`;
}

function markLines() {
  lineElements.forEach((element, index) => {
    const distance = index - activeIndex;
    element.dataset.state =
      distance === 0
        ? 'active'
        : distance === 1
          ? 'next'
          : distance === -1
            ? 'previous'
            : distance < 0
              ? 'past'
              : 'upcoming';
  });
}

function buildTrack() {
  if (!track) return;
  lineElements = lines.map((text) => {
    const element = document.createElement('div');
    element.className = 'lq-viz-lyric';
    // Instrumental gaps keep their slot so the column spacing stays even.
    element.textContent = text.trim() ? text : '♪';
    return element;
  });
  track.replaceChildren(...lineElements);
}

export function publishVisualizerLyrics(
  nextLines: readonly string[] | undefined,
  index: number,
) {
  const incoming = nextLines ?? [];
  const songChanged = !sameLines(incoming, lines);
  if (!songChanged && index === activeIndex) return;

  const wasHidden = activeIndex < 0 || !lines[activeIndex]?.trim();
  lines = incoming;
  activeIndex = index;
  if (songChanged) buildTrack();
  if (!overlay) return;

  const hidden = activeIndex < 0 || !lines[activeIndex]?.trim();
  overlay.hidden = hidden;
  if (hidden) return;
  markLines();
  // A new song, or reappearing after a gap, lands in place rather than
  // scrolling in from wherever the previous track was left.
  positionTrack(!songChanged && !wasHidden);
}

export function initVisualizerLyrics() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'lq-viz-lyrics';
  overlay.setAttribute('aria-label', 'Now singing');
  track = document.createElement('div');
  track.className = 'lq-viz-lyrics-track';
  overlay.append(track);
  document.body.appendChild(overlay);
  buildTrack();
  overlay.hidden = activeIndex < 0 || !lines[activeIndex]?.trim();
  markLines();
  // Line wrapping, the overlay box and the font size all follow the viewport
  // (and full-screen mode); re-anchor without animation when any of them move.
  new ResizeObserver(() => positionTrack(false)).observe(overlay);
}
