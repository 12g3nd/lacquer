export function initSettingsPanel() {
  const injectGearButton = () => {
    const rightControls = document.querySelector(
      'ytmusic-player-bar .right-controls-buttons',
    );
    if (!rightControls) return false;

    if (document.getElementById('lacquer-gear-button')) return true;

    const gearButton = document.createElement('button');
    gearButton.id = 'lacquer-gear-button';
    gearButton.style.background = 'transparent';
    gearButton.style.border = 'none';
    gearButton.style.color = '#fff';
    gearButton.style.cursor = 'pointer';
    gearButton.style.margin = '0 8px';
    gearButton.style.padding = '4px 8px';
    gearButton.style.position = 'relative';
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
    container.style.backgroundColor = 'var(--ytmusic-color-black4, #1a1a1a)';
    container.style.padding = '8px';
    container.style.borderRadius = '8px';
    container.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    container.style.display = 'none';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';
    container.style.zIndex = '9999';
    container.style.minWidth = '150px';

    const addMenuItem = (text: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.innerText = text;
      btn.style.padding = '8px 12px';
      btn.style.borderRadius = '4px';
      btn.style.border = 'none';
      btn.style.background = 'transparent';
      btn.style.color = 'var(--ytmusic-text-primary, #fff)';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '13px';
      btn.style.textAlign = 'left';
      btn.style.transition = 'background 0.2s';

      btn.onmouseenter = () => {
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
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

    addMenuItem('Plugins & Options', () => {
      window.ipcRenderer.send('toggle-in-app-menu');
    });

    addMenuItem('Reload', () => {
      window.location.reload();
    });
    
    addMenuItem('Developer Tools', () => {
      window.ipcRenderer.send('toggle-in-app-menu');
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

    gearButton.appendChild(container);
    rightControls.prepend(gearButton);
    return true;
  };

  const observer = new MutationObserver(() => {
    if (document.querySelector('ytmusic-player-bar .right-controls-buttons')) {
      if (injectGearButton()) {
        observer.disconnect();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
