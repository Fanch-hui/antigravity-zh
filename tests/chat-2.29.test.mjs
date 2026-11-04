import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(html, prepare = () => {}) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  prepare(dom.window.document);
  dom.window.eval(script);
  return dom;
}

test('context usage translates counts and descriptions while preserving conversation text', () => {
  const info = 'Compacted since the last response; counts update after the next one.';
  const dom = mount(`<div data-testid="context-usage-panel">
    <div class="text-foreground tabular-nums" id="counts"></div>
    <div role="img" aria-label="47% of the context window used"></div>
    <dl><dt>Instructions and tools</dt><dd>9.4K</dd><dt>Free</dt><dd>100K</dd></dl><p>${info}</p></div>
    <div data-testid="planner-response-text">${info}</div><div>Free</div>`, doc => {
    doc.querySelector('#counts').append('47K', ' of', ' ', '100K', ' tokens used');
  });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#counts').textContent, '已使用 47K / 100K token');
  assert.equal(doc.querySelector('[role="img"]').getAttribute('aria-label'), '已使用 47% 的上下文窗口');
  assert.deepEqual([...doc.querySelectorAll('dt')].map(node => node.textContent), ['指令和工具', '剩余']);
  assert.equal(doc.querySelector('p').textContent, '上次回复后已压缩上下文；数量将在下次回复后更新。');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, info);
  assert.equal(doc.body.lastElementChild.textContent, 'Free');
  dom.window.close();
});

test('connectors and plugin controls keep names and search input intact', () => {
  const dom = mount(`<div role="menu">
    <div data-testid="composer-connectors-submenu"><span class="flex-1 truncate">Connectors</span></div>
    <div class="flex items-baseline justify-between gap-2 px-2 pt-1 pb-2"><div class="text-sm font-medium text-foreground">Connectors</div></div>
    <input placeholder="Search connectors" aria-label="Search connectors" value="Connectors">
    <div data-testid="composer-connector-row"><div class="truncate text-foreground">Connectors</div><button>Fix</button></div>
    <div class="px-2 py-3 text-xs text-muted-foreground">No connectors match “Alice”</div></div>
    <div data-testid="plugin-suggestion-card"><div data-testid="customization-card" class="relative flex items-center gap-3 p-3 rounded-xl">
      <div class="flex-1 min-w-0 flex flex-col gap-0.5 pr-4"><div class="font-medium text-sm text-foreground truncate">Local only</div><div class="text-xs text-muted-foreground truncate">Sign in needed</div></div>
      <div class="relative z-10 flex-shrink-0 flex items-center"><span class="inline-flex items-center rounded-full">Local only</span></div></div></div>
    <button data-testid="mcp-server-account-select" aria-label="Account this MCP server uses: Alice">Alice</button>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="composer-connectors-submenu"]').textContent, '连接器');
  assert.equal(doc.querySelector('.items-baseline > div').textContent, '连接器');
  assert.equal(doc.querySelector('input').placeholder, '搜索连接器');
  assert.equal(doc.querySelector('input').getAttribute('aria-label'), '搜索连接器');
  assert.equal(doc.querySelector('input').value, 'Connectors');
  assert.equal(doc.querySelector('[data-testid="composer-connector-row"] div').textContent, 'Connectors');
  assert.equal(doc.querySelector('[data-testid="composer-connector-row"] button').textContent, '修复');
  assert.equal(doc.querySelector('.px-2.py-3').textContent, '没有与“Alice”匹配的连接器');
  assert.equal(doc.querySelector('.font-medium.text-sm.truncate').textContent, 'Local only');
  assert.equal(doc.querySelector('.pr-4 > .text-xs').textContent, 'Sign in needed');
  assert.equal(doc.querySelector('.rounded-full').textContent, '仅限本地');
  assert.equal(doc.querySelector('[data-testid="mcp-server-account-select"]').getAttribute('aria-label'), '此 MCP 服务器使用的账户：Alice');
  dom.window.close();
});

test('side panel and voice controls localize fixed labels without changing names or spoken text', () => {
  const dom = mount(`<div data-testid="side-question-tab-empty"><span>Ask a side question without interrupting the main conversation</span></div>
    <button data-testid="side-question-tab-stop" aria-label="Stop side question"></button>
    <button data-testid="side-question-tab-promote" aria-label="Promote to conversation"></button>
    <div data-testid="voice-mic-warning-switch"><span class="min-w-0 truncate">Switch mic</span><span class="shrink-0 font-medium">Switch mic</span></div>
    <div data-testid="voice-speed-panel" role="group" aria-label="Voice speed"><div>Voice speed</div><input data-testid="voice-speed-slider" type="range" aria-label="Voice speed"></div>
    <button data-testid="voice-call-speed" aria-label="Voice speed, 1.25x"></button>
    <div data-testid="live-transcript-pane"><div class="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">Nothing said yet</div></div>
    <div data-testid="user-input-step">Ask a side question without interrupting the main conversation</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="side-question-tab-empty"]').textContent, '提出附加问题，不会中断主会话');
  assert.equal(doc.querySelector('[data-testid="side-question-tab-stop"]').getAttribute('aria-label'), '停止附加问题');
  assert.equal(doc.querySelector('[data-testid="side-question-tab-promote"]').getAttribute('aria-label'), '转为会话');
  assert.equal(doc.querySelector('[data-testid="voice-mic-warning-switch"] .truncate').textContent, 'Switch mic');
  assert.equal(doc.querySelector('[data-testid="voice-mic-warning-switch"] .font-medium').textContent, '切换麦克风');
  assert.equal(doc.querySelector('[data-testid="voice-speed-panel"]').getAttribute('aria-label'), '语音速度');
  assert.equal(doc.querySelector('[data-testid="voice-speed-slider"]').getAttribute('aria-label'), '语音速度');
  assert.equal(doc.querySelector('[data-testid="voice-call-speed"]').getAttribute('aria-label'), '语音速度，1.25x');
  assert.equal(doc.querySelector('[data-testid="live-transcript-pane"]').textContent, '还没有语音内容');
  assert.equal(doc.querySelector('[data-testid="user-input-step"]').textContent, 'Ask a side question without interrupting the main conversation');
  dom.window.close();
});

test('external links and toast content retain dynamic values', () => {
  const title = 'Failed to create remote project';
  const dom = mount(`<div role="dialog"><div data-testid="external-link-confirm-modal"><p>This link wants to open an app on your device.</p>
    <div data-testid="external-link-confirm-uri" title="example://Open link"><span>example://Open link</span></div>
    <button data-testid="external-link-confirm-open">Open link</button></div></div>
    <div data-testid="toast-notification" data-notification-tag="new-cloud-project-error">
      <div class="text-sm font-medium leading-normal"><span>${title}</span></div><div class="text-sm text-secondary-foreground"><span>${title}</span></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('p').textContent, '此链接将打开你设备上的应用。');
  assert.equal(doc.querySelector('button').textContent, '打开链接');
  assert.equal(doc.querySelector('[data-testid="external-link-confirm-uri"]').title, 'example://Open link');
  assert.equal(doc.querySelector('.font-medium span').textContent, '创建远程项目失败');
  assert.equal(doc.querySelector('.text-secondary-foreground span').textContent, title);
  dom.window.close();
});

test('remote capacity titles and diff counts leave server messages and project names intact', () => {
  const title = 'Daily environment time used';
  const dom = mount(`<div data-testid="input-box-notification-card">
    <div class="flex items-center gap-1.5 min-w-0"><span class="truncate">${title}</span></div><p>${title}</p></div>
    <span data-testid="diff-view-mode-stats" role="img" aria-label="12 lines added, 3 lines removed"></span>
    <span data-testid="diff-view-mode-stats" role="img" aria-label="files added, files removed"></span>
    <div role="menu"><span class="truncate min-w-0" title="Create a project whose conversations run remotely.">New Remote Project</span>
      <div role="menuitem" data-testid="project-selector-github-repo-item"><span class="truncate flex-1 min-w-0">New Remote Project</span></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('.truncate').textContent, '今日环境使用时间已用完');
  assert.equal(doc.querySelector('p').textContent, title);
  const stats = [...doc.querySelectorAll('[data-testid="diff-view-mode-stats"]')];
  assert.equal(stats[0].getAttribute('aria-label'), '新增 12 行，删除 3 行');
  assert.equal(stats[1].getAttribute('aria-label'), 'files added, files removed');
  assert.equal(doc.querySelector('[title="Create a project whose conversations run remotely."]').textContent, '新建远程项目');
  assert.equal(doc.querySelector('[data-testid="project-selector-github-repo-item"]').textContent, 'New Remote Project');
  dom.window.close();
});
