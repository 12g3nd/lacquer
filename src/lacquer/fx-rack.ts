/*
 * Lacquer — the FX rack (Stage C, C1).
 *
 * Stage A/B shipped six preset buttons in a grey box that used not one Lacquer
 * token and exposed none of the parameters the Signal Chain implements. This is
 * the real rack: an analog-hi-fi instrument panel (DESIGN.md §1 reference
 * vocabulary) in Blueglass, with machined controls and Instrument-voice
 * readouts, surfacing speed + pitch mode, reverb wet + room character, stereo
 * width, an EQ summary and a master bypass, plus a cheap output meter off the
 * shared analyser tap that only runs while the rack is open.
 *
 * The Signal Chain's preset switch is authoritative and immediate: selecting a
 * preset calls `signalChain.setPreset` and clears any parameter overrides. The
 * per-parameter controls then ride on top of the active preset through the
 * chain's existing public setters (`setSpeed`, `setReverb`, `setWidth`); a
 * moved parameter shows a Solar "modified" dot on its preset. Preset +
 * overrides persist in `localStorage`.
 *
 * The popover has real focus management: focus moves into the rack on open, Tab
 * is trapped while it is open, Escape closes it and returns focus to the FX
 * button, and a pointer-down outside dismisses it.
 */

import { whenElement } from './dom';
import { signalChain } from './signal-chain';

import type { SignalChainPreset } from './signal-chain-types';

type RoomKey = 'off' | 'small-room' | 'medium-hall' | 'large-cathedral';

interface Overrides {
  speed?: number;
  pitchLock?: boolean;
  reverbWet?: number;
  room?: RoomKey;
  width?: number;
}

interface PresetParams {
  speed: number;
  pitchLock: boolean;
  reverbWet: number;
  room: RoomKey;
  width: number;
  eqBands: number;
}

interface PersistedState {
  preset: SignalChainPreset;
  overrides: Overrides;
}

const PRESETS: SignalChainPreset[] = [
  'Original',
  'Sped + Reverb',
  'Slowed + Reverb',
  'Dream',
  'Tape',
  'Night',
];

/* The stored value of each parameter per preset — the display model, mirroring
 * `signal-chain.ts`'s `setPreset` switch, so the rack can show what a preset
 * does and detect when a control has been moved off it. */
const PRESET_PARAMS: Record<SignalChainPreset, PresetParams> = {
  'Original': {
    speed: 1,
    pitchLock: true,
    reverbWet: 0,
    room: 'off',
    width: 1,
    eqBands: 0,
  },
  'Sped + Reverb': {
    speed: 1.18,
    pitchLock: false,
    reverbWet: 0.15,
    room: 'medium-hall',
    width: 1.2,
    eqBands: 0,
  },
  'Slowed + Reverb': {
    speed: 0.85,
    pitchLock: false,
    reverbWet: 0.25,
    room: 'large-cathedral',
    width: 1.15,
    eqBands: 1,
  },
  'Dream': {
    speed: 0.95,
    pitchLock: true,
    reverbWet: 0.2,
    room: 'medium-hall',
    width: 1.3,
    eqBands: 2,
  },
  'Tape': {
    speed: 1,
    pitchLock: true,
    reverbWet: 0.05,
    room: 'small-room',
    width: 0.95,
    eqBands: 2,
  },
  'Night': {
    speed: 1,
    pitchLock: true,
    reverbWet: 0.1,
    room: 'small-room',
    width: 0.9,
    eqBands: 1,
  },
};

const ROOM_LABEL: Record<RoomKey, string> = {
  'off': 'Off',
  'small-room': 'Room',
  'medium-hall': 'Hall',
  'large-cathedral': 'Cath',
};
const ROOM_ORDER: RoomKey[] = [
  'off',
  'small-room',
  'medium-hall',
  'large-cathedral',
];

const STORAGE_KEY = 'lacquer.fx';
const LEGACY_PRESET_KEY = 'lacquer.fxPreset';
const METER_SEGMENTS = 7;

const isPreset = (value: unknown): value is SignalChainPreset =>
  typeof value === 'string' && PRESETS.includes(value as SignalChainPreset);

const loadState = (): PersistedState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const stored = parsed.overrides;
      if (isPreset(parsed.preset)) {
        return {
          preset: parsed.preset,
          overrides: stored && typeof stored === 'object' ? stored : {},
        };
      }
    }
  } catch {
    // Fall through to the legacy key / default.
  }
  const legacy = window.localStorage.getItem(LEGACY_PRESET_KEY);
  return { preset: isPreset(legacy) ? legacy : 'Original', overrides: {} };
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const formatSpeed = (rate: number) => `${rate.toFixed(2)}×`;
const formatWet = (wet: number) => `${Math.round(wet * 100)}%`;
const formatWidth = (width: number) => width.toFixed(2);
const formatEq = (bands: number) =>
  bands === 0 ? 'Flat' : `${bands} band${bands === 1 ? '' : 's'}`;

export const initFXRack = () => {
  if (document.getElementById('lacquer-fx-rack')) return;

  const state = loadState();
  let preset = state.preset;
  let overrides: Overrides = { ...state.overrides };
  let lastNonOriginal: SignalChainPreset =
    preset === 'Original' ? 'Sped + Reverb' : preset;
  let open = false;

  const effective = (): PresetParams => {
    const base = PRESET_PARAMS[preset];
    return {
      speed: overrides.speed ?? base.speed,
      pitchLock: overrides.pitchLock ?? base.pitchLock,
      reverbWet: overrides.reverbWet ?? base.reverbWet,
      room: overrides.room ?? base.room,
      width: overrides.width ?? base.width,
      eqBands: base.eqBands,
    };
  };

  const hasOverrides = () =>
    Object.values(overrides).some((value) => value !== undefined);

  const persist = () => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ preset, overrides } satisfies PersistedState),
      );
      window.localStorage.setItem(LEGACY_PRESET_KEY, preset);
    } catch {
      // Storage disabled — the rack still works for this session.
    }
  };

  /* Push the current effective parameters into the Signal Chain, on top of
   * whatever preset is active. Any override engages the limiter for clip
   * safety even when the preset (Original) would leave it bypassed. */
  const applyOverrides = () => {
    const p = effective();
    signalChain.setSpeed(p.speed, p.pitchLock);
    signalChain.setReverb({
      wet: p.reverbWet,
      ir: p.room === 'off' ? null : p.room,
    });
    signalChain.setWidth(p.width);
    if (hasOverrides()) signalChain.setLimiter(true);
  };

  const notifyPresetChanged = () => {
    document.dispatchEvent(
      new CustomEvent('lacquer:preset-changed', { detail: { preset } }),
    );
  };

  const selectPreset = (next: SignalChainPreset) => {
    preset = next;
    overrides = {};
    if (next !== 'Original') lastNonOriginal = next;
    signalChain.setPreset(next);
    persist();
    render();
    notifyPresetChanged();
  };

  // ── FX affordance in the transport ───────────────────────────────
  const fxButton = el('button', undefined, 'FX');
  fxButton.id = 'lacquer-fx-button';
  fxButton.type = 'button';
  fxButton.setAttribute('aria-haspopup', 'dialog');
  fxButton.setAttribute('aria-expanded', 'false');
  fxButton.setAttribute('aria-controls', 'lacquer-fx-rack');

  // ── The panel ────────────────────────────────────────────────────
  const rack = el('div');
  rack.id = 'lacquer-fx-rack';
  rack.setAttribute('role', 'dialog');
  rack.setAttribute('aria-label', 'Signal chain');
  rack.popover = 'manual';
  rack.hidden = true;
  rack.toggleAttribute('inert', true);

  const head = el('div', 'lq-fx-head');
  head.appendChild(el('h2', 'lq-fx-title', 'Signal Chain'));
  const meter = el('div', 'lq-fx-meter');
  meter.setAttribute('aria-hidden', 'true');
  const meterSegments: HTMLElement[] = [];
  for (let i = 0; i < METER_SEGMENTS; i += 1) {
    const seg = el('span', 'lq-fx-meter-seg');
    meterSegments.push(seg);
    meter.appendChild(seg);
  }
  head.appendChild(meter);
  rack.appendChild(head);

  const presetGrid = el('div', 'lq-fx-presets');
  presetGrid.setAttribute('role', 'group');
  presetGrid.setAttribute('aria-label', 'Presets');
  const presetButtons = new Map<SignalChainPreset, HTMLButtonElement>();
  for (const name of PRESETS) {
    const button = el('button', 'lq-fx-preset', name);
    button.type = 'button';
    button.addEventListener('click', () => selectPreset(name));
    presetButtons.set(name, button);
    presetGrid.appendChild(button);
  }
  rack.appendChild(presetGrid);

  const params = el('div', 'lq-fx-params');

  const makeRow = (label: string, seg = false) => {
    const row = el('div', 'lq-fx-row');
    if (seg) row.classList.add('lq-fx-row--seg');
    row.appendChild(el('span', 'lq-fx-label', label));
    return row;
  };

  const makeSlider = (
    min: number,
    max: number,
    step: number,
    ariaLabel: string,
    onInput: (value: number) => void,
  ) => {
    const input = el('input', 'lq-fx-slider');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute('aria-label', ariaLabel);
    input.addEventListener('input', () => {
      onInput(Number(input.value));
      applyOverrides();
      persist();
      render();
    });
    return input;
  };

  const setSliderFill = (input: HTMLInputElement) => {
    const min = Number(input.min);
    const max = Number(input.max);
    const pct = ((Number(input.value) - min) / (max - min)) * 100;
    input.style.setProperty('--lq-fx-fill', `${pct}%`);
  };

  const makeSegmented = <T>(
    ariaLabel: string,
    options: { value: T; label: string }[],
    onPick: (value: T) => void,
  ) => {
    const group = el('div', 'lq-fx-segmented');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', ariaLabel);
    const buttons = options.map(({ value, label }) => {
      const button = el('button', 'lq-fx-seg', label);
      button.type = 'button';
      button.addEventListener('click', () => {
        onPick(value);
        applyOverrides();
        persist();
        render();
      });
      group.appendChild(button);
      return { value, button };
    });
    return { group, buttons };
  };

  // Speed
  const speedRow = makeRow('Speed');
  const speedSlider = makeSlider(0.5, 1.5, 0.01, 'Playback speed', (value) => {
    overrides.speed = value;
  });
  const speedReadout = el('span', 'lq-fx-readout');
  speedRow.append(speedSlider, speedReadout);
  params.appendChild(speedRow);

  // Pitch mode
  const pitchRow = makeRow('Pitch', true);
  const pitchControl = el('div', 'lq-fx-pitch');
  const pitchSlider = makeSlider(0, 1, 1, 'Pitch mode', (value) => {
    overrides.pitchLock = value === 1;
  });
  pitchControl.append(
    el('span', 'lq-fx-pitch-end', 'Variable'),
    pitchSlider,
    el('span', 'lq-fx-pitch-end', 'Lock'),
  );
  pitchRow.appendChild(pitchControl);
  params.appendChild(pitchRow);

  // Reverb wet
  const reverbRow = makeRow('Reverb');
  const reverbSlider = makeSlider(0, 0.6, 0.01, 'Reverb amount', (value) => {
    overrides.reverbWet = value;
  });
  const reverbReadout = el('span', 'lq-fx-readout');
  reverbRow.append(reverbSlider, reverbReadout);
  params.appendChild(reverbRow);

  // Room character
  const roomRow = makeRow('Room', true);
  const room = makeSegmented<RoomKey>(
    'Room character',
    ROOM_ORDER.map((value) => ({ value, label: ROOM_LABEL[value] })),
    (value) => {
      overrides.room = value;
    },
  );
  roomRow.appendChild(room.group);
  params.appendChild(roomRow);

  // Width
  const widthRow = makeRow('Width');
  const widthSlider = makeSlider(0, 2, 0.05, 'Stereo width', (value) => {
    overrides.width = value;
  });
  const widthReadout = el('span', 'lq-fx-readout');
  widthRow.append(widthSlider, widthReadout);
  params.appendChild(widthRow);

  // EQ summary
  const eqRow = makeRow('EQ');
  const eqReadout = el('span', 'lq-fx-readout');
  eqReadout.setAttribute('data-muted', '');
  eqRow.append(el('span'), eqReadout);
  params.appendChild(eqRow);

  rack.appendChild(params);

  // Footer — master bypass
  const foot = el('div', 'lq-fx-foot');
  const bypassButton = el('button', 'lq-fx-bypass', 'Bypass');
  bypassButton.type = 'button';
  bypassButton.addEventListener('click', () => {
    selectPreset(preset === 'Original' ? lastNonOriginal : 'Original');
  });
  foot.appendChild(bypassButton);
  foot.appendChild(el('p', 'lq-fx-scope', 'Applies to every song'));
  rack.appendChild(foot);

  // ── Render ─────────────────────────────────────────────────────────
  function render() {
    const p = effective();
    const base = PRESET_PARAMS[preset];
    const modified = hasOverrides();

    for (const [name, button] of presetButtons) {
      button.setAttribute('aria-pressed', String(name === preset));
      button.toggleAttribute('data-modified', name === preset && modified);
    }

    if (document.activeElement !== speedSlider) {
      speedSlider.value = String(p.speed);
    }
    setSliderFill(speedSlider);
    speedReadout.textContent = formatSpeed(p.speed);

    pitchSlider.value = p.pitchLock ? '1' : '0';
    pitchSlider.setAttribute(
      'aria-valuetext',
      p.pitchLock ? 'Lock' : 'Variable',
    );
    setSliderFill(pitchSlider);

    if (document.activeElement !== reverbSlider) {
      reverbSlider.value = String(p.reverbWet);
    }
    setSliderFill(reverbSlider);
    reverbReadout.textContent = formatWet(p.reverbWet);
    reverbReadout.toggleAttribute('data-muted', p.reverbWet === 0);

    for (const { value, button } of room.buttons) {
      button.setAttribute('aria-pressed', String(value === p.room));
    }

    if (document.activeElement !== widthSlider) {
      widthSlider.value = String(p.width);
    }
    setSliderFill(widthSlider);
    widthReadout.textContent = formatWidth(p.width);

    eqReadout.textContent = formatEq(base.eqBands);
    bypassButton.setAttribute('aria-pressed', String(preset === 'Original'));
    fxButton.toggleAttribute(
      'data-lacquer-fx-active',
      preset !== 'Original' || modified,
    );
  }

  // ── Output meter — rAF only while the rack is open ─────────────────
  let meterFrame = 0;
  let meterBuffer: Uint8Array<ArrayBuffer> | null = null;
  const stopMeter = () => {
    if (meterFrame) cancelAnimationFrame(meterFrame);
    meterFrame = 0;
    for (const seg of meterSegments) {
      seg.removeAttribute('data-lit');
      seg.removeAttribute('data-peak');
    }
  };
  const runMeter = () => {
    let analyser: AnalyserNode | null;
    try {
      analyser = signalChain.getAnalyserNode();
    } catch {
      analyser = null;
    }
    if (!analyser) {
      meter.hidden = true;
      return;
    }
    const node = analyser;
    if (!meterBuffer || meterBuffer.length !== node.fftSize) {
      meterBuffer = new Uint8Array(node.fftSize);
    }
    const buffer = meterBuffer;
    const tick = () => {
      node.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = (buffer[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buffer.length);
      const level = Math.min(1, (rms * 3.2) ** 0.6);
      const lit = Math.round(level * METER_SEGMENTS);
      meterSegments.forEach((seg, index) => {
        seg.toggleAttribute('data-lit', index < lit);
        seg.toggleAttribute(
          'data-peak',
          index >= METER_SEGMENTS - 1 && lit > index,
        );
      });
      meterFrame = requestAnimationFrame(tick);
    };
    tick();
  };

  // ── Open / close + focus management ───────────────────────────────
  const focusables = (): HTMLElement[] => [
    ...rack.querySelectorAll<HTMLElement>('button, input'),
  ];

  const setOpen = (next?: boolean) => {
    const want = next ?? !open;
    if (want === open) return;
    open = want;
    rack.hidden = !open;
    rack.toggleAttribute('inert', !open);
    fxButton.setAttribute('aria-expanded', String(open));
    if (open) {
      rack.showPopover();
      render();
      runMeter();
      focusables()[0]?.focus();
    } else {
      rack.hidePopover();
      stopMeter();
      fxButton.focus();
    }
  };

  rack.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  fxButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!open) return;
    const target = event.target as Node;
    if (!rack.contains(target) && target !== fxButton) setOpen(false);
  });

  // A preset changed elsewhere (context menu, shortcut IPC): sync the model and
  // UI, but do not re-apply — the dispatcher already called the chain.
  document.addEventListener('lacquer:preset-changed', ((
    event: CustomEvent<{ preset: string }>,
  ) => {
    const next = event.detail.preset;
    if (isPreset(next) && next !== preset) {
      preset = next;
      overrides = {};
      if (next !== 'Original') lastNonOriginal = next;
      persist();
    }
    render();
  }) as EventListener);

  // ── Mount + restore ──────────────────────────────────────────────
  whenElement('ytmusic-player-bar .right-controls-buttons').then(
    (rightControls) => {
      if (document.getElementById('lacquer-fx-wrapper')) return;
      const wrapper = el('div');
      wrapper.id = 'lacquer-fx-wrapper';
      wrapper.append(fxButton, rack);
      rightControls.prepend(wrapper);
      render();
    },
  );

  // Restore the saved preset + overrides. `signalChain.init()` has already run
  // and set Original; re-assert the stored state on top of it.
  if (preset !== 'Original') signalChain.setPreset(preset);
  if (hasOverrides()) applyOverrides();
  notifyPresetChanged();
};

/**
 * Toggle (or force) the FX rack open state. Used by the context menu's "FX…"
 * item and the `peard:fx-rack-toggle` shortcut IPC.
 */
export const setFXRackOpen = (open?: boolean) => {
  const rack = document.getElementById('lacquer-fx-rack');
  const button = document.getElementById('lacquer-fx-button');
  if (!rack || !button) return;
  const isOpen = !rack.hasAttribute('hidden');
  if ((open ?? !isOpen) !== isOpen) button.click();
};
