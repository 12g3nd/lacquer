import { expect, test } from '@playwright/test';

import {
  deriveVisualizerChromeState,
  deriveVisualizerModeState,
} from '../../src/lacquer/visualizer-mode';

test('armed Visualizer Mode only activates the plugin on the player page', () => {
  expect(
    deriveVisualizerModeState({ armed: false, playerPageOpen: false }),
  ).toEqual({
    armed: false,
    active: false,
    suspended: false,
    buttonPressed: false,
    rootActive: false,
    pluginEnabled: false,
  });

  expect(
    deriveVisualizerModeState({ armed: false, playerPageOpen: true }),
  ).toEqual({
    armed: false,
    active: false,
    suspended: false,
    buttonPressed: false,
    rootActive: false,
    pluginEnabled: false,
  });

  expect(
    deriveVisualizerModeState({ armed: true, playerPageOpen: false }),
  ).toEqual({
    armed: true,
    active: false,
    suspended: true,
    buttonPressed: true,
    rootActive: false,
    pluginEnabled: false,
  });

  expect(
    deriveVisualizerModeState({ armed: true, playerPageOpen: true }),
  ).toEqual({
    armed: true,
    active: true,
    suspended: false,
    buttonPressed: true,
    rootActive: true,
    pluginEnabled: true,
  });
});

test('Visualizer Mode only hides unpinned chrome after idle', () => {
  const base = {
    visualizerActive: true,
    idle: true,
    pointerOverChrome: false,
    focusInChrome: false,
    popoverOpen: false,
  };

  expect(deriveVisualizerChromeState(base)).toEqual({
    hidden: true,
    pinned: false,
  });
  expect(
    deriveVisualizerChromeState({ ...base, visualizerActive: false }),
  ).toEqual({ hidden: false, pinned: false });
  expect(deriveVisualizerChromeState({ ...base, idle: false })).toEqual({
    hidden: false,
    pinned: false,
  });

  for (const pin of [
    'pointerOverChrome',
    'focusInChrome',
    'popoverOpen',
  ] as const) {
    expect(deriveVisualizerChromeState({ ...base, [pin]: true })).toEqual({
      hidden: false,
      pinned: true,
    });
  }
});
