// Lightweight in-memory global event subscription for app-wide signals
// Keep implementation tiny to avoid adding dependencies. Consumers can
// subscribe to the global refresh event and will receive a call when
// `emitGlobalRefresh()` is invoked.

type Callback = () => void;
const globalRefreshSubscribers = new Set<Callback>();

export function subscribeGlobalRefresh(cb: Callback): () => void {
  globalRefreshSubscribers.add(cb);
  return () => globalRefreshSubscribers.delete(cb);
}

export function unsubscribeGlobalRefresh(cb: Callback): void {
  globalRefreshSubscribers.delete(cb);
}

export function emitGlobalRefresh(): void {
  // Fire-and-forget; guard each subscriber with try/catch
  for (const cb of Array.from(globalRefreshSubscribers)) {
    try {
      cb();
    } catch (err) {
      // swallow per-subscriber errors to avoid interrupting others
      try { console.error('[globalEvents] subscriber error', err); } catch {}
    }
  }
}


