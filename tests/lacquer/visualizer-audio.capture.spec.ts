import { expect, test, type Page } from '@playwright/test';

import {
  attachToLacquer,
  capture,
  isSignedIn,
  settle,
  showPlayer,
} from './harness';

type Connection = {
  sourceId: number;
  source: string;
  targetId: number;
  target: string;
  toDestination: boolean;
  active: boolean;
};

type AuditState = {
  connections: Connection[];
  ids: WeakMap<object, number>;
  nodes: Map<number, AudioNode>;
  audioReadyListeners: Set<EventListenerOrEventListenerObject>;
  playerObservers: Set<ResizeObserver>;
  nextId: number;
};

type PlayerApi = {
  getVolume(): number;
  setVolume(value: number): void;
};

const installAudioAudit = (page: Page) =>
  page.addInitScript(() => {
    const audit: AuditState = {
      connections: [],
      ids: new WeakMap(),
      nodes: new Map(),
      audioReadyListeners: new Set(),
      playerObservers: new Set(),
      nextId: 1,
    };
    const idFor = (node: AudioNode) => {
      let id = audit.ids.get(node);
      if (!id) {
        id = audit.nextId++;
        audit.ids.set(node, id);
        audit.nodes.set(id, node);
      }
      return id;
    };

    const originalConnect = AudioNode.prototype.connect;
    Object.defineProperty(AudioNode.prototype, 'connect', {
      configurable: true,
      writable: true,
      value: function (this: AudioNode, ...args: unknown[]) {
        const target = args[0] as AudioNode;
        audit.connections.push({
          sourceId: idFor(this),
          source: this.constructor.name,
          targetId: idFor(target),
          target: target.constructor.name,
          toDestination: target === this.context.destination,
          active: true,
        });
        return Reflect.apply(originalConnect, this, args);
      },
    });

    const originalDisconnect = AudioNode.prototype.disconnect;
    Object.defineProperty(AudioNode.prototype, 'disconnect', {
      configurable: true,
      writable: true,
      value: function (this: AudioNode, ...args: unknown[]) {
        const sourceId = idFor(this);
        const target = args[0];
        const targetId = target instanceof AudioNode ? idFor(target) : null;
        for (const edge of audit.connections) {
          if (
            edge.active &&
            edge.sourceId === sourceId &&
            (targetId === null || edge.targetId === targetId)
          ) {
            edge.active = false;
          }
        }
        return Reflect.apply(originalDisconnect, this, args);
      },
    });

    const originalAdd = Document.prototype.addEventListener;
    const originalRemove = Document.prototype.removeEventListener;
    Document.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (type === 'peard:audio-can-play' && listener) {
        audit.audioReadyListeners.add(listener);
      }
      return originalAdd.call(this, type, listener, options);
    };
    Document.prototype.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      if (type === 'peard:audio-can-play' && listener) {
        audit.audioReadyListeners.delete(listener);
      }
      return originalRemove.call(this, type, listener, options);
    };

    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeResizeObserver {
      private observesPlayer = false;

      observe(target: Element, options?: ResizeObserverOptions) {
        if (target.id === 'player') {
          this.observesPlayer = true;
          audit.playerObservers.add(this);
        }
        return super.observe(target, options);
      }

      disconnect() {
        if (this.observesPlayer) audit.playerObservers.delete(this);
        return super.disconnect();
      }
    };

    (
      window as typeof window & { __lqVisualizerAudit: AuditState }
    ).__lqVisualizerAudit = audit;
  });

const installAnimationFrameAudit = (page: Page) =>
  page.evaluate(() => {
    const animationFrames = new Map<number, FrameRequestCallback>();
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      let handle = 0;
      handle = originalRequestAnimationFrame.call(window, (timestamp) => {
        animationFrames.delete(handle);
        callback(timestamp);
      });
      animationFrames.set(handle, callback);
      return handle;
    };
    window.cancelAnimationFrame = (handle) => {
      animationFrames.delete(handle);
      originalCancelAnimationFrame.call(window, handle);
    };
    (
      window as typeof window & {
        __lqVisualizerAnimationFrames: Map<number, FrameRequestCallback>;
      }
    ).__lqVisualizerAnimationFrames = animationFrames;
  });

const ensurePlaying = async (page: Page) => {
  const hasTrack = await page.evaluate(
    () =>
      !!document
        .querySelector('ytmusic-player-bar .title')
        ?.textContent?.trim(),
  );
  if (!hasTrack) {
    const search = page.locator('ytmusic-search-box input').first();
    await search.click();
    await search.fill('IGOR Tyler the Creator');
    await page.keyboard.press('Enter');
    await settle(page, 3500);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      document
        .querySelector<HTMLElement>(
          'ytmusic-responsive-list-item-renderer #play-button, ' +
            'ytmusic-responsive-list-item-renderer ytmusic-play-button-renderer',
        )
        ?.click();
    });
    await settle(page, 4000);
  }
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video?.paused) void video.play();
  });
};

const graphState = (page: Page) =>
  page.evaluate(() => {
    const audit = (
      window as typeof window & { __lqVisualizerAudit: AuditState }
    ).__lqVisualizerAudit;
    const active = audit.connections.filter((edge) => edge.active);
    const sharedTap = active.find(
      (edge) => edge.source === 'GainNode' && edge.target === 'AnalyserNode',
    );
    const analyserId = sharedTap?.targetId;
    const analyser = analyserId
      ? (audit.nodes.get(analyserId) as AnalyserNode | undefined)
      : undefined;
    const animationFrames = (
      window as typeof window & {
        __lqVisualizerAnimationFrames?: Map<number, FrameRequestCallback>;
      }
    ).__lqVisualizerAnimationFrames;
    return {
      activeDestinationEdges: active.filter((edge) => edge.toDestination),
      directSourceDestinationEdges: active.filter(
        (edge) =>
          edge.toDestination && edge.source === 'MediaElementAudioSourceNode',
      ),
      mediaStreamAnalysisEdges: active.filter(
        (edge) => edge.source === 'MediaStreamAudioSourceNode',
      ),
      visualizerSpurs: active.filter(
        (edge) => edge.sourceId === analyserId && edge.target === 'GainNode',
      ),
      analyserFftSize: analyser?.fftSize,
      audioReadyListeners: audit.audioReadyListeners.size,
      playerObservers: audit.playerObservers.size,
      visualizerAnimationFrames: [...(animationFrames?.values() ?? [])].filter(
        (callback) => callback.toString().includes('.render('),
      ).length,
      canvasCount: document.querySelectorAll('#visualizer').length,
    };
  });

test('Visualizer uses one disposable post-chain tap across its lifecycle', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));

  const original = await page.evaluate(() => ({
    visualizer: window.mainConfig.plugins.getOptions('visualizer'),
    preciseVolume: window.mainConfig.plugins.getOptions('precise-volume'),
    volume: (
      document.querySelector('#movie_player') as unknown as PlayerApi | null
    )?.getVolume(),
  }));

  try {
    expect(await isSignedIn(page), 'attached session is signed out').toBe(true);
    await installAudioAudit(page);
    await page.evaluate((config) => {
      window.mainConfig.plugins.setOptions(
        'visualizer',
        { ...config, enabled: true, type: 'butterchurn' },
        [],
      );
    }, original.visualizer);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('ytmusic-player-bar', { timeout: 30_000 });
    await ensurePlaying(page);
    await showPlayer(page, 800);
    await page.waitForSelector('#visualizer', { timeout: 20_000 });
    await installAnimationFrameAudit(page);

    await page.evaluate(() => {
      const rack = document.getElementById('lacquer-fx-rack');
      if (rack?.hasAttribute('hidden')) {
        document.getElementById('lacquer-fx-button')?.click();
      }
    });
    await settle(page, 400);

    const preciseVolume = await page.evaluate(async () => {
      const player = document.querySelector(
        '#movie_player',
      ) as unknown as PlayerApi;
      const before = player.getVolume();
      const config = window.mainConfig.plugins.getOptions<{ steps: number }>(
        'precise-volume',
      );
      const step = Number(config.steps || 1);
      const direction = before > step ? 'ArrowDown' : 'ArrowUp';
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: direction,
          code: direction,
          bubbles: true,
          cancelable: true,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 80));
      const changed = player.getVolume();
      const reverse = direction === 'ArrowDown' ? 'ArrowUp' : 'ArrowDown';
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: reverse,
          code: reverse,
          bubbles: true,
          cancelable: true,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 80));
      return { before, changed, restored: player.getVolume(), direction, step };
    });
    expect(preciseVolume.changed).toBe(
      preciseVolume.direction === 'ArrowDown'
        ? preciseVolume.before - preciseVolume.step
        : preciseVolume.before + preciseVolume.step,
    );
    expect(preciseVolume.restored).toBe(preciseVolume.before);

    const legacyTypes = ['wave', 'vudio', 'butterchurn'] as const;
    for (let cycle = 0; cycle < 20; cycle += 1) {
      await page.evaluate(
        async ({ type, blendTimeInSeconds }) => {
          await window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
            type,
            butterchurn: { blendTimeInSeconds },
          });
        },
        {
          type: legacyTypes[cycle % legacyTypes.length],
          blendTimeInSeconds: 1 + cycle / 100,
        },
      );
      await settle(page, 80);
    }

    const cycled = await graphState(page);
    expect(cycled.activeDestinationEdges).toHaveLength(1);
    expect(cycled.directSourceDestinationEdges).toHaveLength(0);
    expect(cycled.mediaStreamAnalysisEdges).toHaveLength(0);
    expect(cycled.visualizerSpurs).toHaveLength(1);
    expect(cycled.analyserFftSize).toBe(2048);
    expect(cycled.audioReadyListeners).toBe(1);
    expect(cycled.playerObservers).toBe(1);
    expect(cycled.visualizerAnimationFrames).toBe(1);
    expect(cycled.canvasCount).toBe(1);

    await page.evaluate(async () => {
      await window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
        enabled: false,
      });
    });
    await page.waitForFunction(
      () => !document.querySelector('#visualizer'),
      undefined,
      { timeout: 5000 },
    );
    const disabled = await graphState(page);
    expect(disabled.visualizerSpurs).toHaveLength(0);
    expect(disabled.audioReadyListeners).toBe(0);
    expect(disabled.playerObservers).toBe(0);
    expect(disabled.visualizerAnimationFrames).toBe(0);
    expect(disabled.canvasCount).toBe(0);

    await page.evaluate(async () => {
      await window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
        enabled: true,
        type: 'butterchurn',
      });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#visualizer', { timeout: 30_000 });
    await showPlayer(page, 500);
    await installAnimationFrameAudit(page);
    await page.evaluate(async () => {
      await window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
        butterchurn: { blendTimeInSeconds: 1.23 },
      });
    });
    await settle(page, 80);
    const reenabled = await graphState(page);
    expect(reenabled.activeDestinationEdges).toHaveLength(1);
    expect(reenabled.visualizerSpurs).toHaveLength(1);
    expect(reenabled.audioReadyListeners).toBe(1);
    expect(reenabled.playerObservers).toBe(1);
    expect(reenabled.visualizerAnimationFrames).toBe(1);
    expect(reenabled.canvasCount).toBe(1);

    const screenshot = await capture(page, 'visualizer-audio-safe');
    console.log(
      '  [visualizer-audio-safe]',
      JSON.stringify({
        cycled,
        disabled,
        reenabled,
        preciseVolume,
        screenshot,
      }),
    );
  } finally {
    await page
      .evaluate((saved) => {
        window.mainConfig.plugins.setOptions(
          'visualizer',
          saved.visualizer,
          [],
        );
        window.mainConfig.plugins.setOptions(
          'precise-volume',
          saved.preciseVolume,
          [],
        );
        const player = document.querySelector(
          '#movie_player',
        ) as unknown as PlayerApi | null;
        if (typeof saved.volume === 'number') player?.setVolume(saved.volume);
      }, original)
      .catch(() => undefined);
    await dispose();
  }
});
