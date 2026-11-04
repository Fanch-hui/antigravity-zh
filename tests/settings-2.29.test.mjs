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

test('2.29 settings translate new descriptions and preserve paths and conversation content', () => {
  const description = 'Show how full the context window is next to the send button. Click it for a breakdown and to see your model quota.';
  const dom = mount(`<div class="p-6 flex flex-col gap-4 w-full max-w-2xl mx-auto">
    <div class="space-y-2"><div class="flex flex-col gap-1"><div class="flex items-center justify-between"><h3 class="m-0 text-sm font-medium">Chat Width</h3></div></div></div>
    <div class="py-2 px-3 w-full flex justify-between"><div class="flex-1 flex flex-col gap-0.5">
      <span>Context and Quota Indicator</span><span>${description}</span></div></div>
    <div data-testid="builtin-browser-download-dir-row"><div class="flex-1 flex flex-col gap-0.5"><span>Download Location</span>
      <span>Folder where files downloaded in the built-in browser are saved.</span><span data-testid="builtin-browser-download-dir-value" class="font-mono">/Users/Name/Download Location</span></div>
      <button data-testid="builtin-browser-download-dir-change">Change…</button></div>
    <div data-testid="planner-response-text">${description}</div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h3').textContent, '聊天宽度');
  assert.equal(doc.querySelector('.py-2 span').textContent, '上下文与用量指示器');
  assert.match(doc.querySelector('.py-2 span + span').textContent, /上下文窗口的使用情况.*模型用量/);
  assert.equal(doc.querySelector('[data-testid="builtin-browser-download-dir-change"]').textContent, '更改…');
  assert.equal(doc.querySelector('[data-testid="builtin-browser-download-dir-value"]').textContent, '/Users/Name/Download Location');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, description);
  dom.window.close();
});

test('recording deletion translates exact count and size without changing protected text', () => {
  const warning = "This deletes 2 call recordings (12.3 MB) from your machine. You can't undo this.";
  const dom = mount(`<div class="flex flex-col gap-4 w-full max-w-2xl mx-auto">
    <div data-testid="voice-settings-recordings"><div class="flex-1 flex flex-col gap-0.5"><div class="flex items-center gap-1.5"><span>Recordings</span></div><span>2 calls · 12.3 MB</span></div><button data-testid="voice-settings-delete-recordings">Delete all</button></div>
    <div data-testid="planner-response-text">${warning}</div></div>
    <div role="dialog"><h2>Delete all recordings?</h2><div data-testid="voice-delete-recordings-modal"><p>${warning}</p></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="voice-settings-recordings"] .flex-1 > span').textContent, '2 条通话录音 · 12.3 MB');
  assert.equal(doc.querySelector('[data-testid="voice-settings-delete-recordings"]').textContent, '全部删除');
  assert.equal(doc.querySelector('[role="dialog"] h2').textContent, '删除所有录音？');
  assert.equal(doc.querySelector('[data-testid="voice-delete-recordings-modal"] p').textContent, '将从本机删除 2 条通话录音（12.3 MB）。此操作无法撤销。');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, warning);
  dom.window.close();
});

test('running-process controls preserve task titles and counts', () => {
  const dom = mount(`<div class="flex flex-col gap-4 w-full max-w-2xl mx-auto">
    <span data-testid="running-heading">Running (Dev only)</span><div data-testid="running-page">
    <div data-testid="running-selection-bar"><span class="text-foreground">2 selected</span><button data-testid="running-selection-stop" aria-label="Stop 2 selected">Stop</button></div>
    <section data-testid="running-group" aria-label="Remote"><div data-testid="running-row"><div class="flex flex-col min-w-0 flex-1"><div class="flex items-center gap-2 min-w-0">
      <span class="text-sm text-foreground truncate">Still running</span><span class="shrink-0 rounded border border-border px-1 text-xs text-muted-foreground">Still running</span></div></div>
      <button data-testid="running-row-stop" aria-label="Stop Still running"></button></div></section></div></div>
    <div role="dialog"><h2>Stop 2 items?</h2><p>Running processes are killed. This cannot be undone.</p><button data-testid="running-confirm-stop">Stop</button></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="running-heading"]').textContent, '运行中（仅开发环境）');
  assert.equal(doc.querySelector('[data-testid="running-selection-bar"] span').textContent, '已选择 2 项');
  assert.equal(doc.querySelector('[data-testid="running-selection-stop"]').getAttribute('aria-label'), '停止所选的 2 项');
  assert.equal(doc.querySelector('[data-testid="running-row-stop"]').getAttribute('aria-label'), 'Stop Still running');
  assert.equal(doc.querySelector('[data-testid="running-row"] span.truncate').textContent, 'Still running');
  assert.equal(doc.querySelector('[data-testid="running-row"] span.border').textContent, '仍在运行');
  assert.equal(doc.querySelector('[data-testid="running-group"]').getAttribute('aria-label'), 'Remote');
  assert.equal(doc.querySelector('[role="dialog"] h2').textContent, '停止 2 项？');
  assert.equal(doc.querySelector('[role="dialog"] p').textContent, '运行中的进程将被终止，此操作无法撤销。');
  dom.window.close();
});

test('voice picker keeps the chosen voice name and accessible controls intact', () => {
  const dom = new JSDOM(`<!doctype html><body><div role="dialog">
    <h2>Choose Antigravity's Voice</h2><div class="mt-1 text-xs text-muted-foreground" id="voice-help"></div>
    <button data-testid="voice-picker-prev" aria-label="Previous voice"></button><button data-testid="voice-picker-next" aria-label="Next voice"></button>
    <div role="group" aria-label="Voices"><button data-testid="voice-picker-dot-0" aria-label="Remote, voice 1 of 4"></button></div>
    <button data-testid="voice-picker-use"></button></div></body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  const doc = dom.window.document;
  const help = doc.querySelector('#voice-help');
  const link = doc.createElement('button');
  link.dataset.testid = 'voice-picker-settings-link';
  link.textContent = 'Settings';
  help.append('Powered by Gemini Live · ', 'You can change this in', ' ', link, ' ', 'later.');
  doc.querySelector('[data-testid="voice-picker-use"]').append('Use ', 'Remote');
  dom.window.eval(script);
  assert.equal(doc.querySelector('h2').textContent, '选择 Antigravity 的声音');
  assert.equal(help.textContent, '由 Gemini Live 提供支持 · 稍后可前往 设置 更改。');
  assert.equal(help.querySelector('button'), link);
  assert.equal(doc.querySelector('[data-testid="voice-picker-dot-0"]').getAttribute('aria-label'), 'Remote，第 1 个声音，共 4 个');
  assert.equal(doc.querySelector('[data-testid="voice-picker-use"]').textContent, '使用 Remote');
  assert.equal(doc.querySelector('[data-testid="voice-picker-prev"]').getAttribute('aria-label'), '上一个声音');
  dom.window.close();
});

test('subscription choices survive translated accessibility labels and keep license names', () => {
  const dom = mount(`<div role="dialog"><div class="font-medium mb-4 text-base text-center select-none">Select Billing Model</div>
    <div role="radiogroup" aria-label="Billing model"><div role="radio"><div>Subscription</div><div>Use Antigravity through your Gemini subscription.</div></div>
      <div role="radio"><div>Pay As You Go</div><div>Pay only for the tokens you use, billed through Gemini platform.</div></div></div>
    <div>Choose a Subscription</div><div role="radiogroup" aria-label="Available licenses"><div role="radio"><span>Subscription</span></div></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('.font-medium').textContent, '选择计费方式');
  const groups = [...doc.querySelectorAll('[role="radiogroup"]')];
  assert.equal(groups[0].getAttribute('aria-label'), '计费模式');
  assert.equal(groups[0].querySelector('[role="radio"] div').textContent, '订阅');
  assert.equal(groups[0].querySelectorAll('[role="radio"]')[1].firstElementChild.textContent, '按量付费');
  assert.equal(groups[1].querySelector('span').textContent, 'Subscription');
  dom.window.close();
});

test('shortcut accessibility labels preserve the action and key combination', () => {
  const dom = mount(`<div class="flex flex-col gap-4 w-full max-w-2xl mx-auto">
    <div data-testid="shortcut-row-example"><button aria-label="Shortcut ⌘K for Open a file"><span>⌘K</span></button>
      <button aria-label="Remove shortcut ⌘K for Open a file"></button>
      <button aria-label="Add shortcut for Open a file"></button><button aria-label="Reset Open a file to default"></button>
      <div role="region" data-testid="inline-keybinding-recorder" aria-label="Recording shortcut for Open a file. Press keys to bind, Enter to save, Escape to cancel.">
        <span class="italic">Press keys...</span><button aria-label="Cancel recording"></button></div></div>
    <button aria-label="Reset all shortcuts to defaults"></button>
    <div data-testid="planner-response-text">Shortcut ⌘K for Open a file</div></div>`);
  const doc = dom.window.document;
  const row = doc.querySelector('[data-testid^="shortcut-row-"]');
  const buttons = row.querySelectorAll(':scope > button');
  assert.deepEqual([...buttons].map(button => button.getAttribute('aria-label')), [
    'Open a file 的快捷键：⌘K', '移除 Open a file 的快捷键 ⌘K', '为 Open a file 添加快捷键', '将 Open a file 重置为默认值',
  ]);
  const recorder = row.querySelector('[data-testid="inline-keybinding-recorder"]');
  assert.equal(recorder.getAttribute('aria-label'), '正在为 Open a file 录制快捷键。按下组合键进行绑定，按 Enter 保存，按 Escape 取消。');
  assert.equal(recorder.querySelector('.italic').textContent, '请按下组合键…');
  assert.equal(recorder.querySelector('button').getAttribute('aria-label'), '取消录制');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Shortcut ⌘K for Open a file');
  dom.window.close();
});
