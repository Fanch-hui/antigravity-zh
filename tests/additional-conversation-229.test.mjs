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

test('permission explanation is translated at its icon and tooltip', () => {
  const dom = mount(`<span data-testid="permissions-override-info-icon" aria-label="Only this conversation uses this preset."></span>
    <div class="compact-tooltip" role="tooltip"><span class="max-w-[240px] block whitespace-normal">This project overrides your global permission settings.</span></div>
    <div data-testid="planner-response-text">Only this conversation uses this preset.</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="permissions-override-info-icon"]').getAttribute('aria-label'), '只有当前会话使用此预设。');
  assert.equal(doc.querySelector('[role="tooltip"] span').textContent, '此项目覆盖了全局权限设置。');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Only this conversation uses this preset.');
  dom.window.close();
});

test('microphone warning preserves the selected device name', () => {
  const dom = mount(`<div data-testid="voice-mic-warning"><button data-testid="voice-mic-warning-switch" aria-label="No audio from Remote. Switch mic">
    <span class="min-w-0 max-w-56 truncate">No audio from Remote</span><span class="font-medium">Switch mic</span></button></div>
    <span data-testid="voice-settings-name">No audio from Remote</span>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="voice-mic-warning-switch"]').getAttribute('aria-label'), '未检测到来自 Remote 的音频。切换麦克风');
  assert.equal(doc.querySelector('[data-testid="voice-mic-warning-switch"] .truncate').textContent, '未检测到来自 Remote 的音频');
  assert.equal(doc.querySelector('[data-testid="voice-settings-name"]').textContent, 'No audio from Remote');
  dom.window.close();
});

test('voice chat markers and transcript cards preserve times and spoken content', () => {
  const dom = mount(`<span data-testid="voice-chat-marker"><svg></svg>Started voice chat · 3:15 AM</span>
    <span data-testid="voice-chat-marker">Voice chat · 3:15 AM · 4m 20s</span>
    <span data-testid="voice-chat-marker">Stopped voice chat · 4m 20s</span>
    <button data-testid="voice-transcript-card" aria-label="Open Voice transcript, 3:15 AM · 4m 20s">
      <span class="flex min-w-0 flex-1 flex-col"><span class="truncate text-sm font-medium text-foreground">Voice transcript</span>
      <span class="truncate text-xs text-muted-foreground">3:15 AM · 4m 20s</span></span></button>
    <div data-testid="planner-response-text">Voice chat · 3:15 AM · 4m 20s</div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('[data-testid="voice-chat-marker"]')].map(node => node.textContent),
    ['已开始语音聊天 · 3:15 AM', '语音聊天 · 3:15 AM · 4m 20s', '已结束语音聊天 · 4m 20s']);
  const card = doc.querySelector('[data-testid="voice-transcript-card"]');
  assert.equal(card.getAttribute('aria-label'), '打开语音转录，3:15 AM · 4m 20s');
  assert.equal(card.querySelector('.text-foreground').textContent, '语音转录');
  assert.equal(card.querySelector('.text-muted-foreground').textContent, '3:15 AM · 4m 20s');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Voice chat · 3:15 AM · 4m 20s');
  dom.window.close();
});

test('task actions and feedback validation translate without changing task or user text', () => {
  const description = 'Please provide a more detailed description (at least 10 characters).';
  const steps = 'Please provide more detailed steps to reproduce (at least 5 characters).';
  const dom = mount(`<button data-testid="background-task-command-expand-toggle" aria-label="Show full command"></button>
    <div class="compact-tooltip" role="tooltip">Collapse command</div>
    <pre data-testid="background-task-command">Show full command</pre>
    <p data-testid="feedback-description-hint"><svg></svg>${description}</p>
    <p data-testid="feedback-steps-hint"><svg></svg>${steps}</p>
    <div data-testid="planner-response-text">${description}</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('button').getAttribute('aria-label'), '显示完整命令');
  assert.equal(doc.querySelector('[role="tooltip"]').textContent, '收起命令');
  assert.equal(doc.querySelector('pre').textContent, 'Show full command');
  assert.equal(doc.querySelector('[data-testid="feedback-description-hint"]').textContent, '请提供更详细的描述（至少 10 个字符）。');
  assert.equal(doc.querySelector('[data-testid="feedback-steps-hint"]').textContent, '请提供更详细的复现步骤（至少 5 个字符）。');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, description);
  dom.window.close();
});
