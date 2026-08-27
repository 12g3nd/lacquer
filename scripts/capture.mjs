/**
 * Runs Lacquer's capture gate.
 *
 * Captures need the real, authenticated profile — a signed-out shell shows none
 * of the states the stage plans ask for. But Playwright's Electron *launcher*
 * never surfaces a window when the profile carries an authenticated YouTube
 * Music session (see the comment block in `tests/lacquer/harness.ts` for the
 * bisection). Attaching over CDP to that same profile works.
 *
 * So this script owns the app: start it with a debugging port, wait for the
 * port, run the capture project against it, then stop it.
 *
 *   pnpm test:capture
 */

import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Imported from Node (not from inside Electron), the `electron` package
// resolves to the absolute path of its binary. Spawning that directly, rather
// than going through `npx` with a shell, is what makes the process handle a
// real Electron pid — a shell wrapper exits immediately, leaving the tree-kill
// below pointed at a dead pid and Electron orphaned.
const { default: electronPath } = await import('electron');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const findFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const waitForCdp = async (port, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) return await response.json();
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Lacquer's debugging port never opened on ${port}.`);
};

const run = (command, args, env) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...env },
    });
    child.on('close', (code) => resolve(code ?? 1));
  });

const port = await findFreePort();

console.log(`[capture] starting Lacquer with debugging port ${port}`);

// LACQUER_CAPTURE (not NODE_ENV=test) suppresses the dev-mode DevTools auto-open
// — which would deadlock against Playwright's CDP attach — WITHOUT taking the
// `isTesting()` branch that leaves the preload sandboxed. A sandboxed preload
// cannot `require('electron-store')`, so `window.mainConfig` never exists and
// none of `src/lacquer/*` initialises: every capture would then be a screenshot
// of the app with its whole renderer shell missing.
const app = spawn(
  electronPath,
  ['.', `--remote-debugging-port=${port}`, '--no-sandbox'],
  {
    cwd: ROOT,
    stdio: 'ignore',
    shell: false,
    env: { ...process.env, LACQUER_CAPTURE: '1' },
  },
);

let exitCode = 1;

const stopApp = () => {
  if (app.exitCode !== null || app.pid === undefined) return;
  if (process.platform === 'win32') {
    // Electron spawns a tree of renderer/GPU/utility processes; killing only
    // the handle leaves them running. /t takes the whole tree.
    spawn('taskkill', ['/pid', String(app.pid), '/f', '/t'], {
      stdio: 'ignore',
    });
  } else {
    app.kill('SIGTERM');
  }
};

process.on('SIGINT', () => {
  stopApp();
  process.exit(130);
});

try {
  const version = await waitForCdp(port);
  console.log(`[capture] attached to ${version.Browser}`);

  exitCode = await run('npx', ['playwright', 'test', '--project=capture'], {
    LACQUER_CDP_ENDPOINT: `http://127.0.0.1:${port}`,
  });

  console.log(
    exitCode === 0
      ? '[capture] captures written to test-results/capture/'
      : '[capture] capture run failed',
  );
} catch (error) {
  console.error(`[capture] ${error.message}`);
} finally {
  stopApp();
}

process.exit(exitCode);
