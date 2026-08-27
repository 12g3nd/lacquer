import { signalChain } from './signal-chain';

import type { SignalChainPreset } from './signal-chain-types';

const PRESETS: SignalChainPreset[] = [
  'Original',
  'Sped + Reverb',
  'Slowed + Reverb',
  'Dream',
  'Tape',
  'Night',
];

export const initFXRack = () => {
  const container = document.createElement('div');
  container.id = 'lacquer-fx-rack-container';
  container.style.position = 'absolute';
  container.style.bottom = '100%';
  container.style.right = '0';
  container.style.backgroundColor = 'var(--ytmusic-color-black4, #1a1a1a)';
  container.style.padding = '12px';
  container.style.borderRadius = '8px';
  container.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  container.style.display = 'none';
  container.style.flexDirection = 'column';
  container.style.gap = '8px';
  container.style.zIndex = '9999';
  container.style.minWidth = '150px';

  const title = document.createElement('div');
  title.innerText = 'Lacquer FX';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '12px';
  title.style.color = 'var(--ytmusic-text-primary, #fff)';
  title.style.marginBottom = '4px';
  title.style.textTransform = 'uppercase';
  title.style.letterSpacing = '1px';
  container.appendChild(title);

  let activePreset = signalChain.getCurrentPreset();

  // Try to load preset from local storage
  const savedPreset = window.localStorage.getItem('lacquer.fxPreset');
  if (savedPreset && PRESETS.includes(savedPreset as SignalChainPreset)) {
    activePreset = savedPreset as SignalChainPreset;
    signalChain.setPreset(activePreset);
  }

  const buttons: (HTMLButtonElement & { updateState: () => void })[] = [];

  PRESETS.forEach((preset) => {
    const btn = document.createElement('button');
    btn.innerText = preset;
    btn.style.padding = '6px 12px';
    btn.style.borderRadius = '4px';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '13px';
    btn.style.textAlign = 'left';
    btn.style.transition = 'background 0.2s';

    const updateActiveState = () => {
      if (activePreset === preset) {
        btn.style.backgroundColor =
          'var(--ytmusic-color-brand-background-solid, rgba(255,255,255,0.2))';
        btn.style.color = 'var(--ytmusic-text-primary, #fff)';
        btn.style.fontWeight = 'bold';
      } else {
        btn.style.backgroundColor = 'transparent';
        btn.style.color = 'var(--ytmusic-text-secondary, #aaa)';
        btn.style.fontWeight = 'normal';
      }
    };

    updateActiveState();

    btn.onclick = () => {
      activePreset = preset;
      signalChain.setPreset(preset);
      buttons.forEach((b) => b.updateState());
      window.localStorage.setItem('lacquer.fxPreset', preset);
    };

    (btn as HTMLButtonElement & { updateState: () => void }).updateState =
      updateActiveState;
    buttons.push(btn as HTMLButtonElement & { updateState: () => void });
    container.appendChild(btn);
  });

  // Inject FX Button into right controls
  const injectFXButton = () => {
    const rightControls = document.querySelector(
      'ytmusic-player-bar .right-controls-buttons',
    );
    if (!rightControls) return;

    if (document.getElementById('lacquer-fx-button')) return;

    const fxButton = document.createElement('button');
    fxButton.id = 'lacquer-fx-button';
    fxButton.innerText = 'FX';
    fxButton.style.background = 'transparent';
    fxButton.style.border = '1px solid rgba(255,255,255,0.2)';
    fxButton.style.borderRadius = '4px';
    fxButton.style.color = '#fff';
    fxButton.style.cursor = 'pointer';
    fxButton.style.margin = '0 8px';
    fxButton.style.padding = '4px 8px';
    fxButton.style.fontSize = '12px';
    fxButton.style.fontWeight = 'bold';
    fxButton.style.position = 'relative';

    fxButton.onclick = (e) => {
      e.stopPropagation();
      const isShowing = container.style.display === 'flex';
      container.style.display = isShowing ? 'none' : 'flex';
    };

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target as Node) && e.target !== fxButton) {
        container.style.display = 'none';
      }
    });

    fxButton.appendChild(container);
    rightControls.prepend(fxButton);
  };

  const observer = new MutationObserver(() => {
    if (document.querySelector('ytmusic-player-bar .right-controls-buttons')) {
      injectFXButton();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
};
