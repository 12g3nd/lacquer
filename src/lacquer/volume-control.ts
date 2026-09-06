import { whenElement } from './dom';

import type { MusicPlayer } from '@/types/music-player';

export function initVolumeControl(api: MusicPlayer) {
  whenElement('ytmusic-player-bar .volume').then((speaker) => {
    if (document.getElementById('lq-volume-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'lq-volume-panel';
    panel.popover = 'manual';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Volume control');
    const readout = document.createElement('output');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.setAttribute('aria-label', 'Volume');
    slider.setAttribute('aria-orientation', 'vertical');
    panel.append(readout, slider);
    speaker.parentElement!.appendChild(panel);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      const value = api.isMuted() ? 0 : Math.round(api.getVolume());
      slider.value = String(value);
      readout.textContent = `${value}%`;
    };
    const close = () => {
      clearTimeout(timer);
      if (panel.matches(':popover-open')) panel.hidePopover();
    };
    const open = () => {
      clearTimeout(timer);
      sync();
      const box = speaker.getBoundingClientRect();
      panel.style.left = `${Math.max(8, Math.min(innerWidth - 72, box.x + box.width / 2 - 32))}px`;
      if (!panel.matches(':popover-open')) panel.showPopover();
    };
    const scheduleClose = () => {
      timer = setTimeout(() => {
        if (!panel.contains(document.activeElement)) close();
      }, 220);
    };
    speaker.addEventListener('pointerenter', open);
    speaker.addEventListener('pointerleave', scheduleClose);
    speaker.addEventListener('focusin', open);
    speaker.addEventListener('focusout', scheduleClose);
    panel.addEventListener('pointerenter', () => clearTimeout(timer));
    panel.addEventListener('pointerleave', scheduleClose);
    panel.addEventListener('focusout', scheduleClose);
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        (speaker.querySelector('button') as HTMLElement)?.focus();
        close();
      }
    });
    document.addEventListener('pointerdown', (event) => {
      if (
        !panel.contains(event.target as Node) &&
        !speaker.contains(event.target as Node)
      )
        close();
    });
    window.addEventListener('resize', close);
    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      api.unMute();
      api.setVolume(value);
      document.dispatchEvent(
        new CustomEvent('lacquer:volume-set', { detail: value }),
      );
      sync();
    });
    document.querySelector('video')?.addEventListener('volumechange', sync);
    sync();
  });
}
