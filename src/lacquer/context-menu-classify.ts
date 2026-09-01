/**
 * Lacquer — context-menu item classification.
 *
 * Deliberately free of imports. `context-menu.ts` pulls in the signal chain,
 * which imports the reverb impulse responses as binary assets; a test that
 * reached the classifier through that module would drag the `.wav` files into
 * the transform. The rule is also simply not a DOM concern.
 */

/**
 * Menu-item classification.
 *
 * This previously matched on the leading characters of each item's icon `path`
 * `d` attribute, justified in a comment as stable "because the icons are baked
 * into the iron-iconset-svg bundle". That was invented, and it failed two ways
 * at once. The prefixes collided — `'M12,2C6'` (go-to-album) was tested before
 * `'M12,2C6.48'` (start-radio), so "Start mix" always classified as "Go to
 * album" — and against current YouTube Music the table matched almost nothing,
 * so every stock action fell through to "More…" and the first tier held only
 * Lacquer's own FX entries. Path geometry is a rendering detail; it was never a
 * semantic signal.
 *
 * The items expose two real ones on their Polymer data, confirmed against a
 * live 14-item queue menu:
 *
 *   iconType     ALBUM, ARTIST, SHARE, FLAG, QUEUE_PLAY_NEXT, MIX …
 *   endpoint     browseEndpoint / queueAddEndpoint / shareEntityEndpoint …
 *                plus a pageType on browse endpoints (ALBUM / ARTIST /
 *                TRACK_CREDITS)
 *
 * `iconType` is primary because it is the more discriminating of the two:
 * "Play next" and "Add to queue" share `queueAddEndpoint` and are separable
 * only by icon. The endpoint is the fallback, and disambiguates browse targets
 * by page type.
 *
 * Items exposing neither (Save to library, Add to liked songs, Pin to Listen
 * again — toggle renderers that hold their state elsewhere) stay unclassified
 * and land in tier 2, which is where they belong anyway.
 */
const BY_ICON_TYPE: Record<string, string> = {
  QUEUE_PLAY_NEXT: 'play-next',
  ADD_TO_REMOTE_QUEUE: 'add-to-queue',
  ADD_TO_PLAYLIST: 'save-to-playlist',
  ALBUM: 'go-to-album',
  ARTIST: 'go-to-artist',
  REMOVE: 'remove-from-queue',
  PEOPLE_GROUP: 'credits',
  SHARE: 'share',
  FLAG: 'report',
  MIX: 'start-radio',
  DISMISS_QUEUE: 'dismiss-queue',
  // Present in other menu contexts (library rows, album pages).
  DELETE: 'remove-from-library',
  UNFAVORITE: 'remove-from-library',
  SAVE_ALT: 'download',
  DOWNLOAD: 'download',
  SHUFFLE: 'shuffle',
  PLAY_ARROW: 'play',
};

/** Disambiguates `browseEndpoint`, which several items share. */
const BY_PAGE_TYPE: Record<string, string> = {
  ALBUM: 'go-to-album',
  ARTIST: 'go-to-artist',
  TRACK_CREDITS: 'credits',
};

/** Endpoints that identify an item on their own. */
const BY_ENDPOINT: Record<string, string> = {
  addToPlaylistEndpoint: 'save-to-playlist',
  removeFromQueueEndpoint: 'remove-from-queue',
  shareEntityEndpoint: 'share',
  getReportFormEndpoint: 'report',
  deletePlaylistEndpoint: 'dismiss-queue',
};

/** The shape Lacquer reads off a YouTube Music menu renderer. */
export interface MenuItemData {
  icon?: { iconType?: string };
  navigationEndpoint?: Record<string, unknown>;
  serviceEndpoint?: Record<string, unknown>;
}

interface MenuItemElement extends HTMLElement {
  __data?: { data?: MenuItemData };
  data?: MenuItemData;
}

/**
 * The classification rule itself, over the data a menu item carries. Exported
 * pure so the real item shapes can be asserted without a browser — see
 * `tests/lacquer/context-menu.smoke.spec.ts`, which pins the full 14-item
 * queue menu captured from the running application.
 */
export function classifyMenuData(
  data: MenuItemData | undefined,
): string | null {
  if (!data) return null;

  const iconType = data.icon?.iconType;
  if (iconType && BY_ICON_TYPE[iconType]) return BY_ICON_TYPE[iconType];

  const endpoint = data.navigationEndpoint ?? data.serviceEndpoint;
  if (!endpoint) return null;

  const browse = endpoint.browseEndpoint as
    | {
        browseEndpointContextSupportedConfigs?: {
          browseEndpointContextMusicConfig?: { pageType?: string };
        };
      }
    | undefined;

  const pageType =
    browse?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType?.replace(
      'MUSIC_PAGE_TYPE_',
      '',
    );
  if (pageType && BY_PAGE_TYPE[pageType]) return BY_PAGE_TYPE[pageType];

  for (const name of Object.keys(endpoint)) {
    if (BY_ENDPOINT[name]) return BY_ENDPOINT[name];
  }

  return null;
}

export function classifyMenuItem(el: HTMLElement): string | null {
  const item = el as MenuItemElement;
  return classifyMenuData(item.__data?.data ?? item.data);
}
