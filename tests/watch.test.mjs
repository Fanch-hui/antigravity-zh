import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { readActivePort, parseLoopbackPorts, listeningPorts } from '../src/active-session.mjs';
import { watchApp } from '../src/watch.mjs';

async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('condition timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('active-port metadata accepts only a valid port on the first line', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'agy-port-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'DevToolsActivePort');
  assert.equal(await readActivePort(file), null);
  await writeFile(file, '12345\n/browser/unused-identifier');
  assert.equal(await readActivePort(file), 12345);
  for (const value of ['0', '65536', '-1', '9222x', '123456']) {
    await writeFile(file, `${value}\n12345`);
    assert.equal(await readActivePort(file), null);
  }
});

test('port ownership is restricted to IPv4 loopback listeners of the given process', async t => {
  assert.deepEqual(parseLoopbackPorts('p123\nn127.0.0.1:9222\nn*:9223\nn[::1]:9224\nn192.168.1.1:9225'), [9222]);
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  assert.ok((await listeningPorts(process.pid)).includes(server.address().port));
});

function fakeInjection(calls) {
  return async ({ port, signal, onReady }) => {
    const call = { port, stopped: false };
    calls.push(call);
    onReady();
    await new Promise(resolve => {
      signal.addEventListener('abort', resolve, { once: true });
      if (signal.aborted) resolve();
    });
    call.stopped = true;
  };
}

test('background watcher waits for launches, releases closed sessions and reconnects after restart', async t => {
  let running = null;
  const calls = [], checked = [], errors = [];
  const controller = new AbortController();
  const done = watchApp('/Applications/Antigravity.app', {
    script: 'window.translated = true;', signal: controller.signal, interval: 10,
    discover: async () => running,
    validate: async () => { checked.push(running.pid); },
    inject: fakeInjection(calls), onError: error => errors.push(error.message),
  });
  t.after(async () => { controller.abort(); await done; });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(calls.length, 0);
  running = { pid: 100, port: 9222 };
  await until(() => calls.length === 1);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(calls.length, 1);
  running = null;
  await until(() => calls[0].stopped);
  running = { pid: 101, port: 9223 };
  await until(() => calls.length === 2);
  assert.deepEqual(checked, [100, 101]);
  assert.deepEqual(errors, []);
  controller.abort(); await done;
  assert.ok(calls.every(call => call.stopped));
});

test('unsupported app version is blocked once per launch without injection', async t => {
  let running = { pid: 100, port: 9222 };
  const calls = [], errors = [];
  let checks = 0;
  const controller = new AbortController();
  const done = watchApp('/Applications/Antigravity.app', {
    script: 'window.translated = true;', signal: controller.signal, interval: 10,
    discover: async () => running,
    validate: async () => { checks++; throw new Error('应用 version 与适配指纹不匹配。'); },
    inject: fakeInjection(calls), onError: error => errors.push(error.message),
  });
  t.after(async () => { controller.abort(); await done; });
  await until(() => checks === 1);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(checks, 1);
  assert.equal(errors.length, 1);
  assert.equal(calls.length, 0);
  running = { pid: 101, port: 9223 };
  await until(() => checks === 2);
  assert.equal(calls.length, 0);
});
