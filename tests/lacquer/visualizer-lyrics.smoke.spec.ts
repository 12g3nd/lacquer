import { expect, test } from '@playwright/test';

import { selectVisualizerLyrics } from '../../src/lacquer/visualizer-lyrics';
import { AlbumColorTransition } from '../../src/plugins/visualizer/visualizers/album-colors';

test('album colour transitions preserve continuity and reach the next album', () => {
  const palette = new AlbumColorTransition();
  palette.setTarget('rgb(240, 40, 20)', 0);
  expect(palette.sample(900)).toEqual([240, 40, 20]);
  palette.setTarget('rgb(20, 40, 240)', 1000);
  expect(palette.sample(1000)).toEqual([240, 40, 20]);
  expect(palette.sample(1450)[2]).toBeGreaterThan(palette.sample(1450)[0]);
  const before = palette.sample(1450);
  palette.setTarget('rgb(40, 220, 60)', 1450);
  expect(palette.sample(1450)).toEqual(before);
  expect(palette.sample(2350)).toEqual([40, 220, 60]);
  palette.setTarget('invalid', 2400);
  expect(palette.sample(3300)).toEqual([40, 220, 60]);
});

test('overlay follows timed lyrics, seeks, gaps, and missing lyrics without timestamps', () => {
  const lines = [
    { timeInMs: 1000, duration: 2000, text: 'First line' },
    { timeInMs: 4000, duration: 2000, text: 'Next line' },
  ];
  expect(selectVisualizerLyrics(lines, 1500)).toEqual({
    previous: '',
    current: 'First line',
    next: 'Next line',
  });
  expect(selectVisualizerLyrics(lines, 4500)).toEqual({
    previous: 'First line',
    current: 'Next line',
    next: '',
  });
  expect(selectVisualizerLyrics(lines, 1500).current).toBe('First line');
  expect(selectVisualizerLyrics(lines, 3500).current).toBe('');
  expect(selectVisualizerLyrics(undefined, 1500)).toEqual({
    previous: '',
    current: '',
    next: '',
  });
  expect(selectVisualizerLyrics(lines, 7000)).toEqual({
    previous: '',
    current: '',
    next: '',
  });
});
