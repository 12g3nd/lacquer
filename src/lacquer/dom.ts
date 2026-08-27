/*
 * One shared MutationObserver for "wait until this selector exists".
 *
 * Lacquer's renderer modules each need to wait for a slice of the YouTube Music
 * DOM to mount before they can inject into it. Previously `fx-rack.ts` and
 * `settings-panel.ts` each ran their own `MutationObserver` on `document.body`
 * with `subtree: true` — two full-tree observers living for the whole session.
 * This collapses them into a single observer that disconnects the moment every
 * outstanding waiter has resolved.
 */

interface Waiter {
  selector: string;
  resolve: (element: Element) => void;
}

const waiters: Waiter[] = [];
let observer: MutationObserver | null = null;

const flush = () => {
  for (let i = waiters.length - 1; i >= 0; i--) {
    const element = document.querySelector(waiters[i].selector);
    if (element) {
      waiters[i].resolve(element);
      waiters.splice(i, 1);
    }
  }

  if (waiters.length === 0 && observer) {
    observer.disconnect();
    observer = null;
  }
};

/**
 * Resolves with the first element matching `selector`. If it is already in the
 * document the promise resolves synchronously on the microtask queue; otherwise
 * the shared observer watches for it. The promise never rejects — a selector
 * that never matches simply never resolves, which is the right behaviour for
 * optional injection points.
 */
export const whenElement = (selector: string): Promise<Element> => {
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    waiters.push({ selector, resolve });

    if (!observer) {
      observer = new MutationObserver(flush);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
};
