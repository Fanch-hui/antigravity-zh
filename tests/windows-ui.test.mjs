import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();

test('2.15 customization layouts retain plugin and shelf metadata inside dialogs', () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div role="dialog">
    <div class="relative flex items-center gap-3 p-3 h-[72px] rounded-xl hover:bg-muted/70 transition-colors">
      <div class="flex-1 min-w-0 flex flex-col gap-0.5">
        <div class="flex items-center gap-1.5 min-w-0"><div id="plugin" class="font-medium text-sm text-foreground truncate"><a>Close</a></div></div>
        <div id="description" class="text-sm text-muted-foreground truncate">Close</div>
      </div><button>Add</button></div>
    <div class="space-y-10"><section aria-label="Add">
      <h2 id="shelf" class="text-xl font-medium text-foreground">Add</h2>
      <p id="shelf-description" class="text-xs text-muted-foreground mt-1">Close</p>
    </section></div>
    <div class="mt-2"><div class="flex items-center gap-3 min-w-0">
      <h1 id="detail" class="text-2xl font-bold tracking-tight leading-tight text-foreground truncate min-w-0">Close</h1></div>
      <p id="detail-description" class="text-sm text-muted-foreground mt-3 leading-relaxed">Close</p></div>
    <div data-testid="terminal-surface"><span id="terminal">Close</span></div>
    <span id="reference" data-uri="file:///D:/example" data-quotable-inline="true">Close</span>
    <div data-testid="subagent-node"><span id="agent" class="text-sm truncate transition-colors">Close</span></div>
    <span id="agent-panel" class="text-xs font-medium truncate flex-1 min-w-0">Close</span>
    <button id="control">Close</button>
    </div></body>`, { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(script);
  const doc = dom.window.document;
  for (const id of ['plugin', 'shelf-description', 'detail-description', 'reference', 'agent', 'agent-panel']) {
    assert.equal(doc.getElementById(id).textContent, 'Close', id);
  }
  for (const id of ['description', 'detail', 'terminal']) assert.equal(doc.getElementById(id).textContent, 'Close', id);
  assert.equal(doc.getElementById('shelf').textContent, 'Add');
  assert.equal(doc.getElementById('control').textContent, '关闭');
  assert.equal(doc.querySelector('button').textContent, '添加');
  dom.window.close();
});
