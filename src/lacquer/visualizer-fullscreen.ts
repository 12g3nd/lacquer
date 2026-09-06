import { whenElement } from './dom';

let activateVisualizer: (() => void) | undefined;
let entering = false;
let owned = false;
let appWasInert = false;

function restoreApp() {
  const app = document.querySelector<HTMLElement>('ytmusic-app');
  if (app) app.inert = appWasInert;
}

export async function enterVisualizerFullscreen() {
  if (entering || document.fullscreenElement || !activateVisualizer) return;
  entering = true;
  owned = true;
  document.documentElement.setAttribute('data-lq-viz-fullscreen', '');
  try {
    // Fullscreen the document, so the canvas and lyric siblings share the
    // native screen. Fullscreening only the canvas would exclude the lyrics.
    await document.documentElement.requestFullscreen();
    activateVisualizer();
    const app = document.querySelector<HTMLElement>('ytmusic-app');
    appWasInert = app?.inert ?? false;
    if (app) app.inert = true;
    document.getElementById('lq-viz-song-header')?.focus();
  } catch (error) {
    owned = false;
    document.documentElement.removeAttribute('data-lq-viz-fullscreen');
    console.error('[Lacquer] Could not enter full screen', error);
  } finally {
    entering = false;
  }
}

export function initVisualizerFullscreen(activate: () => void) {
  if (activateVisualizer) return;
  activateVisualizer = activate;
  const header = document.createElement('header');
  header.id = 'lq-viz-song-header';
  header.tabIndex = -1;
  header.setAttribute('aria-label', 'Now playing');
  const art = document.createElement('img');
  art.alt = '';
  const identity = document.createElement('div');
  identity.className = 'lq-viz-song-identity';
  const title = document.createElement('h1');
  const byline = document.createElement('p');
  identity.append(title, byline);
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.textContent = 'Exit full screen';
  exit.title = 'Exit full screen (Esc)';
  exit.addEventListener('click', () => document.exitFullscreen());
  header.append(art, identity, exit);
  document.body.appendChild(header);

  whenElement('ytmusic-player-bar .middle-controls').then((info) => {
    const update = () => {
      title.textContent =
        info.querySelector('.title')?.textContent?.trim() || 'Nothing playing';
      byline.textContent =
        info.querySelector('.byline')?.textContent?.trim() || '';
      const src = document.querySelector<HTMLImageElement>(
        'ytmusic-player-bar img',
      )?.src;
      if (src && art.src !== src) art.src = src;
      art.hidden = !src;
    };
    update();
    new MutationObserver(update).observe(info, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  });

  document.addEventListener('fullscreenchange', () => {
    if (!owned || document.fullscreenElement) return;
    owned = false;
    restoreApp();
    document.documentElement.removeAttribute('data-lq-viz-fullscreen');
    document.getElementById('lacquer-viz-fullscreen')?.focus();
  });
  document.addEventListener(
    'keydown',
    (event) => {
      if (!owned || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (document.fullscreenElement) document.exitFullscreen();
    },
    { capture: true },
  );
}
