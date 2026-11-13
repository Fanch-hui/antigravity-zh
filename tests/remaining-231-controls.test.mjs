import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';
const script = await createRuntimeScript();
const mount = html => {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {url:'https://127.0.0.1:42000/',runScripts:'outside-only'});
  dom.window.eval(script);
  return dom;
};
const quota = (title, detail = '') => `<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-2 py-1 rounded-md text-sm"><span class="truncate text-muted-foreground">${title}</span><span class="flex items-center justify-end gap-1.5"><span class="text-muted-foreground">43% left</span></span><span class="col-span-2 truncate text-muted-foreground">${detail}</span></div>`;

test('quota window labels and combined reset descriptions match current typography and retain model names', () => {
  const dom = mount(`<div class="flex flex-col min-h-0 select-none"><div class="flex flex-col gap-1 min-h-0 overflow-y-auto custom-scrollbar">${quota('Weekly limit','Resets in 2d 19h')}${quota('5h limit','Resets in 4h 15m')}${quota('Gemini 4 Argon','Weekly limit, resets in 1d 18h')}${quota('Daily limit','5h limit, resets in &lt;1m')}${quota('Future Model','Unknown reset policy')}</div></div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('.grid > span:first-child')].map(el=>el.textContent),['每周额度','5 小时额度','Gemini 4 Argon','每日额度','Future Model']);
  assert.deepEqual([...doc.querySelectorAll('.col-span-2')].map(el=>el.textContent),['2 天 19 小时后重置','4 小时 15 分钟后重置','每周额度，1 天 18 小时后重置','5 小时额度，不到 1 分钟后重置','Unknown reset policy']);
  assert.equal(doc.querySelector('.justify-end > span').textContent,'剩余 43%');
  dom.window.close();
});

test('user and assistant message toolbar times translate without touching message text', async () => {
  const time = 'text-sm text-muted-foreground select-none px-1 mr-1 self-center whitespace-nowrap';
  const dom = mount(`<div data-testid="user-input-step"><div data-testid="user-message-content">49m ago</div><div data-testid="user-message-actions"><span data-screenshot-volatile class="${time}">49m ago</span></div></div>
    <div data-testid="planner-response-text">47m ago</div><div data-testid="cascade-system-message-toolbar"><div><span data-screenshot-volatile data-tooltip-id="time" class="text-sm text-muted-foreground select-none px-1 whitespace-nowrap">47m ago</span></div></div>`);
  const doc = dom.window.document;
  const userTime = doc.querySelector('[data-testid="user-message-actions"] span');
  const assistantTime = doc.querySelector('[data-testid="cascade-system-message-toolbar"] span');
  assert.equal(userTime.textContent,'49m 前');
  assert.equal(assistantTime.textContent,'47m 前');
  assert.equal(doc.querySelector('[data-testid="user-message-content"]').textContent,'49m ago');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent,'47m ago');
  userTime.textContent='50m ago'; assistantTime.textContent='just now';
  await new Promise(resolve=>dom.window.setTimeout(resolve,0));
  assert.equal(userTime.textContent,'50m 前');
  assert.equal(assistantTime.textContent,'刚刚');
  userTime.textContent='just now';
  await new Promise(resolve=>dom.window.setTimeout(resolve,0));
  assert.equal(userTime.textContent,'刚刚');
  dom.window.close();
});

test('conversation menu labels include pin, unpin and remote control without broadening setting scope', () => {
  const dom = mount('<div role="menu"><div role="menuitem"><span class="truncate">Pin</span></div><div role="menuitem"><span class="truncate">Unpin</span></div><div role="menuitem"><span class="truncate">Remote Control</span></div></div><div data-testid="planner-response-text">Remote Control</div>');
  assert.deepEqual([...dom.window.document.querySelectorAll('[role="menuitem"] > span')].map(el=>el.textContent),['置顶','取消置顶','远程控制']);
  assert.equal(dom.window.document.querySelector('[data-testid="planner-response-text"]').textContent,'Remote Control');
  dom.window.close();
});

test('voice defaults and change control translate while real voice and microphone names remain original', () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4"><span data-testid="voice-settings-name" class="text-muted-foreground">Not set</span><button data-testid="voice-settings-change">Change</button><div data-testid="voice-settings-mic"><button role="combobox" aria-expanded="true"><span id="dropdown-value-mic" class="truncate">System default</span></button></div></div>
    <div data-select-popup><div role="option"><div><span class="truncate">System default</span></div></div><div role="option"><div><span class="truncate">Review</span></div></div><div role="option"><div><span class="truncate">System default (2)</span></div></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="voice-settings-name"]').textContent,'未设置');
  assert.equal(doc.querySelector('button[data-testid]').textContent,'更改');
  assert.equal(doc.querySelector('#dropdown-value-mic').textContent,'系统默认');
  assert.deepEqual([...doc.querySelectorAll('[role="option"] .truncate')].map(el=>el.textContent),['系统默认','Review','System default (2)']);
  dom.window.close();
  const selected = mount('<div class="max-w-2xl mx-auto flex-col gap-4"><span data-testid="voice-settings-name">Review</span><div data-testid="voice-settings-mic"><button role="combobox"><span id="dropdown-value-mic">Change</span></button></div></div>');
  assert.equal(selected.window.document.querySelector('[data-testid="voice-settings-name"]').textContent,'Review');
  assert.equal(selected.window.document.querySelector('#dropdown-value-mic').textContent,'Change');
  selected.window.close();
});

test('appearance section headings, font labels, contrast and code preview use current setting renderers', () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4"><h3 class="m-0 font-medium">Chat</h3><h3 class="m-0 font-medium">Accessibility</h3><div class="py-2 px-3 justify-between"><div><span id="dropdown-label-font">Font</span></div><div class="shrink-0"><button><span id="dropdown-value-font">Google Sans</span></button></div></div><div class="py-2 px-3 justify-between"><span id="dropdown-label-size">Font Size</span><span id="dropdown-value-size">14px</span></div><div class="py-2 px-3 justify-between"><div class="shrink-0"><button>Strong</button></div></div><button data-testid="theme-code-preview-toggle"><span>Code Preview</span></button><pre><code>Code Preview</code></pre></div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('h3')].map(el=>el.textContent),['聊天','辅助功能']);
  assert.equal(doc.querySelector('#dropdown-label-font').textContent,'字体');
  assert.equal(doc.querySelector('#dropdown-label-size').textContent,'字号');
  assert.equal(doc.querySelector('#dropdown-value-font').textContent,'Google Sans');
  assert.equal(doc.querySelector('#dropdown-value-size').textContent,'14px');
  assert.equal(doc.querySelector('.shrink-0 > button:not(:has(span))').textContent,'高对比度');
  assert.equal(doc.querySelector('[data-testid="theme-code-preview-toggle"] span').textContent,'代码预览');
  assert.equal(doc.querySelector('code').textContent,'Code Preview');
  dom.window.close();
});

test('built-in theme preset labels translate in trigger and linked popup and preserve other preset names', () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4"><div class="py-2 px-3 justify-between"><span id="dropdown-label-preset">Preset</span><button aria-controls="presets" aria-labelledby="dropdown-label-preset dropdown-value-preset"><span id="dropdown-value-preset">Default Light</span></button></div></div><div data-select-popup role="listbox" id="presets"><div role="option"><span class="truncate">Default Light</span></div><div role="option"><span class="truncate">Default Dark</span></div><div role="option"><span class="truncate">Catppuccin</span></div></div>`);
  const doc=dom.window.document;
  assert.equal(doc.querySelector('#dropdown-value-preset').textContent,'默认浅色');
  assert.deepEqual([...doc.querySelectorAll('[role="option"] span')].map(el=>el.textContent),['默认浅色','默认深色','Catppuccin']);
  dom.window.close();
});

test('built-in browser subagent explanation is translated as one full sentence', () => {
  const dom=mount('<div class="max-w-2xl mx-auto flex-col gap-4"><div class="py-2 px-3 justify-between"><div class="flex-1 flex flex-col"><span class="text-sm text-muted-foreground whitespace-pre-wrap">Configure allowed and denied URLs for the browser subagent. It runs in the built-in browser, so no separate browser install is needed.</span></div></div></div>');
  assert.equal(dom.window.document.querySelector('span').textContent,'配置浏览器子智能体允许和禁止访问的网址。它在内置浏览器中运行，无需另行安装浏览器。');
  dom.window.close();
});

test('conversation hovercard metadata restores update prefix and standalone marker, retaining date and title', () => {
  const dom=mount(`<div data-hover-card-popup class="bg-card text-foreground border flex flex-col gap-1.5 w-72 outline-none animate-slideIn !p-0 !gap-0 overflow-hidden"><div class="flex flex-col gap-1.5 p-3"><div class="text-foreground line-clamp-3 leading-snug break-words">Outside of Project</div><div class="flex flex-col gap-1.5"><div class="flex items-center gap-1 text-sm text-muted-foreground"><span class="shrink-0 flex items-center"><svg data-project-glyph="folder"></svg></span><span class="truncate">Outside of Project</span></div><div class="flex items-center gap-1 text-sm text-muted-foreground"><span class="shrink-0 flex items-center"><svg><path d="M618.92-298.92l42.15-42.15L510-492.16V-680 extra"/></svg></span><span class="truncate">Updated 5月31日, 15:31</span></div></div></div></div>`);
  const doc=dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('.gap-1 > span.truncate')].map(el=>el.textContent),['未归入项目','更新于 5月31日, 15:31']);
  assert.equal(doc.querySelector('.line-clamp-3').textContent,'Outside of Project');
  dom.window.close();
});

test('voice picker explanatory text accepts current typography and preserves the selected voice name', () => {
  const dom=mount(`<div role="dialog"><h2>Choose Antigravity's Voice</h2><div class="mt-1 text-sm text-muted-foreground">Powered by Gemini Live · You can change this in <button data-testid="voice-picker-settings-link">Settings</button> later.</div><div data-testid="voice-picker-name">Review</div><button data-testid="voice-picker-use">Use Review</button></div>`);
  const doc=dom.window.document;
  assert.equal(doc.querySelector('h2').textContent,'选择 Antigravity 的声音');
  assert.equal(doc.querySelector('.mt-1').textContent,'由 Gemini Live 提供支持 · 稍后可前往 设置 更改。');
  assert.equal(doc.querySelector('[data-testid="voice-picker-name"]').textContent,'Review');
  assert.equal(doc.querySelector('[data-testid="voice-picker-use"]').textContent,'使用 Review');
  dom.window.close();
});

test('external browser instructions retain their link and translate the complete fixed prefix', () => {
  const dom=mount('<div class="max-w-2xl mx-auto flex-col gap-4"><div class="py-2 px-3 justify-between"><div class="flex-1 flex flex-col"><span class="text-sm text-muted-foreground whitespace-pre-wrap">Configure allowed and denied URLs for the browser subagent (invoked with /browser). Requires <a href="https://www.google.com/chrome/">Google Chrome</a>.</span></div></div></div>');
  assert.equal(dom.window.document.querySelector('span').textContent,'配置浏览器子智能体允许和禁止访问的网址（通过 /browser 调用）。需要安装 Google Chrome.');
  assert.equal(dom.window.document.querySelector('a').getAttribute('href'),'https://www.google.com/chrome/');
  dom.window.close();
});

test('hovercard unread and background statuses retain separate project and branch labels', () => {
  const row=(icon,text)=>`<div class="flex items-center gap-1 text-sm text-muted-foreground"><span class="shrink-0 flex items-center">${icon}</span><span class="truncate">${text}</span></div>`;
  const dom=mount(`<div data-hover-card-popup>${row('<div data-testid="status-unread-dot"></div>','Unread')}${row('<span data-testid="status-loading-spinner" class="grid place-content-center shrink-0 opacity-70"></span>','Canceling')}${row('<svg data-testid="status-task-running" class="shrink-0 opacity-70"></svg>','3 tasks running')}${row('<svg data-project-glyph="folder"></svg>','Unread')}${row('<svg></svg>','Canceling')}</div>`);
  assert.deepEqual([...dom.window.document.querySelectorAll('span.truncate')].map(el=>el.textContent),['未读','正在取消','3 个任务正在运行','Unread','Canceling']);
  dom.window.close();
});
