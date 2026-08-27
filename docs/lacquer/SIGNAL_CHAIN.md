# Lacquer Signal Chain

The Lacquer Signal Chain is the centralized owner of the WebAudio graph for the application. It resolves past issues where individual plugins created parallel paths to the audio destination, leading to duplicated signals, phase cancellation, and node leaks.

## Architecture

```
YouTube Video Element
      │
      ▼
MediaElementAudioSourceNode (MESA)
      │
      ▼
[Input Gain] ───────► (EQ Bypass)
      │                     │
      ▼                     ▼
 [EQ Filter Chain] ───► (Width Bypass)
      │                     │
      ▼                     ▼
 [Mid/Side Width] ────► (Reverb Bypass)
      │                     │
      ▼                     ▼
 [Convolver (IR)] ────► (Compressor Bypass)
      │                     │
      ▼                     ▼
 [DynamicsCompressor] ─► (Limiter)
                            │
                            ▼
                      [Output Gain]
                            │
                            ├────────► [AnalyserNode Tap] (for Visualizer / Skip Silences)
                            ▼
                    AudioContext.destination
```

### Key Principles
1. **Single Owner**: `src/lacquer/signal-chain.ts` creates and manages the `AudioContext` and `MediaElementAudioSourceNode` exactly once.
2. **Neutral Bypass**: When the "Original" preset is active, all DSP stages (EQ, Width, Reverb, Compressor) are bypassed via `GainNode` routing. The signal path is completely neutral.
3. **Robust Reverb**: Uses a `ConvolverNode` with small local `.wav` impulse responses.
4. **Varispeed vs Pitch-Preserve**: Exposes control over both playback rate and `preservesPitch` on the HTMLVideoElement.
5. **Shared Analyser**: Provides a single `.getAnalyserNode()` tap for all plugins (Visualizer, Skip Silences) to prevent redundant FFTs and graph mutations.

## Presets
- **Original**: 100% neutral.
- **Sped + Reverb**: Varispeed (pitch shifting up), moderate hall reverb, widened stereo.
- **Slowed + Reverb**: Varispeed (pitch shifting down), large cathedral reverb, high-shelf cut, widened stereo.
- **Dream**: Near-normal speed, lush reverb, gentle EQ shaping, very wide stereo.
- **Tape**: Normal speed, mid-bump/high-cut EQ, slightly narrowed stereo, soft compression.
- **Night**: Normal speed, dark EQ, subtle room reverb.

## Plugin Migrations
Legacy audio plugins (Audio Compressor, Equalizer, Visualizer, Skip Silences) have been converted to lightweight configuration adapters. They now invoke methods on the `signalChain` rather than mutating the graph themselves.

## Limitations
- True real-time parametric pitch shifting (without affecting speed) is not implemented, as it requires an `AudioWorklet` phase vocoder which fights the media element architecture. Varispeed + built-in Chromium time-stretching are used instead.
- Crossfade remains on a separate Howler.js audio graph.
