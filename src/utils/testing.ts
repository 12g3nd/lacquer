export const isTesting = () => process.env.NODE_ENV === 'test';

/**
 * The capture gate (`scripts/capture.mjs`) launches the *real* app — not a
 * hermetic test build — and only needs the one behaviour `isTesting()` also
 * happened to provide: DevTools must not auto-open, because Playwright already
 * holds the CDP connection and a second attach deadlocks startup (D13).
 *
 * It must NOT take the `isTesting()` path that leaves the preload sandboxed:
 * that path blocks `require('electron-store')`, so `window.mainConfig` never
 * exists and the entire renderer shell (`src/lacquer/*`) fails to initialise —
 * which would make every capture a screenshot of a half-dead app.
 */
export const isCapturing = () => process.env.LACQUER_CAPTURE === '1';
