/*
 * Lacquer — titlebar & shell nav (D8; wordmark upgraded in Stage C, C4).
 *
 * The window is frameless (see `createMainWindow` in `src/index.ts`) with the
 * native Windows Controls Overlay for min / maximise / close. This module does
 * the renderer-side part:
 *
 *   - draws the Lacquer wordmark where the stock YouTube Music logo was (the
 *     logo itself is hidden in `suppress.css`). Stage A shipped a plain Space
 *     Grotesk text node; this is a real inline SVG mark — a lacquered record
 *     against an orbit, with a spectral-diffraction arc — beside the word;
 *   - relocates back / forward to the top of the rail.
 *
 * All colour and type live in `titlebar.css`; this module only builds
 * structure. YouTube Music re-renders the nav bar and the guide, which wipes
 * injected nodes, so each injection is guarded by a narrow `childList`-only
 * observer on its own host that re-asserts the node if it disappears.
 */

import { whenElement } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WORDMARK_ID = 'lacquer-wordmark';
const RAIL_NAV_ID = 'lacquer-rail-nav';

/** The record-and-orbit mark plus the wordmark, as one lockup. The `<g>` with
 *  class `lq-mark` is re-used standalone as the app icon (`assets/icon.svg`). */
const WORDMARK_SVG = `
<svg class="lq-wordmark-svg" viewBox="0 0 116 32" role="img" aria-label="Lacquer">
  <defs>
    <linearGradient id="lq-mark-spectrum-grad" x1="0" y1="0" x2="1" y2="0.35">
      <stop offset="0"></stop>
      <stop offset="0.4"></stop>
      <stop offset="0.72"></stop>
      <stop offset="1"></stop>
    </linearGradient>
  </defs>
  <g class="lq-mark">
    <ellipse class="lq-mark-orbit" cx="16" cy="16" rx="14.5" ry="10.5"
      transform="rotate(-22 16 16)"></ellipse>
    <circle class="lq-mark-orbit-body" cx="28" cy="6.4" r="2.3"></circle>
    <circle class="lq-mark-disc" cx="16" cy="16" r="11.5"></circle>
    <circle class="lq-mark-groove" cx="16" cy="16" r="7.6"></circle>
    <path class="lq-mark-spectrum" d="M7.3 8.7 A11.5 11.5 0 0 1 24.7 8.7"></path>
    <circle class="lq-mark-spindle" cx="16" cy="16" r="2.6"></circle>
  </g>
  <text class="lq-wordmark-text" x="37" y="22">Lacquer</text>
</svg>`;

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

export const initTitleBar = () => {
  whenElement('ytmusic-nav-bar').then(injectWordmark);
  whenElement('#guide-renderer, ytmusic-guide-renderer').then(injectRailNav);
};
