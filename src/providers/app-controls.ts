import path from 'node:path';

import { app, BrowserWindow, ipcMain } from 'electron';

import * as config from '@/config';

export const restart = () => restartInternal();

export const setupAppControls = () => {
  ipcMain.on('peard:restart', restart);
  ipcMain.handle('peard:get-downloads-folder', () => app.getPath('downloads'));
  ipcMain.on('peard:reload', () =>
    BrowserWindow.getFocusedWindow()?.webContents.loadURL(config.get('url')),
  );
  ipcMain.handle('peard:get-path', (_, ...args: string[]) =>
    path.join(...args),
  );

  // Lacquer's settings menu (`src/lacquer/settings-panel.ts`). These replace
  // two menu items that both sent `toggle-in-app-menu` and did nothing once
  // that plugin was disabled by default (D8).
  ipcMain.on('lacquer:toggle-dev-tools', () => {
    BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools();
  });
  ipcMain.on('lacquer:edit-config', () => {
    config.edit();
  });
};

function restartInternal() {
  app.relaunch({ execPath: process.env.PORTABLE_EXECUTABLE_FILE });
  // ExecPath will be undefined if not running portable app, resulting in default behavior
  app.quit();
}

function sendToFrontInternal(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args);
  }
}

export const sendToFront =
  process.type === 'browser'
    ? sendToFrontInternal
    : () => {
        console.error('sendToFront called from renderer');
      };
