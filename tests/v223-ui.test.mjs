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

test('2.23 bundle UI translates actions while keeping catalog metadata and names', () => {
  const dom = mount(`<section data-testid="marketplace-bundles-shelf" class="flex flex-col gap-3">
    <div class="flex flex-col gap-1 px-3"><h2>Bundles</h2><p>Curated integrations</p></div>
    <div data-testid="bundle-card-example"><div class="min-w-0 flex flex-col gap-2">
      <h3><a>Remove all</a></h3><div>Removing the bundle removes all of its plugins.</div></div>
      <button aria-label="Add 3 plugins from Remove all">Add all · 3</button></div></section>
    <div class="flex flex-col gap-3"><div><h1 class="text-lg font-medium tracking-tight leading-tight text-foreground truncate min-w-0">Adding...</h1></div>
      <p class="text-sm text-muted-foreground leading-relaxed m-0">Set the volume of agent sounds.</p>
      <div class="flex flex-wrap items-center"><span>Removing the bundle removes all of its plugins.</span></div>
      <button>Remove all</button></div>
    <div class="relative isolate flex items-center gap-3 p-3 rounded-xl"><div class="flex-1 min-w-0 flex flex-col gap-0.5 pr-4">
      <div class="font-medium text-sm text-foreground truncate"><a>General work</a></div>
      <div class="text-xs text-muted-foreground truncate">Research, writing, and everyday tasks, without code.</div></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('section h2').textContent, '插件组合包');
  assert.equal(doc.querySelector('section p').textContent, 'Curated integrations');
  assert.equal(doc.querySelector('h3').textContent, 'Remove all');
  assert.equal(doc.querySelector('[data-testid^="bundle-card-"] .gap-2 > div').textContent, 'Removing the bundle removes all of its plugins.');
  assert.equal(doc.querySelector('section button').textContent, '全部添加 · 3');
  assert.equal(doc.querySelector('section button').getAttribute('aria-label'), '添加来自 Remove all 的 3 个插件');
  assert.equal(doc.querySelector('h1').textContent, 'Adding...');
  assert.equal(doc.querySelector('p.m-0').textContent, 'Set the volume of agent sounds.');
  assert.equal(doc.querySelector('.flex-wrap span').textContent, '移除组合包会移除其中的全部插件。');
  assert.equal(doc.querySelector('.flex-col.gap-3 > button').textContent, '全部移除');
  assert.equal(doc.querySelector('.pr-4 a').textContent, 'General work');
  assert.equal(doc.querySelector('.pr-4 > .text-xs').textContent, 'Research, writing, and everyday tasks, without code.');
  dom.window.close();
});

test('2.23 resource picker translates its fixed title and preserves resource names', async () => {
  const dom = mount(`<div class="flex flex-col p-2 gap-2 w-full max-h-96">
    <div class="flex items-center justify-between"><span id="title" class="text-xs font-medium flex-1 text-center"></span></div>
    <input placeholder="Filter resources..."><div id="loading">Loading resources...</div>
    <label data-testid="github-repo-option-example"><span>Folder</span></label>
    <button>Upload Files</button></div>
    <div data-testid="google-drive-connect-view"><p>Complete sign-in in the popup window, then click Continue.</p><button>Re-open sign-in popup</button></div>`);
  const doc = dom.window.document;
  doc.querySelector('#title').append(...['Add ', 'GitHub', ' resources'].map(part => doc.createTextNode(part)));
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(doc.querySelector('#title').textContent, '添加 GitHub 资源');
  assert.equal(doc.querySelector('input').placeholder, '筛选资源...');
  assert.equal(doc.querySelector('#loading').textContent, '正在加载资源...');
  assert.equal(doc.querySelector('label span').textContent, 'Folder');
  assert.equal(doc.querySelector('button').textContent, '上传文件');
  assert.equal(doc.querySelector('p').textContent, '在弹出窗口中完成登录，然后点击“继续”。');
  assert.equal(doc.querySelector('[data-testid="google-drive-connect-view"] button').textContent, '重新打开登录窗口');
  dom.window.close();
});

test('2.23 billing copy preserves token and distinguishes shared quota from pay as you go', () => {
  const dom = mount(`<div role="radiogroup" aria-label="Billing model"><div role="radio">
    <h3>Pay As You Go</h3><p>Pay only for the tokens you use, billed through Agent Platform (formerly Vertex AI).</p></div>
    <div role="radio"><h3>Gemini Enterprise</h3><p>Draws from your organization's pooled Gemini Enterprise usage.</p></div></div>
    <div data-testid="planner-response-text">Pay As You Go</div><div data-testid="user-input-step">Pay As You Go</div><code>Pay As You Go</code>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h3').textContent, '按量付费');
  assert.equal(doc.querySelector('p').textContent, '仅为实际使用的 token 付费，通过 Agent Platform（原 Vertex AI）计费。');
  assert.equal(doc.querySelectorAll('h3')[1].textContent, 'Gemini Enterprise');
  assert.equal(doc.querySelectorAll('p')[1].textContent, '使用贵组织共享的 Gemini Enterprise 额度。');
  for (const selector of ['[data-testid="planner-response-text"]', '[data-testid="user-input-step"]', 'code']) {
    assert.equal(doc.querySelector(selector).textContent, 'Pay As You Go');
  }
  dom.window.close();
});

test('2.23 media and warning controls retain numeric values and variable payloads', () => {
  const dom = mount(`<div data-testid="media-modal-video-player"><button title="Playback speed (< / >)" aria-label="Playback speed 1.5x">1.5x</button>
    <div data-testid="media-modal-zoom-reset" aria-label="Zoom 125%, reset to fit">125%</div>
    <button>Back 5s (←)</button><button title="Pause (k)" aria-label="Mute (m)"></button></div>
    <div data-testid="conversation-open-elsewhere-banner"><span>This conversation is also open in another app. Sending messages from both may cause conflicts.</span></div>
    <div role="alert">Failed to save settings: Unknown service error</div>
    <div data-testid="agent-input-box"><p class="pointer-events-none absolute left-2 right-2 top-2 z-0 select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-6 text-foreground opacity-60">Ask anything, @ to mention, / for actions</p></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('button').title, '播放速度（< / >）');
  assert.equal(doc.querySelector('button').getAttribute('aria-label'), '播放速度 1.5 倍');
  assert.equal(doc.querySelector('button').textContent, '1.5x');
  assert.equal(doc.querySelector('[data-testid="media-modal-zoom-reset"]').getAttribute('aria-label'), '缩放 125%，重置为适应窗口');
  assert.equal(doc.querySelector('[data-testid="media-modal-zoom-reset"]').textContent, '125%');
  assert.equal(doc.querySelectorAll('button')[1].textContent, '后退 5 秒（←）');
  assert.equal(doc.querySelectorAll('button')[2].title, '暂停（k）');
  assert.equal(doc.querySelectorAll('button')[2].getAttribute('aria-label'), '静音（m）');
  assert.equal(doc.querySelector('[data-testid="conversation-open-elsewhere-banner"] span').textContent, '此会话也已在另一个应用中打开。在两处同时发送消息可能导致冲突。');
  assert.equal(doc.querySelector('[role="alert"]').textContent, '保存设置失败：Unknown service error');
  assert.equal(doc.querySelector('p').textContent, '随时提问，@ 添加引用，/ 选择操作');
  dom.window.close();
});
