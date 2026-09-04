export type VisualizerPreference =
  | 'visualizerShowPanel'
  | 'visualizerLyricsOverlay'
  | 'visualizerAlbumColors';

const defaults: Record<VisualizerPreference, boolean> = {
  visualizerShowPanel: true,
  visualizerLyricsOverlay: false,
  visualizerAlbumColors: true,
};

export function getVisualizerPreference(key: VisualizerPreference): boolean {
  const value = window.mainConfig.get(`lacquer.${key}`);
  return typeof value === 'boolean' ? value : defaults[key];
}

export function applyVisualizerPresentation() {
  const root = document.documentElement;
  root.toggleAttribute(
    'data-lq-viz-panel-hidden',
    !getVisualizerPreference('visualizerShowPanel'),
  );
  root.toggleAttribute(
    'data-lq-viz-lyrics-overlay',
    getVisualizerPreference('visualizerLyricsOverlay'),
  );
  root.toggleAttribute(
    'data-lq-viz-album-colors',
    getVisualizerPreference('visualizerAlbumColors'),
  );
}

export function setVisualizerPreference(
  key: VisualizerPreference,
  value: boolean,
) {
  window.mainConfig.set(`lacquer.${key}`, value);
  applyVisualizerPresentation();
}
