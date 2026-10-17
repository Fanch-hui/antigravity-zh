import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only'
  });
  dom.window.eval(script);
  return dom;
}
const tooltip = html => `<div class="compact-tooltip" role="tooltip">${html}</div>`;

// The app builds each shortcut and its explanation as one complete text node.
test('2.24 queue shortcuts and quota tooltips translate complete copy with original values', () => {
  const argon = 'For paid Pro plans, Argon quota is separate. Higher Argon quota (included as part of the larger Gemini quota bucket) is available on Ultra plans.';
  const dom = mount(tooltip(`<span class="flex flex-col gap-1 whitespace-nowrap">
    <span id="send">⏎ Sends immediately</span><span id="queue">⌥⏎ Queues after the turn</span>
    <span id="next">⌥⏎ On empty prompt, sends next in queue</span>
    <span id="win">Alt+Enter Sends immediately</span></span>`) +
    tooltip('Models within this group: Gemini Flash, Gemini Pro') +
    tooltip('Models within this group: Claude Opus, Claude Sonnet, GPT-OSS') + tooltip(argon) +
    tooltip('Models within this group: Unknown model') + `<p>${argon}</p>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#send').textContent, '⏎ 立即发送');
  assert.equal(doc.querySelector('#queue').textContent, '⌥⏎ 在当前轮次结束后发送');
  assert.equal(doc.querySelector('#next').textContent, '⌥⏎ 输入框为空时，发送队列中的下一条消息');
  assert.equal(doc.querySelector('#win').textContent, 'Alt+Enter 立即发送');
  const tips = [...doc.querySelectorAll('[role="tooltip"]')];
  assert.equal(tips[1].textContent, '此分组中的模型：Gemini Flash, Gemini Pro');
  assert.equal(tips[2].textContent, '此分组中的模型：Claude Opus, Claude Sonnet, GPT-OSS');
  assert.equal(tips[3].textContent, '付费 Pro 方案的 Argon 额度单独计算。Ultra 方案提供更高的 Argon 额度，计入其更大的 Gemini 总额度。');
  assert.equal(tips[4].textContent, 'Models within this group: Unknown model');
  assert.equal(doc.querySelector('p').textContent, argon);
  dom.window.close();
});

test('2.24 feedback labels and all category placeholders leave entered feedback intact', () => {
  const categories = [
    ['Bug Report', '问题报告', 'Describe the bug you encountered...', '请描述您遇到的问题...'],
    ['Feature Request', '功能建议', 'Describe the feature you would like to see...', '请描述您希望增加的功能...'],
    ['Auth and Billing', '身份验证与计费', 'Describe your auth or billing issue...', '请描述您的身份验证或计费问题...'],
    ['Remote Control Issue', '远程控制问题', 'Describe your Remote Control issue...', '请描述您的远程控制问题...'],
    ['General Feedback', '其他反馈', 'Enter your feedback here...', '请在此处填写反馈...']
  ];
  const dom = mount(`<div class="max-w-2xl mx-auto flex flex-col gap-4">
    ${categories.map(([label, , placeholder]) => `<label class="flex items-center gap-2 text-sm cursor-pointer">
      <input type="radio" name="feedbackType"><span>${label}</span></label>
      <textarea placeholder="${placeholder}">${label}</textarea>`).join('')}
    <textarea id="steps" placeholder="Please list the steps to reproduce the issue">Bug Report</textarea></div>
    <span id="ordinary">Bug Report</span><textarea id="other" placeholder="Describe the bug you encountered...">General Feedback</textarea>
    <div data-testid="planner-response-text">Bug Report</div><code>Feature Request</code>`);
  const doc = dom.window.document;
  categories.forEach(([source, target, , placeholder], index) => {
    assert.equal(doc.querySelectorAll('label > span')[index].textContent, target);
    assert.equal(doc.querySelectorAll('textarea')[index].placeholder, placeholder);
    assert.equal(doc.querySelectorAll('textarea')[index].value, source);
  });
  assert.equal(doc.querySelector('#steps').placeholder, '请列出问题的复现步骤');
  assert.equal(doc.querySelector('#steps').value, 'Bug Report');
  assert.equal(doc.querySelector('#ordinary').textContent, 'Bug Report');
  assert.equal(doc.querySelector('#other').placeholder, 'Describe the bug you encountered...');
  assert.equal(doc.querySelector('#other').value, 'General Feedback');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Bug Report');
  assert.equal(doc.querySelector('code').textContent, 'Feature Request');
  dom.window.close();
});

test('2.24 nested settings and project controls translate without changing project names or shortcuts', () => {
  const upgrade = 'You can upgrade to a Google AI Ultra plan to receive higher rate limits.';
  const dom = mount(`<div class="h-full w-full flex flex-col bg-sidebar">
    <div class="flex-1 flex flex-col gap-1 py-3 overflow-y-auto"><div class="flex flex-col gap-0.5">
      <button class="text-xs mx-4 py-1 hover:underline">Show All</button>
      <button class="text-xs mx-4 py-1 hover:underline">Show Less</button></div></div></div>
    <div class="max-w-2xl mx-auto flex flex-col gap-4"><div class="py-2 px-3 justify-between">
      <div class="flex-1 flex flex-col gap-0.5"><span class="text-xs text-muted-foreground whitespace-pre-wrap">${upgrade}</span></div></div></div>
    ${tooltip('<div class="text-xs"><span>Select Project</span><span class="ml-1 opacity-50">⌘;</span></div>')}
    <input data-testid="project-selector-search" placeholder="Search Projects">
    <div data-testid="project-selector-item"><span>Search Projects</span></div>
    <button data-tooltip-id="filter" aria-label="Display Options"></button>${tooltip('Display Options')}
    <div data-testid="user-input-step">${upgrade}</div><div class="terminal-surface" data-testid="terminal-surface">Display Options</div>
    <div class="relative flex items-center gap-3 p-3 rounded-xl"><div class="flex-1 min-w-0 flex flex-col gap-0.5 pr-4">
      <div class="font-medium text-sm text-foreground truncate">General Feedback</div>
      <div class="text-xs text-muted-foreground truncate">${upgrade}</div></div></div>`);
  const doc = dom.window.document;
  const buttons = [...doc.querySelectorAll('button')];
  assert.deepEqual(buttons.slice(0, 2).map(button => button.textContent), ['显示全部', '收起']);
  assert.equal(doc.querySelector('.whitespace-pre-wrap').textContent, '您可以升级到 Google AI Ultra 方案，以获得更高的使用限额。');
  assert.equal(doc.querySelector('[role="tooltip"] span').textContent, '选择项目');
  assert.equal(doc.querySelector('[role="tooltip"] span + span').textContent, '⌘;');
  assert.equal(doc.querySelector('input').placeholder, '搜索项目');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"] span').textContent, 'Search Projects');
  assert.equal(buttons[2].getAttribute('aria-label'), '显示选项');
  assert.equal(doc.querySelectorAll('[role="tooltip"]')[1].textContent, '显示选项');
  assert.equal(doc.querySelector('[data-testid="user-input-step"]').textContent, upgrade);
  assert.equal(doc.querySelector('[data-testid="terminal-surface"]').textContent, 'Display Options');
  assert.equal(doc.querySelector('.pr-4 > .truncate').textContent, 'General Feedback');
  assert.equal(doc.querySelector('.pr-4 > .text-xs').textContent, upgrade);
  dom.window.close();
});
