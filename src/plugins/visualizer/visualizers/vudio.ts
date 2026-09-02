import Vudio from 'vudio/umd/vudio';

import { Visualizer } from './visualizer';

import type { VisualizerPluginConfig } from '../index';

class VudioVisualizer extends Visualizer {
  private readonly visualizer: Vudio;

  constructor(
    _audioContext: AudioContext,
    audioSource: MediaElementAudioSourceNode,
    canvas: HTMLCanvasElement,
    audioNode: GainNode,
    stream: MediaStream,
    config: VisualizerPluginConfig,
  ) {
    super(audioSource, audioNode);

    this.visualizer = new Vudio(stream, canvas, {
      width: canvas.width,
      height: canvas.height,
      // Visualizer config
      ...config,
    });

    this.visualizer.dance();
  }

  resize(width: number, height: number) {
    this.visualizer.setOption({
      width,
      height,
    });
  }

  protected destroyVisualizer() {
    this.visualizer.pause();
  }
}

export default VudioVisualizer;
