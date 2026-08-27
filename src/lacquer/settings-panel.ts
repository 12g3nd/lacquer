import { whenElement } from './dom';

export function initSettingsPanel() {
  whenElement('ytmusic-player-bar .right-controls-buttons').then(
    (rightControls) => {
      if (document.getElementById('lacquer-gear-button')) return;

      const gearButton = document.createElement('button');
      gearButton.id = 'lacquer-gear-button';
      gearButton.style.background = 'transparent';
      gearButton.style.border = 'none';
      gearButton.style.color = '#fff';
      gearButton.style.cursor = 'pointer';
      gearButton.style.margin = '0 8px';
      gearButton.style.padding = '4px 8px';
      gearButton.style.display = 'flex';
      gearButton.style.alignItems = 'center';
      gearButton.style.justifyContent = 'center';
      gearButton.setAttribute('aria-label', 'Settings');
      gearButton.setAttribute('title', 'Settings');

      // Simple SVG gear icon
      gearButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `;

      const container = document.createElement('div');
      container.id = 'lacquer-settings-menu-container';
      container.style.position = 'absolute';
      container.style.bottom = '100%';
      container.style.right = '0';
      container.style.backgroundColor =
        'var(--lq-blueglass, rgba(16, 42, 76, 0.72))';
      container.style.backdropFilter = 'var(--lq-blueglass-blur, blur(24px))';
      container.style.padding = '8px';
      container.style.borderRadius = 'var(--lq-radius-md, 8px)';
      container.style.border =
        '1px solid var(--lq-blueglass-border, rgba(232, 239, 245, 0.12))';
      container.style.display = 'none';
      container.style.flexDirection = 'column';
      container.style.gap = '4px';
      container.style.zIndex = '9999';
      container.style.minWidth = '150px';

      const addMenuItem = (text: string, onClick: () => void) => {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.padding = '8px 12px';
        btn.style.borderRadius = 'var(--lq-radius-sm, 4px)';
        btn.style.border = 'none';
        btn.style.background = 'transparent';
        btn.style.color = 'var(--lq-text, #e8eff5)';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '13px';
        btn.style.fontFamily = 'var(--lq-font-interface, Inter, sans-serif)';
        btn.style.textAlign = 'left';
        btn.style.transition = 'background 0.15s';

        btn.onmouseenter = () => {
          btn.style.background = 'rgba(232, 239, 245, 0.1)';
        };
        btn.onmouseleave = () => {
          btn.style.background = 'transparent';
        };

        btn.onclick = (e) => {
          e.stopPropagation();
          onClick();
          container.style.display = 'none';
        };

        container.appendChild(btn);
      };

      // Opens config.json — the plugin toggles and every option live there, and
      // it works with `in-app-menu` disabled (D8). Previously this sent
      // `toggle-in-app-menu`, which did nothing once that plugin was off.
      addMenuItem('Plugins & Options', () => {
        window.ipcRenderer.send('lacquer:edit-config');
      });

      addMenuItem('Reload', () => {
        window.location.reload();
      });

      // Previously sent `toggle-in-app-menu` — the *same* IPC as the item
      // above, so "Developer Tools" opened nothing. Now toggles DevTools.
      addMenuItem('Developer Tools', () => {
        window.ipcRenderer.send('lacquer:toggle-dev-tools');
      });

      gearButton.onclick = (e) => {
        e.stopPropagation();
        const isShowing = container.style.display === 'flex';
        container.style.display = isShowing ? 'none' : 'flex';
      };

      document.addEventListener('click', (e) => {
        if (!container.contains(e.target as Node) && e.target !== gearButton) {
          container.style.display = 'none';
        }
      });

      // Menu is a sibling of the button inside a positioned wrapper, not a
      // child of it — same fix as the FX rack.
      const wrapper = document.createElement('div');
      wrapper.id = 'lacquer-settings-wrapper';
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.appendChild(gearButton);
      wrapper.appendChild(container);

      rightControls.prepend(wrapper);
    },
  );
}
