import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { watchActivePort } from '../src/startup-wakeup.mjs';
import { watchApp } from '../src/watch.mjs';

test('port events wake the waiter and events arriving before a wait are retained', async () => {
  let changed;
  let closed = false;
  const watcher = new EventEmitter();
  watcher.close = () => { closed = true; };
  const wakeup = watchActivePort('/test/DevToolsActivePort', { watchDirectory: (directory, callback) => {
    assert.equal(directory, '/test'); changed = callback; return watcher;
  } });
  const controller = new AbortController();
  try {
    let woke = false;
    const first = wakeup.wait(1000, controller.signal).then(() => { woke = true; });
    changed('change', 'unrelated-file');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(woke, false);
    changed('rename', Buffer.from('DevToolsActivePort'));
    await first;
    changed('change', 'DevToolsActivePort');
    woke = false;
    const retained = wakeup.wait(1000, controller.signal).then(() => { woke = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(woke, true);
    await retained;
    const waiting = wakeup.wait(1000, controller.signal);
    controller.abort();
    await waiting;
  } finally { wakeup.close(); }
  assert.equal(closed, true);
});

test('an unavailable directory keeps the timer fallback and retries watching later', async () => {
  let attempts = 0;
  const wakeup = watchActivePort('/missing/DevToolsActivePort', { watchDirectory: () => {
    attempts++; throw new Error('directory unavailable');
  } });
  try {
    await wakeup.wait(1, new AbortController().signal);
    assert.equal(attempts, 2);
  } finally { wakeup.close(); }
});

test('port creation wakes discovery without waiting for the process polling interval', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'agy-startup-wakeup-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const controller = new AbortController();
  let discovered = false, ready = false, closed = false;
  const checked = [];
  const done = watchApp('/test/app', {
    script: 'window.test = true;', signal: controller.signal, userDataPath: directory, interval: 10000,
    discover: async () => {
      discovered = true;
      return ready ? { pid: 123, port: 9222 } : null;
    },
    validate: async () => { checked.push(123); return {}; },
    inject: async ({ signal, checkUi, onReady }) => {
      assert.equal(checkUi, true); onReady();
      await new Promise(resolve => {
        signal.addEventListener('abort', resolve, { once: true });
        if (signal.aborted) resolve();
      });
    },
    createWakeup: file => {
      assert.equal(file, path.join(directory, 'DevToolsActivePort'));
      const wakeup = watchActivePort(file);
      return { wait: (...args) => wakeup.wait(...args), close() { closed = true; wakeup.close(); } };
    },
    onReady: () => controller.abort(),
  });
  const timeout = setTimeout(() => controller.abort(), 1500);
  t.after(async () => { clearTimeout(timeout); controller.abort(); await done; });
  while (!discovered) await new Promise(resolve => setImmediate(resolve));
  ready = true;
  await writeFile(path.join(directory, 'DevToolsActivePort'), '9222\n');
  await done;
  assert.deepEqual(checked, [123]);
  assert.equal(closed, true);
});
