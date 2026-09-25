import { sify, tify } from 'chinese-conv';
import { render } from 'solid-js/web';

import { waitForElement } from '@/utils/wait-for-element';

import { LyricsRenderer, setIsVisible } from './renderer';

export const selectors = {
  head: '#tabsContent > .tab-header:nth-of-type(2)',
  body: {
    tabRenderer: '#tab-renderer[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"]',
    root: 'ytmusic-description-shelf-renderer',
  },
};

export const tabStates: Record<string, () => void> = {
  true: async () => {
    setIsVisible(true);

    let container = document.querySelector('#synced-lyrics-container');
    if (container) return;

    const tabRenderer = await waitForElement<HTMLElement>(
      selectors.body.tabRenderer,
    );

    container = Object.assign(document.createElement('div'), {
      id: 'synced-lyrics-container',
    });

    tabRenderer.appendChild(container);
    render(() => <LyricsRenderer />, container);
  },
  false: () => {
    setIsVisible(false);
  },
};

export const canonicalize = (text: string) => {
  return (
    text
      // `hi  there` => `hi there`
      .replaceAll(/\s+/g, ' ')

      // `( a )` => `(a)`
      .replaceAll(/([([]) ([^ ])/g, (_, symbol, a) => `${symbol}${a}`)
      .replaceAll(/([^ ]) ([)\]])/g, (_, a, symbol) => `${a}${symbol}`)

      // `can ' t` => `can't`
      .replaceAll(
        /([Ii]) (') ([^ ])|(n) (') (t)(?= |$)|(t) (') (s)|([^ ]) (') (re)|([^ ]) (') (ve)|([^ ]) (-) ([^ ])/g,
        (m, ...groups) => {
          for (let i = 0; i < groups.length; i += 3) {
            if (groups[i]) {
              return groups.slice(i, i + 3).join('');
            }
          }

          return m;
        },
      )
      // `Stayin ' still` => `Stayin' still`
      .replaceAll(/in ' ([^ ])/g, (_, char) => `in' ${char}`)
      .replaceAll("in ',", "in',")

      .replaceAll(", ' cause", ", 'cause")

      // `hi , there` => `hi, there`
      .replaceAll(/([^ ]) ([.,!?])/g, (_, a, symbol) => `${a}${symbol}`)

      // `hi " there "` => `hi "there"`
      .replaceAll(
        /"([^"]+)"/g,
        (_, content) =>
          `"${typeof content === 'string' ? content.trim() : content}"`,
      )
      .trim()
  );
};

const hasChinese = (lines: string[]) =>
  lines.some((line) => /[\u4E00-\u9FFF]+/.test(line));

export const convertChineseCharacter = (
  text: string,
  mode: 'simplifiedToTraditional' | 'traditionalToSimplified',
) => {
  if (!hasChinese([text])) return text;

  switch (mode) {
    case 'simplifiedToTraditional':
      return tify(text);
    case 'traditionalToSimplified':
      return sify(text);
  }
};

export const simplifyUnicode = (text?: string) =>
  text
    ? text
        .replaceAll(/\u0020|\u00A0|[\u2000-\u200A]|\u202F|\u205F|\u3000/g, ' ')
        .trim()
    : text;

/**
 * Every script `romanization.ts` handles: Devanagari, Bengali, Thai, Hangul
 * Jamo, kana, Hangul compatibility Jamo, CJK (incl. Ext. A and compatibility
 * ideographs) and Hangul syllables. A line with none of them is returned as-is,
 * so English lyrics never load the romanization dictionaries at all.
 */
const needsRomanization =
  /[\u0900-\u09FF\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/;

let romanization: Promise<typeof import('./romanization')> | undefined;

export const romanize = async (line: string) => {
  if (!needsRomanization.test(line)) return line;
  romanization ??= import('./romanization');
  return (await romanization).romanize(line);
};
