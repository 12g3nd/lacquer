/*
 * Lacquer — left collection rail, structural layer (Stage B, B2).
 *
 * `rail.css` themes the stock guide. Two things a stylesheet cannot do live
 * here:
 *
 *   1. Relabel the primary nav — Home / Explore / Library become
 *      Listen / Discover / Collection (D10) as *real text nodes* with proper
 *      `aria-label`s. Not `font-size: 0` + `::after`, which breaks screen
 *      readers and i18n and is explicitly banned.
 *   2. The account control moves out of the titlebar (D8) into a footer button
 *      at the bottom of the rail. The button proxies to the stock
 *      `ytmusic-settings-button`, which stays in the DOM (visually hidden by
 *      `suppress.css`) so its account menu still works.
 *
 * Routes and click behaviour are untouched — the stock entry keeps its own
 * endpoint. Only the visible label and the ARIA name change.
 *
 * YouTube Music re-renders the guide on navigation and wipes edits, so each
 * change is re-asserted by a narrow `childList` observer scoped to the guide,
 * the same shape as `titlebar.ts`.
 */

import { whenElement } from './dom';

/** D10. Keyed by the stock English label; index is the fallback for locales. */
const PRIMARY_RELABEL: Record<string, string> = {
  Home: 'Listen',
  Explore: 'Discover',
  Library: 'Collection',
};
const PRIMARY_BY_INDEX = ['Listen', 'Discover', 'Collection'];

const ACCOUNT_ID = 'lacquer-rail-account';

const relabelEntry = (entry: Element, next: string) => {
  const title = entry.querySelector<HTMLElement>('.title');
  const item = entry.querySelector<HTMLElement>('tp-yt-paper-item');
  if (!title || title.textContent?.trim() === next) return;
  title.textContent = next;
  item?.setAttribute('aria-label', next);
  item?.setAttribute('title', next);
};

const relabelPrimary = (guide: Element) => {
  const primary = [
    ...guide.querySelectorAll('ytmusic-guide-entry-renderer[is-primary]'),
  ];
  // Only touch entries we are sure are primary nav. If `is-primary` is absent
  // on this build, fall back to the first three entries and relabel only —
  // never hide, since entry 4 could be a playlist.
  const marked = primary.length > 0;
  const entries = marked
    ? primary
    : [...guide.querySelectorAll('ytmusic-guide-entry-renderer')].slice(0, 3);

  entries.forEach((entry, index) => {
    // Listen / Discover / Collection are the only primary items (D10). Anything
    // past them is the Upgrade nag — off-brand, and an ad-free surface is a
    // design premise (D11). `removeUpgradeButton` handles it on a clean
    // profile; this covers profiles that stored the option off.
    if (marked && index > 2) {
      (entry as HTMLElement).style.display = 'none';
      return;
    }
    const current = entry.querySelector('.title')?.textContent?.trim() ?? '';
    const mapped =
      PRIMARY_RELABEL[current] ??
      (PRIMARY_BY_INDEX.includes(current) ? current : PRIMARY_BY_INDEX[index]);
    if (mapped) relabelEntry(entry, mapped);
  });
};

const buildAccountButton = () => {
  const button = document.createElement('button');
  button.id = ACCOUNT_ID;
  button.type = 'button';
  button.setAttribute('aria-label', 'Account');

  const stockAvatar = document.querySelector<HTMLImageElement>(
    'ytmusic-settings-button img, ytmusic-settings-button #avatar img',
  );
  const avatarSrc = stockAvatar?.src;

  if (avatarSrc) {
    const img = document.createElement('img');
    img.className = 'lacquer-account-avatar';
    img.src = avatarSrc;
    img.alt = '';
    button.appendChild(img);
  } else {
    const dot = document.createElement('span');
    dot.className =
      'lacquer-account-avatar lacquer-account-avatar--placeholder';
    dot.textContent = '●';
    button.appendChild(dot);
  }

  const label = document.createElement('span');
  label.textContent = 'Account';
  button.appendChild(label);

  button.addEventListener('click', () => {
    document
      .querySelector<HTMLElement>(
        'ytmusic-settings-button tp-yt-paper-icon-button, ytmusic-settings-button button, ytmusic-settings-button',
      )
      ?.click();
  });

  return button;
};

const injectAccountFooter = (guide: Element) => {
  if (guide.querySelector(`#${ACCOUNT_ID}`)) return;
  guide.appendChild(buildAccountButton());
};

/** Coalesces observer bursts into one microtask. */
const debounced = (fn: () => void) => {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      fn();
    });
  };
};

const keepRail = (guide: Element) => {
  const apply = debounced(() => {
    relabelPrimary(guide);
    injectAccountFooter(guide);
  });
  apply();
  new MutationObserver(apply).observe(guide, {
    childList: true,
    subtree: true,
  });
};

export const initRail = () => {
  whenElement('ytmusic-guide-renderer#guide-renderer').then(keepRail);

  // The icon rail (`#mini-guide-renderer`) is built the first time the window
  // is narrow enough, and re-rendered as it collapses/expands. A single
  // ResizeObserver — native, fires only on an actual size change — re-asserts
  // the relabelling whenever it exists. Cheaper and simpler than a persistent
  // subtree MutationObserver waiting for a node that may never appear.
  const relabelMini = debounced(() => {
    const mini = document.querySelector('#mini-guide-renderer');
    if (mini) relabelPrimary(mini);
  });
  relabelMini();
  new ResizeObserver(relabelMini).observe(document.documentElement);
};
