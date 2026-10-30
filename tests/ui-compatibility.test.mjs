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
function fixture({ bundles = true, pluginWrapper = false, legacy = false } = {}) {
  const title = element('div', 'font-medium text-sm text-foreground truncate', 'plugin.name');
  const description = element('div', `${legacy ? 'text-sm' : 'text-xs'} text-muted-foreground truncate`, 'plugin.description');
  const body = element('div', `flex-1 min-w-0 flex flex-col gap-0.5${legacy ? '' : ' pr-4'}`, `${title},${description}`);
  const card = element('div', `relative flex items-center gap-3 p-3 rounded-xl${legacy ? ' h-[72px]' : ''}`,
    pluginWrapper ? element('div', 'wrapper', body) : body);
  const shelf = legacy ? element('div', 'space-y-10', element('section', '',
    `${element('h2', 'text-xl font-medium text-foreground', 'shelf.displayName')},`
      + element('p', 'text-xs text-muted-foreground mt-1', 'shelf.description'), ',"aria-label":shelf.displayName'))
    : element('section', 'flex flex-col gap-3',
    element('div', 'flex flex-col gap-1 px-3', 'shelf.name'), ',"aria-label":shelf.name');
  const bundle = element('div', 'group', element('div', 'min-w-0 flex flex-col gap-2',
    `${element('h3', 'font-medium text-sm text-foreground truncate', 'bundle.name')},`
      + element('div', 'text-xs text-muted-foreground leading-relaxed', 'bundle.description')),
  ',"data-testid":`bundle-card-${bundle.id}`');
  const bundleShelf = element('section', 'flex flex-col gap-3',
    element('div', 'flex flex-col gap-1 px-3'), ',"data-testid":"marketplace-bundles-shelf"');
  const detail = element('div', legacy ? 'mt-2' : 'flex flex-col gap-3',
    `${element('div', 'flex', element('h1',
      `${legacy ? 'text-2xl font-bold' : 'text-lg font-medium'} tracking-tight leading-tight text-foreground truncate min-w-0`, 'plugin.name'))},`
      + element('p', `text-sm text-muted-foreground${legacy ? ' mt-3' : ''} leading-relaxed`, 'plugin.description'));
  const newerMarkers = ['terminal-tab-surface', 'entity-pill', 'subagent-tab-header-title'];
  return [
    ...markers.filter(name => !legacy || !newerMarkers.includes(name))
      .map(name => element('div', '', 'value', `,"data-testid":${JSON.stringify(name)}`)),
    ...(legacy ? [element('div', '', 'terminal', ',"data-testid":"terminal-surface"'),
      element('div', '', 'panes', ',"data-testid":"terminal-split-container"'),
      element('span', '', 'file.name', ',"data-uri":file.uri,"data-quotable-inline":"true"'),
      element('div', '', 'subagent', ',"data-testid":"subagent-node"'),
      element('span', 'text-xs font-medium truncate flex-1 min-w-0', 'agent.toolSummary')]
      : [element('label', '', 'repo.name', ',"data-testid":`github-repo-option-${repo.id}`')]),
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

test('the older customization layout checks its corresponding terminal, reference and subagent protection', () => {
  assert.deepEqual(checkUiCompatibility(fixture({ bundles: false, legacy: true })), { compatible: true, missing: [] });
  for (const [before, after, rule] of [
    ['terminal-surface', 'changed-terminal', 'terminal-tab-surface'],
    ['data-uri', 'changed-uri', 'entity-pill'],
    ['subagent-node', 'changed-subagent', 'subagent-tab-header-title'],
    ['h-[72px]', 'h-[80px]', 'plugin-card-content'],
    ['text-xl font-medium', 'text-lg font-medium', 'marketplace-shelf-content'],
    ['mt-3 leading-relaxed', 'mt-4 leading-relaxed', 'plugin-detail-content'],
  ]) assert(checkUiCompatibility(fixture({ bundles: false, legacy: true }).replaceAll(before, after)).missing.includes(rule), rule);
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

function configurationFixture() {
  const conflict = element('div', '', element('div', 'flex items-start gap-3',
    element('div', 'flex-1 min-w-0',
      element('span', 'font-medium text-sm text-foreground truncate', 'name') + ','
      + element('div', 'text-xs text-muted-foreground truncate', 'description'))), ',"data-testid":testId');
  const variable = element('div', 'flex flex-col gap-1',
    element('div', 'flex', element('label', 'text-xs font-semibold', 'variable.title')) + ','
      + element('span', 'text-xs text-muted-foreground', 'variable.description') + ','
      + element('input', 'w-full', '', ',"data-testid":"mcp-config-variable-input"'),
    ',"data-testid":"mcp-config-variable"');
  const provider = element('div', 'flex flex-col',
    element('div', 'flex', element('span', 'text-sm font-medium text-foreground truncate', 'provider.label')) + ','
      + element('p', 'text-xs text-muted-foreground leading-relaxed', 'provider.description'),
    ',"data-testid":`plugin-context-provider-${provider.id}`');
  return [conflict, variable, element('div', '', provider, ',"data-testid":"plugin-context-provider-list"'),
    element('div', '', 'content', ',"data-testid":"plugin-install-conflict-modal"'),
    'const ids=["conflict-current-plugin","conflict-incoming-plugin"]'].join(';');
}

test('2.26 plugin configuration content structures are checked when the feature exists', () => {
  const source = fixture() + ';' + configurationFixture();
  assert.deepEqual(checkUiCompatibility(source), { compatible: true, missing: [] });
  for (const [before, after, rule] of [
    ['flex items-start gap-3', 'flex items-center gap-3', 'plugin-conflict-content'],
    ['mcp-config-variable-input', 'changed-variable-input', 'mcp-configuration-content'],
    ['text-sm font-medium text-foreground truncate', 'text-sm font-medium text-foreground', 'context-provider-content'],
  ]) {
    const changed = fixture() + ';' + configurationFixture().replaceAll(before, after);
    assert.ok(checkUiCompatibility(changed).missing.includes(rule), rule);
  }
});

test('runtime compatibility evaluation includes plugin configuration protection checks', async () => {
  const { client } = executingClient(fixture() + ';' + configurationFixture());
  assert.equal((await assertUiCompatibility(client, origin)).compatible, true);
});

function activityRowsFixture() {
  return [
    'function RowContent({testId:a,icon:b,label:d,labelClassName:f}){return A.createElement(A.Fragment,null,A.createElement("span",{className:f},d))}',
    'const Row=A.forwardRef(({testId:a,icon:b,label:d},ref)=>{const label=A.createElement(A.Fragment,null,A.createElement(RowContent,{testId:a,icon:b,label:d,labelClassName:join("min-w-0 truncate")}));const props={"data-testid":a,ref};return A.createElement("button",{...props},label)});Row.displayName="PanelItemRow"',
    'A.createElement(Row,{testId:`accumulated-item-${section.key}`,label:item.label})',
    'A.createElement(Row,{testId:"background-task-row",label:task.label})',
  ].join(';');
}

test('2.27 activity rows require the shared dynamic label and test-id rendering structure', async () => {
  const source = fixture().replace('activity-lane-label', 'removed-marker') + ';' + activityRowsFixture();
  assert.deepEqual(checkUiCompatibility(source), { compatible: true, missing: [] });
  for (const [before, after] of [
    ['background-task-row', 'changed-task-row'],
    ['accumulated-item-${', 'changed-item-${'],
    ['min-w-0 truncate', 'min-w-0'],
    ['"data-testid":a', '"data-row-id":a'],
    ['className:f},d', 'className:f},other'],
    ['null,A.createElement(\"span\",{className:f},d)', 'null,A.createElement(\"div\",{},A.createElement(\"span\",{className:f},d))'],
    ['{...props},label)', '{...props},A.createElement(\"div\",{},label))'],
    ['A.createElement(Row,{testId:"background-task-row"', 'A.createElement(Other,{testId:"background-task-row"'],
  ]) {
    const changed = source.replace(before, after);
    assert(checkUiCompatibility(changed).missing.includes('activity-lane-label'), before);
  }
  const { client } = executingClient(source);
  assert.equal((await assertUiCompatibility(client, origin)).compatible, true);
});

function activityRows228Fixture() {
  return [
    'function Content({testId:a,label:d,labelClassName:f,detail:h,detailClassName:k,trailing:l}){return A.createElement(A.Fragment,null,A.createElement("span",{className:f},d),h&&A.createElement("span",{"data-testid":a?`${a}-detail`:void 0,className:k},h),l)}',
    'const Row=A.forwardRef(({testId:a,label:d,detail:f,hoverAction:h,href:n,onClick:q,...t},ref)=>{var b=A.createElement(Content,{testId:a,label:d,labelClassName:join("min-w-0 truncate"),detail:f});var v=h?A.createElement("div",{},A.createElement("button",{"aria-label":h.ariaLabel})):null;var props={...t,ref,"data-testid":a};return n?A.createElement("a",{...props,href:n},b):q?v?A.createElement("div",{...props,role:"button"},b,v):A.createElement("button",{...props},b):A.createElement("div",{...props},b,v)});',
    'A.createElement(Row,{testId:`accumulated-item-${section.key}`,label:item.label})',
    'A.createElement(Row,{testId:"background-task-row",label:task.label})',
  ].join(';');
}

test('2.28 rows keep labels as direct spans with optional sibling hover actions', async () => {
  const source = fixture().replace('activity-lane-label', 'removed-marker') + ';' + activityRows228Fixture();
  assert.deepEqual(checkUiCompatibility(source), { compatible: true, missing: [] });
  for (const [before, after] of [
    ['className:f},d', 'className:f},other'],
    ['"data-testid":a}', '"data-row-id":a}'],
    ['{...props,role:"button"},b,v)', '{...props,role:"button"},A.createElement("div",{},b),v)'],
    ['{...props},b,v)', '{...props},v,b)'],
    ['null,A.createElement("span",{className:f},d)', 'null,A.createElement("div",{},A.createElement("span",{className:f},d))'],
  ]) assert(checkUiCompatibility(source.replace(before, after)).missing.includes('activity-lane-label'), before);
  const { client } = executingClient(source);
  assert.equal((await assertUiCompatibility(client, origin)).compatible, true);
});
