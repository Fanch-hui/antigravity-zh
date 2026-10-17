import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { surfaces } from '../runtime/surfaces.mjs';

const runtime = await readFile(new URL('../runtime/translator.js', import.meta.url), 'utf8');
const longSource = "Specifies the agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience.";
const records = [
  { id: 'review-settings', source: 'Review', target: '审阅', scope: 'settings' },
  { id: 'review-generic', source: 'Review', target: '查看', scope: 'generic' },
  { id: 'policy', source: 'Review Policy', target: '审阅策略', scope: 'settings' },
  { id: 'always', source: 'Always Proceed', target: '无需审阅，直接继续', scope: 'settings' },
  { id: 'description', source: longSource, target: '指定智能体请求审阅产物时的行为。产物是智能体创建的文档，用于丰富对话体验。', scope: 'settings' },
  { id: 'allow', source: 'Allow Once', target: '仅允许本次', scope: 'generic' },
  { id: 'search', source: 'Search', target: '搜索', scope: 'generic' },
  { id: 'no-files', source: 'No files', target: '没有文件', scope: 'generic' },
  { id: 'count', source: 'Review {0} changes', target: '审阅 {0} 项更改', scope: 'changes', template: { pattern: '^Review ([0-9]+) changes$', replacement: '审阅 $1 项更改' } },
  { id: 'setting-option', source: 'Require Review', target: '需要审阅', scope: 'settings' },
  { id: 'jsx-part', source: 'Click ', target: '点击 ', scope: 'generic' },
  { id: 'signin', source: 'Continue with Google', target: '使用 Google 继续', scope: 'dialog' },
  { id: 'feedback', source: 'Expected behavior', target: '预期行为', scope: 'dialog' },
  { id: 'run-label', source: 'Run command', target: '运行命令', scope: 'permission' },
  { id: 'dismiss', source: 'Dismiss toast', target: '关闭提示', scope: 'permission' },
  { id: 'terminal-policy', source: 'Terminal Command Auto Execution', target: '终端命令自动执行', scope: 'settings' },
  { id: 'artifact-proceed', source: 'Always Proceed', target: '无需审阅，直接继续', scope: 'settings', settingLabel: 'Review Policy' },
  { id: 'terminal-proceed', source: 'Always Proceed', target: '自动执行', scope: 'settings', settingLabel: 'Terminal Command Auto Execution' },
  { id: 'browser-proceed', source: 'Always Proceed', target: '自动执行', scope: 'settings', settingLabel: 'Browser Javascript Execution Policy' },
  { id: 'disable', source: '{0} {1} file{2}', target: '{0} {1} 个文件', scope: 'generic', captureMappings: { '0': { Disable: '禁用', Enable: '启用' }, '2': { s: '', '': '' } }, template: { pattern: '^(Disable|Enable) ([0-9]+) file(s?)$', replacement: '$1 $2 个文件$3' } },
  { id: 'price', source: 'Price: {0}', target: '费用：{0}', scope: 'generic', template: { pattern: '^Price: (.+)$', replacement: '费用：$$$1' } },
  { id: 'none', source: 'No {0} found', target: '未找到 {0}', scope: 'generic', template: { pattern: '^No (.+) found$', replacement: '未找到 $1' } },
  { id: 'conversations', source: '{0} conversation{1}', target: '{0} 个会话', scope: 'generic', captureMappings: { '1': { s: '', '': '' } }, template: { pattern: '^([0-9]+) conversation(s?)$', replacement: '$1 个会话$2' } }
];

function mount(html, url = 'https://127.0.0.1:42000/') {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, { url, runScripts: 'outside-only' });
  const script = runtime.replace('/*__AGY_ZH_DICTIONARY__*/ null', () => JSON.stringify(records))
    .replace('/*__AGY_ZH_SURFACES__*/ null', () => JSON.stringify(surfaces));
  dom.window.eval(script);
  return dom;
}

const settle = dom => new Promise(resolve => dom.window.setTimeout(resolve, 0));

test('runtime startup timing ends after the first translation pass', () => {
  const dom = mount('<button>Allow Once</button>');
  const runtimeState = dom.window.__AGY_ZH_RUNTIME__;
  assert.equal(dom.window.document.querySelector('button').textContent, '仅允许本次');
  const { scriptStartedMs, firstPassStartedMs, firstPassMs, readyMs } = runtimeState.timing;
  assert.ok(firstPassStartedMs >= scriptStartedMs);
  assert.ok(firstPassMs >= 0);
  assert.ok(readyMs >= firstPassStartedMs + firstPassMs);
  assert.ok(Object.isFrozen(runtimeState.timing));
  dom.window.close();
});

test('generic phrases do not combine text around inline content without a specific label selector', () => {
  const dom = mount('<button id="control"><kbd>Enter</kbd></button>');
  const button = dom.window.document.getElementById('control');
  const shortcut = button.querySelector('kbd');
  button.prepend(...['Allow ', 'Once'].map(text => dom.window.document.createTextNode(text)));
  dom.window.__AGY_ZH_RUNTIME__.translate(button);
  assert.equal(button.textContent, 'Allow OnceEnter');
  assert.equal(button.querySelector('kbd'), shortcut);
  dom.window.close();
});

test('uses actual settings structure and contextual options; retains whitespace and long descriptions', () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4">
    <span id="policy" >  Review Policy\n</span><span id="specific">Review</span>
    <span id="description">${longSource}</span><button id="always">Always Proceed</button>
    <span id="dropdown-label-1">Review Policy</span><button aria-labelledby="dropdown-label-1 dropdown-value-1"><span id="dropdown-value-1">Always Proceed</span></button>
  </div><button id="generic">Review</button>
  <div role="listbox" aria-labelledby="dropdown-label-1"><div role="option" id="portal">Require Review</div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#policy').textContent, '  审阅策略\n');
  assert.equal(doc.querySelector('#specific').textContent, '审阅');
  assert.equal(doc.querySelector('#generic').textContent, '查看');
  assert.equal(doc.querySelector('#always').textContent, '无需审阅，直接继续');
  assert.equal(doc.querySelector('#description').textContent, records[4].target);
  assert.equal(doc.querySelector('#portal').textContent, '需要审阅');
  dom.window.close();
});

test('preserves user messages, AI markdown, code, terminal output, paths, project names, and input values', () => {
  const dom = mount(`<div data-testid="conversation-view">
    <div data-testid="user-input-step"><span>Review</span><button title="Allow Once">Allow Once</button></div>
    <div data-testid="planner-response-text"><p>Review</p></div>
    <div class="md-divider-spacing"><p>Review</p><button>Allow Once</button></div>
    <button id="control">Allow Once</button>
  </div><pre><code><span title="Review">Review</span></code></pre>
  <div class="xterm"><span>Review</span></div><div data-testid="sidecar-logs-content">Review</div>
  <span data-testid="file-title-name" title="Review">Review</span>
  <button data-testid="project-selector-item">Review</button>
  <span data-uri="file:///Review" title="Review">Review</span>
  <input id="input" value="Review" placeholder="Search" title="/tmp/Review" />
  <div contenteditable="true"><span>Review</span></div><p id="unscoped">Review</p>`);
  const doc = dom.window.document;
  for (const selector of ['[data-testid="user-input-step"] span', '[data-testid="planner-response-text"] p', '.md-divider-spacing p', 'code span', '.xterm span', '[data-testid="file-title-name"]', '[data-testid="project-selector-item"]', '[data-uri]', '[contenteditable] span', '#unscoped']) {
    assert.equal(doc.querySelector(selector).textContent, 'Review', selector);
  }
  assert.equal(doc.querySelector('[data-testid="user-input-step"] button').textContent, 'Allow Once');
  assert.equal(doc.querySelector('.md-divider-spacing button').textContent, 'Allow Once');
  assert.equal(doc.querySelector('code span').title, 'Review');
  assert.equal(doc.querySelector('#control').textContent, '仅允许本次');
  assert.equal(doc.querySelector('#input').value, 'Review');
  assert.equal(doc.querySelector('#input').placeholder, '搜索');
  assert.equal(doc.querySelector('#input').title, '/tmp/Review');
  dom.window.close();
});

test('translates complete static paragraphs and restricted templates while keeping variables', () => {
  const dom = mount(`<div data-testid="empty-file-view"><p id="empty">No files</p></div>
    <div data-testid="review-changes-loading"><span id="count"> Review 3 changes </span><span id="unknown">Review file.txt changes</span></div>
    <p id="plain">No files</p><button id="partial">Please Review</button><button id="split">Click <span>/tmp/project</span></button>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#empty').textContent, '没有文件');
  assert.equal(doc.querySelector('#count').textContent, ' 审阅 3 项更改 ');
  assert.equal(doc.querySelector('#unknown').textContent, 'Review file.txt changes');
  assert.equal(doc.querySelector('#plain').textContent, 'No files');
  assert.equal(doc.querySelector('#partial').textContent, 'Please Review');
  assert.equal(doc.querySelector('#split').textContent, '点击 /tmp/project');
  assert.equal(doc.querySelector('#split span').textContent, '/tmp/project');
  dom.window.close();
});

test('handles insertion, attributes, repeated framework rendering, and settles without observer loops', async () => {
  const dom = mount('<div id="container"></div><button id="rerender">Review</button>');
  const doc = dom.window.document;
  let mutations = 0;
  const monitor = new dom.window.MutationObserver(records => { mutations += records.length; });
  monitor.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true });
  const button = doc.createElement('button');
  button.textContent = 'Allow Once';
  button.setAttribute('aria-label', 'Review');
  doc.querySelector('#container').append(button);
  await settle(dom);
  assert.equal(button.textContent, '仅允许本次');
  assert.equal(button.getAttribute('aria-label'), '查看');
  button.title = 'Review';
  doc.querySelector('#rerender').firstChild.nodeValue = 'Review';
  await settle(dom);
  assert.equal(button.title, '查看');
  assert.equal(doc.querySelector('#rerender').textContent, '查看');
  const settledCount = mutations;
  await settle(dom);
  assert.equal(mutations, settledCount);
  assert.ok(mutations < 20);
  monitor.disconnect();
  dom.window.close();
});

test('does not install on external origins or a child frame', () => {
  for (const url of ['https://example.com/', 'http://127.0.0.1:42000/', 'https://localhost:42000/']) {
    const dom = mount('<button>Review</button>', url);
    assert.equal(dom.window.__AGY_ZH_RUNTIME__, undefined);
    assert.equal(dom.window.document.querySelector('button').textContent, 'Review');
    dom.window.close();
  }
  const dom = mount('<iframe></iframe>');
  const child = dom.window.document.querySelector('iframe').contentWindow;
  child.document.body.innerHTML = '<button>Review</button>';
  child.eval(runtime.replace('/*__AGY_ZH_DICTIONARY__*/ null', () => JSON.stringify(records)));
  assert.equal(child.__AGY_ZH_RUNTIME__, undefined);
  assert.equal(child.document.querySelector('button').textContent, 'Review');
  dom.window.close();
});


test('matches actual login, feedback, and approval toast shells without rewriting toast user content', () => {
  const dom = mount(`<div class="entrance-auth-panel"><button id="sign-in">Continue with Google</button></div>
    <div class="max-w-2xl mx-auto flex-col gap-4"><ul><li id="feedback">Expected behavior</li></ul></div>
    <div class="border-l-orange-500">
      <button class="truncate" id="title">Review</button><p id="question">Review</p>
      <p class="font-medium" id="permission">Run command</p>
      <button id="user-option">Allow Once</button>
      <div class="justify-start"><button id="allow">Allow Once</button></div>
      <button id="dismiss" aria-label="Dismiss toast">×</button>
    </div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#sign-in').textContent, '使用 Google 继续');
  assert.equal(doc.querySelector('#feedback').textContent, '预期行为');
  assert.equal(doc.querySelector('#permission').textContent, '运行命令');
  assert.equal(doc.querySelector('#dismiss').getAttribute('aria-label'), '关闭提示');
  assert.equal(doc.querySelector('#allow').textContent, '仅允许本次');
  assert.equal(doc.querySelector('#title').textContent, 'Review');
  assert.equal(doc.querySelector('#question').textContent, 'Review');
  assert.equal(doc.querySelector('#user-option').textContent, 'Allow Once');
  dom.window.close();
});


test('distinguishes artifact, terminal, and browser policy options after setting labels are translated', async () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4">
    <span id="dropdown-label-artifact">Review Policy</span>
    <button aria-labelledby="dropdown-label-artifact"><span id="artifact">Always Proceed</span></button>
    <span id="dropdown-label-terminal">Terminal Command Auto Execution</span>
    <button aria-labelledby="dropdown-label-terminal"><span id="terminal">Always Proceed</span></button>
    <span id="dropdown-label-browser">Browser Javascript Execution Policy</span>
    <button aria-labelledby="dropdown-label-browser"><span id="browser">Always Proceed</span></button>
  </div><div role="listbox" aria-labelledby="dropdown-label-terminal"><span role="option" id="portal-policy">Always Proceed</span></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#dropdown-label-terminal').textContent, '终端命令自动执行');
  assert.equal(doc.querySelector('#artifact').textContent, '无需审阅，直接继续');
  assert.equal(doc.querySelector('#terminal').textContent, '自动执行');
  assert.equal(doc.querySelector('#browser').textContent, '自动执行');
  assert.equal(doc.querySelector('#portal-policy').textContent, '自动执行');
  doc.querySelector('[role="listbox"]').setAttribute('aria-labelledby', 'dropdown-label-artifact');
  await settle(dom);
  assert.equal(doc.querySelector('#portal-policy').textContent, '无需审阅，直接继续');
  dom.window.close();
});

test('maps template captures by placeholder index and preserves dollar signs in captured values', () => {
  const dom = mount('<button id="disable">Disable 3 files</button><button id="enable">Enable 1 file</button><button id="price">Price: $1.20</button>');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#disable').textContent, '禁用 3 个文件');
  assert.equal(doc.querySelector('#enable').textContent, '启用 1 个文件');
  assert.equal(doc.querySelector('#price').textContent, '费用：$$1.20');
  dom.window.close();
});


function textParts(dom, parent, parts) {
  const nodes = parts.map(part => dom.window.document.createTextNode(part));
  parent.append(...nodes);
  return nodes;
}

test('combines sibling text nodes, retains their identity, and reuses original fragments after name updates', async () => {
  const dom = mount('<div id="empty" role="status"></div><div data-testid="user-input-step" id="user"></div><input id="input" value="No Report found" />');
  const doc = dom.window.document;
  const parent = doc.querySelector('#empty');
  const nodes = textParts(dom, parent, ['No ', 'Report', ' found']);
  const comment = doc.createComment('react-text-boundary');
  parent.insertBefore(comment, nodes[1]);
  const userNodes = textParts(dom, doc.querySelector('#user'), ['No ', 'Report', ' found']);
  await settle(dom);
  assert.equal(parent.textContent, '未找到 Report');
  assert.deepEqual([...parent.childNodes], [nodes[0], comment, nodes[1], nodes[2]]);
  assert.deepEqual(nodes.map(node => node.nodeValue), ['未找到 Report', '', '']);
  assert.deepEqual(userNodes.map(node => node.nodeValue), ['No ', 'Report', ' found']);
  assert.equal(doc.querySelector('#input').value, 'No Report found');
  nodes[1].nodeValue = 'New Report';
  await settle(dom);
  assert.equal(parent.textContent, '未找到 New Report');
  nodes.forEach((node, position) => { node.nodeValue = ['No ', 'Budget', ' found'][position]; });
  await settle(dom);
  assert.equal(parent.textContent, '未找到 Budget');
  nodes[1].remove();
  await settle(dom);
  assert.equal(parent.textContent, 'No  found');
  assert.equal(parent.firstChild, nodes[0]);
  assert.equal(parent.lastChild, nodes[2]);
  dom.window.close();
});

test('combines numerical plural fragments without merging nodes or replacing element children', async () => {
  const dom = mount('<div role="status" id="count"></div><button id="mixed">No <span>Report</span> found</button>');
  const doc = dom.window.document;
  const parent = doc.querySelector('#count');
  const nodes = textParts(dom, parent, ['3', ' conversation', 's']);
  const mixedNodes = [...doc.querySelector('#mixed').childNodes];
  let mutations = 0;
  const monitor = new dom.window.MutationObserver(records => { mutations += records.length; });
  monitor.observe(parent, { subtree: true, characterData: true });
  await settle(dom);
  assert.equal(parent.textContent, '3 个会话');
  assert.deepEqual([...parent.childNodes], nodes);
  nodes[0].nodeValue = '1';
  nodes[2].nodeValue = '';
  await settle(dom);
  assert.equal(parent.textContent, '1 个会话');
  assert.deepEqual(nodes.map(node => node.nodeValue), ['1 个会话', '', '']);
  assert.equal(doc.querySelector('#mixed').textContent, 'No Report found');
  assert.deepEqual([...doc.querySelector('#mixed').childNodes], mixedNodes);
  const settledCount = mutations;
  await settle(dom);
  assert.equal(mutations, settledCount);
  assert.ok(mutations < 20);
  monitor.disconnect();
  dom.window.close();
});
