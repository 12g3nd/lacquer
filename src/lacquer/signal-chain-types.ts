export type SignalChainPreset =
  | 'Original'
  | 'Sped + Reverb'
  | 'Slowed + Reverb'
  | 'Dream'
  | 'Tape'
  | 'Night';

export interface SignalChainState {
  preset: SignalChainPreset;
}

export interface ReverbConfig {
  wet: number; // 0.0 to 1.0
  ir: 'small-room' | 'medium-hall' | 'large-cathedral' | null;
}

export interface CompressorConfig {
  threshold: number;
  ratio: number;
  knee: number;
  attack: number;
  release: number;
}
