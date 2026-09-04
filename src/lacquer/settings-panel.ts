/*
 * Lacquer — transport settings menu (Stage A housekeeping; styling moved out
 * to `settings-panel.css` in Stage C, C5).
 *
 * The native menu bar is hidden by default (`in-app-menu` off, D8), so a gear
 * button next to the FX button gives quick access to:
 *   - Plugins & Options — opens `config.json` (`lacquer:edit-config`)
 *   - Reload
 *   - Developer Tools (`lacquer:toggle-dev-tools`)
 *
 * The menu is a sibling of the button inside a positioned wrapper, not a child
 * of it (a preset click inside a nested menu would bubble to the button and
 * toggle it shut).
 */

import { whenElement } from './dom';

import { resolveVisualizerType } from '../plugins/visualizer/visualizers/lacquer-state';

const GEAR_SVG = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3"></circle>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
</svg>`;

export function initSettingsPanel() {
  whenElement('ytmusic-player-bar .right-controls-buttons').then(
    (rightControls) => {
      if (document.getElementById('lacquer-gear-button')) return;

      const gearButton = document.createElement('button');
      gearButton.id = 'lacquer-gear-button';
      gearButton.type = 'button';
      gearButton.setAttribute('aria-label', 'Settings');
      gearButton.setAttribute('title', 'Settings');
      gearButton.setAttribute('aria-haspopup', 'menu');
      gearButton.setAttribute('aria-expanded', 'false');
      gearButton.innerHTML = GEAR_SVG;

      const menu = document.createElement('div');
      menu.id = 'lacquer-settings-menu-container';
      menu.setAttribute('role', 'menu');
      menu.hidden = true;

      let open = false;
      const engineItems = new Map<string, HTMLButtonElement>();
      const setOpen = (next: boolean) => {
        const selected = resolveVisualizerType(
          window.mainConfig.plugins.getOptions<{ type?: unknown }>('visualizer')
            .type,
        );
        for (const [type, item] of engineItems) {
          item.setAttribute('aria-checked', String(type === selected));
        }
        open = next;
        menu.hidden = !next;
        gearButton.setAttribute('aria-expanded', String(next));
      };

      const addItem = (text: string, onClick: () => void | Promise<void>) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'lacquer-settings-item';
        button.setAttribute('role', 'menuitem');
        button.textContent = text;
        button.addEventListener('click', async (event) => {
          event.stopPropagation();
          button.disabled = true;
          try {
            await onClick();
            setOpen(false);
          } catch {
            button.textContent = `${text} — retry`;
          } finally {
            button.disabled = false;
          }
        });
        menu.appendChild(button);
        return button;
      };

      for (const [type, label] of [
        ['lacquer-orbital', 'Orbital Shockwave — show artwork'],
        ['lacquer-rave', 'Laser Basilica — hide artwork'],
        ['butterchurn', 'Butterchurn — hide artwork'],
      ]) {
        const item = addItem(label, async () => {
          await window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
            type,
          });
        });
        item.setAttribute('role', 'menuitemradio');
        engineItems.set(type, item);
      }

      addItem('Plugins & Options', () => {
        window.ipcRenderer.send('lacquer:edit-config');
      });
      addItem('Reload', () => {
        window.location.reload();
      });
      addItem('Developer Tools', () => {
        window.ipcRenderer.send('lacquer:toggle-dev-tools');
      });

      gearButton.addEventListener('click', (event) => {
        event.stopPropagation();
        setOpen(!open);
      });
      menu.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          gearButton.focus();
        }
      });
      document.addEventListener('pointerdown', (event) => {
        const target = event.target as Node;
        if (!menu.contains(target) && target !== gearButton) setOpen(false);
      });

      const wrapper = document.createElement('div');
      wrapper.id = 'lacquer-settings-wrapper';
      wrapper.append(gearButton, menu);
      rightControls.prepend(wrapper);
    },
  );
}
