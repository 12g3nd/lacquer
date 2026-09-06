/*
 * Lacquer — titlebar & shell nav (D8; wordmark upgraded in Stage C, C4).
 *
 * The window is frameless (see `createMainWindow` in `src/index.ts`) with the
 * native Windows Controls Overlay for min / maximise / close. This module does
 * the renderer-side part:
 *
 *   - draws the Lacquer wordmark where the stock YouTube Music logo was (the
 *     logo itself is hidden in `suppress.css`). Stage A shipped a plain Space
 *     Grotesk text node; this is the approved champagne-and-bronze script L
 *     on its Orbit Noir plate beside the word;
 *   - relocates back / forward to the top of the rail.
 *
 * All colour and type live in `titlebar.css`; this module only builds
 * structure. YouTube Music re-renders the nav bar and the guide, which wipes
 * injected nodes, so each injection is guarded by a narrow `childList`-only
 * observer on its own host that re-asserts the node if it disappears.
 */

import { whenElement } from './dom';
import { WORDMARK_SVG } from './logo.generated';
import { signalChain } from './signal-chain';
import { enterVisualizerFullscreen } from './visualizer-fullscreen';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WORDMARK_ID = 'lacquer-wordmark';
const RAIL_NAV_ID = 'lacquer-rail-nav';

/** Re-runs `inject` whenever `host`'s direct children change and the marker
 *  element is missing. One observer per host, `childList` only. */
const keepInjected = (host: Element, markerId: string, inject: () => void) => {
  inject();
  new MutationObserver(() => {
    if (!document.getElementById(markerId)) inject();
  }).observe(host, { childList: true });
};

const chevron = (d: string) => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  return svg;
};

const navButton = (label: string, d: string, onClick: () => void) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lq-shell-navbtn';
  button.appendChild(chevron(d));
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.onclick = onClick;
  return button;
};

const injectWordmark = (navBar: Element) => {
  const left =
    navBar.querySelector('#left-content') ??
    navBar.querySelector('.left-content') ??
    navBar;

  keepInjected(left, WORDMARK_ID, () => {
    if (document.getElementById(WORDMARK_ID)) return;
    const mark = document.createElement('span');
    mark.id = WORDMARK_ID;
    mark.innerHTML = WORDMARK_SVG;
    left.prepend(mark);
  });
};

const injectRailNav = (rail: Element) => {
  const host = rail.querySelector('#sections') ?? rail;

  keepInjected(host, RAIL_NAV_ID, () => {
    if (document.getElementById(RAIL_NAV_ID)) return;
    const bar = document.createElement('div');
    bar.id = RAIL_NAV_ID;
    bar.appendChild(navButton('Back', 'm15 18-6-6 6-6', () => history.back()));
    bar.appendChild(
      navButton('Forward', 'm9 18 6-6-6-6', () => history.forward()),
    );
    host.prepend(bar);
  });
};

const initListeningStatus = () => {
  whenElement('ytmusic-nav-bar #right-content').then((host) => {
    keepInjected(host, 'lq-listening-status', () => {
      const status = document.createElement('div');
      status.id = 'lq-listening-status';
      const indicator = document.createElement('span');
      indicator.className = 'lq-listening-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('div');
      const title = document.createElement('span');
      const detail = document.createElement('small');
      copy.append(title, detail);
      const full = navButton(
        'Full-screen visualizer',
        'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
        () => {
          enterVisualizerFullscreen();
        },
      );
      status.append(indicator, copy, full);
      host.prepend(status);
    });
    const update = () => {
      const status = document.getElementById('lq-listening-status');
      const video = document.querySelector('video');
      if (!status) return;
      const playing = video && !video.paused;
      status.toggleAttribute('data-playing', Boolean(playing));
      status.querySelector('div > span')!.textContent = playing
        ? 'Listening'
        : 'Ready when you are';
      status.querySelector('small')!.textContent =
        `${signalChain.getCurrentPreset()} \u00b7 ${(video?.playbackRate ?? 1).toFixed(2)}\u00d7`;
    };
    whenElement('video').then((video) => {
      for (const event of ['playing', 'pause', 'ratechange'])
        video.addEventListener(event, update);
      update();
    });
    document.addEventListener('lacquer:preset-changed', update);
    update();
  });
};

export const initTitleBar = () => {
  initListeningStatus();
  whenElement('ytmusic-nav-bar').then(injectWordmark);
  whenElement('#guide-renderer, ytmusic-guide-renderer').then(injectRailNav);
};
