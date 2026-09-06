import processorUrl from '@soundtouchjs/audio-worklet/processor?url';

/** Equal slider distances represent equal musical intervals. */
export const pitchAtCorrection = (speed: number, correction: number) =>
  speed ** (1 - correction);

/** A single optional pitch stage; native endpoints remain unprocessed. */
export class PitchStage {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly ready: Promise<void>;
  private node?: AudioWorkletNode;
  private speed = 1;
  private correction = 1;
  private processing = false;
  private available = false;

  constructor(private readonly context: BaseAudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.input.connect(this.output);
    this.ready = this.load();
  }

  private async load() {
    try {
      await this.context.audioWorklet.addModule(processorUrl);
      this.node = new AudioWorkletNode(this.context, 'soundtouch-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.node.onprocessorerror = () => {
        this.available = false;
        this.update();
        document.dispatchEvent(new Event('lacquer:pitch-unavailable'));
      };
      this.available = true;
      this.update();
    } catch (error) {
      this.available = false;
      document.dispatchEvent(new Event('lacquer:pitch-unavailable'));
      throw error;
    }
  }

  set(speed: number, correction: number) {
    this.speed = speed;
    this.correction = correction;
    this.update();
  }

  get usesProcessor() {
    return this.processing;
  }

  private update() {
    const active =
      this.available &&
      this.speed !== 1 &&
      this.correction > 0 &&
      this.correction < 1;
    if (this.node && active) {
      this.node.parameters.get('playbackRate')!.value = this.speed;
      const pitch = this.node.parameters.get('pitch')!;
      pitch.setTargetAtTime(
        pitchAtCorrection(this.speed, this.correction),
        this.context.currentTime,
        0.025,
      );
    }
    if (active === this.processing) return;
    this.input.disconnect();
    this.node?.disconnect();
    if (active && this.node) {
      this.input.connect(this.node);
      this.node.connect(this.output);
    } else {
      this.input.connect(this.output);
    }
    this.processing = active;
  }
}
