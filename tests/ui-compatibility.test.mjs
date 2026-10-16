import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { assertUiCompatibility, checkUiCompatibility } from '../src/ui-compatibility.mjs';

const origin = 'https://127.0.0.1:47123';
const markers = ['user-input-step', 'planner-response-text', 'pending-user-messages',
  'terminal-active', 'terminal-tab-surface', 'setup-script-output', 'file-title-name',
  'breadcrumb-segment', 'project-selector-item', 'branch-option', 'entity-pill',
  'activity-lane-label', 'subagent-tab-header-title', 'model-selector-item', 'input-attachment'];

function element(tag, classes, children = 'content', props = '') {
  return `A.createElement(${JSON.stringify(tag)},{className:${JSON.stringify(classes)}${props}},${children})`;
}
function fixture({ bundles = true, pluginWrapper = false } = {}) {
  const title = element('div', 'font-medium text-sm text-foreground truncate', 'plugin.name');
  const description = element('div', 'text-xs text-muted-foreground truncate', 'plugin.description');
  const body = element('div', 'flex-1 min-w-0 flex flex-col gap-0.5 pr-4', `${title},${description}`);
  const card = element('div', 'relative flex items-center gap-3 p-3 rounded-xl',
    pluginWrapper ? element('div', 'wrapper', body) : body);
  const shelf = element('section', 'flex flex-col gap-3',
    element('div', 'flex flex-col gap-1 px-3', 'shelf.name'), ',"aria-label":shelf.name');
  const bundle = element('div', 'group', element('div', 'min-w-0 flex flex-col gap-2',
    `${element('h3', 'font-medium text-sm text-foreground truncate', 'bundle.name')},`
      + element('div', 'text-xs text-muted-foreground leading-relaxed', 'bundle.description')),
  ',"data-testid":`bundle-card-${bundle.id}`');
  const bundleShelf = element('section', 'flex flex-col gap-3',
    element('div', 'flex flex-col gap-1 px-3'), ',"data-testid":"marketplace-bundles-shelf"');
  const detail = element('div', 'flex flex-col gap-3',
    `${element('div', 'flex', element('h1',
      'text-lg font-medium tracking-tight leading-tight text-foreground truncate min-w-0', 'plugin.name'))},`
      + element('p', 'text-sm text-muted-foreground leading-relaxed', 'plugin.description'));
  return [
    ...markers.map(name => element('div', '', 'value', `,"data-testid":${JSON.stringify(name)}`)),
    element('label', '', 'repo.name', ',"data-testid":`github-repo-option-${repo.id}`'),
    element('div', 'max-w-2xl mx-auto flex-col gap-4'), card, shelf, detail,
    element('div', '', 'models', ',"data-testid":"model-selector-panel"'),
    element('span', 'truncate text-xs text-left', 'model.label'),
    element('span', 'truncate text-xs text-left', 'model.base', ',"data-testid":"model-selector-effort-group"'),
    element('span', '', 'effort.label', ',"data-testid":"model-selector-effort-option"'),
    ...(bundles ? ['const path="/customizations/marketplaces/a/bundles/b"', bundle, bundleShelf] : []),
  ].join(';');
}

function executingClient(source, overrides = {}) {
  const requests = [];
  const calls = [];
  const window = {};
  window.top = window;
  const context = { window, location: { origin, pathname: '/' }, AbortSignal,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, text: async () => source };
    }, ...overrides };
  const client = { call: async (method, params, timeout) => {
    calls.push({ method, params, timeout });
    const value = await vm.runInNewContext(params.expression, context);
    return { result: { value: JSON.parse(JSON.stringify(value)) } };
  } };
  return { client, requests, calls };
}

test('compatible rendering structures accept additional and reordered classes and unrelated UI changes', () => {
  const source = fixture().replace(/className:"([^"]*)"/g, (_, classes) =>
    `className:${JSON.stringify(`new-style ${classes.split(' ').reverse().join(' ')}`)}`);
  assert.deepEqual(checkUiCompatibility(`${source};${element('button', 'extra', '"New feature"')}`),
    { compatible: true, missing: [] });
  assert.deepEqual(checkUiCompatibility(fixture({ bundles: false })), { compatible: true, missing: [] });
});

test('missing critical content attributes reject injection even when marker strings remain elsewhere', () => {
  for (const marker of [...markers, 'github-repo-option-']) {
    const source = fixture().replaceAll(marker, `renamed-${marker}`) + `;const example=${JSON.stringify(marker)}`;
    const result = checkUiCompatibility(source);
    assert.equal(result.compatible, false, marker);
    assert(result.missing.some(name => marker.startsWith(name)), marker);
  }
});

test('changed plugin and bundle protection structures reject injection', () => {
  for (const [before, after, rule] of [
    ['gap-0.5 pr-4', 'gap-1 pr-4', 'plugin-card-content'],
    ['gap-1 px-3', 'gap-2 px-3', 'marketplace-shelf-content'],
    ['min-w-0 flex flex-col gap-2', 'min-w-0 flex flex-col gap-4', 'bundle-card-content'],
    ['marketplace-bundles-shelf', 'renamed-bundles-shelf', 'bundle-shelf'],
    ['tracking-tight leading-tight', 'tracking-normal leading-tight', 'plugin-detail-content'],
  ]) {
    const result = checkUiCompatibility(fixture().replaceAll(before, after));
    assert.equal(result.compatible, false, rule);
    assert(result.missing.includes(rule), rule);
  }
  assert(checkUiCompatibility(fixture({ pluginWrapper: true })).missing.includes('plugin-card-content'));
});

test('model names must retain protected leaf structure independently of the group label', () => {
  const source = fixture().replace('text-xs text-left"},model.label', 'text-xs text-right"},model.label');
  assert(checkUiCompatibility(source).missing.includes('model-name-content'));
});

test('CDP validation executes a same-origin credential-free static GET and returns only compatibility', async () => {
  const { client, requests, calls } = executingClient(fixture());
  assert.deepEqual(await assertUiCompatibility(client, origin), { compatible: true, missing: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'Runtime.evaluate');
  assert.equal(calls[0].params.awaitPromise, true);
  assert.equal(calls[0].params.returnByValue, true);
  assert.equal(calls[0].timeout, 10000);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/main.js');
  const { signal, ...options } = requests[0].options;
  assert(signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(JSON.stringify(options)), {
    method: 'GET', credentials: 'omit', redirect: 'error', mode: 'same-origin', cache: 'force-cache',
  });
  assert(!calls[0].params.expression.includes('document.'));
});

test('CDP validation refuses incompatible source and failures without returning application text', async () => {
  const { client } = executingClient(fixture().replace('planner-response-text', 'changed-response-text'));
  await assert.rejects(assertUiCompatibility(client, origin), /不兼容：planner-response-text/);
  const failed = executingClient(fixture(), { fetch: async () => { throw new Error('private server detail'); } });
  await assert.rejects(assertUiCompatibility(failed.client, origin), /不兼容：static-script$/);
});

test('a navigated page or iframe cannot trigger any static request', async () => {
  for (const overrides of [{ location: { origin: 'https://example.com', pathname: '/' } },
    { location: { origin, pathname: '/external' } }, { window: { top: {} } }]) {
    const { client, requests } = executingClient(fixture(), overrides);
    await assert.rejects(assertUiCompatibility(client, origin), /application-page/);
    assert.equal(requests.length, 0);
  }
  await assert.rejects(assertUiCompatibility({}, 'https://example.com'), /地址无效/);
});

test('internal settings, history and conversation routes can validate the same static interface', async () => {
  for (const pathname of ['/settings', '/history', '/c/example-conversation']) {
    const { client, requests } = executingClient(fixture(), { location: { origin, pathname } });
    assert.equal((await assertUiCompatibility(client, origin)).compatible, true);
    assert.equal(requests.length, 1);
  }
});
