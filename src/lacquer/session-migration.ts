import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { LoggerPrefix } from '@/utils';

/**
 * One-time session migration from Pear into Lacquer.
 *
 * Background: Lacquer previously called
 * `app.setPath('userData', <appData>/YouTube Music)` at module scope in
 * `src/index.ts`. That produced a split brain rather than the documented
 * "shared config" behaviour:
 *
 *   - `electron-store` is instantiated eagerly when `@/config` is imported,
 *     which under ESM happens *before* the importing module's body runs. Its
 *     path therefore resolved against Electron's default userData
 *     (`<appData>/Lacquer`, derived from `productName`) and never saw the
 *     override.
 *   - The Chromium session is created after `app.whenReady()`, long after the
 *     override took effect, so cookies and web storage went to Pear's
 *     directory.
 *
 * Net effect: config in `<appData>/Lacquer`, login in
 * `<appData>/YouTube Music`. The override has been removed so both now resolve
 * to `<appData>/Lacquer`, and this module carries the existing login across
 * once so the user does not have to re-authenticate.
 *
 * Deliberately NOT migrated:
 *   - `config.json` — Lacquer needs its own defaults to actually apply.
 *   - Caches — regenerable, and large.
 *
 * This must run after `app.whenReady()` resolves but before the first
 * BrowserWindow is created, so that Chromium has not yet opened the cookie
 * store. It is intentionally not an import-order dependency: `perfectionist/
 * sort-imports` would reorder a side-effect import and silently break it.
 */

/** Pear's userData directory name on Windows. */
const LEGACY_DIR_NAME = 'YouTube Music';

/** Written into Lacquer's userData once migration has been attempted. */
const MARKER_FILE = '.lacquer-session-migrated';

/**
 * Session-bearing paths, relative to userData. `Network` carries the cookie
 * jar on current Chromium; the bare `Cookies` files are the pre-Network-folder
 * layout and are copied too so this works across Electron versions.
 */
const SESSION_ENTRIES = [
  'Network',
  'Local Storage',
  'Session Storage',
  'IndexedDB',
  'Cookies',
  'Cookies-journal',
];

const log = (message: string) => {
  console.log(LoggerPrefix, `session migration: ${message}`);
};

/**
 * Copies Pear's session into Lacquer's userData if this is the first run and a
 * Pear installation is present.
 *
 * Never throws, never deletes from the source, and never blocks startup: a
 * failed migration means the user signs in again, not a broken application.
 */
export const migratePearSession = () => {
  const target = app.getPath('userData');
  const marker = path.join(target, MARKER_FILE);

  if (fs.existsSync(marker)) return;

  const source = path.join(app.getPath('appData'), LEGACY_DIR_NAME);

  // Guard against the source and target ever resolving to the same place.
  if (path.resolve(source) === path.resolve(target)) {
    log('source and target are the same directory, nothing to do');
    writeMarker(marker, 'skipped: same directory');
    return;
  }

  if (!fs.existsSync(source)) {
    log('no Pear installation found, starting with a clean session');
    writeMarker(marker, 'skipped: no source');
    return;
  }

  const copied: string[] = [];
  const failed: string[] = [];

  for (const entry of SESSION_ENTRIES) {
    const from = path.join(source, entry);
    if (!fs.existsSync(from)) continue;

    try {
      fs.cpSync(from, path.join(target, entry), {
        recursive: true,
        force: true,
      });
      copied.push(entry);
    } catch (error) {
      failed.push(entry);
      console.error(
        LoggerPrefix,
        `session migration: failed to copy "${entry}"`,
        error,
      );
    }
  }

  if (copied.length > 0) {
    log(`copied ${copied.join(', ')} from Pear`);
  }

  if (failed.length > 0) {
    log(
      `${failed.length} item(s) could not be copied — you may need to sign in ` +
        'again. If Windows Controlled Folder Access is enabled, it can block ' +
        'writes between AppData directories.',
    );
  }

  // The marker is written even on partial failure. Retrying on every launch
  // would risk overwriting a good session with a stale one.
  writeMarker(marker, `copied: ${copied.join(', ') || 'nothing'}`);
};

const writeMarker = (marker: string, detail: string) => {
  try {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(
      marker,
      `${new Date().toISOString()}\n${detail}\n`,
      'utf8',
    );
  } catch (error) {
    console.error(
      LoggerPrefix,
      'session migration: could not write marker file',
      error,
    );
  }
};
