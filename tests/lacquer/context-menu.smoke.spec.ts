import { test, expect } from '@playwright/test';

import {
  classifyMenuData,
  type MenuItemData,
} from '../../src/lacquer/context-menu-classify';

/**
 * Pins the context-menu classifier against the real menu.
 *
 * The fixtures below are the complete 14-item queue menu, captured from the
 * running application — icon types, endpoints and page types exactly as
 * YouTube Music supplied them. They exist because the previous classifier
 * matched on the leading characters of each item's icon `path` geometry, which
 * failed twice over: `'M12,2C6'` (go-to-album) was tested before
 * `'M12,2C6.48'` (start-radio) so "Start mix" always classified as "Go to
 * album", and against current YouTube Music the table matched almost nothing,
 * leaving the first tier holding only Lacquer's own FX entries.
 *
 * Pure functions, no browser needed.
 */

const item = (
  iconType: string | null,
  endpointName?: string,
  pageType?: string,
): MenuItemData => ({
  ...(iconType ? { icon: { iconType } } : {}),
  ...(endpointName
    ? {
        navigationEndpoint: {
          [endpointName]: pageType
            ? {
                browseEndpointContextSupportedConfigs: {
                  browseEndpointContextMusicConfig: {
                    pageType: `MUSIC_PAGE_TYPE_${pageType}`,
                  },
                },
              }
            : {},
        },
      }
    : {}),
});

/** The live queue menu, in the order YouTube Music emitted it. */
const QUEUE_MENU: [string, MenuItemData, string | null][] = [
  ['Start mix', item('MIX', 'watchEndpoint'), 'start-radio'],
  ['Play next', item('QUEUE_PLAY_NEXT', 'queueAddEndpoint'), 'play-next'],
  [
    'Add to queue',
    item('ADD_TO_REMOTE_QUEUE', 'queueAddEndpoint'),
    'add-to-queue',
  ],
  ['Save to library', item(null), null],
  ['Add to liked songs', item(null), null],
  [
    'Save to playlist',
    item('ADD_TO_PLAYLIST', 'addToPlaylistEndpoint'),
    'save-to-playlist',
  ],
  [
    'Remove from queue',
    item('REMOVE', 'removeFromQueueEndpoint'),
    'remove-from-queue',
  ],
  ['Go to album', item('ALBUM', 'browseEndpoint', 'ALBUM'), 'go-to-album'],
  ['Go to artist', item('ARTIST', 'browseEndpoint', 'ARTIST'), 'go-to-artist'],
  [
    'View song credits',
    item('PEOPLE_GROUP', 'browseEndpoint', 'TRACK_CREDITS'),
    'credits',
  ],
  ['Share', item('SHARE', 'shareEntityEndpoint'), 'share'],
  ['Report', item('FLAG', 'getReportFormEndpoint'), 'report'],
  ['Pin to Listen again', item(null), null],
  [
    'Dismiss queue',
    item('DISMISS_QUEUE', 'deletePlaylistEndpoint'),
    'dismiss-queue',
  ],
];

test('classifies every item in the real queue menu', () => {
  for (const [label, data, expected] of QUEUE_MENU) {
    expect(classifyMenuData(data), label).toBe(expected);
  }
});

test('Start mix is not Go to album', () => {
  // The exact regression. Both are round "disc" icons and, under the old
  // path-prefix table, the same classification.
  const startMix = classifyMenuData(item('MIX', 'watchEndpoint'));
  const goToAlbum = classifyMenuData(item('ALBUM', 'browseEndpoint', 'ALBUM'));

  expect(startMix).toBe('start-radio');
  expect(goToAlbum).toBe('go-to-album');
  expect(startMix).not.toBe(goToAlbum);
});

test('separates the two items that share queueAddEndpoint', () => {
  // Endpoint alone cannot tell these apart, which is why icon type leads.
  expect(classifyMenuData(item('QUEUE_PLAY_NEXT', 'queueAddEndpoint'))).toBe(
    'play-next',
  );
  expect(
    classifyMenuData(item('ADD_TO_REMOTE_QUEUE', 'queueAddEndpoint')),
  ).toBe('add-to-queue');
});

test('falls back to the endpoint when the icon is unknown', () => {
  // Survives YouTube renaming or dropping an icon type.
  expect(classifyMenuData(item('SOME_NEW_ICON', 'shareEntityEndpoint'))).toBe(
    'share',
  );
  expect(
    classifyMenuData(item('SOME_NEW_ICON', 'browseEndpoint', 'ARTIST')),
  ).toBe('go-to-artist');
});

test('unknown items classify as null so they stay reachable in More…', () => {
  expect(classifyMenuData(item(null))).toBeNull();
  expect(classifyMenuData(item('TOTALLY_UNKNOWN'))).toBeNull();
  expect(
    classifyMenuData(item('TOTALLY_UNKNOWN', 'someFutureEndpoint')),
  ).toBeNull();
  expect(classifyMenuData(undefined)).toBeNull();
});

test('classification never depends on icon path geometry', () => {
  // A menu item carrying only path data must not classify: that signal is a
  // rendering detail and reintroducing it reintroduces the collision.
  const geometryOnly = {
    icon: {},
    navigationEndpoint: {},
  } as unknown as MenuItemData;
  expect(classifyMenuData(geometryOnly)).toBeNull();
});
