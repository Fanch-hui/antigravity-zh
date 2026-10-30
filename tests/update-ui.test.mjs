import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
test('automatic and manual update prompts translate every state and preserve icons across transitions', async () => {
  const dom = new JSDOM(`<body><div role="button" data-testid="app-update-button"><span>Restart to Update</span><span>→</span></div>
    <div role="button" data-testid="manual-update-button" aria-label="Update Available"><span>Update Available</span></div>
    <div role="tooltip">Restart to Update</div><div data-testid="planner-response-text">Restart to Update</div></body>`,
  { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(script);
  const doc = dom.window.document;
  const button = doc.querySelector('[data-testid="app-update-button"]');
  const tooltip = doc.querySelector('[role="tooltip"]');
  assert.equal(button.textContent, '重启以更新→');
  assert.equal(tooltip.textContent, '重启以更新');
  assert.equal(doc.querySelector('[data-testid="manual-update-button"]').getAttribute('aria-label'), '有可用更新');
  for (const [source, target] of [['Update Available', '有可用更新'], ['Downloading Update', '正在下载更新'],
    ['Install Update', '安装更新'], ['Installing Update', '正在安装更新'], ['Updating…', '正在更新…']]) {
    button.firstElementChild.textContent = source;
    tooltip.textContent = source;
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    assert.equal(button.firstElementChild.textContent, target);
    assert.equal(tooltip.textContent, target);
    assert.equal(button.lastElementChild.textContent, '→');
  }
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Restart to Update');
  dom.window.close();
});

test('update confirmation translates interruption notices and keeps active task names intact', () => {
  const dom = new JSDOM(`<body><div role="dialog"><h2>Update Available</h2>
    <p>You have 3 conversations in progress. Updating will interrupt them, and they will automatically resume once the update completes.</p>
    <div class="mt-3 bg-background/50 border border-border/50 rounded p-2 max-h-40 overflow-y-auto"><span>Active Tasks &amp; Conversations:</span>
      <ul class="space-y-1"><li class="text-xs text-muted-foreground truncate max-w-[340px]">Restart to Update</li><li class="text-xs text-muted-foreground truncate max-w-[340px]">Update Available</li></ul></div>
    <button>Cancel</button><button>Update Anyway</button></div></body>`,
  { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(script);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h2').textContent, '有可用更新');
  assert.equal(doc.querySelector('p').textContent, '您有 3 个对话正在进行。更新会中断这些对话；更新完成后，它们会自动继续。');
  assert.deepEqual([...doc.querySelectorAll('li')].map(item => item.textContent), ['Restart to Update', 'Update Available']);
  assert.deepEqual([...doc.querySelectorAll('button')].map(item => item.textContent), ['取消', '仍然更新']);
  dom.window.close();
});

test('environment creation failures translate the title and preserve the server error body', () => {
  const dom = new JSDOM(`<body><div data-testid="toast-notification" data-notification-tag="new-environment-error">
    <div class="text-sm font-medium leading-normal"><span>Failed to create Demo</span></div>
    <div class="text-sm text-secondary-foreground"><span>Failed to create Demo</span></div></div></body>`,
  { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(script);
  assert.equal(dom.window.document.querySelector('.font-medium span').textContent, '创建 Demo 失败');
  assert.equal(dom.window.document.querySelector('.text-secondary-foreground span').textContent, 'Failed to create Demo');
  dom.window.close();
});
