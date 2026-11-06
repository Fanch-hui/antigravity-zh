import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const settle = dom => new Promise(resolve => dom.window.setTimeout(resolve, 0));
function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  dom.window.eval(script);
  return dom;
}

const projectTrigger = (id, label) => `<div role="menuitem" data-testid="${id}">
  <span class="flex items-center"><span class="flex items-center"><svg></svg><span class="truncate">${label}</span></span></span></div>`;
const search = (id, label) => `<div data-testid="${id}"><svg></svg><input placeholder="${label}" aria-label="${label}" value="${label}"></div>`;

test('project submenu labels and search prompts translate without changing names or typed values', () => {
  const dom = mount(`<div role="menu">
    ${projectTrigger('project-selector-this-machine-trigger', 'This Computer')}
    ${projectTrigger('project-selector-cloud-trigger', 'Remote')}
    ${projectTrigger('project-selector-machine-trigger-host', 'Remote')}
    <div data-testid="project-selector-item"><span title="This Computer">This Computer</span></div>
    <div data-testid="branch-option">Remote</div>
  </div>
  ${search('project-selector-search', 'Search Projects')}
  ${search('project-selector-this-machine-search', 'Search Projects…')}
  ${search('project-selector-machine-search-host', 'Search Workspaces…')}
  ${search('project-selector-cloud-search', 'Search Remote…')}
  <input placeholder="Search Remote…" value="Search Remote…">`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="project-selector-this-machine-trigger"] .truncate').textContent, '此电脑');
  assert.equal(doc.querySelector('[data-testid="project-selector-cloud-trigger"] .truncate').textContent, '远程');
  assert.equal(doc.querySelector('[data-testid="project-selector-machine-trigger-host"] .truncate').textContent, 'Remote');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"]').textContent, 'This Computer');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"] span').title, 'This Computer');
  assert.equal(doc.querySelector('[data-testid="branch-option"]').textContent, 'Remote');
  const inputs = [...doc.querySelectorAll('input')];
  assert.deepEqual(inputs.map(input => input.placeholder), ['搜索项目', '搜索项目…', '搜索工作区…', '搜索远程项目…', 'Search Remote…']);
  assert.deepEqual(inputs.slice(0, 4).map(input => input.getAttribute('aria-label')), ['搜索项目', '搜索项目…', '搜索工作区…', '搜索远程项目…']);
  assert.deepEqual(inputs.map(input => input.value), ['Search Projects', 'Search Projects…', 'Search Workspaces…', 'Search Remote…', 'Search Remote…']);
  dom.window.close();
});

test('permission headings translate only in the preset menu and retain preset identity', () => {
  const dom = mount(`<div data-testid="permissions-project-options">
    ${['Local Permissions', 'Remote Permissions', 'This Conversation', 'Project Settings', 'Workspace Settings'].map(label =>
      `<div class="flex items-center gap-1 px-2 pb-1 select-none"><div class="text-xs px-2 pb-1 text-muted-foreground font-medium select-none !p-0 !pb-0 truncate">${label}</div></div>`).join('')}
    <div data-testid="permissions-preset-option-turbo" data-value="turbo"><span class="truncate">Turbo</span></div>
  </div><div data-testid="project-selector-item">Local Permissions</div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('[data-testid="permissions-project-options"] > div.flex > div')]
    .map(node => node.textContent), ['本机权限', '远程权限', '当前会话', '项目设置', '工作区设置']);
  assert.equal(doc.querySelector('[data-value="turbo"]').textContent, 'Turbo');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"]').textContent, 'Local Permissions');
  dom.window.close();
});

test('voice mode controls and fixed tooltips translate while shortcuts stay unchanged', async () => {
  const dom = mount(`<button data-testid="voice-start-button" aria-label="Start Voice mode"></button>
    <button data-testid="voice-end-button" aria-label="End Voice mode"></button>
    <button data-testid="voice-call-end" aria-label="End Live chat"></button>
    <button data-testid="voice-mute-button" aria-label="Mute mic"></button>
    <div class="compact-tooltip" role="tooltip">Start Voice mode</div>
    <div class="compact-tooltip" role="tooltip">Mute mic (⌘ M)</div>
    <div data-testid="planner-response-text">Start Voice mode</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="voice-start-button"]').getAttribute('aria-label'), '启动语音模式');
  assert.equal(doc.querySelector('[data-testid="voice-end-button"]').getAttribute('aria-label'), '结束语音模式');
  assert.equal(doc.querySelector('[data-testid="voice-call-end"]').getAttribute('aria-label'), '结束实时聊天');
  assert.equal(doc.querySelector('[data-testid="voice-mute-button"]').getAttribute('aria-label'), '关闭麦克风');
  const tooltips = doc.querySelectorAll('[role="tooltip"]');
  assert.equal(tooltips[0].textContent, '启动语音模式');
  assert.equal(tooltips[1].textContent, '关闭麦克风（⌘ M）');
  doc.querySelector('[data-testid="voice-mute-button"]').setAttribute('aria-label', 'Unmute mic');
  tooltips[1].textContent = 'Unmute mic (⌘ M)';
  await settle(dom);
  assert.equal(doc.querySelector('[data-testid="voice-mute-button"]').getAttribute('aria-label'), '打开麦克风');
  assert.equal(tooltips[1].textContent, '打开麦克风（⌘ M）');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Start Voice mode');
  dom.window.close();
});

test('user message timestamps translate at fixed action leaves, not message content', async () => {
  const timestamp = value => `<span data-screenshot-volatile="true" class="text-xs text-muted-foreground select-none px-1 mr-1 self-center whitespace-nowrap">${value}</span>`;
  const spoof = `<div data-testid="user-message-actions">${timestamp('17h ago')}</div>`;
  const dom = mount(`<div data-testid="user-input-step">
    <div data-testid="user-message-bubble"><div data-testid="user-message-content">17h ago${spoof}</div></div>
    <div data-testid="user-message-actions">${timestamp('17h ago')}<button>Copy</button></div>
  </div>
  <div data-testid="user-input-step"><div data-testid="user-message-bubble">
    <div class="relative flex-1 p-0.5">just now${spoof}</div>
    <div class="user-input-buttons-container">${timestamp('just now')}</div>
  </div></div><div data-testid="planner-response-text">17h ago</div>`);
  const doc = dom.window.document;
  const actions = doc.querySelectorAll('[data-testid="user-message-actions"]');
  assert.equal(actions[0].textContent, '17h ago');
  assert.equal(actions[1].querySelector('span').textContent, '17h 前');
  assert.equal(actions[2].textContent, '17h ago');
  assert.equal(doc.querySelector('.user-input-buttons-container > span').textContent, '刚刚');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, '17h ago');
  actions[1].querySelector('span').textContent = '2mo ago';
  await settle(dom);
  assert.equal(actions[1].querySelector('span').textContent, '2mo 前');
  actions[1].querySelector('span').textContent = 'abc ago';
  await settle(dom);
  assert.equal(actions[1].querySelector('span').textContent, 'abc ago');
  dom.window.close();
});

test('background task empty state translates without changing task output or ordinary text', () => {
  const empty = '<div class="flex items-center justify-center text-sm w-full h-full text-secondary-foreground">Task not found</div>';
  const dom = mount(`<div class="browser-hole-ancestor">${empty}<div data-testid="terminal-surface">${empty}</div></div>${empty}`);
  const states = dom.window.document.querySelectorAll('div.flex.items-center.justify-center');
  assert.deepEqual([...states].map(node => node.textContent), ['未找到任务', 'Task not found', 'Task not found']);
  dom.window.close();
});
