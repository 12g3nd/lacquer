/*
 * Lacquer — keyboard-navigation focus rings.
 *
 * Chromium's `:focus-visible` heuristic switches to "keyboard modality" on any
 * key press. Lacquer is driven by key shortcuts (arrow keys change volume,
 * media keys, Ctrl+Shift+V), so a stray press painted the Ion ring around
 * whatever was last clicked — the Previous button, or a full-width element as
 * a lone line across the full-screen view.
 *
 * Rings are an affordance for moving focus, so they follow Tab alone: Tab
 * turns them on, the next pointer press turns them off. `suppress.css` keys
 * the ring off `[data-lq-keyboard-nav]`.
 */

const ATTRIBUTE = 'data-lq-keyboard-nav';

export const initFocusModality = () => {
  const root = document.documentElement;
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Tab') root.setAttribute(ATTRIBUTE, '');
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'pointerdown',
    () => root.removeAttribute(ATTRIBUTE),
    { capture: true, passive: true },
  );
};
