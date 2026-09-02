export abstract class Visualizer {
  protected readonly audioNode: GainNode;
  private readonly upstreamNode: AudioNode;
  private isDestroyed = false;

  protected constructor(upstreamNode: AudioNode, audioNode: GainNode) {
    this.upstreamNode = upstreamNode;
    this.audioNode = audioNode;
  }

  abstract resize(width: number, height: number): void;

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    try {
      this.destroyVisualizer();
    } finally {
      try {
        this.upstreamNode.disconnect(this.audioNode);
      } catch {}
      try {
        this.audioNode.disconnect();
      } catch {}
    }
  }

  protected abstract destroyVisualizer(): void;
}
