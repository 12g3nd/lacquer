import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type CDPSession, type Page } from '@playwright/test';

import {
  CAPTURE_DIR,
  attachToLacquer,
  capture,
  settle,
  showPlayer,
} from './harness';

type ConfigBridge = {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  plugins: {
    getOptions(id: string): Record<string, unknown>;
    setOptions(
      id: string,
      value: Record<string, unknown>,
      defaults?: unknown[],
    ): void;
  };
};

type RuntimeAudit = {
  querySelectors: Record<string, number>;
  rootComputedStyles: number;
  rootStyleRecords: number;
  observerCallbacks: number;
  activeObservers: Set<MutationObserver>;
  listeners: Map<string, Set<EventListenerOrEventListenerObject>>;
  animationFrames: Map<number, FrameRequestCallback>;
};

type FrameProfile = {
  frames: number;
  fps: number;
  steadyFps: number;
  meanMs: number;
  p95Ms: number;
  maxMs: number;
  taskMsPerSecond: number;
  scriptMsPerSecond: number;
  audit: {
    querySelectors: Record<string, number>;
    rootComputedStyles: number;
    rootStyleRecords: number;
    observerCallbacks: number;
  };
};

const installRuntimeAudit = (page: Page) =>
  page.addInitScript(() => {
    const audit: RuntimeAudit = {
      querySelectors: {},
      rootComputedStyles: 0,
      rootStyleRecords: 0,
      observerCallbacks: 0,
      activeObservers: new Set(),
      listeners: new Map(),
      animationFrames: new Map(),
    };

    const nativeQuerySelector = Document.prototype.querySelector;
    Document.prototype.querySelector = function <E extends Element = Element>(
      selectors: string,
    ): E | null {
      audit.querySelectors[selectors] =
        (audit.querySelectors[selectors] ?? 0) + 1;
      return nativeQuerySelector.call(this, selectors) as E | null;
    };

    const nativeGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (element, pseudoElement) => {
      if (element === document.documentElement) audit.rootComputedStyles += 1;
      return nativeGetComputedStyle.call(window, element, pseudoElement);
    };

    const NativeMutationObserver = window.MutationObserver;
    window.MutationObserver = class extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super((records, observer) => {
          audit.observerCallbacks += 1;
          audit.rootStyleRecords += records.filter(
            (record) =>
              record.target === document.documentElement &&
              record.attributeName === 'style',
          ).length;
          callback(records, observer);
        });
      }

      observe(target: Node, options?: MutationObserverInit) {
        audit.activeObservers.add(this);
        return super.observe(target, options);
      }

      disconnect() {
        audit.activeObservers.delete(this);
        return super.disconnect();
      }
    };

    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      if (listener && (this === document || this === window)) {
        const key = `${this === window ? 'window' : 'document'}:${type}`;
        const values = audit.listeners.get(key) ?? new Set();
        values.add(listener);
        audit.listeners.set(key, values);
      }
      return nativeAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) {
      if (listener && (this === document || this === window)) {
        const key = `${this === window ? 'window' : 'document'}:${type}`;
        audit.listeners.get(key)?.delete(listener);
      }
      return nativeRemove.call(this, type, listener, options);
    };

    const nativeRequest = window.requestAnimationFrame;
    const nativeCancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      let handle = 0;
      handle = nativeRequest.call(window, (timestamp) => {
        audit.animationFrames.delete(handle);
        callback(timestamp);
      });
      audit.animationFrames.set(handle, callback);
      return handle;
    };
    window.cancelAnimationFrame = (handle) => {
      audit.animationFrames.delete(handle);
      nativeCancel.call(window, handle);
    };

    (
      window as typeof window & { __lqPerformanceAudit: RuntimeAudit }
    ).__lqPerformanceAudit = audit;
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
    const video = document.querySelector<HTMLVideoElement>('video');
    if (video?.paused) void video.play();
  });
};

const performanceMetrics = async (session: CDPSession) => {
  const response = await session.send('Performance.getMetrics');
  return Object.fromEntries(
    response.metrics.map(({ name, value }) => [name, value]),
  );
};

const profileFrames = async (
  page: Page,
  session: CDPSession,
  durationMs = 1800,
): Promise<FrameProfile> => {
  await page.evaluate(() => {
    const audit = (
      window as typeof window & { __lqPerformanceAudit: RuntimeAudit }
    ).__lqPerformanceAudit;
    audit.querySelectors = {};
    audit.rootComputedStyles = 0;
    audit.rootStyleRecords = 0;
    audit.observerCallbacks = 0;
  });
  const before = await performanceMetrics(session);
  const timings = await page.evaluate(
    (duration) =>
      new Promise<number[]>((resolve) => {
        const values: number[] = [];
        const started = performance.now();
        let previous = started;
        const tick = (now: number) => {
          values.push(now - previous);
          previous = now;
          if (now - started >= duration) resolve(values.slice(1));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    durationMs,
  );
  const after = await performanceMetrics(session);
  const audit = await page.evaluate(() => {
    const state = (
      window as typeof window & { __lqPerformanceAudit: RuntimeAudit }
    ).__lqPerformanceAudit;
    return {
      querySelectors: { ...state.querySelectors },
      rootComputedStyles: state.rootComputedStyles,
      rootStyleRecords: state.rootStyleRecords,
      observerCallbacks: state.observerCallbacks,
    };
  });
  timings.sort((a, b) => a - b);
  const elapsedSeconds = timings.reduce((sum, value) => sum + value, 0) / 1000;
  const steadyTimings = timings.filter((value) => value <= 50);
  const steadySeconds =
    steadyTimings.reduce((sum, value) => sum + value, 0) / 1000;
  const meanMs =
    elapsedSeconds > 0 ? (elapsedSeconds * 1000) / timings.length : 0;
  return {
    frames: timings.length,
    fps: elapsedSeconds > 0 ? timings.length / elapsedSeconds : 0,
    steadyFps: steadySeconds > 0 ? steadyTimings.length / steadySeconds : 0,
    meanMs,
    p95Ms: timings[Math.floor(timings.length * 0.95)] ?? 0,
    maxMs: timings.at(-1) ?? 0,
    taskMsPerSecond:
      (((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1000) /
      elapsedSeconds,
    scriptMsPerSecond:
      (((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)) * 1000) /
      elapsedSeconds,
    audit,
  };
};

const runtimeSnapshot = (page: Page) =>
  page.evaluate(() => {
    const audit = (
      window as typeof window & { __lqPerformanceAudit: RuntimeAudit }
    ).__lqPerformanceAudit;
    return {
      listeners: Object.fromEntries(
        [...audit.listeners].map(([key, listeners]) => [key, listeners.size]),
      ),
      activeObservers: audit.activeObservers.size,
      visualizerFrames: document.getElementById('lq-viz-reactivity') ? 1 : 0,
      canvases: document.querySelectorAll('#visualizer').length,
      heapUsed:
        (
          performance as Performance & {
            memory?: { usedJSHeapSize: number };
          }
        ).memory?.usedJSHeapSize ?? null,
    };
  });

test('Visualizer Mode holds frame rate and releases runtime work after twenty cycles', async () => {
  const { page, dispose } = await attachToLacquer();
  page.on('dialog', (dialog) => void dialog.dismiss().catch(() => undefined));
  const original = await page.evaluate(() => ({
    mode: (window.mainConfig as unknown as ConfigBridge).get(
      'lacquer.visualizerMode',
    ),
    visualizer: (
      window.mainConfig as unknown as ConfigBridge
    ).plugins.getOptions('visualizer'),
  }));
  const profiles: Record<string, FrameProfile> = {};

  try {
    await page.evaluate(async () => {
      const config = window.mainConfig as unknown as ConfigBridge;
      config.set('lacquer.visualizerMode', false);
      await window.ipcRenderer.invoke('peard:set-config', 'visualizer', {
        enabled: false,
        type: 'lacquer-rave',
      });
    });
    await installRuntimeAudit(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('ytmusic-player-bar', { timeout: 30_000 });
    await ensurePlaying(page);
    await showPlayer(page, 600);

    const session = await page.context().newCDPSession(page);
    await session.send('Performance.enable');
    const battery = await page.evaluate(async () => {
      const navigatorWithBattery = navigator as Navigator & {
        getBattery?: () => Promise<{ charging: boolean; level: number }>;
      };
      const value = await navigatorWithBattery.getBattery?.();
      return value
        ? { charging: value.charging, level: value.level }
        : { charging: null, level: null };
    });

    profiles.normalPlaying = await profileFrames(page, session);
    await page.locator('ytmusic-player-bar #play-pause-button').click();
    await settle(page, 250);
    profiles.normalIdle = await profileFrames(page, session);
    await page.locator('ytmusic-player-bar #play-pause-button').click();
    await settle(page, 250);

    await page.locator('#lacquer-viz-button').click();
    await page.waitForSelector('#visualizer', { timeout: 20_000 });
    await settle(page, 400);
    await session.send('HeapProfiler.collectGarbage');
    const beforeCycles = await runtimeSnapshot(page);
    profiles.vizPlaying = await profileFrames(page, session);

    await session.send('Emulation.setCPUThrottlingRate', { rate: 2 });
    profiles.vizPlaying2xCpu = await profileFrames(page, session);
    await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    await page.locator('ytmusic-player-bar #play-pause-button').click();
    await settle(page, 250);
    profiles.vizIdleDrift = await profileFrames(page, session);
    await page.locator('ytmusic-player-bar #play-pause-button').click();
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        '--ytmusic-album-color',
        '231, 96, 14',
      ),
    );
    profiles.albumCrossfade = await profileFrames(page, session, 1200);

    for (let cycle = 0; cycle < 20; cycle += 1) {
      await page.locator('#lacquer-viz-button').click();
      await page.waitForFunction(() => !document.querySelector('#visualizer'));
      await page.locator('#lacquer-viz-button').click();
      await page.waitForSelector('#visualizer', { timeout: 10_000 });
    }
    await settle(page, 300);
    await session.send('HeapProfiler.collectGarbage');
    const afterCycles = await runtimeSnapshot(page);
    const activeScreenshot = await capture(
      page,
      'visualizer-performance-rave-active',
    );

    await page.locator('#lacquer-viz-button').click();
    await page.waitForFunction(() => !document.querySelector('#visualizer'));
    await settle(page, 100);
    const disabled = await runtimeSnapshot(page);
    const browserMetrics = await performanceMetrics(session);
    const normalScreenshot = await capture(
      page,
      'visualizer-performance-normal',
    );

    fs.mkdirSync(CAPTURE_DIR, { recursive: true });
    const report = {
      measuredAt: new Date().toISOString(),
      battery,
      profiles,
      beforeCycles,
      afterCycles,
      disabled,
      browserMetrics: {
        JSHeapUsedSize: browserMetrics.JSHeapUsedSize,
        Nodes: browserMetrics.Nodes,
        JSEventListeners: browserMetrics.JSEventListeners,
      },
      screenshots: { active: activeScreenshot, normal: normalScreenshot },
    };
    fs.writeFileSync(
      path.join(CAPTURE_DIR, 'visualizer-performance.json'),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    console.log(`  visualizer performance: ${JSON.stringify(report)}`);

    for (const [name, profile] of Object.entries(profiles).filter(
      ([profileName]) => profileName !== 'vizPlaying2xCpu',
    )) {
      expect(
        profile.steadyFps,
        `${name} steady frame rate`,
      ).toBeGreaterThanOrEqual(name === 'albumCrossfade' ? 45 : 52);
      expect(profile.p95Ms, `${name} p95 frame time`).toBeLessThanOrEqual(
        name === 'albumCrossfade' || name === 'vizPlaying' ? 40 : 26,
      );
    }
    expect(Number.isFinite(profiles.vizPlaying2xCpu.fps)).toBe(true);
    expect(profiles.vizPlaying.audit.querySelectors.video ?? 0).toBeLessThan(
      12,
    );
    expect(
      profiles.vizPlaying.audit.querySelectors['#song-image'] ?? 0,
    ).toBeLessThan(12);
    expect(profiles.vizPlaying.audit.rootComputedStyles).toBeLessThan(12);
    expect(profiles.vizPlaying.audit.rootStyleRecords).toBeLessThan(12);
    expect(afterCycles.listeners).toEqual(beforeCycles.listeners);
    expect(afterCycles.activeObservers).toBe(beforeCycles.activeObservers);
    expect(afterCycles.visualizerFrames).toBe(1);
    expect(afterCycles.canvases).toBe(1);
    if (beforeCycles.heapUsed !== null && afterCycles.heapUsed !== null) {
      expect(afterCycles.heapUsed - beforeCycles.heapUsed).toBeLessThan(
        8 * 1024 * 1024,
      );
    }
    expect(disabled.visualizerFrames).toBe(0);
    expect(disabled.canvases).toBe(0);
  } finally {
    await page
      .evaluate((saved) => {
        const config = window.mainConfig as unknown as ConfigBridge;
        config.set('lacquer.visualizerMode', saved.mode ?? false);
        config.plugins.setOptions('visualizer', saved.visualizer, []);
        document.documentElement.style.removeProperty('--ytmusic-album-color');
      }, original)
      .catch(() => undefined);
    await dispose();
  }
});
