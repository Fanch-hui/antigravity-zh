import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

test('voice device names, running titles and automation content stay unchanged', async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div class="flex flex-col gap-4 w-full max-w-2xl mx-auto">
    <span data-testid="voice-settings-name">Review</span>
    <div data-testid="voice-settings-mic"><button role="combobox" aria-expanded="true"><span>Review</span></button></div>
    <section data-testid="running-group" aria-label="Review"><div><span class="truncate font-medium">Review</span></div>
      <div data-testid="running-row"><span class="text-sm text-foreground truncate">Review</span>
        <button data-testid="running-row-stop" aria-label="Open Settings">Stop</button></div></section>
    <div role="button"><div class="col-start-1 row-start-1 min-w-0"><div class="flex"><div data-testid="automation-name">Review</div></div>
      <div class="truncate text-muted-foreground">Review</div></div></div>
    <button data-testid="automation-run"><span class="grid"><span class="truncate text-secondary-foreground">Review</span></span></button>
    <div data-testid="automation-instructions-text"><div data-testid="automation-instructions-markdown"><p>Review</p></div><button>Show all</button></div>
    <div data-testid="sidecar-detail"><p class="m-0 text-[15px] leading-7 text-secondary-foreground">Review</p>
      <p class="m-0 text-[13px] text-muted-foreground">Review</p><button data-testid="sidecar-project-link">Review</button>
      <div data-testid="automation-model-value"><span class="text-sm leading-5 text-foreground">Review</span></div></div>
  </div><div data-select-popup role="listbox"><div role="option">Review</div></div>
  <button>Review</button></body>`, { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(await createRuntimeScript());
  const doc = dom.window.document;
  for (const selector of ['[data-testid="voice-settings-name"]', '[data-testid="voice-settings-mic"] span',
    '[data-testid="running-group"] > div > span', '[data-testid="running-row"] span',
    '[data-testid="automation-name"]', '.col-start-1 > .truncate', '[data-testid="automation-run"] .truncate',
    '[data-testid="automation-instructions-markdown"] p', '[data-testid="sidecar-detail"] p',
    '[data-testid="sidecar-project-link"]', '[data-testid="automation-model-value"] span', '[role="option"]']) {
    assert.equal(doc.querySelector(selector).textContent, 'Review', selector);
  }
  assert.equal(doc.querySelector('[data-testid="running-group"]').getAttribute('aria-label'), 'Review');
  assert.equal(doc.querySelector('[data-testid="running-row-stop"]').getAttribute('aria-label'), 'Open Settings');
  assert.equal(doc.querySelector('body > button').textContent, '审阅');
  dom.window.close();
});

test('a newly opened voice device list protects options while regular select options translate', async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div data-testid="voice-settings-mic">
    <button role="combobox" aria-expanded="false">Voice</button></div>
    <div role="listbox"><div role="option">Review</div></div></body>`,
  { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(await createRuntimeScript());
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[role="option"]').textContent, '审阅');
  doc.querySelector('[role="combobox"]').setAttribute('aria-expanded', 'true');
  const popup = doc.createElement('div');
  popup.setAttribute('data-select-popup', '');
  popup.innerHTML = '<div role="option">Review</div>';
  doc.body.appendChild(popup);
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(popup.textContent, 'Review');
  dom.window.close();
});
