import Butterchurn from 'butterchurn';
import ButterchurnPresets from 'butterchurn-presets';

import { Visualizer } from './visualizer';

import type { VisualizerPluginConfig } from '../index';

class ButterchurnVisualizer extends Visualizer {
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

    // Start animation request loop. Do not use setInterval!
    this.animFrameHandle = requestAnimationFrame(renderVisualizer);
  }

  resize(width: number, height: number) {
    this.visualizer.setRendererSize(width, height);
  }

  protected destroyVisualizer() {
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
