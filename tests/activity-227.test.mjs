import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

test('2.27 activity rows protect generated labels and titles while translating fixed actions', async () => {
  const script = await createRuntimeScript();
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <button data-testid="accumulated-item-goals" title="Review"><span class="min-w-0 truncate">Review</span></button>
    <div role="button" data-testid="background-task-row" title="Review"><span class="min-w-0 truncate">Review</span><div><button aria-label="Cancel Task">Cancel Task</button></div></div>
    <button>Review</button><div data-testid="activity-lane-label">Review</div>
  </body>`, { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(script);
  const doc = dom.window.document;
  for (const id of ['accumulated-item-goals', 'background-task-row']) {
    const row = doc.querySelector(`[data-testid="${id}"]`);
    assert.equal(row.title, 'Review');
    assert.equal(row.querySelector('span').textContent, 'Review');
  }
  assert.equal(doc.querySelector('[data-testid="background-task-row"] button').getAttribute('aria-label'), '取消任务');
  assert.equal(doc.querySelector('[data-testid="background-task-row"] button').textContent, '取消任务');
  assert.equal(doc.querySelector('body > button:last-of-type').textContent, '审阅');
  assert.equal(doc.querySelector('[data-testid="activity-lane-label"]').textContent, 'Review');
  dom.window.close();
});

test('2.28 direct row content protects dynamic detail siblings and nested labels', async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div data-testid="background-task-row" role="button" title="Review">
      <span class="min-w-0 truncate"><span>Review</span></span>
      <span data-testid="background-task-row-detail">Open</span>
      <div><button aria-label="Cancel Task">Cancel Task</button></div>
    </div><button>Review</button>
  </body>`, { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(await createRuntimeScript());
  const row = dom.window.document.querySelector('[data-testid="background-task-row"]');
  assert.equal(row.title, 'Review');
  assert.equal(row.querySelector('span').textContent, 'Review');
  assert.equal(row.querySelector('[data-testid$="-detail"]').textContent, 'Open');
  assert.equal(row.querySelector('button').textContent, '取消任务');
  assert.equal(row.querySelector('button').getAttribute('aria-label'), '取消任务');
  assert.equal(dom.window.document.querySelector('body > button').textContent, '审阅');
  dom.window.close();
});
