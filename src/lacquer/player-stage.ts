/*
 * Lacquer — player stage, structural layer (Stage B, B4).
 *
 * `player-stage.css` paints the atmosphere. This module adds the one thing a
 * stylesheet cannot: the editorial metadata block — album/song title and
 * artist in Newsreader (D7) — because YouTube Music renders no title on the
 * player page at all; the now-playing text lives only in the transport deck.
 *
 * It also flags two states on `:root` so the CSS can stand down from the
 * record-sleeve treatment:
 *
 *   [data-lq-video] — video mode is showing, not the artwork
 *   [data-lq-ad]    — an ad is playing (no blocker is perfect; B4 requires a
 *                     clean Orbit Noir fallback rather than raw YouTube chrome)
 *
 * One observer, scoped to the transport's info block, which only mutates on a
 * track or ad transition. No polling, no per-frame work.
 */

import { whenElement } from './dom';

const NOW_ID = 'lacquer-now';

interface NowPlaying {
  title: string;
  artist: string;
  meta: string;
}

/** `"Spice Girls • Spice (25th Anniversary…) • 2021"` → parts. */
const readNowPlaying = (): NowPlaying | null => {
  const bar = document.querySelector('ytmusic-player-bar');
  const title = bar?.querySelector('.title')?.textContent?.trim() ?? '';
  if (!title) return null;

  const byline = bar?.querySelector('.byline')?.textContent?.trim() ?? '';
  const parts = byline
    .split('•')
    .map((part) => part.trim())
    .filter(Boolean);

  // byline is "artist • album • year" (album and/or year may be absent).
  const artist = parts[0] ?? '';
  const meta = parts.slice(1).join(' · ');

  return { title, artist, meta };
};

const renderNow = (host: Element, now: NowPlaying) => {
  let block = host.querySelector<HTMLElement>(`#${NOW_ID}`);
  if (!block) {
    block = document.createElement('div');
    block.id = NOW_ID;
    block.innerHTML =
      '<p class="lacquer-now-title"></p>' +
      '<p class="lacquer-now-artist"></p>' +
      '<p class="lacquer-now-meta"></p>';
    host.appendChild(block);
  }

  const set = (selector: string, text: string) => {
    const el = block.querySelector<HTMLElement>(selector);
    if (el && el.textContent !== text) el.textContent = text;
  };
  set('.lacquer-now-title', now.title);
  set('.lacquer-now-artist', now.artist);
  const metaEl = block.querySelector<HTMLElement>('.lacquer-now-meta');
  if (metaEl) {
    metaEl.textContent = now.meta;
    metaEl.style.display = now.meta ? '' : 'none';
  }
};

const isAdPlaying = (): boolean => {
  const moviePlayer = document.querySelector('#movie_player');
  if (
    moviePlayer?.classList.contains('ad-showing') ||
    moviePlayer?.classList.contains('ad-interrupting')
  ) {
    return true;
  }
  const adBadge = document.querySelector<HTMLElement>(
    'ytmusic-player-bar .badge-style-type-ad-stark, ytmusic-player-bar .badge-style-type-ad',
  );
  return !!adBadge && adBadge.offsetParent !== null;
};

const isVideoMode = (): boolean => {
  const video = document.querySelector<HTMLElement>(
    'ytmusic-player #song-video',
  );
  return !!video && video.offsetParent !== null && video.offsetHeight > 40;
};

const syncState = () => {
  const root = document.documentElement;
  root.toggleAttribute('data-lq-ad', isAdPlaying());
  root.toggleAttribute('data-lq-video', isVideoMode());
};

const initMetadata = (mainPanel: Element) => {
  const update = () => {
    syncState();
    const now = readNowPlaying();
    if (now) renderNow(mainPanel, now);
  };
  update();

  // The transport's info block mutates on track change and when the "Sponsored"
  // badge appears/disappears — exactly the transitions we care about.
  const infoBlock =
    document.querySelector('ytmusic-player-bar .middle-controls') ??
    document.querySelector('ytmusic-player-bar');
  if (infoBlock) {
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        update();
      });
    }).observe(infoBlock, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Re-assert the block if the player page re-renders and drops it.
  new MutationObserver(() => {
    if (!mainPanel.querySelector(`#${NOW_ID}`)) update();
  }).observe(mainPanel, { childList: true });
};

export const initPlayerStage = () => {
  whenElement('ytmusic-player-page #main-panel').then(initMetadata);
};
