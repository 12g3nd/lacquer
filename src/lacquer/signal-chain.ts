import largeCathedralIrPath from './assets/ir/large-cathedral.wav?url';
import mediumHallIrPath from './assets/ir/medium-hall.wav?url';
import smallRoomIrPath from './assets/ir/small-room.wav?url';

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
  private widthGainM_L!: GainNode;
  private widthGainM_R!: GainNode;
  private widthGainS_L!: GainNode;
  private widthGainS_R!: GainNode;

  private reverbDryGain!: GainNode;
  private reverbWetGain!: GainNode;
  private reverbConvolver!: ConvolverNode;

  private compressorBypassGain!: GainNode;
  private compressorInputGain!: GainNode;
  private compressorNode!: DynamicsCompressorNode;

  private limiterNode!: DynamicsCompressorNode;

  private outputGain!: GainNode;
  private analyserNode!: AnalyserNode;

  private irBuffers: Record<string, AudioBuffer | null> = {
    'small-room': null,
    'medium-hall': null,
    'large-cathedral': null,
  };

  private currentPreset: SignalChainPreset = 'Original';

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

    // Load IRs
    this.loadIR('small-room', smallRoomIrPath as string);
    this.loadIR('medium-hall', mediumHallIrPath as string);
    this.loadIR('large-cathedral', largeCathedralIrPath as string);

    this.inputGain = ctx.createGain();

    this.eqBypassGain = ctx.createGain();
    this.eqInputGain = ctx.createGain();
    this.eqOutputGain = ctx.createGain();

    this.widthBypassGain = ctx.createGain();
    this.widthInputGain = ctx.createGain();
    this.widthSplitter = ctx.createChannelSplitter(2);
    this.widthMerger = ctx.createChannelMerger(2);
    this.widthGainM_L = ctx.createGain();
    this.widthGainM_R = ctx.createGain();
    this.widthGainS_L = ctx.createGain();
    this.widthGainS_R = ctx.createGain();

    this.reverbDryGain = ctx.createGain();
    this.reverbWetGain = ctx.createGain();
    this.reverbConvolver = ctx.createConvolver();

    this.compressorBypassGain = ctx.createGain();
    this.compressorInputGain = ctx.createGain();
    this.compressorNode = ctx.createDynamicsCompressor();

    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1;
    this.limiterNode.ratio.value = 20;
    this.limiterNode.attack.value = 0.001;
    this.limiterNode.release.value = 0.05;

    this.outputGain = ctx.createGain();
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;

    // --- WIRING ---
    source.connect(this.inputGain);

    // EQ
    this.inputGain.connect(this.eqBypassGain);
    this.inputGain.connect(this.eqInputGain);
    this.eqBypassGain.connect(this.widthBypassGain);
    this.eqBypassGain.connect(this.widthInputGain);
    this.eqOutputGain.connect(this.widthBypassGain);
    this.eqOutputGain.connect(this.widthInputGain);

    // Width
    this.widthInputGain.connect(this.widthSplitter);
    this.widthSplitter.connect(this.widthGainM_L, 0); // L -> M_L
    this.widthSplitter.connect(this.widthGainS_L, 0); // L -> S_L
    this.widthSplitter.connect(this.widthGainM_R, 1); // R -> M_R
    this.widthSplitter.connect(this.widthGainS_R, 1); // R -> S_R

    this.widthGainM_L.connect(this.widthMerger, 0, 0);
    this.widthGainS_L.connect(this.widthMerger, 0, 0);
    this.widthGainM_R.connect(this.widthMerger, 0, 1);
    this.widthGainS_R.connect(this.widthMerger, 0, 1);

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
    this.compressorNode.connect(this.limiterNode);
    this.compressorBypassGain.connect(this.limiterNode);

    // Limiter to output
    this.limiterNode.connect(this.outputGain);
    this.outputGain.connect(ctx.destination);

    // Analyser tap
    this.outputGain.connect(this.analyserNode);

    // Initialize state
    this.setPreset('Original');
  }

  private route(stage: 'eq' | 'width' | 'compressor', active: boolean) {
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

  setWidth(width: number) {
    if (!this.audioContext) return;
    if (width === 1.0) {
      this.route('width', false);
      return;
    }

    this.widthGainM_L.gain.value = 0.5;
    this.widthGainS_L.gain.value = 0.5 * width;

    this.widthGainM_R.gain.value = 0.5;
    this.widthGainS_R.gain.value = -0.5 * width;

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

  setSpeed(rate: number, preservesPitch: boolean) {
    if (this.videoElement) {
      this.videoElement.playbackRate = rate;
      (
        this.videoElement as HTMLVideoElement & { preservesPitch: boolean }
      ).preservesPitch = preservesPitch;
    }
  }

  getCurrentPreset(): SignalChainPreset {
    return this.currentPreset;
  }

  setPreset(preset: SignalChainPreset) {
    this.currentPreset = preset;
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
