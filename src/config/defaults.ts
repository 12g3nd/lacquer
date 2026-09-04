export interface WindowSizeConfig {
  width: number;
  height: number;
}

export interface WindowPositionConfig {
  x: number;
  y: number;
}

export interface DefaultConfig {
  'window-size': WindowSizeConfig;
  'window-maximized': boolean;
  'window-position': WindowPositionConfig;
  'url': string;
  'options': {
    language?: string;
    tray: boolean;
    appVisible: boolean;
    autoUpdates: boolean;
    alwaysOnTop: boolean;
    hideMenu: boolean;
    hideMenuWarned: boolean;
    startAtLogin: boolean;
    disableHardwareAcceleration: boolean;
    removeUpgradeButton: boolean;
    restartOnConfigChanges: boolean;
    trayClickPlayPause: boolean;
    autoResetAppCache: boolean;
    resumeOnStart: boolean;
    likeButtons: string;
    swapLikeButtonsOrder: boolean;
    proxy: string;
    startingPage: string;
    overrideUserAgent: boolean;
    usePodcastParticipantAsArtist: boolean;
    themes: string[];
    customWindowTitle?: string;
  };
  'plugins': Record<string, { enabled: boolean } & Record<string, unknown>>;
  'lacquer': {
    visualizerMode: boolean;
    visualizerShowPanel: boolean;
    visualizerLyricsOverlay: boolean;
    visualizerAlbumColors: boolean;
  };
}

/*
 * Lacquer's default plugin set — DECISIONS.md D11.
 *
 * These only take effect because Lacquer has its own `userData` (D9); on a
 * profile carried over from Pear the user's saved choices still win. `isEnabled`
 * deep-merges this over each plugin's own `config`, so an entry here overrides
 * the upstream default — which is why `in-app-menu` (default-on for Windows
 * upstream) and `navigation` / `performance-improvement` are listed explicitly
 * even where the value matches: the table is the decision, in one place.
 */
const defaultPlugins: DefaultConfig['plugins'] = {
  // On — the spine of the product.
  // The design anchor; non-optional (D11). `enableSeekbar` off: its seekbar
  // theme paints a pink gradient the Stage-A shell overrides anyway, and
  // leaving it on fights `suppress.css` for the progress fill.
  'album-color-theme': { enabled: true, enableSeekbar: false },
  'do-not-track': { enabled: true }, // ad blocking — an ad on the Experience surface breaks the premise
  'sponsorblock': { enabled: true },
  'synced-lyrics': {
    enabled: true,
    preciseTiming: true,
    showLyricsEvenIfInexact: true,
    showTimeCodes: false,
    defaultTextString: '♪',
    lineEffect: 'fancy',
    romanization: true,
    preferredProvider: 'YTMusic',
  }, // match the owner's useful Pear lyrics setup, including the Fancy line treatment
  'navigation': { enabled: true }, // back / forward, relocated to the rail (D8)
  'performance-improvement': { enabled: true },
  'shortcuts': {
    enabled: true,
    local: { visualizerModeToggle: 'CommandOrControl+Shift+V' },
  }, // media keys, FX, and Visualizer Mode route through it
  'taskbar-mediacontrol': { enabled: true }, // Windows 11 media overlay
  'precise-volume': { enabled: true }, // finer volume; independent of the Signal Chain (see below)

  // Off — superseded by the Signal Chain. Competing audio graphs are the exact
  // conflict the Signal Chain audit was commissioned to prevent.
  'equalizer': { enabled: false },
  'audio-compressor': { enabled: false },
  'playback-speed': { enabled: false },
  'visualizer': { enabled: false },
  'crossfade': { enabled: false },
  'skip-silences': { enabled: false },

  // Off — competing visual layers that inject their own styling and would fight
  // the authored shell.
  'ambient-mode': { enabled: false },
  'blur-nav-bar': { enabled: false },
  'transparent-player': { enabled: false },
  'unobtrusive-player': { enabled: false },
  'in-app-menu': { enabled: false }, // Lacquer builds its own titlebar (D8)
};

export const defaultConfig: DefaultConfig = {
  'window-size': {
    width: 1100,
    height: 550,
  },
  'window-maximized': false,
  'window-position': {
    x: -1,
    y: -1,
  },
  'url': 'https://music.\u0079\u006f\u0075\u0074\u0075\u0062\u0065.com',
  'options': {
    tray: false,
    appVisible: true,
    autoUpdates: true,
    alwaysOnTop: false,
    hideMenu: true,
    hideMenuWarned: false,
    startAtLogin: false,
    disableHardwareAcceleration: false,
    // Orbit Noir has no upgrade nag — an ad-free, un-monetised surface is a
    // design premise (D11). Pear's own mechanism hides the guide entry by icon
    // path; `rail.ts` also drops any primary entry past Listen/Discover/
    // Collection for profiles that already stored `false` here.
    removeUpgradeButton: true,
    restartOnConfigChanges: false,
    trayClickPlayPause: false,
    autoResetAppCache: false,
    resumeOnStart: true,
    likeButtons: '',
    swapLikeButtonsOrder: false,
    proxy: '',
    startingPage: '',
    overrideUserAgent: false,
    usePodcastParticipantAsArtist: false,
    themes: [],
  },
  'plugins': defaultPlugins,
  'lacquer': {
    visualizerMode: false,
    visualizerShowPanel: true,
    visualizerLyricsOverlay: false,
    visualizerAlbumColors: true,
  },
};
