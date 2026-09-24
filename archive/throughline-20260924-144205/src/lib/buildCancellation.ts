export function interruptible<T>(promise: Promise<T>, signal: AbortSignal, timeoutMs = 120_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => { cleanup(); reject(new DOMException('Build paused.', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('The operation timed out. You can resume from the saved checkpoint.')); }, timeoutMs);
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', stop); };
    if (signal.aborted) { stop(); return; }
    signal.addEventListener('abort', stop, { once: true });
    promise.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}

export function buildDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const stop = () => { clearTimeout(timer); reject(new DOMException('Build paused.', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, ms);
    if (signal.aborted) { stop(); return; }
    signal.addEventListener('abort', stop, { once: true });
  });
}
