import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const settle = dom => new Promise(resolve => dom.window.setTimeout(resolve, 0));

function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only'
  });
  dom.window.eval(script);
  return dom;
}

test('translates sidebar links and marketplace headings using the packaged dictionary', () => {
  const dom = mount(`<a data-testid="new-conversation-button">New Conversation</a>
    <a data-testid="history-button">Conversation History</a>
    <a href="/customizations">Customizations</a><button data-testid="settings-button">Settings</button>
    <div class="max-w-4xl mx-auto px-8 pt-8 pb-4"><h1>Customizations</h1></div>
    <nav data-testid="plugins-tabs"><a>Marketplace</a><a>Installed</a></nav>
    <a data-testid="project-selector-item">New Conversation</a><a id="name">Settings</a>`);
  const doc = dom.window.document;
  for (const [selector, target] of [
    ['[data-testid="new-conversation-button"]', '新建会话'],
    ['[data-testid="history-button"]', '会话历史'], ['[href="/customizations"]', '自定义配置'],
    ['[data-testid="settings-button"]', '设置'], ['h1', '自定义配置'],
    ['nav a:first-child', '市场'], ['nav a:last-child', '已安装']
  ]) assert.equal(doc.querySelector(selector).textContent, target);
  assert.equal(doc.querySelector('[data-testid="project-selector-item"]').textContent, 'New Conversation');
  assert.equal(doc.querySelector('#name').textContent, 'Settings');
  dom.window.close();
});

test('resolves portaled policy options through aria-controls without changing action values', async () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4">
    <span id="dropdown-label-plan">Plan Review Policy</span>
    <span id="dropdown-label-terminal">Terminal Command Auto Execution</span>
    <button id="trigger" role="combobox" aria-labelledby="dropdown-label-plan" aria-controls="options">Always Ask</button>
  </div><div data-select-popup><div id="options" role="listbox">
    <div role="option" data-value="turbo" id="proceed">Always Proceed</div>
    <div role="option"><span id="description">Every command requires approval.</span></div>
  </div></div><div data-testid="user-input-step">Always Proceed</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#proceed').textContent, '无需审阅，直接继续');
  assert.equal(doc.querySelector('#proceed').getAttribute('data-value'), 'turbo');
  assert.equal(doc.querySelector('#description').textContent, '每条命令都需要批准。');
  doc.querySelector('#trigger').setAttribute('aria-labelledby', 'dropdown-label-terminal');
  await settle(dom);
  assert.equal(doc.querySelector('#proceed').textContent, '自动执行');
  assert.equal(doc.querySelector('[data-testid="user-input-step"]').textContent, 'Always Proceed');
  dom.window.close();
});

test('localizes quota durations, preserves percentages, and rejects unknown duration text', async () => {
  const dom = mount(`<div class="flex flex-col max-h-80 overflow-y-auto custom-scrollbar select-none p-1">
    <span id="group">Gemini Models</span><span id="weekly">Weekly Limit Remaining</span>
    <span id="period">Five Hour Limit Remaining</span><span id="reset">Resets in 6d 17h</span>
    <span id="soon">Resets in &lt;1m</span><span id="unknown">Resets in account-name</span><span id="pct">78%</span>
  </div><div class="max-w-2xl mx-auto flex-col gap-4">
    <span id="long">You have used some of your weekly limit, it will fully refresh in 6 days, 17 hours.</span>
    <span id="five">You have used some of your 5-hour limit, it will fully refresh in 3 hours, 52 minutes.</span>
  </div><div data-testid="planner-response-text">Resets in 6d 17h</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#group').textContent, 'Gemini 模型');
  assert.equal(doc.querySelector('#weekly').textContent, '每周剩余额度');
  assert.equal(doc.querySelector('#period').textContent, '5 小时周期剩余额度');
  assert.equal(doc.querySelector('#reset').textContent, '6 天 17 小时后重置');
  assert.equal(doc.querySelector('#soon').textContent, '1 分钟内重置');
  assert.equal(doc.querySelector('#pct').textContent, '78%');
  assert.equal(doc.querySelector('#unknown').textContent, 'Resets in account-name');
  assert.equal(doc.querySelector('#long').textContent, '您已使用部分每周额度，将在 6 天 17 小时后完全恢复。');
  assert.equal(doc.querySelector('#five').textContent, '您已使用部分 5 小时周期额度，将在 3 小时 52 分钟后完全恢复。');
  doc.querySelector('#reset').firstChild.nodeValue = 'Resets in 3h 49m';
  await settle(dom);
  assert.equal(doc.querySelector('#reset').textContent, '3 小时 49 分钟后重置');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Resets in 6d 17h');
  dom.window.close();
});

test('translates the input prompt and catalog controls while preserving plugin content', () => {
  const dom = mount(`<div data-testid="agent-input-box">
    <p class="pointer-events-none absolute select-none whitespace-nowrap">Ask anything, @ to mention, / for actions</p>
    <div contenteditable="true">Ask anything, @ to mention, / for actions</div>
  </div><section class="flex flex-col gap-3"><div class="flex flex-col gap-1 px-3">
    <h2>Build with Google</h2>
    <p>Build on Google's developer platforms, including Android, Chrome, Gemini, and Google Cloud.</p>
  </div><div class="relative flex items-center gap-3 p-3 rounded-xl"><div class="flex-1 min-w-0 flex flex-col gap-0.5 pr-4">
    <a>Google Docs</a><div class="text-xs text-muted-foreground truncate">Read, draft, and edit docs.</div>
  </div></div></section><p id="body">Read, draft, and edit docs.</p>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="agent-input-box"] p').textContent, '随时提问，@ 添加引用，/ 选择操作');
  assert.equal(doc.querySelector('[contenteditable]').textContent, 'Ask anything, @ to mention, / for actions');
  assert.equal(doc.querySelector('h2').textContent, 'Build with Google');
  assert.equal(doc.querySelector('section p').textContent, "Build on Google's developer platforms, including Android, Chrome, Gemini, and Google Cloud.");
  assert.equal(doc.querySelector('.truncate').textContent, 'Read, draft, and edit docs.');
  assert.equal(doc.querySelector('a').textContent, 'Google Docs');
  assert.equal(doc.querySelector('#body').textContent, 'Read, draft, and edit docs.');
  dom.window.close();
});

test('protects plugin names and descriptions even when they equal known UI strings', () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4">
    <div class="relative flex items-center gap-3 p-3 rounded-xl"><div class="flex-1 min-w-0 flex flex-col gap-0.5 pr-4">
      <div class="flex items-center gap-1.5 min-w-0"><div class="font-medium text-sm text-foreground truncate"><a id="plugin">New Conversation</a></div></div>
      <div id="description" class="text-xs text-muted-foreground truncate">Every command <span>requires approval.</span></div>
    </div><div class="relative z-10"><button>Add</button></div></div>
    <div class="flex flex-col gap-3"><div><h1 class="text-lg font-medium tracking-tight leading-tight text-foreground truncate min-w-0">Customizations</h1></div>
      <p class="text-sm text-muted-foreground leading-relaxed">Every command requires approval.</p></div>
  </div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#plugin').textContent, 'New Conversation');
  assert.equal(doc.querySelector('#description').textContent, 'Every command requires approval.');
  assert.equal(doc.querySelector('h1').textContent, 'Customizations');
  assert.equal(doc.querySelector('p').textContent, 'Every command requires approval.');
  assert.equal(doc.querySelector('button').textContent, '添加');
  dom.window.close();
});

test('keeps token terminology and distinguishes grouping from timeline folding', () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4"><h3>Token Usage</h3>
    <span>Loading token usage...</span></div>
    <button role="option" data-testid="group-by-option-none">None</button>
    <select title="How long a quiet interval must be before it collapses"><option value="none">None</option></select>
    <button>Select Day</button><div class="carousel"><button>Previous</button><button>Next</button></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h3').textContent, 'token 用量');
  assert.equal(doc.querySelector('span').textContent, '正在加载 token 用量...');
  assert.equal(doc.querySelector('[data-testid="group-by-option-none"]').textContent, '不分组');
  assert.equal(doc.querySelector('option').textContent, '不折叠');
  assert.equal(doc.querySelector('option').value, 'none');
  assert.equal(doc.querySelector('button:not([role]):not(.carousel button)').textContent, '选择星期');
  assert.equal(doc.querySelector('.carousel').textContent, '上一张下一张');
  dom.window.close();
});

test('translates fragmented type errors and articles without altering automation names', async () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4"><span class="text-red-500" id="error"></span>
    <div class="space-y-2"><div class="flex flex-col gap-1"><div class="text-xs text-muted-foreground leading-relaxed"><span id="intro"></span></div></div></div>
  </div><div class="text-muted-foreground text-xs px-2">No artifacts generated</div>`);
  const doc = dom.window.document;
  const name = doc.createElement('strong');
  name.textContent = 'the';
  doc.querySelector('#error').append(...['A ', 'workspace', ' with this name already exists.'].map(part => doc.createTextNode(part)));
  doc.querySelector('#intro').append(doc.createTextNode('This project was created for'), doc.createTextNode(' '),
    doc.createTextNode('the '), name, doc.createTextNode(' '), doc.createTextNode('automation. '));
  await settle(dom);
  assert.equal(doc.querySelector('#error').textContent, '已有同名工作区。');
  assert.equal(name.textContent, 'the');
  assert.equal(doc.querySelector('#intro').textContent.replace(/\s+/g, ' ').trim(), '此项目专为 the 自动化任务创建。');
  assert.equal(doc.querySelector('.px-2').textContent, '尚未生成产物');
  dom.window.close();
});
