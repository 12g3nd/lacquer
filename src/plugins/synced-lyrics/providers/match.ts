import { jaroWinkler } from '@skyra/jaro-winkler';

/*
 * Does a provider's matched track correspond to the song being played?
 *
 * MusixMatch's unofficial API started answering every search with the same
 * unrelated track (Drake — "NOKIA") and fabricated, gibberish lyrics, which
 * then won provider selection whenever YouTube Music's own lyrics were slow
 * or missing. The provider used to special-case one such decoy by track id;
 * checking the match itself catches any decoy or mismatch.
 */

const SIMILAR = 0.9;

/** Lowercase, drop accents, credits, bracketed and " - " qualifiers, punctuation. */
const normalize = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[([{].*?[)\]}]/g, ' ')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s(?:feat|ft)\.?\s.*$/, '')
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const similar = (a: string, b: string) =>
  a.length > 0 && b.length > 0 && (a === b || jaroWinkler(a, b) > SIMILAR);

const artistsOf = (artist: string) =>
  artist
    .split(/[&,]|\s(?:x|and|feat\.?|ft\.?|with)\s/i)
    .map(normalize)
    .filter(Boolean);

export const isSameTrack = (
  query: { title: string; alternativeTitle?: string; artist: string },
  track: { title: string; artist: string },
) => {
  const trackTitle = normalize(track.title);
  const titleMatches = [query.title, query.alternativeTitle]
    .filter((title): title is string => Boolean(title))
    .some((title) => similar(normalize(title), trackTitle));
  if (!titleMatches) return false;

  const trackArtists = artistsOf(track.artist);
  return artistsOf(query.artist).some((artist) =>
    trackArtists.some((candidate) => similar(artist, candidate)),
  );
};

/** Beyond this, a result is a different edit of the song. */
const DURATION_TOLERANCE_S = 15;
/** A timed result this much further off than the closest still lines up. */
const TIMED_PREFERENCE_S = 2;

/**
 * The result whose duration best matches the song, preferring one with timed
 * lyrics when it is about as close. LRCLib often lists several uploads of one
 * song; picking purely by duration regularly landed on an untimed copy while a
 * timed one sat a second away, leaving nothing to sync.
 */
export const pickClosestResult = <
  T extends { duration: number; syncedLyrics?: string | null },
>(
  results: readonly T[],
  songDuration: number,
): T | undefined => {
  const offset = (result: T) => Math.abs(result.duration - songDuration);
  const candidates = results
    .filter((result) => offset(result) <= DURATION_TOLERANCE_S)
    .sort((a, b) => offset(a) - offset(b));
  const closest = candidates[0];
  if (!closest) return undefined;
  return (
    candidates.find(
      (result) =>
        result.syncedLyrics &&
        offset(result) <= offset(closest) + TIMED_PREFERENCE_S,
    ) ?? closest
  );
};
