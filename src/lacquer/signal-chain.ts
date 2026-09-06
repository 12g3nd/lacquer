import largeCathedralIrPath from './assets/ir/large-cathedral.wav?url';
import mediumHallIrPath from './assets/ir/medium-hall.wav?url';
import smallRoomIrPath from './assets/ir/small-room.wav?url';
import { PitchStage } from './pitch-stage';

import type { FilterConfig } from '../plugins/equalizer/presets';
import type {
  SignalChainPreset,
  CompressorConfig,
  ReverbConfig,
} from './signal-chain-types';

class SignalChain {
  private audioContext: AudioContext | null = null;
  private videoElement: HTMLVideoElement | null = null;

  private inputGain!: GainNode;

  private eqBypassGain!: GainNode;
  private eqInputGain!: GainNode;
  private eqOutputGain!: GainNode;
  private eqFilters: BiquadFilterNode[] = [];

  private widthBypassGain!: GainNode;
  private widthInputGain!: GainNode;
  private widthSplitter!: ChannelSplitterNode;
  private widthMerger!: ChannelMergerNode;
  // Mid/side is realised as a 2x2 matrix rather than discrete M and S nodes:
  // L' = a*L + b*R and R' = b*L + a*R, where a = (1+w)/2 and b = (1-w)/2.
  // Each merger input must therefore receive from BOTH splitter outputs.
  private widthLtoL!: GainNode;
  private widthRtoL!: GainNode;
  private widthLtoR!: GainNode;
  private widthRtoR!: GainNode;

  private reverbDryGain!: GainNode;
  private reverbWetGain!: GainNode;
  private reverbConvolver!: ConvolverNode;

  private compressorBypassGain!: GainNode;
  private compressorInputGain!: GainNode;
  private compressorNode!: DynamicsCompressorNode;

  private limiterBypassGain!: GainNode;
  private limiterInputGain!: GainNode;
  private limiterNode!: DynamicsCompressorNode;

  private outputGain!: GainNode;
  private analyserNode!: AnalyserNode;

  private irBuffers: Record<string, AudioBuffer | null> = {
    'small-room': null,
    'medium-hall': null,
    'large-cathedral': null,
  };

  private currentPreset: SignalChainPreset = 'Original';
  private playbackRate = 1;
  private pitchCorrection = 1;
  private pitchStage!: PitchStage;
  pitchReady: Promise<void> = Promise.resolve();

  private resumeAudioContext = () => {
    const context = this.audioContext;
    if (context?.state === 'suspended') {
      context.resume().catch((error: unknown) => {
        console.warn('[Lacquer] Audio context resume failed', error);
      });
    }
  };

  // Store active config so we can wait for buffers to load
  private activeReverbConfig: ReverbConfig = { wet: 0, ir: null };

  private async loadIR(name: string, url: string) {
    if (!this.audioContext) return;
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      this.irBuffers[name] = audioBuffer;

      // If we're waiting for this IR to play, apply it now
      if (
        this.activeReverbConfig.ir === name &&
        this.activeReverbConfig.wet > 0
      ) {
        this.setReverb(this.activeReverbConfig);
      }
    } catch (e) {
      console.error('Failed to load IR', name, e);
    }
  }

  init(
    source: MediaElementAudioSourceNode,
    ctx: AudioContext,
    video: HTMLVideoElement,
  ) {
    if (this.audioContext) return;
    this.audioContext = ctx;
    this.videoElement = video;
    // YTM resets the media element's rate on track changes. The rack owns
    // the listening session, so retain its effective speed and pitch mode.
    video.addEventListener('ratechange', this.restorePlaybackRate);
    video.addEventListener('loadedmetadata', this.restorePlaybackRate);
    video.addEventListener('playing', this.restorePlaybackRate);
    video.addEventListener('play', this.resumeAudioContext);
    video.addEventListener('playing', this.resumeAudioContext);
    document.addEventListener('pointerdown', this.resumeAudioContext, {
      passive: true,
    });
    this.resumeAudioContext();

    // Load IRs
    this.loadIR('small-room', smallRoomIrPath);
    this.loadIR('medium-hall', mediumHallIrPath);
    this.loadIR('large-cathedral', largeCathedralIrPath);

    this.inputGain = ctx.createGain();

    this.eqBypassGain = ctx.createGain();
    this.eqInputGain = ctx.createGain();
    this.eqOutputGain = ctx.createGain();

    this.widthBypassGain = ctx.createGain();
    this.widthInputGain = ctx.createGain();
    this.widthSplitter = ctx.createChannelSplitter(2);
    this.widthMerger = ctx.createChannelMerger(2);
    this.widthLtoL = ctx.createGain();
    this.widthRtoL = ctx.createGain();
    this.widthLtoR = ctx.createGain();
    this.widthRtoR = ctx.createGain();

    this.reverbDryGain = ctx.createGain();
    this.reverbWetGain = ctx.createGain();
    this.reverbConvolver = ctx.createConvolver();

    this.compressorBypassGain = ctx.createGain();
    this.compressorInputGain = ctx.createGain();
    this.compressorNode = ctx.createDynamicsCompressor();

    this.limiterBypassGain = ctx.createGain();
    this.limiterInputGain = ctx.createGain();
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.001;
    this.limiterNode.release.value = 0.05;

    this.outputGain = ctx.createGain();
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;

    // --- WIRING ---
    this.pitchStage = new PitchStage(ctx);
    source.connect(this.pitchStage.input);
    this.pitchStage.output.connect(this.inputGain);
    this.pitchReady = this.pitchStage.ready;
    this.pitchReady
      .then(() => this.restorePlaybackRate())
      .catch((error: unknown) => {
        console.error('[Lacquer] Pitch processing unavailable', error);
        document.dispatchEvent(new Event('lacquer:pitch-unavailable'));
      });

    // EQ
    this.inputGain.connect(this.eqBypassGain);
    this.inputGain.connect(this.eqInputGain);
    this.eqBypassGain.connect(this.widthBypassGain);
    this.eqBypassGain.connect(this.widthInputGain);
    this.eqOutputGain.connect(this.widthBypassGain);
    this.eqOutputGain.connect(this.widthInputGain);

    // Width — mid/side as a 2x2 matrix. Both merger inputs are fed from both
    // splitter outputs; without the cross terms this degenerates into
    // independent per-channel gain, which is not mid/side at all.
    this.widthInputGain.connect(this.widthSplitter);
    this.widthSplitter.connect(this.widthLtoL, 0); // L -> left out
    this.widthSplitter.connect(this.widthLtoR, 0); // L -> right out (cross)
    this.widthSplitter.connect(this.widthRtoL, 1); // R -> left out  (cross)
    this.widthSplitter.connect(this.widthRtoR, 1); // R -> right out

    this.widthLtoL.connect(this.widthMerger, 0, 0);
    this.widthRtoL.connect(this.widthMerger, 0, 0);
    this.widthLtoR.connect(this.widthMerger, 0, 1);
    this.widthRtoR.connect(this.widthMerger, 0, 1);

    this.widthMerger.connect(this.reverbDryGain);
    this.widthMerger.connect(this.reverbConvolver);

    this.widthBypassGain.connect(this.reverbDryGain);
    this.widthBypassGain.connect(this.reverbConvolver);

    // Reverb
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbDryGain.connect(this.compressorBypassGain);
    this.reverbDryGain.connect(this.compressorInputGain);
    this.reverbWetGain.connect(this.compressorBypassGain);
    this.reverbWetGain.connect(this.compressorInputGain);

    // Compressor
    this.compressorInputGain.connect(this.compressorNode);
    this.compressorNode.connect(this.limiterInputGain);
    this.compressorNode.connect(this.limiterBypassGain);
    this.compressorBypassGain.connect(this.limiterInputGain);
    this.compressorBypassGain.connect(this.limiterBypassGain);

    // Limiter — bypassable, so Original is genuinely neutral. Presets that add
    // reverb wet on top of full dry can exceed 0 dBFS and do want it engaged.
    this.limiterInputGain.connect(this.limiterNode);
    this.limiterNode.connect(this.outputGain);
    this.limiterBypassGain.connect(this.outputGain);
    this.outputGain.connect(ctx.destination);

    // Analyser tap
    this.outputGain.connect(this.analyserNode);

    // Initialize state
    this.setPreset('Original');
  }

  private route(
    stage: 'eq' | 'width' | 'compressor' | 'limiter',
    active: boolean,
  ) {
    if (!this.audioContext) return;
    const t = this.audioContext.currentTime;

    const setGains = (bypass: GainNode, input: GainNode) => {
      bypass.gain.setTargetAtTime(active ? 0 : 1, t, 0.01);
      input.gain.setTargetAtTime(active ? 1 : 0, t, 0.01);
    };

    switch (stage) {
      case 'eq':
        setGains(this.eqBypassGain, this.eqInputGain);
        break;
      case 'width':
        setGains(this.widthBypassGain, this.widthInputGain);
        break;
      case 'compressor':
        setGains(this.compressorBypassGain, this.compressorInputGain);
        break;
      case 'limiter':
        setGains(this.limiterBypassGain, this.limiterInputGain);
        break;
    }
  }

  getAnalyserNode() {
    return this.analyserNode;
  }

  setEQ(filters: FilterConfig[]) {
    if (!this.audioContext) return;

    this.eqFilters.forEach((f) => f.disconnect());
    this.eqFilters = [];

    if (filters.length === 0) {
      this.route('eq', false);
      return;
    }

    this.eqInputGain.disconnect();
    let currentOut: AudioNode = this.eqInputGain;
    filters.forEach((config) => {
      const f = this.audioContext!.createBiquadFilter();
      f.type = config.type;
      f.frequency.value = config.frequency;
      f.Q.value = config.Q;
      f.gain.value = config.gain;
      currentOut.connect(f);
      currentOut = f;
      this.eqFilters.push(f);
    });
    currentOut.connect(this.eqOutputGain);
    this.route('eq', true);
  }

  /**
   * Stereo width via mid/side.
   *
   *   M = (L + R) / 2          S = (L - R) / 2
   *   L' = M + S*w             R' = M - S*w
   *
   * Expanded into the matrix the graph actually implements:
   *
   *   L' = a*L + b*R           R' = b*L + a*R
   *   a = (1 + w) / 2          b = (1 - w) / 2
   *
   * At w = 1 this is a = 1, b = 0 — the identity, matching bypass exactly.
   * At w = 0 it collapses to mono. Above 1 it widens.
   */
  setWidth(width: number) {
    if (!this.audioContext) return;
    if (width === 1.0) {
      this.route('width', false);
      return;
    }

    const direct = (1 + width) / 2;
    const cross = (1 - width) / 2;

    this.widthLtoL.gain.value = direct;
    this.widthRtoR.gain.value = direct;
    this.widthRtoL.gain.value = cross;
    this.widthLtoR.gain.value = cross;

    this.route('width', true);
  }

  setReverb(config: ReverbConfig) {
    if (!this.audioContext) return;
    this.activeReverbConfig = config;

    const t = this.audioContext.currentTime;
    if (config.wet === 0 || !config.ir) {
      this.reverbWetGain.gain.setTargetAtTime(0, t, 0.01);
      return;
    }

    const buffer = this.irBuffers[config.ir];
    if (buffer) {
      this.reverbConvolver.buffer = buffer;
      this.reverbWetGain.gain.setTargetAtTime(config.wet, t, 0.01);
    } else {
      this.reverbWetGain.gain.setTargetAtTime(0, t, 0.01);
    }
  }

  setCompressor(config: CompressorConfig) {
    if (!this.audioContext) return;
    this.compressorNode.threshold.value = config.threshold;
    this.compressorNode.ratio.value = config.ratio;
    this.compressorNode.knee.value = config.knee;
    this.compressorNode.attack.value = config.attack;
    this.compressorNode.release.value = config.release;
    this.route('compressor', true);
  }

  bypassCompressor() {
    this.route('compressor', false);
  }

  setLimiter(active: boolean) {
    this.route('limiter', active);
  }

  private restorePlaybackRate = () => {
    const video = this.videoElement;
    if (!video) return;
    if (video.defaultPlaybackRate !== this.playbackRate) {
      video.defaultPlaybackRate = this.playbackRate;
    }
    if (video.playbackRate !== this.playbackRate) {
      video.playbackRate = this.playbackRate;
    }
    this.pitchStage?.set(this.playbackRate, this.pitchCorrection);
    video.preservesPitch =
      !this.pitchStage?.usesProcessor && this.pitchCorrection >= 0.5;
  };

  setSpeed(rate: number, preservesPitch: boolean | number) {
    this.playbackRate = rate;
    this.pitchCorrection = Math.max(0, Math.min(1, Number(preservesPitch)));
    this.restorePlaybackRate();
  }

  getCurrentPreset(): SignalChainPreset {
    return this.currentPreset;
  }

  setPreset(preset: SignalChainPreset) {
    this.currentPreset = preset;

    // Original must be audibly neutral and level-stable, so it takes no
    // limiting. Every other preset sums reverb wet on top of full dry and can
    // therefore exceed 0 dBFS, where the limiter earns its place.
    this.setLimiter(preset !== 'Original');

    switch (preset) {
      case 'Original':
        this.setSpeed(1.0, true);
        this.setEQ([]);
        this.setWidth(1.0);
        this.setReverb({ wet: 0, ir: null });
        this.bypassCompressor();
        break;
      case 'Sped + Reverb':
        this.setSpeed(1.18, false);
        this.setEQ([]);
        this.setWidth(1.2);
        this.setReverb({ wet: 0.15, ir: 'medium-hall' });
        this.bypassCompressor();
        break;
      case 'Slowed + Reverb':
        this.setSpeed(0.85, false);
        this.setEQ([{ type: 'highshelf', frequency: 8000, Q: 1, gain: -3 }]);
        this.setWidth(1.15);
        this.setReverb({ wet: 0.25, ir: 'large-cathedral' });
        this.bypassCompressor();
        break;
      case 'Dream':
        this.setSpeed(0.95, true);
        this.setEQ([
          { type: 'lowshelf', frequency: 150, Q: 1, gain: 2 },
          { type: 'highshelf', frequency: 6000, Q: 1, gain: 1 },
        ]);
        this.setWidth(1.3);
        this.setReverb({ wet: 0.2, ir: 'medium-hall' });
        this.bypassCompressor();
        break;
      case 'Tape':
        this.setSpeed(1.0, true);
        this.setEQ([
          { type: 'lowshelf', frequency: 100, Q: 1, gain: 1.5 },
          { type: 'highshelf', frequency: 10000, Q: 1, gain: -2.5 },
        ]);
        this.setWidth(0.95);
        this.setReverb({ wet: 0.05, ir: 'small-room' });
        this.setCompressor({
          threshold: -18,
          ratio: 3,
          knee: 15,
          attack: 0.01,
          release: 0.2,
        });
        break;
      case 'Night':
        this.setSpeed(1.0, true);
        this.setEQ([{ type: 'highshelf', frequency: 5000, Q: 1, gain: -4 }]);
        this.setWidth(0.9);
        this.setReverb({ wet: 0.1, ir: 'small-room' });
        this.bypassCompressor();
        break;
    }
  }

  // To be used by legacy plugins if needed
  getContext() {
    return this.audioContext;
  }
}

export const signalChain = new SignalChain();
