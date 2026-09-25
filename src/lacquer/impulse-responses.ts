/*
 * Lacquer — reverb impulse responses, main-process side.
 *
 * The three IRs are ~1 MB of WAV. Imported with `?url` they were inlined as
 * base64 into every bundle that touched `signal-chain.ts` — renderer, preload
 * and main — and the renderer bundle is compiled synchronously on every full
 * page load, before YouTube Music's own HTML can parse. Emitting them as files
 * and serving the bytes over IPC keeps them off that critical path; the Signal
 * Chain fetches one only when a preset actually asks for it.
 */

import fs from 'node:fs/promises';

import largeCathedral from './assets/ir/large-cathedral.wav?asset';
import mediumHall from './assets/ir/medium-hall.wav?asset';
import smallRoom from './assets/ir/small-room.wav?asset';

import type { IpcMain } from 'electron';

const IR_FILES: Record<string, string> = {
  'small-room': smallRoom,
  'medium-hall': mediumHall,
  'large-cathedral': largeCathedral,
};

export const registerImpulseResponses = (ipcMain: IpcMain) => {
  ipcMain.handle('lacquer:get-ir', async (_, name: string) => {
    const file = IR_FILES[name];
    if (!file) throw new Error(`Unknown impulse response: ${name}`);
    return new Uint8Array(await fs.readFile(file));
  });
};
