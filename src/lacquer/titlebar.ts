/*
 * Lacquer — titlebar & shell nav (Stage A slice of D8).
 *
 * The window is frameless (see `createMainWindow` in `src/index.ts`) with the
 * native Windows Controls Overlay for min / maximise / close — Pear's existing
 * window-control mechanism, not hand-drawn buttons. This module does the
 * renderer-side part:
 *
 *   - draws the "Lacquer" wordmark (Space Grotesk) where the stock YouTube
 *     Music logo was (the logo itself is hidden in `suppress.css`);
 *   - relocates back / forward to the top of the rail — they are navigation,
 *     and navigation belongs in the rail.
 *
 * Account access stays as the stock avatar at the right of the one-row
 * titlebar, de-branded by `suppress.css`. The *authored* rail — and moving
 * account into its footer — is Stage B.
 *
 * YouTube Music re-renders both the nav bar and the guide (on navigation, on
 * data load), which wipes injected nodes. Each injection is guarded by a
 * narrow `childList`-only observer on its own host that re-asserts the node if
 * it disappears — scoped tight enough to stay off the perf budget.
 */

import { whenElement } from './dom';

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
  button.appendChild(chevron(d));
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  Object.assign(button.style, {
    width: '32px',
    height: '32px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 'var(--lq-radius-sm, 4px)',
    background: 'transparent',
    color: 'var(--lq-text, #e8eff5)',
    cursor: 'pointer',
  });
  button.onmouseenter = () => {
    button.style.background = 'var(--lq-instrument-raised, #173a6a)';
  };
  button.onmouseleave = () => {
    button.style.background = 'transparent';
  };
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
    mark.textContent = 'Lacquer';
    Object.assign(mark.style, {
      fontFamily: 'var(--lq-font-graphic, "Space Grotesk", Inter, sans-serif)',
      fontWeight: '600',
      fontSize: '20px',
      lineHeight: '1',
      letterSpacing: '0.01em',
      color: 'var(--lq-text, #e8eff5)',
      padding: '0 8px',
      userSelect: 'none',
    });
    mark.style.setProperty('-webkit-app-region', 'no-drag');
    left.prepend(mark);
  });
};

const injectRailNav = (rail: Element) => {
  const host = rail.querySelector('#sections') ?? rail;

  keepInjected(host, RAIL_NAV_ID, () => {
    if (document.getElementById(RAIL_NAV_ID)) return;
    const bar = document.createElement('div');
    bar.id = RAIL_NAV_ID;
    Object.assign(bar.style, {
      display: 'flex',
      gap: 'var(--lq-space-1, 4px)',
      padding: 'var(--lq-space-2, 8px)',
      borderBottom: '1px solid var(--lq-hairline, rgba(232, 239, 245, 0.14))',
    });
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
