/*
 * Lacquer — track / item context menu (Stage C, C2).
 *
 * The classifier (`context-menu-classify.ts`, import-free by design) decides
 * what each stock YouTube Music menu item *is* from its Polymer data — icon
 * type first, navigation/service endpoint as the fallback — never from icon
 * path geometry. This module consumes that to reorganise the menu into
 * Lacquer's two tiers:
 *
 *   Tier 1  Play next · Add to queue · Save to playlist · —
 *           Sped + Reverb · Slowed + Reverb · FX… · —
 *           Go to album · Go to artist · More…
 *   Tier 2  (revealed by More…) remove-from-library, remove-from-queue,
 *           dismiss queue, download, credits, share, report, start radio,
 *           shuffle, play, and anything the classifier could not place —
 *           nothing is ever dropped.
 *
 * Two defects this stage fixes:
 *
 *   - The reorg used to wrap items in plain `<div>`s and nest tier 2 in a
 *     sub-container, which broke `tp-yt-paper-listbox` keyboard navigation.
 *     The listbox stays flat now — tier 2 items are just `hidden` until More…
 *     is opened — and this module runs its own roving-focus keyboard
 *     controller over it: Up/Down, Home/End, Escape, type-ahead, Enter/Space.
 *
 *   - `closeMenu()` used to set `display:none` and restore it a frame later —
 *     a flicker, not a close; Polymer still had the dropdown open. It now
 *     calls the dropdown's own `close()`, which also restores focus to the
 *     trigger.
 *
 * The popup is styled in `context-menu.css` (Blueglass, Interface voice).
 */

import { classifyMenuItem } from './context-menu-classify';
import { whenElement } from './dom';
import { setFXRackOpen } from './fx-rack';
import { signalChain } from './signal-chain';

import type { SignalChainPreset } from './signal-chain-types';

const TIER_1_LEAD = ['play-next', 'add-to-queue', 'save-to-playlist'];
const TIER_1_NAV = ['go-to-album', 'go-to-artist'];
const TIER_2_ORDER = [
  'remove-from-library',
  'remove-from-queue',
  'dismiss-queue',
  'download',
  'credits',
  'share',
  'report',
  'start-radio',
  'shuffle',
  'play',
];

const ITEM_SELECTOR = '[data-lacquer-menuitem]:not([hidden])';
const TYPEAHEAD_RESET_MS = 700;

/* -------------------------------------------------------------------------- */
/* Lacquer rows                                                               */
/* -------------------------------------------------------------------------- */

function createSeparator(): HTMLElement {
  const sep = document.createElement('div');
  sep.className =
    'lacquer-menu-separator style-scope ytmusic-menu-popup-renderer';
  sep.setAttribute('role', 'separator');
  return sep;
}

function createLacquerItem(
  label: string,
  ariaLabel: string,
  onClick: () => void,
  opts: { more?: boolean } = {},
): HTMLElement {
  const item = document.createElement('div');
  item.className = 'lacquer-menu-item style-scope ytmusic-menu-popup-renderer';
  item.dataset.lacquerMenuitem = '';
  item.tabIndex = -1;
  item.setAttribute('role', 'menuitem');
  item.setAttribute('aria-label', ariaLabel);
  if (opts.more) {
    item.dataset.lacquerMore = '';
    item.setAttribute('aria-expanded', 'false');
    item.setAttribute('aria-haspopup', 'true');
  }

  const text = document.createElement('span');
  text.className = 'lacquer-menu-label';
  text.textContent = label;
  item.appendChild(text);

  item.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });

  return item;
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

function closeMenu() {
  const popup = document.querySelector<HTMLElement>(
    'ytmusic-menu-popup-renderer',
  );
  const dropdown = popup?.closest<HTMLElement & { close?: () => void }>(
    'tp-yt-iron-dropdown',
  );
  if (typeof dropdown?.close === 'function') {
    dropdown.close();
    return;
  }
  dropdown?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
}

function applyFxPreset(preset: SignalChainPreset) {
  signalChain.setPreset(preset);
  window.localStorage.setItem('lacquer.fxPreset', preset);
  document.dispatchEvent(
    new CustomEvent('lacquer:preset-changed', { detail: { preset } }),
  );
  closeMenu();
}

function openFxRack() {
  closeMenu();
  setFXRackOpen(true);
}

/* -------------------------------------------------------------------------- */
/* Keyboard navigation                                                        */
/* -------------------------------------------------------------------------- */

let typeBuffer = '';
let typeTimer = 0;

const items = (listbox: HTMLElement): HTMLElement[] => [
  ...listbox.querySelectorAll<HTMLElement>(ITEM_SELECTOR),
];

function focusAt(list: HTMLElement[], index: number) {
  if (list.length === 0) return;
  const target = Math.max(0, Math.min(list.length - 1, index));
  list.forEach((item, i) => {
    item.tabIndex = i === target ? 0 : -1;
  });
  list[target].focus();
}

function typeahead(list: HTMLElement[], char: string) {
  window.clearTimeout(typeTimer);
  typeBuffer += char.toLowerCase();
  typeTimer = window.setTimeout(() => {
    typeBuffer = '';
  }, TYPEAHEAD_RESET_MS);

  const match = list.find((item) =>
    (item.textContent ?? '').trim().toLowerCase().startsWith(typeBuffer),
  );
  if (match) focusAt(list, list.indexOf(match));
}

function installKeyboard(listbox: HTMLElement) {
  if (listbox.dataset.lacquerKb === '1') return;
  listbox.dataset.lacquerKb = '1';

  // Capture phase so `tp-yt-paper-listbox`'s own `IronMenuBehavior` keydown
  // handler never sees the keys we own — it would double-move selection.
  listbox.addEventListener(
    'keydown',
    (event) => {
      const list = items(listbox);
      if (list.length === 0) return;
      const current = list.indexOf(document.activeElement as HTMLElement);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopImmediatePropagation();
          focusAt(list, current < 0 ? 0 : (current + 1) % list.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          event.stopImmediatePropagation();
          focusAt(list, current <= 0 ? list.length - 1 : current - 1);
          break;
        case 'Home':
          event.preventDefault();
          event.stopImmediatePropagation();
          focusAt(list, 0);
          break;
        case 'End':
          event.preventDefault();
          event.stopImmediatePropagation();
          focusAt(list, list.length - 1);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          event.stopImmediatePropagation();
          (document.activeElement as HTMLElement | null)?.click();
          break;
        case 'Escape':
          event.preventDefault();
          event.stopImmediatePropagation();
          closeMenu();
          break;
        default:
          if (event.key.length === 1 && /\S/.test(event.key)) {
            event.stopImmediatePropagation();
            typeahead(list, event.key);
          }
      }
    },
    true,
  );
}

/* -------------------------------------------------------------------------- */
/* Reorganisation                                                             */
/* -------------------------------------------------------------------------- */

let reorganizing = false;

function toggleMore(listbox: HTMLElement, moreItem: HTMLElement) {
  const next = moreItem.getAttribute('aria-expanded') !== 'true';
  moreItem.setAttribute('aria-expanded', String(next));
  const label = moreItem.querySelector('.lacquer-menu-label');
  if (label) label.textContent = next ? 'Less…' : 'More…';

  for (const item of listbox.querySelectorAll<HTMLElement>('.lacquer-tier2')) {
    item.hidden = !next;
  }
  if (next) {
    listbox.querySelector<HTMLElement>('.lacquer-tier2')?.focus();
  } else {
    moreItem.focus();
  }
}

function reorganizeMenu(listbox: HTMLElement) {
  if (reorganizing) return;

  // Strip Lacquer rows left over from a previous menu on this reused listbox.
  for (const node of listbox.querySelectorAll(
    '.lacquer-menu-item, .lacquer-menu-separator',
  )) {
    node.remove();
  }

  const stock = ([...listbox.children] as HTMLElement[]).filter(
    (child) =>
      child.getAttribute('role') !== 'separator' && child.tagName !== 'HR',
  );
  if (stock.length === 0) return;

  reorganizing = true;
  try {
    const byKey = new Map<string, HTMLElement>();
    const extras: HTMLElement[] = [];
    for (const item of stock) {
      const key = classifyMenuItem(item);
      if (key && !byKey.has(key)) byKey.set(key, item);
      else extras.push(item);
      item.dataset.lacquerMenuitem = '';
      item.tabIndex = -1;
      item.classList.remove('lacquer-tier2');
      item.hidden = false;
    }

    const take = (key: string): HTMLElement | undefined => {
      const item = byKey.get(key);
      if (item) byKey.delete(key);
      return item;
    };

    const tier1: HTMLElement[] = [];
    for (const key of TIER_1_LEAD) {
      const item = take(key);
      if (item) tier1.push(item);
    }
    tier1.push(createSeparator());
    tier1.push(
      createLacquerItem(
        'Sped + Reverb',
        'Apply the Sped and Reverb effect',
        () => applyFxPreset('Sped + Reverb'),
      ),
      createLacquerItem(
        'Slowed + Reverb',
        'Apply the Slowed and Reverb effect',
        () => applyFxPreset('Slowed + Reverb'),
      ),
      createLacquerItem('FX…', 'Open the effects rack', openFxRack),
    );
    tier1.push(createSeparator());
    for (const key of TIER_1_NAV) {
      const item = take(key);
      if (item) tier1.push(item);
    }

    const tier2: HTMLElement[] = [];
    for (const key of TIER_2_ORDER) {
      const item = take(key);
      if (item) tier2.push(item);
    }
    for (const [, item] of byKey) tier2.push(item);
    for (const item of extras) tier2.push(item);

    for (const item of tier2) {
      item.classList.add('lacquer-tier2');
      item.hidden = true;
    }

    for (const node of tier1) listbox.appendChild(node);

    if (tier2.length > 0) {
      listbox.appendChild(createSeparator());
      const moreItem = createLacquerItem(
        'More…',
        'Show more options',
        () => toggleMore(listbox, moreItem),
        { more: true },
      );
      listbox.appendChild(moreItem);
      for (const node of tier2) listbox.appendChild(node);
    }

    const first = listbox.querySelector<HTMLElement>(ITEM_SELECTOR);
    if (first) first.tabIndex = 0;

    installKeyboard(listbox);

    // If the popup moved focus into itself on open (keyboard invocation),
    // land on the first item so arrow keys have somewhere to start.
    if (first && listbox.contains(document.activeElement)) first.focus();
  } finally {
    reorganizing = false;
  }
}

/* -------------------------------------------------------------------------- */
/* Wiring                                                                     */
/* -------------------------------------------------------------------------- */

function attachMenuObserver(container: Element) {
  const check = () => {
    const listbox = container.querySelector<HTMLElement>(
      'ytmusic-menu-popup-renderer tp-yt-paper-listbox',
    );
    if (!listbox) return;
    const hasFreshStock = [...listbox.children].some(
      (child) =>
        !child.hasAttribute('data-lacquer-menuitem') &&
        !child.classList.contains('lacquer-menu-separator') &&
        child.getAttribute('role') !== 'separator',
    );
    if (hasFreshStock) reorganizeMenu(listbox);
  };

  new MutationObserver(() => {
    requestAnimationFrame(check);
  }).observe(container, { childList: true, subtree: true });
}

export function initContextMenu() {
  whenElement('ytmusic-popup-container').then(attachMenuObserver);
}
