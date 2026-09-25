/*
 * Lacquer — keep the elapsed / total time clear of the output controls.
 *
 * `transport.css` pins the time just right of the centred transport buttons,
 * while the right-hand controls grow leftward from the edge of the bar. Their
 * width is not fixed: YouTube Music adds a captions button for videos, and
 * plugins add their own. On a normal-width window that pushed FX straight into
 * "0:03 / 3:59". CSS cannot see the collision, so this measures it — only when
 * one of the three boxes changes size — and resolves it in two steps:
 *
 *   1. `[data-lq-deck-compact]` tightens the gaps between the output controls;
 *   2. only if the time still does not fit, `[data-lq-time-cramped]` hides it,
 *      the same way the narrow-window rule already does.
 */

import { whenElement } from './dom';

const GAP_PX = 12;
const COMPACT = 'data-lq-deck-compact';
const CRAMPED = 'data-lq-time-cramped';

/** Left edge of the right-hand cluster's first visible control. */
const controlsLeft = (controls: Element) => {
  let left = Infinity;
  for (const child of controls.children) {
    const box = child.getBoundingClientRect();
    if (box.width > 0) left = Math.min(left, box.left);
  }
  return left;
};

export const initTransportFit = () => {
  whenElement('ytmusic-player-bar .right-controls-buttons').then((controls) => {
    const bar = controls.closest('ytmusic-player-bar');
    const time = bar?.querySelector<HTMLElement>('.left-controls > .time-info');
    if (!bar || !time) return;

    const collides = () => {
      const box = time.getBoundingClientRect();
      return box.width > 0 && box.right + GAP_PX > controlsLeft(controls);
    };

    const check = () => {
      // Measure from the relaxed layout each time. Neither step moves the
      // time or grows the controls, so this cannot oscillate.
      bar.removeAttribute(CRAMPED);
      bar.removeAttribute(COMPACT);
      if (!collides()) return;
      bar.setAttribute(COMPACT, '');
      if (collides()) bar.setAttribute(CRAMPED, '');
    };

    const observer = new ResizeObserver(check);
    observer.observe(bar);
    observer.observe(controls);
    observer.observe(time);
  });
};
