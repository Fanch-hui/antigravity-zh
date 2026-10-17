import { watch } from 'node:fs';
import path from 'node:path';

export function watchActivePort(file, { watchDirectory = watch } = {}) {
  let watcher = null;
  let pending = false;
  let closed = false;
  let waiting = null;
  const wake = () => {
    pending = true;
    waiting?.();
  };
  function listen() {
    if (closed || watcher) return;
    try {
      const active = watchDirectory(path.dirname(file), (_event, filename) => {
        if (filename?.toString() === path.basename(file)) wake();
      });
      watcher = active;
      active.on('error', () => { active.close(); if (watcher === active) watcher = null; });
    } catch { watcher = null; }
  }
  listen();
  return {
    wait(milliseconds, signal) {
      listen();
      if (closed || signal.aborted) return Promise.resolve();
      if (pending) { pending = false; return Promise.resolve(); }
      return new Promise(resolve => {
        const timer = setTimeout(finish, milliseconds);
        function finish() {
          clearTimeout(timer);
          signal.removeEventListener('abort', finish);
          waiting = null;
          pending = false;
          resolve();
        }
        waiting = finish;
        signal.addEventListener('abort', finish, { once: true });
        if (signal.aborted) finish();
      });
    },
    close() {
      closed = true;
      watcher?.close();
      watcher = null;
      waiting?.();
    },
  };
}
