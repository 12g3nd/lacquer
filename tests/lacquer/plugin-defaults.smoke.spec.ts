import { test, expect } from '@playwright/test';
import { deepmerge } from 'deepmerge-ts';

import { defaultConfig } from '../../src/config/defaults';

/**
 * Pins the D11 default plugin set (DECISIONS.md D11) and the merge that makes it
 * survive a real profile.
 *
 * `config.plugins.getPlugins()` returns `deepmerge(defaultConfig.plugins,
 * stored)`. This matters because `electron-store` shallow-merges the top-level
 * `plugins` key: the moment `config.json` carries any `plugins` entry — which
 * the owner's dev-built profile does — the `defaults.ts` table would otherwise
 * be dropped whole, taking `album-color-theme` (the design anchor) with it.
 *
 * This test runs in Node (no Electron launch) and exercises the exact merge
 * against both a clean profile and the shape of the owner's real `config.json`.
 * The behavioural half — that `in-app-menu` genuinely does not mount — is in
 * `shell.smoke.spec.ts`.
 */

const EXPECTED_ON = [
  'album-color-theme',
  'do-not-track',
  'sponsorblock',
  'synced-lyrics',
  'navigation',
  'performance-improvement',
  'shortcuts',
  'taskbar-mediacontrol',
  'precise-volume',
];

const EXPECTED_OFF = [
  'in-app-menu',
  'equalizer',
  'audio-compressor',
  'playback-speed',
  'visualizer',
  'crossfade',
  'skip-silences',
  'ambient-mode',
  'blur-nav-bar',
  'transparent-player',
  'unobtrusive-player',
];

type PluginMap = Record<
  string,
  { enabled?: boolean } & Record<string, unknown>
>;

/** Mirrors `config.plugins.getPlugins()`. */
const resolve = (stored: PluginMap): PluginMap =>
  deepmerge(defaultConfig.plugins, stored) as PluginMap;

test('D11: defaults.ts carries the full table', () => {
  for (const id of EXPECTED_ON) {
    expect(defaultConfig.plugins[id]?.enabled, `${id} on`).toBe(true);
  }
  for (const id of EXPECTED_OFF) {
    expect(defaultConfig.plugins[id]?.enabled, `${id} off`).toBe(false);
  }

  expect(defaultConfig.plugins['synced-lyrics']).toMatchObject({
    enabled: true,
    preciseTiming: true,
    showLyricsEvenIfInexact: true,
    showTimeCodes: true,
    lineEffect: 'fancy',
    romanization: true,
  });
});

test('D11: applies on a clean profile', () => {
  const resolved = resolve({});
  for (const id of EXPECTED_ON) expect(resolved[id]?.enabled, id).toBe(true);
  for (const id of EXPECTED_OFF) expect(resolved[id]?.enabled, id).toBe(false);
});

test('D11: survives a profile that already has a plugins key', () => {
  // The shape of the owner's real config.json at the time of Stage A.
  const resolved = resolve({
    notifications: {},
    'video-toggle': { mode: 'custom' },
    'precise-volume': { globalShortcuts: {} },
    discord: { listenAlong: true },
  });

  expect(resolved['album-color-theme']?.enabled).toBe(true);
  expect(resolved['in-app-menu']?.enabled).toBe(false);
  expect(resolved['precise-volume']?.enabled).toBe(true);
  // A user-set slice is preserved, not clobbered.
  expect(resolved['precise-volume']?.globalShortcuts).toEqual({});
  expect(resolved['discord']?.listenAlong).toBe(true);
});

test('D11: an explicit user choice still wins over the default', () => {
  const resolved = resolve({ 'album-color-theme': { enabled: false } });
  expect(resolved['album-color-theme']?.enabled).toBe(false);
});
