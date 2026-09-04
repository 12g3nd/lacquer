import Butterchurn from 'butterchurn';
import ButterchurnPresets from 'butterchurn-presets';

import { AlbumColorTransition, drawAlbumFrame } from './album-colors';
import { Visualizer } from './visualizer';

import type { VisualizerPluginConfig } from '../index';

class ButterchurnVisualizer extends Visualizer {
  private readonly canvas: HTMLCanvasElement;
  private readonly source = document.createElement('canvas');
  private readonly visualizer: ReturnType<typeof Butterchurn.createVisualizer>;
  private destroyed: boolean = false;
  private animFrameHandle: number | null;

  constructor(
    audioContext: AudioContext,
    upstreamNode: AudioNode,
    canvas: HTMLCanvasElement,
    audioNode: GainNode,
    config: VisualizerPluginConfig,
  ) {
    super(upstreamNode, audioNode);
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Butterchurn needs a canvas output context');
    const palette = new AlbumColorTransition();
    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);
    let lastPaletteRead = -Infinity;

    const preset = ButterchurnPresets[config.butterchurn.preset];
    const renderVisualizer = () => {
      if (this.destroyed) return;
      this.visualizer.render();
      const now = performance.now();
      const matchAlbum =
        root.hasAttribute('data-lq-viz') &&
        root.hasAttribute('data-lq-viz-album-colors');
      if (matchAlbum && now - lastPaletteRead >= 100) {
        palette.setTarget(rootStyle.getPropertyValue('--lq-album-fill'), now);
        lastPaletteRead = now;
      }
      drawAlbumFrame(
        context,
        this.source,
        matchAlbum ? palette.sample(now) : undefined,
      );
      this.animFrameHandle = requestAnimationFrame(renderVisualizer);
    };

    this.visualizer = Butterchurn.createVisualizer(audioContext, this.source, {
      width: canvas.width,
      height: canvas.height,
    });
    this.visualizer.loadPreset(preset, config.butterchurn.blendTimeInSeconds);
    this.visualizer.connectAudio(audioNode);
    document.documentElement.dataset.lqVizTreatment = 'butterchurn';

    // Start animation request loop. Do not use setInterval!
    this.animFrameHandle = requestAnimationFrame(renderVisualizer);
  }

  resize(width: number, height: number) {
    // Butterchurn 3 resizes its internal OffscreenCanvas only. The supplied
    // output canvas otherwise stays at the browser's default 300×150 and
    // clips the rendered field to a black rectangle in the corner.
    this.canvas.width = Math.max(1, Math.round(width));
    this.canvas.height = Math.max(1, Math.round(height));
    this.source.width = this.canvas.width;
    this.source.height = this.canvas.height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.visualizer.setRendererSize(width, height);
  }

  protected destroyVisualizer() {
    document.documentElement.removeAttribute('data-lq-viz-treatment');
    if (this.animFrameHandle !== null) {
      cancelAnimationFrame(this.animFrameHandle);
      this.animFrameHandle = null;
    }
    this.destroyed = true;
    try {
      this.visualizer.disconnectAudio(this.audioNode);
    } catch {}
    try {
      this.visualizer.loseGLContext();
    } catch {}
  }
}

export default ButterchurnVisualizer;
