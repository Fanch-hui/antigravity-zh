import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  dom.window.eval(script);
  return dom;
}

test('2.26 context window options translate quota warnings while preserving model and effort names', () => {
  const warning = '512K context uses about 1.3x quota per turn because each request sends more tokens.';
  const dom = mount(`<div data-testid="model-selector-panel">
    <button data-testid="model-selector-item"><span class="truncate text-xs text-left">Expensive</span></button>
    <span data-testid="model-selector-effort-option">High</span>
    <div role="menu" aria-label="Context window" data-testid="model-selector-context-window-submenu">
      <div role="menuitemradio" data-testid="model-selector-context-window-option"><span>512K<span data-testid="model-selector-context-window-badge">Expensive</span></span></div>
    </div></div><div role="tooltip"><span data-testid="model-selector-context-window-tooltip">${warning}</span></div>
    <div data-testid="planner-response-text">${warning}</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="model-selector-item"]').textContent, 'Expensive');
  assert.equal(doc.querySelector('[data-testid="model-selector-effort-option"]').textContent, 'High');
  assert.equal(doc.querySelector('[role="menu"]').getAttribute('aria-label'), '上下文窗口');
  assert.equal(doc.querySelector('[role="menuitemradio"]').textContent, '512K用量较高');
  assert.equal(doc.querySelector('[role="tooltip"]').textContent, '512K 上下文每轮约消耗 1.3 倍额度，因为每次请求发送的 token 更多。');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, warning);
  dom.window.close();
});

test('2.26 send shortcuts translate joined React text nodes with original shortcut values', () => {
  const dom = mount('<div role="tooltip"><div class="flex flex-col gap-0.5 text-xs text-left max-w-[320px]"><div id="primary"></div><div id="secondary" class="opacity-75"></div></div></div>');
  const doc = dom.window.document;
  const primary = doc.querySelector('#primary');
  const secondary = doc.querySelector('#secondary');
  primary.append('Queue Message', ' ', '⏎');
  secondary.append('Send Immediately', ' (', '⌥⏎', ')');
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.equal(primary.textContent, '将消息加入队列 ⏎');
  assert.equal(secondary.textContent, '立即发送（⌥⏎）');
  dom.window.close();
});

test('2.26 filters, voice controls and navigator labels use fixed surfaces', () => {
  const dom = mount(`<span data-testid="palette-filter-archived">Only Archived</span>
    <span data-testid="palette-filter-scheduled">Only Automations</span>
    <span data-testid="view-option-auto-pin">Auto Pin</span>
    <button data-testid="voice-start-button" aria-label="Start voice"></button>
    <div data-testid="voice-pill" role="status" aria-label="Voice on"></div>
    <button data-testid="conversation-navigator-turn" aria-label="Turn 2 of 5"></button>
    <button data-testid="conversation-navigator-card" aria-label="Go to turn 2 of 5"></button>
    <div role="presentation"><span class="text-muted-foreground">No instances yet.</span><button data-testid="instance-selector-set-up" aria-label="Get started with Remote Control">Get started</button></div>
    <p>Only Archived</p><div data-testid="user-input-step"><button aria-label="Start voice">Auto Pin</button></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="palette-filter-archived"]').textContent, '仅已归档');
  assert.equal(doc.querySelector('[data-testid="palette-filter-scheduled"]').textContent, '仅自动任务');
  assert.equal(doc.querySelector('[data-testid="view-option-auto-pin"]').textContent, '自动置顶');
  assert.equal(doc.querySelector('[data-testid="voice-start-button"]').getAttribute('aria-label'), '开始语音');
  assert.equal(doc.querySelector('[data-testid="voice-pill"]').getAttribute('aria-label'), '语音已开启');
  assert.equal(doc.querySelector('[data-testid="conversation-navigator-turn"]').getAttribute('aria-label'), '第 2 轮，共 5 轮');
  assert.equal(doc.querySelector('[data-testid="conversation-navigator-card"]').getAttribute('aria-label'), '跳转到第 2 轮，共 5 轮');
  assert.equal(doc.querySelector('[role="presentation"] > span').textContent, '暂无实例。');
  assert.equal(doc.querySelector('p').textContent, 'Only Archived');
  assert.equal(doc.querySelector('[data-testid="user-input-step"] button').getAttribute('aria-label'), 'Start voice');
  dom.window.close();
});

test('2.26 onboarding preserves shortcut nodes and disclosure links', () => {
  const dom = mount(`<div role="dialog"><h2>Getting started with Google Antigravity</h2>
    <div data-testid="post-onboarding-welcome-modal"><span>Build with one agent or a team</span></div>
    <p data-testid="post-onboarding-welcome-tip"><span>Tip:</span> Press <kbd>⌘⇧A</kbd> to switch to the Gemini app. Your agents keep working in the background.</p></div>
    <div role="dialog"><h2>Files and resources in cloud workspaces</h2><div data-testid="cloud-resource-disclosure-modal">
    <span>Stored and mounted in your cloud environment</span><p data-testid="cloud-resource-disclosure-terms">Avoid uploading highly sensitive data and verify actions taken by your agent. Make sure you have the <a href="https://policies.google.com/terms#toc-relationship">necessary rights</a> to any content or files that you upload, including content of minors. Don't generate content that infringes on others' rights, including content that deceives, harasses, or harms. When using Antigravity, you must comply with Google's <a href="https://policies.google.com/terms/generative-ai/use-policy">Prohibited Use Policy</a></p></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h2').textContent, '开始使用 Google Antigravity');
  assert.equal(doc.querySelector('kbd').textContent, '⌘⇧A');
  assert.equal(doc.querySelector('[data-testid="post-onboarding-welcome-tip"]').textContent, '提示： 按下 ⌘⇧A 即可切换到 Gemini 应用。智能体会继续在后台工作。');
  const links = [...doc.querySelectorAll('a')];
  assert.deepEqual(links.map(link => link.textContent), ['必要权利', '禁止使用政策']);
  assert.equal(links[0].getAttribute('href'), 'https://policies.google.com/terms#toc-relationship');
  assert.match(doc.querySelector('[data-testid="cloud-resource-disclosure-terms"]').textContent, /请勿生成侵犯他人权利的内容/);
  dom.window.close();
});
