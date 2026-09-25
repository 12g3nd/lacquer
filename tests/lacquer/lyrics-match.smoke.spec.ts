import { expect, test } from '@playwright/test';

import {
  isSameTrack,
  pickClosestResult,
} from '../../src/plugins/synced-lyrics/providers/match';

test('prefers a timed LRCLib entry when it is as close as the untimed ones', () => {
  // LRCLib's real candidates for Quadeca — "Baby Steps" (video is 239 s).
  const results = [
    { id: 36940916, duration: 238, syncedLyrics: null },
    { id: 37352195, duration: 238, syncedLyrics: null },
    { id: 37630062, duration: 239, syncedLyrics: null },
    { id: 38483487, duration: 238, syncedLyrics: '[00:03.86]The baby' },
  ];
  expect(pickClosestResult(results, 239)?.id).toBe(38483487);
  // A timed entry that is much further off would drift; keep the closest.
  expect(
    pickClosestResult(
      [
        { id: 1, duration: 239, syncedLyrics: null },
        { id: 2, duration: 250, syncedLyrics: '[00:01.00]x' },
      ],
      239,
    )?.id,
  ).toBe(1);
  // Nothing within tolerance.
  expect(
    pickClosestResult([{ id: 1, duration: 300, syncedLyrics: 'x' }], 239),
  ).toBeUndefined();
});

const query = (title: string, artist: string, alternativeTitle?: string) => ({
  title,
  artist,
  alternativeTitle,
});

test('rejects a provider match for a different song (MusixMatch decoy)', () => {
  // Captured 2026-09-24: MusixMatch answered every search — Quadeca, Mallrat,
  // The Weeknd, Coldplay — with this track and fabricated lyrics.
  const decoy = { title: 'NOKIA', artist: 'Drake' };
  expect(isSameTrack(query('Baby Steps', 'Quadeca'), decoy)).toBe(false);
  expect(isSameTrack(query('Groceries', 'Mallrat'), decoy)).toBe(false);
  // Same artist, different song.
  expect(isSameTrack(query('Hotline Bling', 'Drake'), decoy)).toBe(false);
  // The earlier decoy the provider special-cased by id.
  expect(
    isSameTrack(query('Baby Steps', 'Quadeca'), {
      title: 'Paradise',
      artist: 'Coldplay',
    }),
  ).toBe(false);
});

test('accepts genuine matches despite featuring credits and punctuation', () => {
  expect(
    isSameTrack(query('Baby Steps', 'Quadeca'), {
      title: 'Baby Steps',
      artist: 'Quadeca',
    }),
  ).toBe(true);
  expect(
    isSameTrack(query('Espresso', 'Sabrina Carpenter'), {
      title: 'Espresso',
      artist: 'Sabrina Carpenter',
    }),
  ).toBe(true);
  expect(
    isSameTrack(query('Sure Thing (feat. Kid Cudi)', 'Miguel, Kid Cudi'), {
      title: 'Sure Thing',
      artist: 'Miguel',
    }),
  ).toBe(true);
  expect(
    isSameTrack(query('Dont Stop Me Now - Remastered 2011', 'Queen'), {
      title: "Don't Stop Me Now",
      artist: 'Queen',
    }),
  ).toBe(true);
  // The original-language title is tried as well as the displayed one.
  expect(
    isSameTrack(query('Lemon', 'Kenshi Yonezu', 'Lemon'), {
      title: 'Lemon',
      artist: 'Kenshi Yonezu',
    }),
  ).toBe(true);
});
