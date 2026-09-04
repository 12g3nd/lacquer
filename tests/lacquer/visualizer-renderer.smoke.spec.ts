import { expect, test } from '@playwright/test';

import {
  isKickOnset,
  readBandEnergies,
  resolveVisualizerType,
} from '../../src/plugins/visualizer/visualizers/lacquer-state';

test('authored visualizer types survive while unsafe legacy types fall back', () => {
  expect(resolveVisualizerType('lacquer-orbital')).toBe('lacquer-orbital');
  expect(resolveVisualizerType('lacquer-rave')).toBe('lacquer-rave');
  expect(resolveVisualizerType('butterchurn')).toBe('butterchurn');
  expect(resolveVisualizerType('wave')).toBe('lacquer-orbital');
  expect(resolveVisualizerType('vudio')).toBe('lacquer-orbital');
  expect(resolveVisualizerType(undefined)).toBe('lacquer-orbital');
});

test('audio energy is read from frequency ranges, not fixed bin numbers', () => {
  const sampleRate = 32_000;
  const bins = new Uint8Array(1024);
  const binWidth = sampleRate / (bins.length * 2);
  const fillBand = (low: number, high: number, value: number) => {
    const first = Math.ceil(low / binWidth);
    const last = Math.ceil(high / binWidth);
    bins.fill(value, first, last);
  };
  fillBand(28, 185, 255);
  fillBand(185, 2100, 128);
  fillBand(3800, 12_000, 64);

  const energy = readBandEnergies(bins, sampleRate);
  expect(energy.bass).toBeCloseTo(1, 2);
  expect(energy.mids).toBeCloseTo(128 / 255, 2);
  expect(energy.highs).toBeCloseTo(64 / 255, 2);
});

test('kick onset requires strength, a rising edge, and cooldown', () => {
  expect(isKickOnset(0.34, 0.25, 180)).toBe(true);
  expect(isKickOnset(0.28, 0.2, 180)).toBe(false);
  expect(isKickOnset(0.34, 0.32, 180)).toBe(false);
  expect(isKickOnset(0.34, 0.25, 80)).toBe(false);
});
