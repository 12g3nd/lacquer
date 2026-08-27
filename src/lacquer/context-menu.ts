import { signalChain } from './signal-chain';

import type { SignalChainPreset } from './signal-chain-types';

/**
 * Maps known YTM menu-item icon SVG path prefixes to a classification key.
 * These prefixes are taken from the icon paths that YTM injects into
 * menu items — they're stable across versions because the icons are
 * baked into the iron-iconset-svg bundle.
 */
const ICON_CLASSIFIERS: Record<string, string> = {
  // "Play next" — queue_play_next icon
  'M21,16H': 'play-next',
  // "Add to queue"
  'M22,7H': 'add-to-queue',
  // "Save to playlist" / "Add to playlist"
  'M22,13h': 'save-to-playlist',
  'M14,10H': 'save-to-playlist',
  // "Go to album"
  'M12,2C6': 'go-to-album',
  // "Go to artist"
  'M12,12c2': 'go-to-artist',
  // "Remove from library" / "Unlike"
  'M4.45,': 'remove-from-library',
  // "Remove from queue"
  'M15,6H': 'remove-from-queue',
  // "Share"
  'M15,5.63': 'share',
  // "Credits"
  'M12,3.5': 'credits',
  // "Report"
  'M13.18,4': 'report',
  // "Download" / handled by downloader plugin, but classify stock one too
  'M17,18v': 'download',
  // "Start radio"
  'M12,2C6.48': 'start-radio',
  // "Shuffle play"
  'M10.59,9': 'shuffle',
  // "Play"
  'M8,5v14': 'play',
};

/** Lacquer tier-1 menu order by classification key. */
const TIER_1_ORDER = [
  'play-next',
  'add-to-queue',
  'save-to-playlist',
  '__separator_fx__',
  'sped-reverb',
  'slowed-reverb',
  'fx-open',
  '__separator_nav__',
  'go-to-album',
  'go-to-artist',
  'more',
];

/** Items that belong in tier-2 ("More…" submenu). */
const TIER_2_KEYS = new Set([
  'remove-from-library',
  'remove-from-queue',
  'download',
  'credits',
  'share',
  'report',
  'start-radio',
  'shuffle',
  'play',
]);

function classifyMenuItem(el: HTMLElement): string | null {
  const iconPath = el.querySelector<SVGPathElement>('path[d]');
  if (!iconPath) return null;
  const d = iconPath.getAttribute('d') || '';
  for (const [prefix, key] of Object.entries(ICON_CLASSIFIERS)) {
    if (d.startsWith(prefix)) return key;
  }
  return null;
}

function isContextRelevant(key: string): boolean {
  const url = window.location.href;

  if (key === 'go-to-album') {
    // Skip on album pages
    return !url.includes('browse/') || !url.includes('OLAK');
  }
  if (key === 'remove-from-queue') {
    // Only in queue context (player page with queue visible)
    const queuePanel = document.querySelector(
      'ytmusic-player-page tp-yt-paper-tab[aria-selected="true"]',
    );
    return (
      queuePanel?.textContent?.trim()?.toLowerCase()?.includes('queue') ?? false
    );
  }
  return true;
}

function createSeparator(): HTMLElement {
  const sep = document.createElement('div');
  sep.classList.add(
    'style-scope',
    'menu-item',
    'ytmusic-menu-popup-renderer',
    'lacquer-menu-separator',
  );
  sep.setAttribute('role', 'separator');
  sep.style.height = '1px';
  sep.style.margin = '4px 16px';
  sep.style.background = 'rgba(255, 255, 255, 0.12)';
  return sep;
}

function createLacquerItem(
  label: string,
  ariaLabel: string,
  onClick: () => void,
): HTMLElement {
  const item = document.createElement('div');
  item.classList.add(
    'style-scope',
    'menu-item',
    'ytmusic-menu-popup-renderer',
    'lacquer-menu-item',
  );
  item.setAttribute('role', 'option');
  item.setAttribute('tabindex', '-1');
  item.setAttribute('aria-label', ariaLabel);

  const textDiv = document.createElement('div');
  textDiv.style.display = 'flex';
  textDiv.style.alignItems = 'center';
  textDiv.style.gap = '16px';
  textDiv.style.padding = '8px 16px';
  textDiv.style.cursor = 'pointer';
  textDiv.style.fontSize = '14px';
  textDiv.style.color = 'var(--ytmusic-text-primary, #fff)';
  textDiv.style.fontFamily = 'var(--lq-font-interface, Inter, sans-serif)';
  textDiv.textContent = label;

  item.appendChild(textDiv);

  item.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  });

  // Hover style
  item.addEventListener('mouseenter', () => {
    item.style.background = 'rgba(255, 255, 255, 0.1)';
    item.style.borderRadius = 'var(--lq-radius-md, 8px)';
  });
  item.addEventListener('mouseleave', () => {
    item.style.background = '';
    item.style.borderRadius = '';
  });

  return item;
}

function closeMenu() {
  const popup = document.querySelector<HTMLElement>(
    'ytmusic-menu-popup-renderer',
  );
  if (popup) {
    const ironDropdown = popup.closest<HTMLElement>('tp-yt-iron-dropdown');
    if (ironDropdown) {
      ironDropdown.style.display = 'none';
      requestAnimationFrame(() => {
        ironDropdown.style.display = '';
      });
    }
  }
}

function applyFxPreset(preset: SignalChainPreset) {
  signalChain.setPreset(preset);
  window.localStorage.setItem('lacquer.fxPreset', preset);
  document.dispatchEvent(
    new CustomEvent('lacquer:preset-changed', { detail: { preset } }),
  );
  closeMenu();
}

function toggleFxRack() {
  const container = document.getElementById('lacquer-fx-rack-container');
  if (container) {
    const isShowing = container.style.display === 'flex';
    container.style.display = isShowing ? 'none' : 'flex';
  }
  closeMenu();
}

let moreExpanded = false;

function reorganizeMenu(listbox: HTMLElement) {
  const children = Array.from(listbox.children) as HTMLElement[];
  if (children.length === 0) return;

  // Already reorganized this instance?
  if (listbox.getAttribute('data-lacquer-reorganized') === 'true') return;
  listbox.setAttribute('data-lacquer-reorganized', 'true');

  moreExpanded = false;

  // Classify existing items
  const classified = new Map<string, HTMLElement>();
  const unclassified: HTMLElement[] = [];

  for (const child of children) {
    // Skip separators
    if (
      child.getAttribute('role') === 'separator' ||
      child.tagName === 'HR' ||
      child.classList.contains('lacquer-menu-separator')
    ) {
      continue;
    }

    const key = classifyMenuItem(child);
    if (key) {
      classified.set(key, child);
    } else {
      unclassified.push(child);
    }
  }

  // Collect tier-2 items
  const tier2Items: HTMLElement[] = [];
  for (const [key, el] of classified.entries()) {
    if (TIER_2_KEYS.has(key)) {
      if (isContextRelevant(key)) {
        tier2Items.push(el);
      }
    }
  }
  for (const el of unclassified) {
    tier2Items.push(el);
  }

  // Clear the listbox
  while (listbox.firstChild) {
    listbox.removeChild(listbox.firstChild);
  }

  // Build tier-1
  for (const key of TIER_1_ORDER) {
    if (key === '__separator_fx__' || key === '__separator_nav__') {
      listbox.appendChild(createSeparator());
      continue;
    }

    if (key === 'sped-reverb') {
      listbox.appendChild(
        createLacquerItem(
          'Sped + Reverb',
          'Apply sped up with reverb effect',
          () => applyFxPreset('Sped + Reverb'),
        ),
      );
      continue;
    }

    if (key === 'slowed-reverb') {
      listbox.appendChild(
        createLacquerItem(
          'Slowed + Reverb',
          'Apply slowed down with reverb effect',
          () => applyFxPreset('Slowed + Reverb'),
        ),
      );
      continue;
    }

    if (key === 'fx-open') {
      listbox.appendChild(
        createLacquerItem('FX\u2026', 'Open effects rack', toggleFxRack),
      );
      continue;
    }

    if (key === 'more') {
      if (tier2Items.length === 0) continue;

      const moreContainer = document.createElement('div');
      moreContainer.classList.add('lacquer-more-container');

      const moreItem = createLacquerItem(
        'More\u2026',
        'Show more options',
        () => {
          moreExpanded = !moreExpanded;
          moreSubmenu.style.display = moreExpanded ? 'block' : 'none';
          moreItem.querySelector('div')!.textContent = moreExpanded
            ? 'Less\u2026'
            : 'More\u2026';
        },
      );

      const moreSubmenu = document.createElement('div');
      moreSubmenu.classList.add('lacquer-more-submenu');
      moreSubmenu.style.display = 'none';
      moreSubmenu.style.paddingLeft = '8px';
      moreSubmenu.setAttribute('role', 'group');
      moreSubmenu.setAttribute('aria-label', 'Additional options');

      for (const el of tier2Items) {
        moreSubmenu.appendChild(el);
      }

      moreContainer.appendChild(moreItem);
      moreContainer.appendChild(moreSubmenu);
      listbox.appendChild(moreContainer);
      continue;
    }

    // Stock YTM items from tier-1
    const existing = classified.get(key);
    if (existing && isContextRelevant(key)) {
      listbox.appendChild(existing);
    }
  }
}

export function initContextMenu() {
  const popupContainer = document.querySelector('ytmusic-popup-container');
  if (!popupContainer) {
    // Retry once DOM is ready
    const retryObserver = new MutationObserver(() => {
      const container = document.querySelector('ytmusic-popup-container');
      if (container) {
        retryObserver.disconnect();
        attachMenuObserver(container);
      }
    });
    retryObserver.observe(document.body, { childList: true, subtree: true });
    return;
  }
  attachMenuObserver(popupContainer);
}

function attachMenuObserver(popupContainer: Element) {
  const observer = new MutationObserver(() => {
    const listbox = popupContainer.querySelector<HTMLElement>(
      'ytmusic-menu-popup-renderer tp-yt-paper-listbox',
    );
    if (listbox && listbox.children.length > 0) {
      // Small delay to let plugin injections (downloader, etc.) run first
      requestAnimationFrame(() => {
        reorganizeMenu(listbox);
      });
    }
  });

  observer.observe(popupContainer, { childList: true, subtree: true });
}
