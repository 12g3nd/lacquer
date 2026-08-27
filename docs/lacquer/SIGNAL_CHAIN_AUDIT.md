# Lacquer Signal Chain Audit

Audit date: 2026-08-27  
Scope: every file in `src/` that creates, routes, analyses, or destroys WebAudio nodes, media-element state, or playback parameters.

---

## 1 — Current Topology as Actually Implemented

```
                                      ┌──────────────────────────────┐
                                      │ YouTube Music <video> element │
                                      └──────────────┬───────────────┘
                                                     │
                              renderer.ts L313-315   │  new AudioContext()
                                                     │  createMediaElementSource(video)
                                                     ▼
                                         ┌──── audioSource (MESA) ────┐
                                         │                            │
                          default path:   │ .connect(ctx.destination)  │  always connected
                                         │                            │
                                         ▼                            │
                                  ctx.destination                     │
                                                                      │
    ┌────────── peard:audio-can-play event (re-fired per loadstart) ───┘
    │  carries: { audioContext, audioSource }
    │
    │  Listeners (each receives the same source+ctx pair):
    │
    │  ┌─ audio-compressor ─── source → DynamicsCompressorNode → ctx.destination
    │  │                       (disconnects source → destination first)
    │  │
    │  ├─ equalizer ────────── source → BiquadFilterNode(s) → ctx.destination
    │  │                       (does NOT disconnect source → destination)
    │  │
    │  ├─ visualizer ──────── source → GainNode(1.25) → [butterchurn/wave/vudio]
    │  │                       (observation-only tap, GainNode never reaches destination)
    │  │
    │  ├─ skip-silences ────── source → AnalyserNode  (analysis-only, no output)
    │  │
    │  └─ custom-output-device ── calls ctx.setSinkId()  (no graph changes)
    │
    │  NOT listeners of peard:audio-can-play:
    │  ├─ precise-volume ───── api.setVolume() / video.volume reads (YT internal API)
    │  ├─ exponential-volume ── redefines HTMLMediaElement.prototype.volume
    │  ├─ playback-speed ────── video.playbackRate = N
    │  └─ crossfade ─────────── Howler.js second <audio> element (separate graph)
```

The single `AudioContext` and single `MediaElementAudioSourceNode` are created once in `renderer.ts` at L313-314 during `onApiLoaded()`. They are shared via a `CustomEvent` dispatched on every track load (`loadstart` → `canplaythrough`).

**There is exactly one AudioContext and one MESA. No plugin creates its own.** The context and source survive the lifetime of the Electron renderer — they are never closed or re-created.

---

## 2 — Plugin-by-Plugin Node Inventory

### audio-compressor (`src/plugins/audio-compressor.ts`)

| Action | Detail |
|--------|--------|
| Creates | `DynamicsCompressorNode` via `createDynamicsCompressor()` |
| Connects | `source → compressor → ctx.destination` |
| Disconnects on start | `source → ctx.destination` (breaks default path) |
| Disconnects on stop | `compressor`, restores `source → ctx.destination` |
| Re-fires on each `audio-can-play` | Yes — creates a **new** compressor node per event |
| Cleanup gap | Old compressor nodes from prior tracks are not explicitly disconnected if they were replaced by a new one before `stop()` was called; the `WeakMap` mapping is overwritten. In practice the old node becomes garbage once dereferenced, but the old `source → oldCompressor → destination` connection remains live in the WebAudio graph until GC. |

### equalizer (`src/plugins/equalizer/index.ts`)

| Action | Detail |
|--------|--------|
| Creates | N `BiquadFilterNode` instances (one per filter config entry + active presets) |
| Connects | `source → filter → ctx.destination` for each filter |
| **Does NOT disconnect** | `source → ctx.destination` — the default path stays live |
| Listener is `{ once: true }` | Only fires on the first `audio-can-play` event. Subsequent track loads do nothing; filters remain connected but reference the original source. |
| Stop | Calls `filter.disconnect()` on each stored filter. Does not touch the source. |
| Bug | Because the listener is `once: true`, enabling the equalizer mid-session and changing tracks will never re-apply filters. |

### visualizer (`src/plugins/visualizer/index.ts`)

| Action | Detail |
|--------|--------|
| Creates | `GainNode` (gain=1.25), passed to butterchurn/wave/vudio |
| Connects | `source → gainNode` (not to destination — observation spur) |
| Listener is **not** `once` | Re-fires on every `audio-can-play` event. Old visualizer is destroyed first (`this.props.visualizerInstance?.destroy()`). |
| Destroy | Calls `audioSource.disconnect(audioNode)` (the gain node). On butterchurn, also `cancelAnimationFrame`. |
| Side effect | The `GainNode(1.25)` has no output, so it does not affect audible volume — it amplifies the signal for visual analysis only. |
| Leak risk | The `ResizeObserver` is properly disconnected before re-creating. |

### skip-silences (`src/plugins/skip-silences/renderer.ts`)

| Action | Detail |
|--------|--------|
| Creates | `AnalyserNode` (fftSize=512, smoothing=0.1) |
| Connects | `source → analyser` (no output to destination) |
| Listener | Not `once`. Fires every `audio-can-play`. |
| Polling | `setTimeout(looper, 2ms)` recursive loop — **never cancelled**. Each `audio-can-play` event spawns a new looper. After N track loads, N concurrent loopers run in parallel, all reading from the same analyser. |
| Stop | Removes the `audio-can-play` listener and `play`/`seeked` handlers. Does **not** cancel the running looper(s) or disconnect the analyser. |
| Bug — looper accumulation | The 2ms polling loop stacks up across tracks. On extended playback (say 50 tracks in a session), 50 concurrent `setTimeout` chains are running simultaneously, each doing FFT reads. This is a performance leak. |

### custom-output-device (`src/plugins/custom-output-device/renderer.ts`)

| Action | Detail |
|--------|--------|
| Creates | Nothing — calls `ctx.setSinkId(deviceId)` |
| Listener is `{ once: true }` | Only processes the first `audio-can-play`. |
| Stop | Removes listener, clears `ondevicechange`. |

### precise-volume (`src/plugins/precise-volume/`)

| Action | Detail |
|--------|--------|
| Audio graph | None — works entirely through `playerApi.setVolume()` (YT internal) and `video.volume` reads/writes. |
| Override | `override.ts` replaces `Element.prototype.addEventListener` temporarily during load to suppress YT's own `mousewheel`/`keydown` listeners on volume sliders. Restored on `window.load`. |
| Persistence | Saves volume to `electron-store` via plugin config. Restores on load. |
| MutationObserver | One observer on `#volume-slider` attribute `value`. |

### exponential-volume (`src/plugins/exponential-volume/index.ts`)

| Action | Detail |
|--------|--------|
| Audio graph | None |
| Mechanism | Redefines `HTMLMediaElement.prototype.volume` getter/setter with cubic scaling (exponent=3). |
| Side effect | **Global prototype mutation** — affects every `<audio>` and `<video>` element in the renderer, including crossfade's Howler `<audio>`. |
| Interaction with precise-volume | Both write to `video.volume`/`api.setVolume()`. Exponential-volume transforms the actual hardware value; precise-volume sets the logical value. They compose correctly if both are enabled (precise-volume writes, exponential-volume's setter transforms). |

### playback-speed (`src/plugins/playback-speed/renderer.tsx`)

| Action | Detail |
|--------|--------|
| Audio graph | None |
| Mechanism | Sets `video.playbackRate` directly. Force-applies on `ratechange` and `peard:src-changed` events. |
| `preservesPitch` | **Not set anywhere.** Browser default (`preservesPitch = true`) applies, meaning speed changes preserve pitch via Chromium's internal time-stretching. |
| Stop | Removes event listeners, removes DOM slider. Does **not** reset `playbackRate` to 1. |

### crossfade (`src/plugins/crossfade/`)

| Action | Detail |
|--------|--------|
| Audio graph | Creates a **separate** Howler.js `<audio>` element with its own `AudioContext` (Howler internal). This is a completely independent audio path. |
| Mechanism | Fetches a parallel audio URL via `Innertube`, creates a `Howl` instance, syncs seek/pause to the main `<video>`, fades between them. |
| Volume manipulation | Directly sets `video.volume = 0` during crossfade-out, then fades in using `VolumeFader` on the video element. |
| Interaction with exponential-volume | Crossfade writes `video.volume` which goes through the exponential getter/setter if that plugin is enabled. The crossfade audio (Howler) uses a separate `<audio>` element — exponential-volume's prototype override also applies to it, potentially causing unexpected volume curves on the crossfade audio. |
| Cleanup | `transitionAudio.unload()` before creating a new Howl. |
| Backend | Creates an `Innertube` instance for fetching stream URLs. Registered via `ipcMain.handle('audio-url', ...)`. |

---

## 3 — Concrete Conflict Risks

### 3.1 Double/triple routing to destination

When both **audio-compressor** and **equalizer** are enabled:
- Compressor disconnects `source → destination`, then connects `source → compressor → destination`.
- Equalizer connects `source → filter → destination` **without disconnecting** `source → destination` (which was already disconnected by the compressor).
- Result: audio passes through the compressor AND through the equalizer filter(s) in **parallel**. Both reach `destination` independently. The listener with signal doubled.

If **only equalizer** is enabled:
- The default `source → destination` path remains.
- Equalizer adds `source → filter → destination` in parallel.
- Result: audio is heard **twice** — once direct, once filtered. The direct signal masks the EQ effect and adds ~3 dB.

### 3.2 Listener timing / `once:true` inconsistency

| Plugin | `once` | Behavior |
|--------|--------|----------|
| audio-compressor | no | Reconnects each track — correct for its pattern |
| equalizer | yes | Only works on first track load |
| visualizer | no | Re-creates visualizer each track — correct |
| skip-silences | no | Accumulates looper on each track — bug |
| custom-output-device | yes | Only processes first track — `setSinkId` is idempotent, so acceptable |

### 3.3 No ordering guarantee

`peard:audio-can-play` listeners fire in registration order (determined by plugin load order). If the compressor listener fires after the equalizer listener, the compressor disconnects `source → destination`, but the equalizer has already connected `source → filter → destination` — the compressor doesn't know about the filter path.

### 3.4 Exponential-volume + crossfade interaction

The crossfade plugin's Howler `<audio>` element inherits the cubic volume transform from `exponential-volume`. The VolumeFader assumes linear volume mapping. With exponential-volume active, a "fade to 0" actually fades to 0^3 = 0 (correct at the endpoint), but the curve shape is doubly warped.

### 3.5 Playback speed → pitch coupling

`preservesPitch` defaults to `true` in Chromium. The playback-speed plugin never sets it. There is no mechanism for users to get varispeed (speed + pitch coupled) or independent pitch shifting.

### 3.6 Skip-silences looper leak

Each `audio-can-play` event spawns a new 2ms `setTimeout` recursive loop. Over a listening session, these stack up with no cancellation mechanism. After 100 tracks, 100 parallel FFT-reading loops are competing for the audio thread.

### 3.7 Compressor recreates node per track

The audio-compressor creates a new `DynamicsCompressorNode` on every `audio-can-play`. The old compressor remains connected in the WebAudio graph (the `WeakMap` loses the old entry, but the graph connection persists until GC). During the window between `canplaythrough` and the handler running, brief audio glitches or volume discontinuities are possible.

---

## 4 — Recommended Single-Owner Architecture

A new module, tentatively `src/lacquer/signal-chain.ts`, should own the entire WebAudio graph. It replaces the ad-hoc pattern where each plugin independently connects to `audioSource` and `ctx.destination`.

### Graph layout

```
video ──► MESA ──► [inputGain] ──► [EQ stage] ──► [compressor/limiter]
                                                         │
                                                    [outputGain] ──► ctx.destination
                                                         │
                                                    [analyserTap] (spur, no output)
```

- **inputGain**: unity by default, used for signal-chain-level input trim.
- **EQ stage**: chain of `BiquadFilterNode`s, hot-swappable.
- **compressor/limiter**: single `DynamicsCompressorNode`, bypassable.
- **outputGain**: master volume (if signal-chain volume is used instead of media-element volume).
- **analyserTap**: `AnalyserNode` connected as a spur from `outputGain` for visualizer + skip-silences.

All connections are made once. Enabling/disabling a stage means connecting/disconnecting within the chain (or setting a bypass GainNode to 1.0 / routing around the stage).

### Ownership rules

1. **Only `signal-chain.ts` calls `connect()` or `disconnect()` on the MESA or any processing node.**
2. Plugins request effects by calling signal-chain API methods (e.g., `signalChain.setEQ(filters)`, `signalChain.enableCompressor(params)`).
3. The signal chain emits its own events or provides direct references for read-only consumers (visualizer, skip-silences).
4. The `peard:audio-can-play` event continues to exist for backward compatibility but carries the signal chain instance rather than raw `audioSource`/`audioContext`.

---

## 5 — Source Boundaries, Modules, and Files to Create/Change

### New files

| File | Purpose |
|------|---------|
| `src/lacquer/signal-chain.ts` | Signal chain owner: creates and manages the graph, exposes API for plugins |
| `src/lacquer/signal-chain-types.ts` | TypeScript interfaces for chain stages, config, events |

### Files to modify

| File | Change |
|------|--------|
| `src/renderer.ts` | Replace direct `audioSource.connect(ctx.destination)` with `signalChain.init(audioSource, audioContext)`. Update the `peard:audio-can-play` event payload. |
| `src/reset.d.ts` | Update the `Compressor` interface (or replace it) to reflect the new event payload. |
| `src/plugins/audio-compressor.ts` | Convert from direct graph manipulation to `signalChain.enableCompressor(params)` / `signalChain.disableCompressor()`. |
| `src/plugins/equalizer/index.ts` | Convert from direct graph manipulation to `signalChain.setEQ(filters)` / `signalChain.clearEQ()`. Fix `once: true` bug. |
| `src/plugins/visualizer/index.ts` | Obtain `AnalyserNode` or tap from signal chain instead of connecting `source → GainNode`. |
| `src/plugins/skip-silences/renderer.ts` | Use shared `AnalyserNode` from signal chain. Fix looper accumulation (cancellation token per track). |
| `src/plugins/custom-output-device/renderer.ts` | No graph changes needed — `setSinkId` operates on the context. Unchanged or minimal. |

### Files unchanged

| File | Reason |
|------|--------|
| `src/plugins/precise-volume/` | Works via YT API, not WebAudio graph. |
| `src/plugins/exponential-volume/` | Prototype override on HTMLMediaElement — orthogonal to graph. |
| `src/plugins/playback-speed/` | Sets `playbackRate` on the element — no graph involvement. |
| `src/plugins/crossfade/` | Uses its own Howler audio path — remains separate (see §14). |
| `src/plugins/downloader/` | No audio graph involvement. |
| `src/preload.ts`, `src/loader/` | No audio graph involvement. |

---

## 6 — Original/Bypass Stays Neutral

"Original" preset means no DSP processing: the signal path is `MESA → ctx.destination` with no intermediate nodes.

Implementation: the signal chain always builds the full node graph, but each stage has a bypass `GainNode` pair:

```
input ──► [bypassGain=1] ──► output    (bypassed: stage disconnected, bypass gain routes around it)
      └──► [stage nodes] ──►┘            (active: bypass gain=0, stage connected)
```

Or more simply: for each stage, toggling enable/disable reconnects the chain to skip or include the stage's nodes. All gain values remain at unity when bypassed. No volume jump occurs because the graph is rewired, not muted/unmuted.

When all stages are bypassed, the topology reduces to: `MESA → inputGain(1.0) → outputGain(1.0) → ctx.destination`. The analyser tap remains connected (it's read-only and inaudible). The result is bit-identical to a direct `MESA → destination` connection, with negligible latency from two unity-gain nodes.

---

## 7 — Speed / Pitch Interaction

### Current state
- `playbackRate` is set directly on the `<video>` element.
- `preservesPitch` is never set (defaults to `true` in Chromium).
- No WebAudio-level pitch shifting exists.

### Recommended approach

**Pitch-preserving speed (current default):** Keep `video.playbackRate` + `preservesPitch = true`. This is Chromium's built-in WSOLA time-stretch and is solid.

**Varispeed (speed + pitch coupled):** Set `preservesPitch = false` on the `<video>` element. Achievable with a single property toggle. Reliable across Electron versions.

**Independent pitch shifting (semitone control):** This requires either:
- (a) A WebAudio `AudioWorklet` or `ScriptProcessorNode` running a phase-vocoder — complex, CPU-intensive, and fragile with the MESA because Chromium's decode rate is driven by `playbackRate`. The MESA outputs at the rate the element plays, so pitching the output independently of speed is fighting the browser.
- (b) A pre-decoded `AudioBuffer` approach — not viable for streaming YouTube content.

**Recommendation:** Offer speed + pitch-preserve (default) and varispeed as toggles. Do not implement independent semitone shifting — it requires unreliable workarounds in the WebAudio / MediaElement model and would add substantial CPU overhead. If a future Chromium version exposes a `detune` property on `HTMLMediaElement` or an `AudioWorklet`-based pitch node becomes standard, it can be revisited then.

---

## 8 — Reverb Recommendation

WebAudio `ConvolverNode` is the correct primitive. It requires an impulse response (IR) `AudioBuffer`.

**No-runtime-remote-asset approach:** Bundle a small set of IR `.wav` files (each 50-200 KB, 1-3 seconds) as static assets in `src/lacquer/assets/ir/`. Load them via `fetch` from the local file system (Electron allows this) and decode with `ctx.decodeAudioData()`.

Three IRs are sufficient for a music player:
- Small room (~0.8s RT60)
- Medium hall (~1.6s RT60)
- Large cathedral / ambient (~3s RT60)

The `ConvolverNode` is placed after EQ and before the compressor/limiter:

```
EQ → [dry/wet mixer] → compressor
       └─► ConvolverNode ─►┘
```

A dry/wet `GainNode` pair controls reverb mix. The convolver is bypassed by disconnecting it and routing dry at unity.

**Cost:** ConvolverNode is GPU-accelerated in Chromium. A 2-second stereo IR at 48 kHz is ~384 KB of float32 data — negligible memory, and the convolution runs on a dedicated audio thread.

---

## 9 — Stereo Width Recommendation

True stereo-width control without artifacts requires:
- Mid/side processing: split to M = (L+R)/2, S = (L-R)/2, scale S, recombine.
- This requires a `ChannelSplitterNode` (2 channels) → two `GainNode`s (mid, side) → `ChannelMergerNode`.

WebAudio provides `ChannelSplitterNode` and `ChannelMergerNode` natively. The M/S matrix can be built from gain nodes:
```
splitter[0] (L) ──► gainM (+0.5) ──► merger[0] (L)
                 ──► gainS (+0.5) ──►
splitter[1] (R) ──► gainM (+0.5) ──► merger[0]
                 ──► gainS (-0.5) ──► merger[1] (R)
... mid/side scaled, then recombined
```

**Recommendation:** Implement as a stage in the signal chain between EQ and reverb. "Width = 100%" is neutral (bypass), "Width = 0%" is mono, "Width = 200%" is exaggerated stereo. The node cost is four `GainNode`s plus splitter/merger — trivial.

Placement in chain: `EQ → stereo-width → reverb → compressor → output`.

---

## 10 — EQ Strategy: Reuse / Integrate / Supersede

The existing equalizer plugin is minimal: one preset ("bass-booster"), one `lowshelf` filter, no UI for parameter adjustment, `{ once: true }` listener bug, parallel routing that doubles the signal.

**Recommendation: supersede.** The signal chain owns the EQ stage. The legacy `equalizer` plugin's config format (`FilterConfig[]` + preset flags) is read by the signal chain for backward compatibility. The signal chain creates `BiquadFilterNode`s in series (not parallel-to-destination), applies them correctly, and handles per-track re-application.

The legacy equalizer plugin is retained as a config/menu shell that calls `signalChain.setEQ(filters)` rather than manipulating the graph directly. Its renderer code reduces to a thin adapter.

Future work (not in this ticket) can expand the EQ UI to a proper parametric equalizer.

---

## 11 — Compressor / Limiter Strategy

The existing `audio-compressor.ts` creates a `DynamicsCompressorNode` with fixed parameters (threshold: -50, ratio: 12, knee: 40, attack: 0, release: 0.25). These are aggressive settings — ratio 12:1 with threshold at -50 dBFS is effectively a brickwall limiter on everything above near-silence.

**Recommendation:** The signal chain owns the `DynamicsCompressorNode`. It is placed at the end of the processing chain, just before `outputGain`, acting as a limiter to prevent clipping from EQ/reverb/width boosts.

Default parameters should be gentler for general listening:
- Threshold: -24 dBFS
- Ratio: 4:1
- Knee: 10 dB
- Attack: 3 ms
- Release: 100 ms

The legacy plugin becomes a config/menu adapter. Its current aggressive preset can be offered as a "heavy compression" option.

A hard limiter (threshold: -1 dBFS, ratio: 20:1) should always be the last node before destination to prevent clipping regardless of other settings. This can be a second `DynamicsCompressorNode` with fixed parameters, always active, not user-configurable.

---

## 12 — Analyzer / Visualizer Tap

The signal chain provides a single `AnalyserNode` connected as a spur (no output to destination) from a point after all processing (post-compressor, pre-destination):

```
compressor → outputGain → ctx.destination
                  └──► analyserNode (spur)
```

The signal chain exposes `getAnalyserNode(): AnalyserNode` for consumers:
- **Visualizer plugin:** reads frequency/time-domain data for rendering. No longer creates its own `GainNode(1.25)` — if gain is needed for visual scaling, it belongs in the visualizer's rendering logic, not in the audio graph.
- **Skip-silences plugin:** reads frequency data for silence detection. Shares the same `AnalyserNode`.

The `AnalyserNode` is created once and reused across tracks. Its `fftSize` should be set to 2048 (sufficient for both visualization and silence detection; skip-silences currently uses 512, but a larger FFT just gives better frequency resolution — the time-domain analysis skip-silences needs is unaffected).

---

## 13 — Lifecycle / Cleanup Rules

### Source uniqueness
The `MediaElementAudioSourceNode` (MESA) can only be created once per `<video>` element per `AudioContext`. Attempting a second `createMediaElementSource()` on the same element throws. The current code creates exactly one in `renderer.ts`. The signal chain inherits this — it must never re-create the MESA.

### Context lifetime
The `AudioContext` lives for the entire renderer process. It is never closed. This is correct — closing and re-creating contexts causes audible glitches and complicates node management.

### Track change
On track change (`loadstart` → `canplaythrough`), the signal chain:
1. Does **not** disconnect or recreate the MESA (it remains connected to the same `<video>` element, which simply changes `src`).
2. Does **not** recreate processing nodes — the chain is stable across tracks.
3. Dispatches `peard:audio-can-play` (for compatibility) so consumers can reinitialize per-track state (e.g., skip-silences resets its `hasAudioStarted` flag).
4. Cancels any prior per-track tasks (skip-silences looper) before signaling the new track.

### Plugin disable at runtime
When a plugin is disabled via `forceUnloadRendererPlugin()`:
1. The plugin's `stop()` is called.
2. The plugin must call `signalChain.disableStage('compressor')` (or equivalent) in its `stop()`.
3. The signal chain bypasses the disabled stage — no dangling nodes.

### Plugin enable at runtime
1. `forceLoadRendererPlugin()` calls the plugin's `start()`.
2. The plugin calls `signalChain.enableCompressor(params)` in its renderer or `onPlayerApiReady`.
3. The signal chain inserts/reconnects the stage.

### Reload
On `window.reload()` or navigation, the entire renderer context is destroyed by Electron. The `AudioContext` and all nodes are garbage-collected. No explicit teardown is needed.

### Close
Same as reload — Electron process termination handles cleanup.

### Rules for plugin authors

1. **Never call `audioSource.connect()` or `audioSource.disconnect()` directly.** Use the signal chain API.
2. **Never create an `AudioContext`.** Use the one provided by the signal chain.
3. **Analysis-only consumers** use `signalChain.getAnalyserNode()`.
4. **Per-track polling** (setTimeout loops, requestAnimationFrame loops) must use an `AbortController` or equivalent cancellation token, stored on the signal chain and reset on each track change.
5. **Volume control** continues via `playerApi.setVolume()` or `video.volume` — it is orthogonal to the signal chain (media-element volume attenuates the MESA output before it enters the graph).

---

## 14 — Compatibility Policy for Current Audio Plugins

| Plugin | Compatibility approach |
|--------|----------------------|
| **audio-compressor** | Becomes a config/menu adapter. Calls `signalChain.setCompressor(params)` / `signalChain.bypassCompressor()`. Existing config schema preserved. |
| **equalizer** | Becomes a config/menu adapter. Calls `signalChain.setEQ(filters)`. Existing `FilterConfig[]` and preset flags preserved. `once:true` bug is eliminated. |
| **visualizer** | Obtains `AnalyserNode` from signal chain instead of creating its own tap. Minor refactor of `createVisualizer()` to use `signalChain.getAnalyserNode()`. Butterchurn/wave/vudio constructors receive the analyser directly. |
| **skip-silences** | Uses shared `AnalyserNode` from signal chain. Looper refactored to use cancellation. |
| **custom-output-device** | Unchanged — calls `ctx.setSinkId()`, no graph involvement. |
| **precise-volume** | Unchanged — operates on media-element volume via YT API. |
| **exponential-volume** | Unchanged — prototype override on `HTMLMediaElement.volume`. |
| **playback-speed** | Unchanged — sets `video.playbackRate`. Signal chain is unaffected by playback rate (MESA output follows the element's rate automatically). |
| **crossfade** | Remains a separate audio path (Howler). The signal chain does not attempt to control crossfade's secondary audio. Long-term, crossfade could be reimplemented using a second MESA + the signal chain, but that requires a second `<audio>` element managed by the chain. Out of scope for the initial signal chain. |

Plugins not listed above (downloader, ambient-mode, album-color-theme, discord, shortcuts, etc.) have no audio graph involvement and are unaffected.

---

## 15 — Testing Matrix

### Configurations to test

| # | Configuration | What to verify |
|---|--------------|----------------|
| 1 | All audio plugins disabled ("Original") | Audio plays through `MESA → inputGain → outputGain → destination`. No processing artifacts, no volume change vs. stock YTM. |
| 2 | Compressor only | Compression applied. Volume normalized per compressor params. No double-routing. |
| 3 | EQ only (bass-booster) | Bass boost audible. No signal doubling (compare volume level to "Original"). |
| 4 | Compressor + EQ | Both active in series. Signal not doubled. EQ → compressor ordering. |
| 5 | Visualizer only | Visual renders. Audio output identical to "Original" (tap is silent spur). |
| 6 | Skip-silences only | Silences skipped. No stacking of loopers across tracks. |
| 7 | All graph plugins enabled | Compressor + EQ + visualizer + skip-silences. No conflicts. Correct ordering. |
| 8 | Custom-output-device | Output routed to selected device. Other processing unaffected. |
| 9 | Precise-volume | Volume steps work. Saved volume restored on restart. |
| 10 | Exponential-volume | Volume curve is cubic. Low volumes audibly quieter than linear. |
| 11 | Playback-speed at 0.5×, 1×, 2× | Speed changes. Pitch preserved (default). No audio graph disruption. |
| 12 | Crossfade | Transition between tracks smooth. No conflict with signal chain. |

### Scenarios to test per configuration

| Scenario | What to verify |
|----------|---------------|
| Track change (next, previous, queue jump) | No audio glitch, no volume jump, processing persists |
| Seek (drag progress bar) | No audio dropout, no state corruption |
| Pause / resume | No click, no volume change on resume |
| Enable plugin mid-playback | Processing activates without restart (where `restartNeeded: false`). No doubled signal. |
| Disable plugin mid-playback | Processing deactivates cleanly. Volume returns to "Original" level. |
| Reload (`Ctrl+Shift+R`) | Full chain re-initializes cleanly. No orphaned contexts. |
| Extended playback (50+ tracks) | No memory growth from accumulated nodes, loopers, or observers. |
| Album art change (for album-color-theme interaction) | No interference with audio processing |

---

## 16 — Performance Considerations for Windows ThinkPad

### WebAudio processing cost

The entire signal chain runs on Chromium's audio render thread (a dedicated real-time thread). On the target ThinkPad:

- **BiquadFilterNode**: near-zero cost per node. 10 filters in series is negligible.
- **DynamicsCompressorNode**: lightweight built-in, runs at block rate (128 samples).
- **ConvolverNode** (future reverb): the most expensive node. A 2-second stereo IR at 48 kHz costs ~2-3% CPU on integrated graphics. Acceptable.
- **AnalyserNode**: FFT is computed on read (lazy). One analyser serving both visualizer and skip-silences is cheaper than two separate analysers.
- **GainNode**: essentially free (multiplication per sample).

### Skip-silences looper

The current 2ms `setTimeout` polling is the biggest performance concern. At 2ms intervals, `getFloatFrequencyData()` triggers a 512-point FFT 500 times per second. The FFT itself is fast, but the `setTimeout` overhead and main-thread scheduling cost is significant for a background task.

**Recommendation:** Increase the polling interval to 50-100ms (silence detection does not need sub-10ms resolution). Use a single `requestAnimationFrame` loop shared with the visualizer, or use `setInterval` with cancellation.

### Visualizer rendering

- Butterchurn uses `requestAnimationFrame` — correct, GPU-composited.
- Vudio creates a `captureStream()` from the video element. `captureStream()` can be expensive on some GPU drivers. Consider using the `AnalyserNode` frequency data directly instead.
- The 1.25× gain on the visualizer's spur node is a wasted multiplication since the data is only used for visual rendering. Move the scaling to the rendering code.

### Memory

- Each `AudioNode` is lightweight (~a few KB). The signal chain will use ~10-15 nodes — negligible.
- The primary memory concern is the Howler.js audio element for crossfade, which loads a full audio stream in parallel. This is unavoidable with the current crossfade architecture.

---

## 17 — Browser / Electron / WebAudio Constraints

### MediaElementAudioSourceNode is single-owner

A `<video>` or `<audio>` element can only be passed to `createMediaElementSource()` once per `AudioContext`. A second call throws `InvalidStateError`. This is why the MESA is created once in `renderer.ts` and shared. The signal chain must never attempt to recreate it.

### MESA follows element playback rate

When `video.playbackRate` changes, the MESA output rate changes accordingly. WebAudio processing (filters, compressor) operates on the rate-adjusted audio. This means:
- At 2× speed, the audio samples arrive at double rate. The `AudioContext` sample rate (typically 48 kHz) is unchanged — the MESA resamples internally. Processing is correct.
- `preservesPitch = true` activates Chromium's WSOLA time-stretcher *before* the MESA output. The signal chain sees pitch-preserved audio.

### CORS and MESA

If the `<video>` element loads a cross-origin source without CORS headers, `createMediaElementSource()` works, but `AnalyserNode.getFloatFrequencyData()` returns all zeros (tainted origin). YouTube Music streams are same-origin (loaded via Electron's webContents), so this is not a concern.

### AudioContext auto-suspend

Chromium suspends `AudioContext` instances that haven't been resumed by a user gesture. In Electron, this is typically not an issue because `--autoplay-policy=no-user-gesture-required` is set. However, if the context is suspended (e.g., after a long idle), audio processing stops until `ctx.resume()` is called. The signal chain should call `ctx.resume()` defensively on each track start.

### No `AudioWorklet` in sandboxed renderer (potential issue)

If Electron's renderer is sandboxed (`sandbox: true` in `BrowserWindow` options), `AudioWorklet.addModule()` may fail because it requires loading a JS file from the renderer's origin. The current codebase does not use `AudioWorklet`. If future effects (pitch shifting, custom DSP) need it, the sandbox policy must be verified.

### ConvolverNode and large IRs

`ConvolverNode` uses a frequency-domain partitioned convolution algorithm. For IR durations > ~5 seconds, latency and CPU cost increase noticeably. Keep bundled IRs under 3 seconds.

### setSinkId availability

`AudioContext.setSinkId()` is available in Chromium 110+. Electron versions used by Pear/Lacquer should be checked, but this is the current approach and presumably working.

### DynamicsCompressorNode limitations

The WebAudio `DynamicsCompressorNode` has fixed behavior: the attack/release ramps are not perfectly linear, the knee curve is implementation-defined, and there is no sidechain input. For a music player limiter, this is sufficient. A more precise limiter would require `AudioWorklet`, which is not warranted for this use case.

---

## Recommended Architecture (≤ 12 Bullets)

1. **Single owner:** `src/lacquer/signal-chain.ts` owns the entire WebAudio graph. No plugin directly calls `connect()` or `disconnect()` on the MESA or any processing node.

2. **One context, one MESA, one graph:** Created once in `renderer.ts`, passed to the signal chain. Never recreated.

3. **Serial chain:** `MESA → inputGain → EQ(series) → stereoWidth → reverb(dry/wet) → compressor → limiter → outputGain → destination`, with an `AnalyserNode` spur from `outputGain`.

4. **Bypass per stage:** Each stage can be individually bypassed by reconnecting around it. "Original" means all stages bypassed — two unity-gain nodes, bit-transparent.

5. **Shared analyser tap:** One `AnalyserNode` serves visualizer and skip-silences. No plugin creates its own analysis nodes.

6. **Plugin adapters:** Existing audio plugins (compressor, equalizer, visualizer, skip-silences) become thin config/menu adapters that call signal-chain methods.

7. **Speed / pitch via element properties:** `playbackRate` and `preservesPitch` stay on the `<video>` element. No WebAudio pitch shifting — too fragile for the MESA model.

8. **Bundled IRs for reverb:** 2-3 impulse response files shipped as static assets. No runtime network fetch.

9. **Cancellation tokens for per-track work:** Skip-silences and any future polling loop must use an `AbortController` reset on each track change, preventing looper accumulation.

10. **Volume remains on the element:** `precise-volume` and `exponential-volume` continue to operate on `video.volume` / `playerApi.setVolume()`. The signal chain does not duplicate volume control.

11. **Crossfade stays separate:** Crossfade's Howler-based second audio path is orthogonal. The signal chain manages only the primary `<video>` element's audio.

12. **Hard limiter always on:** A final `DynamicsCompressorNode` (threshold: -1 dBFS, ratio: 20:1) before destination prevents clipping from any combination of EQ boost, reverb, or width processing. Not user-configurable, not bypassable.
