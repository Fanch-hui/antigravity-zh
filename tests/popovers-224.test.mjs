import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(html, prepare = () => {}) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only'
  });
  prepare(dom.window.document);
  dom.window.eval(script);
  return dom;
}

test('2.24 project popover translates complete labels and keeps operation identifiers', () => {
  const dom = mount(`<div role="menu">
    <button role="menuitem" data-testid="group-header-copy-item"><svg></svg><span class="truncate">Copy Project Name</span></button>
    <button role="menuitem" data-testid="group-header-reveal-item"><svg></svg><span class="truncate">Reveal in Finder</span></button>
    <button role="menuitem" data-testid="group-header-delete-item" data-action="delete"><svg></svg><span class="truncate">Delete Project</span></button>
  </div><div data-testid="project-selector-item">Copy Project Name</div>
  <div data-testid="user-input-step">Delete Project</div><div data-testid="planner-response-text">Reveal in Finder</div>
  <pre>Copy Project Name</pre><div data-testid="terminal-tab-surface">Delete Project</div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('[role="menuitem"] span')].map(item => item.textContent),
    ['复制项目名称', '在 Finder 中显示', '删除项目']);
  assert.equal(doc.querySelector('[data-action="delete"]').dataset.testid, 'group-header-delete-item');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"]').textContent, 'Copy Project Name');
  assert.equal(doc.querySelector('[data-testid="user-input-step"]').textContent, 'Delete Project');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Reveal in Finder');
  assert.equal(doc.querySelector('pre').textContent, 'Copy Project Name');
  assert.equal(doc.querySelector('[data-testid="terminal-tab-surface"]').textContent, 'Delete Project');
  dom.window.close();
});

test('2.24 Windows project popover uses File Explorer wording from the app', () => {
  const dom = mount(`<div role="menu"><button data-testid="group-header-copy-item"><span class="truncate">Copy Workspace Name</span></button>
    <button data-testid="group-header-reveal-item"><span class="truncate">Show in File Explorer</span></button>
    <button data-testid="group-header-delete-item"><span class="truncate">Delete Workspace</span></button></div>`);
  assert.deepEqual([...dom.window.document.querySelectorAll('button span')].map(item => item.textContent),
    ['复制工作区名称', '在文件资源管理器中显示', '删除工作区']);
  dom.window.close();
});

test('2.24 tooltips keep nested shortcut elements and translate complete labels', () => {
  const dom = mount(`<div role="tooltip" id="settings"><div class="text-xs"><span>Settings</span><span class="ml-1 opacity-50">⌘,</span></div></div>
    <div role="tooltip" id="history"><div class="text-xs"><span>Conversation History</span><span class="ml-1 opacity-50">⌘Y</span></div></div>
    <div role="tooltip" id="pin">Pin<span class="ml-1 text-muted-foreground">⌘P</span></div>
    <div role="tooltip" id="new">New Conversation in Project</div>
    <div role="tooltip" id="send">Send Message ⏎</div>
    <div role="tooltip" id="send-active"><div class="flex flex-col gap-0.5 text-xs text-left max-w-[320px]"><div id="send-label"></div></div></div>`, doc => {
    doc.querySelector('#send-label').append(...['Send Message', ' ', 'Enter'].map(part => doc.createTextNode(part)));
  });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#settings').textContent, '设置⌘,');
  assert.equal(doc.querySelector('#history').textContent, '会话历史⌘Y');
  assert.equal(doc.querySelector('#pin').textContent, '置顶⌘P');
  assert.equal(doc.querySelector('#new').textContent, '在项目中新建会话');
  assert.equal(doc.querySelector('#send').textContent, '发送消息 ⏎');
  assert.equal(doc.querySelector('#send-label').textContent, '发送消息 Enter');
  assert.equal(doc.querySelector('#history .opacity-50').textContent, '⌘Y');
  assert.equal(doc.querySelector('#settings .opacity-50').textContent, '⌘,');
  dom.window.close();
});

test('2.24 protected content keeps the same tooltip phrases unchanged', () => {
  const phrase = 'New Conversation in Project';
  const dom = mount(`<div data-testid="user-input-step">${phrase}</div>
    <div data-testid="planner-response-text">Conversation History</div><code>Send Message ⏎</code>
    <div data-testid="terminal-tab-surface">Settings</div><span data-uri="file:///Pin">Pin</span>
    <div class="relative isolate flex items-center gap-3 p-3 rounded-xl"><div class="flex-1 min-w-0 flex flex-col gap-0.5 pr-4">
      <div class="font-medium text-sm text-foreground truncate"><a>Conversation History</a></div>
      <div class="text-xs text-muted-foreground truncate">New Conversation in Project</div></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="user-input-step"]').textContent, phrase);
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Conversation History');
  assert.equal(doc.querySelector('code').textContent, 'Send Message ⏎');
  assert.equal(doc.querySelector('[data-testid="terminal-tab-surface"]').textContent, 'Settings');
  assert.equal(doc.querySelector('[data-uri]').textContent, 'Pin');
  assert.equal(doc.querySelector('a').textContent, 'Conversation History');
  assert.equal(doc.querySelector('.pr-4 > .text-xs').textContent, phrase);
  dom.window.close();
});

test('2.24 split tooltip labels translate as complete phrases beside shortcut children', async () => {
  const dom = mount(`<div role="tooltip" id="split-new"><kbd>⌘N</kbd></div>
    <div role="tooltip" id="split-settings"><span class="ml-1 opacity-50">⌘,</span></div>
    <div role="tooltip" id="split-history"><kbd>⌘Y</kbd></div>`, doc => {
    for (const [id, parts] of [
      ['split-new', ['New ', 'Conversation in Project']],
      ['split-settings', ['Set', 'tings']],
      ['split-history', ['Conversation', ' History']]
    ]) {
      const element = doc.getElementById(id);
      element.prepend(...parts.map(part => doc.createTextNode(part)));
    }
  });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#split-new').textContent, '在项目中新建会话⌘N');
  assert.equal(doc.querySelector('#split-settings').textContent, '设置⌘,');
  assert.equal(doc.querySelector('#split-history').textContent, '会话历史⌘Y');
  assert.equal(doc.querySelector('#split-history kbd').textContent, '⌘Y');
  const shortcut = doc.querySelector('#split-new kbd');
  doc.querySelector('#split-new').replaceChildren('New ', 'Conversation in Project', shortcut);
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(doc.querySelector('#split-new').textContent, '在项目中新建会话⌘N');
  assert.equal(doc.querySelector('#split-new kbd'), shortcut);
  dom.window.close();
});

const row = (id, icon, text) => `<div class="flex items-center gap-1 text-xs text-muted-foreground">
  <span class="shrink-0 flex items-center"><svg><path d="${icon}"></path></svg></span><span class="truncate" id="${id}">${text}</span></div>`;
const checkCircle = 'M423.23-309.85L692.15-578.77L650-620.92';
const schedule = 'M618.92-298.92l42.15-42.15L510-492.16V-680';
const folder = 'M140-180q-24.75 0-42.375-17.625';
const card = contents => `<div class="bg-card text-foreground border flex flex-col gap-1.5 w-72 outline-none animate-slideIn !p-0 !gap-0 overflow-hidden">
  <div class="flex flex-col gap-1.5 p-3"><div class="text-sm text-foreground line-clamp-3 leading-snug break-words" id="conversation-name">Idle</div>
  <div class="flex flex-col gap-1.5">${contents}</div></div></div>`;

test('2.24 conversation hover details distinguish fixed status and update labels from dynamic names', async () => {
  const dom = mount(card(row('project-name', folder, 'Idle') +
    row('branch-name', folder, 'Updated 10月12日, 13:07') + row('status', checkCircle, 'Idle') +
    row('updated', schedule, 'Updated 10月12日, 13:07')));
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#conversation-name').textContent, 'Idle');
  assert.equal(doc.querySelector('#project-name').textContent, 'Idle');
  assert.equal(doc.querySelector('#branch-name').textContent, 'Updated 10月12日, 13:07');
  assert.equal(doc.querySelector('#status').textContent, '空闲');
  assert.equal(doc.querySelector('#updated').textContent, '更新于 10月12日, 13:07');
  doc.querySelector('#updated').textContent = 'Updated 2:58 AM';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(doc.querySelector('#updated').textContent, '更新于 2:58 AM');
  assert.equal(doc.querySelector('#branch-name').textContent, 'Updated 10月12日, 13:07');
  dom.window.close();
});

test('2.24 unknown hover icons preserve status-like names without positional guesses', () => {
  const dom = mount(card(row('project-name', folder, 'Idle') + row('unknown', folder, 'Idle')));
  assert.equal(dom.window.document.querySelector('#project-name').textContent, 'Idle');
  assert.equal(dom.window.document.querySelector('#unknown').textContent, 'Idle');
  dom.window.close();
});
