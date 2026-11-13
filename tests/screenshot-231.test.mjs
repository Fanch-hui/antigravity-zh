import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  dom.window.eval(script);
  return dom;
}

test('2.31 settings sidebar restores headings and expansion controls without touching project names', () => {
  const dom = mount(`<aside data-testid="settings-sidebar" class="h-full w-full flex flex-col bg-sidebar">
    <div class="flex-1 flex flex-col gap-1 py-3 overflow-y-auto">
      <div class="px-4"><h1 class="m-0 text-sm font-medium text-muted-foreground select-none">Settings</h1></div>
      <div class="px-4 mt-2"><h2 class="m-0 text-sm font-medium text-muted-foreground select-none">Workspaces</h2></div>
      <div class="px-4 mt-2"><h2 class="m-0 text-sm font-medium text-muted-foreground select-none">Projects</h2></div>
      <div class="flex flex-col gap-0.5"><button class="text-sm mx-4 py-1 hover:underline">Show All</button>
        <button><span class="flex-1 truncate text-foreground select-none">Settings</span></button></div>
      <div class="px-4 mt-2"><h2 class="m-0 text-sm font-medium text-muted-foreground select-none">Not in Project</h2></div>
    </div></aside>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('h1,h2')].map(el => el.textContent), ['设置', '工作区', '项目', '未归入项目']);
  assert.equal(doc.querySelector('button').textContent, '显示全部');
  assert.equal(doc.querySelector('button > span').textContent, 'Settings');
  dom.window.close();
});

test('current layout cards, fixed section names and subscription explanation translate', () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4">
    <div class="space-y-2"><div class="flex flex-col gap-1"><div><h3 class="m-0 font-medium">Interface Layout</h3></div></div></div>
    <div role="radiogroup" aria-label="Interface Layout">
      <button data-testid="mode-option-non-technical" aria-label="Knowledge Work"><div class="mt-2"><span class="font-medium text-foreground leading-normal">Knowledge Work</span></div><div class="text-sm text-muted-foreground mt-0.5 leading-snug">Simplified interface for research, writing, and everyday tasks.</div></button>
      <button data-testid="mode-option-developer" aria-label="Software Engineering"><div class="mt-2"><span class="font-medium text-foreground leading-normal">Software Engineering</span></div><div class="text-sm text-muted-foreground mt-0.5 leading-snug">Full interface for coding, developer tools, and managing agents.</div></button>
    </div>
    <div class="space-y-2"><div class="flex flex-col gap-1"><div><h3 class="m-0 font-medium">Folders</h3></div></div></div>
    <div class="py-2 px-3 justify-between"><div class="flex-1 flex flex-col gap-0.5"><span class="text-sm text-muted-foreground whitespace-pre-wrap">You can upgrade to a Google AI Ultra plan to receive higher rate limits.</span></div></div>
    <input value="Knowledge Work"><div data-testid="planner-response-text">Software Engineering</div>
  </div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('h3')].map(el => el.textContent), ['界面布局', '文件夹']);
  assert.equal(doc.querySelector('[role="radiogroup"]').getAttribute('aria-label'), '界面布局');
  assert.deepEqual([...doc.querySelectorAll('button')].map(el => [el.getAttribute('aria-label'), el.querySelector('span').textContent]), [['知识工作', '知识工作'], ['软件开发', '软件开发']]);
  assert.deepEqual([...doc.querySelectorAll('.leading-snug')].map(el => el.textContent), ['适用于调研、写作和日常任务的简洁界面。', '提供编程、开发工具和智能体管理功能的完整界面。']);
  assert.equal(doc.querySelector('.whitespace-pre-wrap').textContent, '您可以升级到 Google AI Ultra 方案，以获得更高的使用限额。');
  assert.equal(doc.querySelector('input').value, 'Knowledge Work');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Software Engineering');
  dom.window.close();
});

test('shared menu labels restore local and remote permission headings and project selection labels', () => {
  const dom = mount(`<div role="menu" data-testid="permissions-project-options"><div class="flex items-center gap-1 px-2 pb-1 select-none"><div class="text-sm px-2 pb-1 text-muted-foreground font-medium select-none">Local Permissions</div></div></div>
    <div role="menu" data-testid="project-selector-list"><div class="text-sm px-2 pb-1 text-muted-foreground font-medium select-none">Recent</div><button data-testid="project-selector-item"><span class="truncate flex-1 min-w-0">Recent</span></button></div>
    <div role="menu"><span data-testid="sort-folders-submenu-trigger">Sort Projects</span></div>
    <div role="tooltip" class="compact-tooltip"><div class="text-sm"><span>Select Project</span><span class="ml-1 opacity-50">⌘;</span></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="permissions-project-options"] .text-sm').textContent, '本机权限');
  assert.equal(doc.querySelector('[data-testid="project-selector-list"] > div').textContent, '最近使用');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"] span').textContent, 'Recent');
  assert.equal(doc.querySelector('[data-testid="sort-folders-submenu-trigger"]').textContent, '项目排序');
  assert.equal(doc.querySelector('[role="tooltip"] span').textContent, '选择项目');
  assert.equal(doc.querySelector('[role="tooltip"] span:last-child').textContent, '⌘;');
  dom.window.close();
});

test('related project empty states and all permission menu heading variants share the typography repair', () => {
  const cases = [
    ['No matching projects', '没有匹配的项目'], ['No matching workspaces', '没有匹配的工作区'],
    ['No remote projects', '暂无远程项目'], ['No remote workspaces', '暂无远程工作区'],
    ['No projects found', '未找到项目'], ['No workspaces found', '未找到工作区'],
  ];
  const headings = [['Local Permissions', '本机权限'], ['Remote Permissions', '远程权限'], ['This Conversation', '当前会话'], ['Project Settings', '项目设置'], ['Workspace Settings', '工作区设置']];
  for (const [source, target] of cases) {
    const dom = mount(`<div data-testid="project-selector-list"><div class="text-sm px-2 py-2 text-muted-foreground">${source}</div></div>`);
    assert.equal(dom.window.document.querySelector('[data-testid="project-selector-list"] > div').textContent, target);
    dom.window.close();
  }
  for (const [source, target] of headings) {
    const dom = mount(`<div data-testid="permissions-project-options"><div class="flex items-center gap-1 px-2 pb-1 select-none"><div class="text-sm px-2 pb-1 text-muted-foreground font-medium select-none">${source}</div></div></div>`);
    assert.equal(dom.window.document.querySelector('.text-sm').textContent, target);
    dom.window.close();
  }
});

test('model badges and complete metadata explanations translate independently of model names and efforts', () => {
  const dom = mount(`<div data-testid="model-selector-panel"><button data-testid="model-selector-item"><span class="truncate text-sm text-left">Orchestrator (Argon)</span><div class="bg-secondary rounded-full px-1.5 text-sm"><span>New</span></div></button>
    <button><span data-testid="model-selector-effort-group" class="truncate text-sm text-left">Claude Opus 5.5</span><span class="shrink-0 opacity-70 text-sm">Medium</span><div class="bg-secondary rounded-full px-1.5 text-sm"><span>New</span></div></button>
    <button data-testid="model-selector-item"><span class="truncate text-sm text-left">GPT-OSS 120B (Medium)</span><div class="bg-secondary rounded-full px-1.5 text-sm"><span>Notice</span></div></button>
    <button data-testid="model-selector-item"><span class="truncate text-sm text-left">Gemini 4 Carbon</span><div class="bg-secondary rounded-full px-1.5 text-sm">Unavailable</div></button></div>
    <div role="tooltip"><div class="max-w-[200px]">Argon that may offload routine steps to Hydrogen. Same Argon-level quality, fewer tokens used.</div></div>
    <div role="tooltip"><div class="max-w-[200px]">GPT-OSS will be removed from Antigravity on November 18, 2026.</div></div>
    <div role="tooltip"><div class="max-w-[200px]">Gemini 4 Carbon is currently available to Ultra plan subscribers.</div></div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('.rounded-full')].map(el => el.textContent), ['新增', '新增', '提示', '不可用']);
  assert.deepEqual([...doc.querySelectorAll('.truncate.text-left')].map(el => el.textContent), ['Orchestrator (Argon)', 'Claude Opus 5.5', 'GPT-OSS 120B (Medium)', 'Gemini 4 Carbon']);
  assert.equal(doc.querySelector('.opacity-70').textContent, 'Medium');
  assert.deepEqual([...doc.querySelectorAll('[role="tooltip"] > div')].map(el => el.textContent), ['可将常规步骤交给 Hydrogen 处理的 Argon。保持 Argon 级别的质量，同时减少 token 用量。', 'GPT-OSS 将于 2026 年 11 月 18 日从 Antigravity 下线。', 'Gemini 4 Carbon 目前仅向 Ultra 方案订阅用户开放。']);
  dom.window.close();
});

test('automation and customization pages restore fixed headings and empty messages', () => {
  const dom = mount(`<div data-testid="sidecars-view" data-sidecar-type="automation"><div class="min-w-0 px-3"><h1 class="text-xl font-medium text-foreground select-none m-0">Automations</h1></div>
    <div class="px-2.5 py-16" data-testid="sidecar-list-empty"><p class="m-0 text-lg text-foreground">No automations yet</p><p class="m-0 mt-1 max-w-md text-muted-foreground">Run a prompt on a schedule, like a morning summary of yesterday's changes. Runs show up here.</p></div>
    <span data-testid="automation-name">Automations</span><div data-testid="automation-instructions-markdown">No automations yet</div></div>
    <div class="w-full max-w-4xl mx-auto px-4 sm:px-8 pt-8 pb-4 flex flex-col gap-4"><div class="flex flex-wrap items-center justify-between gap-2 sm:gap-4"><h1 class="text-xl font-medium text-foreground select-none sm:px-3 m-0">Customizations</h1></div><div><input data-testid="customizations-search" placeholder="Search customizations..."></div></div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('h1')].map(el => el.textContent), ['自动化任务', '自定义配置']);
  assert.equal(doc.querySelector('[data-testid="sidecar-list-empty"] p').textContent, '暂无自动化');
  assert.equal(doc.querySelector('[data-testid="sidecar-list-empty"] p:last-child').textContent, '按计划运行提示词，例如每天早上汇总昨天的变更。运行记录将显示在这里。');
  assert.equal(doc.querySelector('[data-testid="automation-name"]').textContent, 'Automations');
  assert.equal(doc.querySelector('[data-testid="automation-instructions-markdown"]').textContent, 'No automations yet');
  dom.window.close();
});

test('conversation placeholder variants translate without relying on inherited typography', () => {
  const messages = [
    ['No conversations yet', '暂无会话'], ['No matching conversations', '没有匹配的会话'],
    ['No archived conversations', '暂无已归档的会话'], ['No pinned conversations', '暂无已固定的会话'],
    ['No coordinators', '暂无协调者'], ['Drop to add to group', '拖放以添加到分组'],
    ['1 pinned conversation', '1 个已固定的会话'], ['2 pinned conversations', '2 个已固定的会话'],
  ];
  for (const [source, target] of messages) {
    const dom = mount(`<div data-testid="conversation-list-sidebar"><div data-sidebar-section-drop-id="main-section-header"><span class="pr-2.5 select-none opacity-30 h-8 flex items-center justify-start truncate whitespace-nowrap pl-2">${source}</span></div><div data-sidebar-row-id="sample"><a><span class="truncate">${source}</span></a></div></div>`);
    assert.equal(dom.window.document.querySelector('[data-sidebar-section-drop-id] > span').textContent, target);
    assert.equal(dom.window.document.querySelector('[data-sidebar-row-id] span').textContent, source);
    dom.window.close();
  }
});

test('all home greeting variants preserve the supplied name and leave matching prose alone', () => {
  const greetings = [
    ['Hey Demo, what should we build today?', '你好，Demo，今天想做些什么？'],
    ['Welcome back, Demo. Where should we pick up?', '欢迎回来，Demo。我们从哪里继续？'],
    ["Good to see you, Demo. What's next?", '很高兴见到你，Demo。接下来做些什么？'],
    ['Hey there, what should we build today?', '你好，今天想做些什么？'],
    ['Welcome back. Where should we pick up?', '欢迎回来。我们从哪里继续？'],
    ["Good to see you. What's next?", '很高兴见到你。接下来做些什么？'],
  ];
  for (const [source, target] of greetings) {
    const dom = mount(`<div data-testid="home-greeting"><h1 class="home-greeting-title">${source}</h1></div><div data-testid="planner-response-text">${source}</div>`);
    assert.equal(dom.window.document.querySelector('h1').textContent, target);
    assert.equal(dom.window.document.querySelector('[data-testid="planner-response-text"]').textContent, source);
    dom.window.close();
  }
});
