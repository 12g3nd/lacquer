import Butterchurn from 'butterchurn';
import ButterchurnPresets from 'butterchurn-presets';

import { Visualizer } from './visualizer';

import type { VisualizerPluginConfig } from '../index';

class ButterchurnVisualizer extends Visualizer {
  private readonly canvas: HTMLCanvasElement;
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

    const preset = ButterchurnPresets[config.butterchurn.preset];
    const renderVisualizer = () => {
      if (this.destroyed) return;
      this.visualizer.render();
      this.animFrameHandle = requestAnimationFrame(renderVisualizer);
    };

    this.visualizer = Butterchurn.createVisualizer(audioContext, canvas, {
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
