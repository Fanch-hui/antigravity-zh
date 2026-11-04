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

test('settings permissions, account requirements, and fixed warnings translate while values stay intact', () => {
  const warning = 'CitC workspace paths are world-readable and permanently snapshotted. Choose a local folder outside CitC.';
  const dom = mount(`<div class="flex flex-col gap-4 w-full max-w-2xl mx-auto">
    <div class="py-2 px-3 flex justify-between"><div class="flex-1 flex flex-col gap-0.5"><span>Enable Sandbox Mode</span><span>Restricts agent tools to a secure, isolated local sandbox.</span></div></div>
    <div class="py-2 px-3 flex justify-between"><div class="flex-1 flex flex-col gap-0.5"><span>Project Required</span><span>A Google Cloud project is required to use Antigravity.</span></div></div>
    <div data-testid="builtin-browser-download-dir-error">${warning}</div><span class="font-mono">/data/Enable Sandbox Mode</span>
    <div data-testid="planner-response-text">${warning}</div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('.py-2 span').textContent, '启用沙箱模式');
  assert.equal(doc.querySelectorAll('.py-2 span')[3].textContent, '使用 Antigravity 需要 Google Cloud 项目。');
  assert.equal(doc.querySelector('[data-testid="builtin-browser-download-dir-error"]').textContent, 'CitC 工作区路径对所有用户可读，且会永久保存快照。请选择 CitC 之外的本地文件夹。');
  assert.equal(doc.querySelector('.font-mono').textContent, '/data/Enable Sandbox Mode');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, warning);
  dom.window.close();
});

test('settings error card translates fixed title and copy controls but keeps details and contents isolated', () => {
  const text = 'Failed to parse settings. Fix and restart.';
  const dom = mount(`<div data-testid="settings-error-messages-card" role="alert">
    <div class="flex-1 flex flex-col gap-1 min-w-0"><span class="text-sm font-medium text-foreground">${text}</span>
      <div class="text-xs text-secondary-foreground break-words whitespace-pre-wrap">Copy error messages</div>
      <div class="text-xs text-secondary-foreground break-words whitespace-pre-wrap">${text}</div></div>
    <button data-testid="settings-error-messages-copy-button" aria-label="Copy error messages" title="Copy error messages"></button></div>
    <div data-testid="planner-response-text">${text}</div>`);
  const doc = dom.window.document;
  const card = doc.querySelector('[data-testid="settings-error-messages-card"]');
  const button = card.querySelector('button');
  assert.equal(card.querySelector('span').textContent, '无法解析设置。请修正后重新启动。');
  assert.equal(button.title, '复制错误信息');
  assert.equal(button.getAttribute('aria-label'), '复制错误信息');
  assert.deepEqual([...card.querySelectorAll(':scope > div > div')].map(node=>node.textContent), ['Copy error messages',text]);
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, text);
  button.setAttribute('aria-label', 'Copied');
  button.title = 'Copied';
  dom.window.__AGY_ZH_RUNTIME__.translate(button);
  assert.equal(button.title, '已复制');
  assert.equal(button.getAttribute('aria-label'), '已复制');
  dom.window.close();
});

test('plugin connection controls retain account text while translating fixed UI and attributes', () => {
  const dom = mount(`<section aria-label="Connections" class="flex flex-col gap-2"><h2 class="text-sm text-muted-foreground m-0">Connections</h2>
    <div class="agy-card"><div data-testid="plugin-connection-local"><div class="min-w-[10rem] flex-1 overflow-hidden"><div>This Computer</div><div class="truncate text-xs text-muted-foreground" title="Remote">Remote</div></div>
      <div><button aria-label="Sign in to Remote on this computer">Sign in</button></div></div>
      <div data-testid="plugin-connection-cloud"><div class="min-w-[10rem] flex-1 overflow-hidden"><div>Remote</div><div class="truncate text-xs text-muted-foreground" title="This Computer">This Computer</div></div><div><button aria-label="More for Remote (Remote)"></button></div></div></div></section>
    <section aria-label="Accounts"><div><input maxlength="40" class="h-6 w-32" placeholder="e.g. work" aria-label="Label for Remote" value="Remote"><button aria-label="Add label for Remote">Add label</button></div></section>`);
  const doc = dom.window.document;
  const section = doc.querySelector('section');
  assert.equal(section.getAttribute('aria-label'), '连接');
  assert.equal(section.querySelector('h2').textContent, '连接');
  const local = doc.querySelector('[data-testid="plugin-connection-local"]');
  const cloud = doc.querySelector('[data-testid="plugin-connection-cloud"]');
  assert.equal(local.querySelector(':scope > div > div:first-child').textContent, '此电脑');
  assert.equal(cloud.querySelector(':scope > div > div:first-child').textContent, '远程');
  assert.equal(local.querySelector('[title]').textContent, 'Remote');
  assert.equal(local.querySelector('[title]').title, 'Remote');
  local.querySelector('[title]').textContent = 'Review';
  local.querySelector('[title]').title = 'Review';
  dom.window.__AGY_ZH_RUNTIME__.translate(local);
  assert.equal(local.querySelector('[title]').textContent, 'Review');
  assert.equal(local.querySelector('[title]').title, 'Review');
  assert.equal(cloud.querySelector('[title]').textContent, 'This Computer');
  assert.equal(local.querySelector('button').getAttribute('aria-label'), '在此电脑上登录 Remote');
  assert.equal(cloud.querySelector('button').getAttribute('aria-label'), 'Remote 的远程连接更多选项');
  const account = doc.querySelector('section[aria-label="Accounts"]');
  const input = account.querySelector('input');
  assert.equal(input.value, 'Remote');
  assert.equal(input.placeholder, '例如：工作');
  assert.equal(input.getAttribute('aria-label'), '为 Remote 添加标签');
  assert.equal(account.querySelector('button').textContent, '添加标签');
  dom.window.close();
});

test('developer voice controls translate fixed labels without changing dropdown values', () => {
  const dom = mount(`<div class="flex flex-col gap-4 w-full max-w-2xl mx-auto"><div class="py-2 px-3 w-full flex justify-between">
    <div class="flex-1 flex flex-col gap-0.5"><span id="voice-engine-label-1">Voice engine</span><span>Whatever the voice-engine-addr flag serves you.</span></div>
    <button class="agy-select-trigger" aria-labelledby="voice-engine-label-1 dropdown-value-1" aria-expanded="true"><span class="truncate" id="dropdown-value-1">Default (Mendel)</span></button></div></div>
    <div data-select-popup><div role="option" data-value=""><div><span class="truncate">Default (Mendel)</span><span class="text-xs text-muted-foreground">Whatever the voice-engine-addr flag serves you.</span></div></div><div role="option" data-value="custom"><div><span class="truncate">Custom…</span><span class="text-xs text-muted-foreground">Type a voice variant name, such as rev27.</span></div></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#voice-engine-label-1').textContent, '语音引擎');
  assert.equal(doc.querySelector('#dropdown-value-1').textContent, '默认（Mendel）');
  assert.equal(doc.querySelectorAll('[role="option"]')[1].querySelector('.truncate').textContent, '自定义…');
  assert.equal(doc.querySelectorAll('[role="option"]')[1].getAttribute('data-value'), 'custom');
  assert.equal(doc.querySelectorAll('[role="option"]')[1].querySelector('.text-xs').textContent, '输入语音变体名称，例如 rev27。');
  dom.window.close();
});

test('hook configuration localizes fixed lifecycle labels and retains names and commands', () => {
  const dom = mount(`<div class="p-8 font-sans text-left text-foreground min-h-screen"><div class="flex flex-col gap-6"><div class="border border-border p-6 rounded-lg shadow-sm">
    <div class="flex justify-between"><h3>Pre Tool Use</h3></div>
    <div class="inline-flex"><button><span>Pre Tool Use</span></button><button><span>Post Invocation</span></button></div>
    <div class="text-xs text-foreground/60 mt-2 px-1">Fires before a tool step executes.</div>
    <div class="mt-4"><div class="text-foreground/60 p-4 text-sm border border-dashed border-border rounded-lg flex justify-between items-center gap-3"><span>No handlers configured for Pre Tool Use.</span></div>
      <div class="bg-muted/5 border border-border p-4 rounded-lg"><select><option value="*">All tools (*)</option><option value="run_command">run_command</option></select><div class="text-xs">Hook will trigger if any tool is executed.</div><code>Pre Tool Use</code></div></div></div></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h3').textContent, 'Pre Tool Use');
  assert.deepEqual([...doc.querySelectorAll('button > span')].map(n=>n.textContent), ['工具使用前','调用后']);
  assert.equal(doc.querySelector('.mt-2').textContent, '在工具步骤执行前触发。');
  assert.equal(doc.querySelector('.border-dashed > span').textContent, '尚未配置工具使用前的处理程序。');
  assert.equal(doc.querySelector('option').textContent, '所有工具（*）');
  assert.equal(doc.querySelector('option').value, '*');
  assert.equal(doc.querySelector('code').textContent, 'Pre Tool Use');
  dom.window.close();
});
