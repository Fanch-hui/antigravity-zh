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

test('history heading and icon-separated deprecation notice translate within their static shell', () => {
  const dom = mount(`<div class="sticky top-0 z-20 bg-background pt-8 pb-4 flex flex-col gap-4">
    <h1 class="text-lg font-medium text-foreground px-3 select-none m-0">Conversation History</h1>
    <div class="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm select-none">
      <svg aria-label="info"></svg><div class="flex flex-col gap-0.5 text-secondary-foreground">
        <span id="notice" class="font-medium text-foreground">This page is going away soon</span>
        <span id="search">Search conversations with <svg aria-label="search"></svg> in the top left.</span>
        <span id="archive">View archived in the sidebar <span class="whitespace-nowrap">(<svg aria-label="filter"></svg> menu)</span>.</span>
      </div>
    </div></div><h1 id="name">Conversation History</h1>
    <div data-testid="planner-response-text">This page is going away soon</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h1').textContent, '会话历史');
  assert.equal(doc.querySelector('#notice').textContent, '此页面即将停用');
  assert.equal(doc.querySelector('#search').textContent.replace(/\s+/g, ''), '使用左上角的来搜索对话。');
  assert.equal(doc.querySelector('#archive').textContent.replace(/\s+/g, ''), '在侧栏中查看已归档会话（菜单）。');
  assert.equal(doc.querySelectorAll('svg').length, 3);
  assert.equal(doc.querySelector('#search svg').getAttribute('aria-label'), '搜索');
  assert.equal(doc.querySelector('#name').textContent, 'Conversation History');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'This page is going away soon');
  dom.window.close();
});

test('settings navigation headings and project expansion controls retain dynamic project names', async () => {
  const dom = mount(`<div class="h-full w-full flex flex-col bg-sidebar">
    <div class="flex-1 flex flex-col gap-1 py-3 overflow-y-auto">
      <div class="px-4"><h1 class="m-0 text-xs font-medium text-muted-foreground select-none">Settings</h1></div>
      <button id="toggle" class="text-xs text-muted-foreground mx-4 py-1 hover:underline">Show All</button>
      <div class="px-4 mt-2"><h2 class="m-0 text-xs font-medium text-muted-foreground select-none">Not in Project</h2></div>
      <button data-testid="project-selector-item">Settings</button>
    </div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h1').textContent, '设置');
  assert.equal(doc.querySelector('h2').textContent, '未归入项目');
  assert.equal(doc.querySelector('#toggle').textContent, '显示全部');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"]').textContent, 'Settings');
  doc.querySelector('#toggle').textContent = 'Show Less';
  await settle(dom);
  assert.equal(doc.querySelector('#toggle').textContent, '收起');
  dom.window.close();
});

test('automation search and sidebar empty states translate without changing values or project labels', () => {
  const dom = mount(`<input placeholder="Search automations..." value="Search automations..." />
    <div data-sidebar-section-drop-id="example">
      <span class="pr-2.5 select-none text-sm opacity-30 h-8 flex items-center justify-start truncate whitespace-nowrap pl-2">No conversations yet</span>
    </div><span id="project" class="font-medium">No conversations yet</span>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('input').placeholder, '搜索自动化任务...');
  assert.equal(doc.querySelector('input').value, 'Search automations...');
  assert.equal(doc.querySelector('[data-sidebar-section-drop-id] span').textContent, '暂无会话');
  assert.equal(doc.querySelector('#project').textContent, 'No conversations yet');
  dom.window.close();
});

test('command policy menu descriptions translate without requiring a listbox or changing action identifiers', () => {
  const options = [
    ['ask', 'Request Review', 'Every command requires approval.', '请求审阅', '每条命令都需要批准。'],
    ['default', 'Default', 'Ask before sensitive operations.', '默认', '在进行敏感操作前询问。'],
    ['auto', 'Auto (Preview)', 'Automatically decide if commands run.', '自动（预览）', '自动决定是否执行命令。'],
    ['turbo', 'Turbo', 'Run all commands without restrictions.', 'Turbo', '不受限制地执行所有命令。'],
  ];
  const dom = mount(`<div data-testid="permissions-project-options">${options.map(([value, title, description]) =>
    `<div role="menuitem" data-testid="permissions-preset-option-${value}" data-value="${value}">
      <span class="flex min-w-0 flex-col"><span class="truncate">${title}</span>
      <span class="truncate text-xs text-muted-foreground">${description}</span></span></div>`).join('')}</div>`);
  for (const [value, , , title, description] of options) {
    const option = dom.window.document.querySelector(`[data-value="${value}"]`);
    assert.equal(option.querySelector('.truncate').textContent, title);
    assert.equal(option.querySelector('.text-muted-foreground').textContent, description);
    assert.equal(option.getAttribute('data-testid'), `permissions-preset-option-${value}`);
  }
  dom.window.close();
});

test('model badges use status wording while names, effort levels, creation actions and percentages retain context', () => {
  const dom = mount(`<div data-testid="model-selector-panel" role="menu">
    <div data-testid="model-selector-item" data-model-label="New">
      <span class="flex items-center gap-1.5 min-w-0"><span id="name" class="truncate text-xs text-left">New</span>
        <div id="new" class="bg-secondary rounded-full px-1.5 text-xs">New</div></span></div>
    <div role="menuitem"><span id="base" data-testid="model-selector-effort-group" data-model-base="Notice" class="truncate text-xs text-left">Notice</span>
      <span id="effort" class="shrink-0 opacity-70 text-xs">Medium</span>
      <div class="bg-secondary opacity-70 flex items-center gap-1 rounded-full px-1.5 text-xs" data-tooltip-id="example">
        <span id="notice">Notice</span><svg></svg></div></div>
    <div role="checkbox"><span class="flex items-center gap-1.5 min-w-0">
      <span id="best-name" class="truncate text-xs text-left">New</span>
      <div id="best-new" class="bg-secondary rounded-full px-1.5 text-xs">New</div></span></div>
    <div data-testid="model-selector-item"><span id="other-name">New</span></div>
    </div><div role="menu"><span data-testid="model-selector-effort-option">High</span></div>
    <div role="tooltip"><div class="max-w-[200px]">New</div></div>
    <div class="flex flex-col max-h-80 overflow-y-auto custom-scrollbar select-none p-1">
      <span id="group">Gemini 4 Argon</span><div class="flex flex-col min-w-0 pr-2">
      <span id="quota" class="text-foreground truncate">Gemini 4 Argon Weekly Limit</span></div><span id="pct">100%</span></div>
    <button id="create">New</button><div data-testid="planner-response-text">Gemini 4 Argon Weekly Limit</div>`);
  const doc = dom.window.document;
  for (const selector of ['#new', '#best-new']) assert.equal(doc.querySelector(selector).textContent, '新增');
  for (const selector of ['#name', '#best-name', '#other-name', '[role="tooltip"] > div']) assert.equal(doc.querySelector(selector).textContent, 'New');
  assert.equal(doc.querySelector('#base').textContent, 'Notice');
  assert.equal(doc.querySelector('#effort').textContent, 'Medium');
  assert.equal(doc.querySelector('[data-testid="model-selector-effort-option"]').textContent, 'High');
  assert.equal(doc.querySelector('#notice').textContent, '提示');
  assert.equal(doc.querySelector('#quota').textContent, 'Gemini 4 Argon 每周额度');
  assert.equal(doc.querySelector('#group').textContent, 'Gemini 4 Argon');
  assert.equal(doc.querySelector('#pct').textContent, '100%');
  assert.equal(doc.querySelector('#create').textContent, '新建');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Gemini 4 Argon Weekly Limit');
  dom.window.close();
});
