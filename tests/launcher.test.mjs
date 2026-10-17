import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { CdpClient } from '../src/cdp-client.mjs';
import { isAppTarget, runInjection, scopedScript } from '../src/target-injection.mjs';
import { launchArguments, allocatePort } from '../src/launch-process.mjs';

async function debuggerServer() {
  let targets = [];
  const calls = [];
  const connections = [];
  let initialized = true;
  let compatible = true;
  let compatibilityResponses = [];
  const targetRequests = [];
  const server = createServer((request, response) => {
    targetRequests.push(Date.now());
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(targets));
  });
  const sockets = new WebSocketServer({ server });
  sockets.on('connection', (socket, request) => {
    connections.push(socket);
    socket.on('message', bytes => {
      const message = JSON.parse(bytes);
      calls.push({ ...message, target: request.url });
      if (message.params?.awaitPromise && compatibilityResponses.length) {
        socket.send(JSON.stringify({ id: message.id, ...compatibilityResponses.shift() }));
        return;
      }
      const result = message.params?.awaitPromise
        ? { result: { type: 'object', value: { compatible, missing: compatible ? [] : ['user-input-step'] } } }
        : message.params?.expression === 'Boolean(window.__AGY_ZH_RUNTIME__)'
          ? { result: { type: 'boolean', value: initialized } } : { identifier: 'translation' };
      socket.send(JSON.stringify({ id: message.id, result }));
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { port, calls, connections, targetRequests, setTargets: value => { targets = value; },
    setInitialized: value => { initialized = value; },
    setCompatible: value => { compatible = value; },
    setCompatibilityResponses: value => { compatibilityResponses = value; },
    async close() {
      for (const socket of sockets.clients) socket.terminate();
      await new Promise(resolve => sockets.close(resolve));
      await new Promise(resolve => server.close(resolve));
    } };
}

function page(port, id = 'main', url = 'https://127.0.0.1:42424/') {
  return { id, type: 'page', url, webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/${id}` };
}

async function until(predicate) {
  const limit = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > limit) throw new Error('condition timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('only the local application routes are eligible for translation', () => {
  assert.equal(isAppTarget(page(9222), 9222), true);
  assert.equal(isAppTarget(page(9222, 'main', 'https://127.0.0.1:42424/?workspace=x#settings'), 9222), true);
  assert.equal(isAppTarget(page(9222, 'main', 'https://127.0.0.1:42424/c/example-conversation'), 9222), true);
  assert.equal(isAppTarget(page(9222, 'main', 'https://127.0.0.1:42424/settings'), 9222), true);
  const rejected = [
    { ...page(9222), type: 'iframe' }, { ...page(9222), type: 'webview' },
    page(9222, 'external', 'https://example.org/'), page(9222, 'login', 'https://127.0.0.1:42424/login'),
    page(9222, 'insecure', 'http://127.0.0.1:42424/'), page(9223),
  ];
  for (const target of rejected) assert.equal(isAppTarget(target, 9222), false);
});

test('runtime script respects origin, path and top-level frame after navigation', () => {
  const expression = scopedScript('window.translated = true;', 'https://127.0.0.1:42424');
  function execute(origin, pathname = '/', topLevel = true) {
    const window = {};
    window.top = topLevel ? window : {};
    new Function('window', 'location', 'document', expression)(window, { origin, pathname }, { readyState: 'complete' });
    return window.translated === true;
  }
  assert.equal(execute('https://127.0.0.1:42424'), true);
  assert.equal(execute('https://127.0.0.1:42424', '/history'), true);
  assert.equal(execute('https://example.org'), false);
  assert.equal(execute('https://127.0.0.1:42424', '/login'), false);
  assert.equal(execute('https://127.0.0.1:42424', '/', false), false);
});

test('CDP registers reload script before current evaluation, then discovers new windows and reconnects', async t => {
  const debuggerApp = await debuggerServer();
  t.after(() => debuggerApp.close());
  debuggerApp.setTargets([page(debuggerApp.port), { ...page(debuggerApp.port, 'external'), type: 'webview' }]);
  const controller = new AbortController();
  t.after(() => controller.abort());
  let ready = false;
  const done = runInjection({ port: debuggerApp.port, script: 'window.test = true;',
    signal: controller.signal, interval: 20, onReady: () => { ready = true; } });
  await until(() => ready);
  assert.deepEqual(debuggerApp.calls.map(call => call.method), [
    'Runtime.evaluate', 'Page.addScriptToEvaluateOnNewDocument', 'Runtime.evaluate', 'Runtime.evaluate',
  ]);
  debuggerApp.setTargets([page(debuggerApp.port), page(debuggerApp.port, 'second')]);
  await until(() => debuggerApp.calls.length === 7);
  assert.match(debuggerApp.calls[4].target, /second$/);
  debuggerApp.connections[0].close();
  await until(() => debuggerApp.calls.length === 10);
  assert.match(debuggerApp.calls[7].target, /main$/);
  controller.abort();
  await done;
  await until(() => debuggerApp.connections.every(socket => socket.readyState >= 2));
});

test('incompatible UI is rejected before registering or executing translation', async t => {
  const debuggerApp = await debuggerServer();
  t.after(() => debuggerApp.close());
  debuggerApp.setTargets([page(debuggerApp.port)]);
  debuggerApp.setCompatible(false);
  const controller = new AbortController();
  t.after(() => controller.abort());
  let ready = false;
  await assert.rejects(runInjection({ port: debuggerApp.port, script: 'window.test = true;',
    signal: controller.signal, interval: 20, onReady: () => { ready = true; } }));
  assert.equal(ready, false);
  assert.equal(debuggerApp.calls.length, 1);
  assert.equal(debuggerApp.calls[0].params.awaitPromise, true);
  await until(() => debuggerApp.connections.every(socket => socket.readyState >= 2));
});

test('startup navigation waits in the same connection before checking and translating the application', async t => {
  const debuggerApp = await debuggerServer(); t.after(() => debuggerApp.close());
  debuggerApp.setTargets([page(debuggerApp.port)]);
  const pendingPage = { result: { result: { value: { compatible: false, missing: ['application-page'] } } } };
  debuggerApp.setCompatibilityResponses([pendingPage, {
    error: { code: -32000, message: 'Execution context was destroyed.' },
  }, pendingPage]);
  const controller = new AbortController();
  const timings = [];
  let ready = false;
  const done = runInjection({ port: debuggerApp.port, script: 'window.test = true;',
    signal: controller.signal, onTiming: event => timings.push(event), onReady: () => { ready = true; } });
  t.after(async () => { controller.abort(); await done; });
  await until(() => ready);
  assert.equal(debuggerApp.connections.length, 1);
  assert.deepEqual(debuggerApp.calls.slice(0, 4).map(call => call.params.awaitPromise), [true, true, true, true]);
  assert.equal(debuggerApp.calls[4].method, 'Page.addScriptToEvaluateOnNewDocument');
  assert.equal(timings.filter(event => event.stage === 'application-page-wait').length, 1);
  assert(timings.findIndex(event => event.stage === 'ui-check-complete')
    < timings.findIndex(event => event.stage === 'script-registered'));
  assert(timings.every(event => Number.isInteger(event.elapsedMs) && event.elapsedMs >= 0));
});

test('startup navigation does not retry actual incompatible application structures', async t => {
  const debuggerApp = await debuggerServer(); t.after(() => debuggerApp.close());
  debuggerApp.setTargets([page(debuggerApp.port)]);
  debuggerApp.setCompatibilityResponses([
    { result: { result: { value: { compatible: false, missing: ['application-page'] } } } },
  ]);
  debuggerApp.setCompatible(false);
  const controller = new AbortController(); t.after(() => controller.abort());
  await assert.rejects(runInjection({ port: debuggerApp.port, script: 'window.test = true;',
    signal: controller.signal }), /user-input-step/);
  assert.equal(debuggerApp.calls.length, 2);
  assert(debuggerApp.calls.every(call => call.params.awaitPromise));
  await until(() => debuggerApp.connections.every(socket => socket.readyState >= 2));
});

test('cancelling the startup navigation wait closes its connection and stops retries', async t => {
  const debuggerApp = await debuggerServer(); t.after(() => debuggerApp.close());
  debuggerApp.setTargets([page(debuggerApp.port)]);
  debuggerApp.setCompatibilityResponses([
    { result: { result: { value: { compatible: false, missing: ['application-page'] } } } },
  ]);
  const controller = new AbortController(); t.after(() => controller.abort());
  const timings = [];
  const done = runInjection({ port: debuggerApp.port, script: 'window.test = true;',
    signal: controller.signal, onTiming: event => timings.push(event) });
  const stopped = done.catch(() => {});
  await until(() => timings.some(event => event.stage === 'application-page-wait'));
  controller.abort(); await stopped;
  await until(() => debuggerApp.connections.every(socket => socket.readyState >= 2));
  assert.equal(debuggerApp.calls.length, 1);
});

test('initial window discovery is fast and returns to the normal interval after readiness', async t => {
  const debuggerApp = await debuggerServer();
  t.after(() => debuggerApp.close());
  const controller = new AbortController();
  let ready = false;
  const done = runInjection({ port: debuggerApp.port, script: 'window.test = true;',
    signal: controller.signal, interval: 2000, onReady: () => { ready = true; } });
  t.after(async () => { controller.abort(); await done; });
  await until(() => debuggerApp.targetRequests.length >= 2);
  assert.ok(debuggerApp.targetRequests[1] - debuggerApp.targetRequests[0] < 1000);
  debuggerApp.setTargets([page(debuggerApp.port)]);
  await until(() => ready);
  const requestsAtReady = debuggerApp.targetRequests.length;
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(debuggerApp.targetRequests.length, requestsAtReady);
});

test('initial loading defers origin check until DOMContentLoaded and readiness waits for initialization', async t => {
  const expression = scopedScript('window.translated = true;', 'https://127.0.0.1:42424');
  const window = {}; window.top = window;
  const location = { origin: 'null', pathname: '/' };
  let onLoaded;
  const document = { readyState: 'loading', addEventListener(event, callback) {
    assert.equal(event, 'DOMContentLoaded'); onLoaded = callback;
  } };
  new Function('window', 'location', 'document', expression)(window, location, document);
  assert.equal(window.translated, undefined);
  location.origin = 'https://127.0.0.1:42424'; onLoaded();
  assert.equal(window.translated, true);
  const debuggerApp = await debuggerServer(); t.after(() => debuggerApp.close());
  debuggerApp.setTargets([page(debuggerApp.port)]); debuggerApp.setInitialized(false);
  const controller = new AbortController(); t.after(() => controller.abort());
  let ready = false;
  const done = runInjection({ port: debuggerApp.port, script: 'window.test = true;', signal: controller.signal,
    interval: 20, onReady: () => { ready = true; } });
  await until(() => debuggerApp.calls.some(call => call.params?.expression === 'Boolean(window.__AGY_ZH_RUNTIME__)'));
  assert.equal(ready, false);
  debuggerApp.setInitialized(true); await until(() => ready);
  controller.abort(); await done;
});

test('CDP failures and pending requests reject without exposing remote messages', async t => {
  const debuggerApp = await debuggerServer();
  t.after(() => debuggerApp.close());
  const client = await CdpClient.connect(page(debuggerApp.port).webSocketDebuggerUrl);
  t.after(() => client.close());
  const serverSocket = debuggerApp.connections[0];
  serverSocket.removeAllListeners('message');
  serverSocket.once('message', bytes => {
    const { id } = JSON.parse(bytes);
    serverSocket.send(JSON.stringify({ id, error: { message: 'private server details' } }));
  });
  await assert.rejects(client.call('Runtime.evaluate'), { message: '应用拒绝了汉化请求。' });
  const pending = client.call('Runtime.evaluate');
  serverSocket.close();
  await assert.rejects(pending, { message: '应用汉化连接已关闭。' });
});

test('CDP only classifies known context navigation errors as transient', async t => {
  const debuggerApp = await debuggerServer(); t.after(() => debuggerApp.close());
  const client = await CdpClient.connect(page(debuggerApp.port).webSocketDebuggerUrl);
  t.after(() => client.close());
  const socket = debuggerApp.connections[0];
  socket.removeAllListeners('message');
  for (const [code, message, expected] of [
    [-32000, 'Cannot find default execution context', 'AGY_CDP_CONTEXT_NAVIGATING'],
    [-32000, 'Cannot find context with specified id', 'AGY_CDP_CONTEXT_NAVIGATING'],
    [-32000, 'Execution context was destroyed.', 'AGY_CDP_CONTEXT_NAVIGATING'],
    [-32000, 'Execution context was destroyed, most likely because of a navigation.', 'AGY_CDP_CONTEXT_NAVIGATING'],
    [-32000, 'private unrelated failure', undefined],
    [-32602, 'Execution context was destroyed.', undefined],
  ]) {
    socket.once('message', bytes => {
      const { id } = JSON.parse(bytes);
      socket.send(JSON.stringify({ id, error: { code, message } }));
    });
    await assert.rejects(client.call('Runtime.evaluate'), error => {
      assert.equal(error.code, expected);
      assert.equal(error.message, '应用拒绝了汉化请求。');
      return true;
    });
  }
});

test('stopping injection closes a page still waiting for runtime initialization', async t => {
  const debuggerApp = await debuggerServer();
  t.after(() => debuggerApp.close());
  debuggerApp.setTargets([page(debuggerApp.port)]);
  debuggerApp.setInitialized(false);
  const controller = new AbortController();
  t.after(() => controller.abort());
  const done = runInjection({ port: debuggerApp.port, script: 'window.test = true;',
    signal: controller.signal, interval: 20 });
  const stopped = done.catch(() => {});
  await until(() => debuggerApp.calls.some(call => call.params?.expression === 'Boolean(window.__AGY_ZH_RUNTIME__)'));
  controller.abort();
  await stopped;
  await until(() => debuggerApp.connections.every(socket => socket.readyState >= 2));
});

test('launcher uses a loopback port and standard debugging switches', async () => {
  const port = await allocatePort();
  assert.ok(Number.isInteger(port) && port > 0);
  assert.deepEqual(launchArguments(port), [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1']);
});
