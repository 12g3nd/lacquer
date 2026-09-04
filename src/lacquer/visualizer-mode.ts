import { whenElement } from './dom';

export interface VisualizerModeInput {
  armed: boolean;
  playerPageOpen: boolean;
}

export interface VisualizerModeState {
  armed: boolean;
  active: boolean;
  suspended: boolean;
  buttonPressed: boolean;
  rootActive: boolean;
  pluginEnabled: boolean;
}

export interface VisualizerChromeInput {
  visualizerActive: boolean;
  idle: boolean;
  pointerOverChrome: boolean;
  focusInChrome: boolean;
  popoverOpen: boolean;
}

export interface VisualizerChromeState {
  hidden: boolean;
  pinned: boolean;
}

export const deriveVisualizerChromeState = (
  input: VisualizerChromeInput,
): VisualizerChromeState => {
  const pinned =
    input.pointerOverChrome || input.focusInChrome || input.popoverOpen;
  return {
    hidden: input.visualizerActive && input.idle && !pinned,
    pinned,
  };
};

export const deriveVisualizerModeState = ({
  armed,
  playerPageOpen,
}: VisualizerModeInput): VisualizerModeState => ({
  armed,
  active: armed && playerPageOpen,
  suspended: armed && !playerPageOpen,
  buttonPressed: armed,
  rootActive: armed && playerPageOpen,
  pluginEnabled: armed && playerPageOpen,
});

let armed = false;
let playerPageOpen = false;
let initialised = false;
let layoutObserver: MutationObserver | null = null;
let requestedPluginEnabled: boolean | null = null;
let pluginSync = Promise.resolve();
let modeOwnsPlugin = false;

const CHROME_IDLE_MS = 3000;
const POINTER_THROTTLE_MS = 80;
const CHROME_SELECTOR = [
  'ytmusic-nav-bar',
  '#nav-bar-background',
  '#guide-wrapper',
  '#guide',
  '#mini-guide',
  '#mini-guide-background',
  'ytmusic-player-bar',
  '#player-bar-background',
  'ytmusic-player-page#player-page #side-panel',
].join(',');
const OPEN_POPOVER_SELECTOR = [
  '#lacquer-fx-rack:not([hidden])',
  '#lacquer-settings-menu-container:not([hidden])',
  'tp-yt-iron-dropdown[opened]',
].join(',');

let chromeTimer: ReturnType<typeof setTimeout> | null = null;
let chromeActive = false;
let lastPointerSample = 0;
let pointerX = -1;
let pointerY = -1;

const clearChromeTimer = () => {
  if (chromeTimer !== null) clearTimeout(chromeTimer);
  chromeTimer = null;
};

const pointerIsOverChrome = () => {
  if (pointerX < 0 || pointerY < 0) return false;
  return Boolean(
    document.elementFromPoint(pointerX, pointerY)?.closest(CHROME_SELECTOR),
  );
};

const focusIsInChrome = () =>
  document.activeElement instanceof Element &&
  Boolean(document.activeElement.closest(CHROME_SELECTOR));

const popoverIsOpen = () =>
  Boolean(document.querySelector(OPEN_POPOVER_SELECTOR));

const hideChromeAfterIdle = () => {
  chromeTimer = null;
  const state = deriveVisualizerChromeState({
    visualizerActive: chromeActive,
    idle: true,
    pointerOverChrome: pointerIsOverChrome(),
    focusInChrome: focusIsInChrome(),
    popoverOpen: popoverIsOpen(),
  });
  document.documentElement.toggleAttribute(
    'data-lq-viz-chrome-hidden',
    state.hidden,
  );

  // A pin can disappear without producing pointer or keyboard input (for
  // example, a menu can close itself). Reuse the same timer to check again;
  // there is never an interval or a second idle clock.
  if (chromeActive && state.pinned) {
    chromeTimer = setTimeout(hideChromeAfterIdle, CHROME_IDLE_MS);
  }
};

const scheduleChromeHide = () => {
  clearChromeTimer();
  if (chromeActive) {
    chromeTimer = setTimeout(hideChromeAfterIdle, CHROME_IDLE_MS);
  }
};

/** Wake Visualizer Mode chrome from local input or native media controls. */
export const wakeVisualizerChrome = () => {
  if (!chromeActive) return;
  document.documentElement.removeAttribute('data-lq-viz-chrome-hidden');
  scheduleChromeHide();
};

const syncChromeMode = (active: boolean) => {
  chromeActive = active;
  document.documentElement.removeAttribute('data-lq-viz-chrome-hidden');
  scheduleChromeHide();
};

const syncPlugin = (enabled: boolean) => {
  if (requestedPluginEnabled === enabled) return;
  requestedPluginEnabled = enabled;

  // Route through the main-process config handler. Mutating the preload's own
  // electron-store instance persists the value, but it does not synchronously
  // trip the main instance's watcher, so no live plugin:enable/plugin:unload
  // event is guaranteed. Serialising requests also makes a rapid player→browse
  // transition deterministic: a late enable is always followed by its disable.
  pluginSync = pluginSync
    .then(() =>
      window.ipcRenderer.invoke('peard:set-config', 'visualizer', { enabled }),
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      requestedPluginEnabled = null;
      console.error('[Lacquer] Visualizer Mode plugin sync failed', error);
    });
};

const renderState = () => {
  const state = deriveVisualizerModeState({ armed, playerPageOpen });
  const root = document.documentElement;
  const button = document.querySelector<HTMLButtonElement>(
    '#lacquer-viz-button',
  );

  root.toggleAttribute('data-lq-viz', state.rootActive);
  root.toggleAttribute('data-lq-viz-suspended', state.suspended);
  button?.setAttribute('aria-pressed', String(state.buttonPressed));
  button?.toggleAttribute('data-lq-viz-armed', state.armed);
  syncChromeMode(state.active);
  if (state.armed) modeOwnsPlugin = true;
  if (modeOwnsPlugin) syncPlugin(state.pluginEnabled);
};

export const setVisualizerModeEnabled = (enabled: boolean) => {
  armed = enabled;
  window.mainConfig.set('lacquer.visualizerMode', enabled);
  renderState();
};

const revealPlayerPage = () => {
  const layout = document.querySelector('ytmusic-app-layout');
  if (layout?.hasAttribute('player-page-open')) return;

  // Use YouTube Music's own control so its route, focus and responsive state
  // stay authoritative. Merely arming from Browse used to look like a dead
  // button because the player-scoped mode immediately suspended itself.
  document
    .querySelector<HTMLElement>('ytmusic-player-bar .toggle-player-page-button')
    ?.click();
};

export const toggleVisualizerMode = () => {
  if (!initialised) return;

  // A pressed button on Browse means the mode is armed but suspended. In that
  // state the useful action is to reveal the player and resume, not silently
  // disarm the mode while leaving the screen unchanged.
  if (armed && !playerPageOpen) {
    revealPlayerPage();
    return;
  }

  const enabled = !armed;
  if (enabled && !playerPageOpen) revealPlayerPage();
  setVisualizerModeEnabled(enabled);
};

const mountButton = (rightControls: Element) => {
  if (document.getElementById('lacquer-viz-wrapper')) return;

  const button = document.createElement('button');
  button.id = 'lacquer-viz-button';
  button.type = 'button';
  button.textContent = 'VIZ';
  button.setAttribute('aria-label', 'Visualizer Mode');
  button.setAttribute('aria-pressed', String(armed));
  button.setAttribute('title', 'Visualizer Mode (Ctrl+Shift+V; Escape exits)');
  button.addEventListener('click', (event) => {
    toggleVisualizerMode();
    // Pointer activation should be free to idle once the pointer leaves the
    // deck. Keyboard activation retains focus, keeping the chrome pinned.
    if (event.detail > 0) button.blur();
  });

  const wrapper = document.createElement('div');
  wrapper.id = 'lacquer-viz-wrapper';
  wrapper.appendChild(button);
  rightControls.prepend(wrapper);
  renderState();
};

/**
 * Owns the shell-level Visualizer Mode state. The plugin renders the canvas;
 * this module decides when that canvas is allowed to exist. "Armed" persists,
 * while "active" follows YouTube Music's authoritative player-page attribute.
 */
export const initVisualizerMode = () => {
  if (initialised) return;
  initialised = true;
  armed = window.mainConfig.get('lacquer.visualizerMode') === true;
  modeOwnsPlugin = armed;
  playerPageOpen =
    document
      .querySelector('ytmusic-app-layout')
      ?.hasAttribute('player-page-open') ?? false;

  whenElement('ytmusic-app-layout').then((layout) => {
    const updatePlayerPage = () => {
      playerPageOpen = layout.hasAttribute('player-page-open');
      renderState();
    };

    layoutObserver?.disconnect();
    layoutObserver = new MutationObserver(updatePlayerPage);
    layoutObserver.observe(layout, {
      attributes: true,
      attributeFilter: ['player-page-open'],
    });
    updatePlayerPage();
  });

  whenElement('ytmusic-player-bar .right-controls-buttons').then(mountButton);

  document.addEventListener('keydown', (event) => {
    wakeVisualizerChrome();
    if (event.key === 'Escape' && armed) setVisualizerModeEnabled(false);
  });
  document.addEventListener('focusin', wakeVisualizerChrome);
  document.addEventListener(
    'pointermove',
    (event) => {
      const now = performance.now();
      const hidden = document.documentElement.hasAttribute(
        'data-lq-viz-chrome-hidden',
      );
      if (!hidden && now - lastPointerSample < POINTER_THROTTLE_MS) return;
      lastPointerSample = now;
      pointerX = event.clientX;
      pointerY = event.clientY;
      wakeVisualizerChrome();
    },
    { passive: true },
  );

  // When armed, the mode is authoritative after a crash. When it has never
  // been armed, leave a manually enabled standalone visualizer untouched.
  renderState();
};
