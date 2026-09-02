export type LacquerVisualizerType =
  | 'lacquer-orbital'
  | 'lacquer-rave'
  | 'butterchurn';

export interface BandEnergies {
  bass: number;
  mids: number;
  highs: number;
}

export const resolveVisualizerType = (type: unknown): LacquerVisualizerType => {
  if (type === 'lacquer-orbital' || type === 'lacquer-rave') return type;
  return 'butterchurn';
};

const averageRange = (
  data: Uint8Array,
  sampleRate: number,
  lowHz: number,
  highHz: number,
) => {
  const binWidth = sampleRate / (data.length * 2);
  const low = Math.max(0, Math.ceil(lowHz / binWidth));
  const high = Math.min(data.length, Math.ceil(highHz / binWidth));
  let sum = 0;
  for (let index = low; index < high; index += 1) sum += data[index];
  return sum / Math.max(1, high - low) / 255;
};

export const readBandEnergies = (
  frequencyData: Uint8Array,
  sampleRate: number,
): BandEnergies => ({
  bass: averageRange(frequencyData, sampleRate, 28, 185),
  mids: averageRange(frequencyData, sampleRate, 185, 2100),
  highs: averageRange(frequencyData, sampleRate, 3800, 12_000),
});

export const isKickOnset = (
  bass: number,
  priorBass: number,
  elapsedSinceKick: number,
) => bass > 0.29 && bass > priorBass * 1.12 && elapsedSinceKick > 115;
