import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { runtimeDictionary } from '../src/locales.mjs';
import { surfaces } from '../runtime/surfaces.mjs';
import { createOwnedLabels } from '../runtime/owned-labels.mjs';

const runtime = await readFile(new URL('../runtime/translator.js', import.meta.url), 'utf8');
const user = '[data-testid="user-input-step"]';
const question = '[data-testid="side-question-question"]';
const card = '[data-testid="settings-error-messages-card"]';
const automation = '[data-testid="sidecar-detail"] [data-testid="automation-settings"] > p.m-0.leading-7.text-secondary-foreground[class~="text-[15px]"]';
const schedule = `${automation} > [data-testid="automation-schedule-value"]`;
const scheduleReference = '[data-testid="automation-schedule-value"] span.text-sm.leading-5.text-foreground, button[data-testid="automation-schedule-value"]';
const entries = [
  { source: 'Undo to this point', target: '撤销到此处', contentBoundary: user,
    selector: `${user} [data-testid="revert-button"]`, kind: 'attribute', attribute: 'aria-label' },
  { source: 'Side Question', target: '侧问', contentBoundary: question,
    selector: `${question} > span.shrink-0`, kind: 'text' },
  { source: 'Error', target: '错误', contentBoundary: card, kind: 'text',
    selector: `${card} > div.flex-1.flex.flex-col.gap-1.min-w-0 > span.text-sm.font-medium.text-foreground` },
  { source: 'Copy', target: '复制', contentBoundary: card, kind: 'attribute', attribute: 'aria-label',
    selector: `${card} > [data-testid="settings-error-messages-copy-button"]` },
  { source: 'Runs', target: '运行', contentBoundary: automation, selector: automation, kind: 'text' },
  { source: 'every {0} minutes', target: '每 {0} 分钟', selector: scheduleReference,
    kind: 'text', template: true, capturePatterns: { 0: '\\d+' } },
  { source: 'every {0} minutes', target: '每 {0} 分钟', contentBoundary: automation, selector: schedule,
    kind: 'text', template: true, capturePatterns: { 0: '\\d+' } },
  { source: 'every {0} hours', target: '每 {0} 小时', selector: scheduleReference,
    kind: 'text', template: true, capturePatterns: { 0: '\\d+' } },
  { source: 'every {0} hours', target: '每 {0} 小时', contentBoundary: automation, selector: schedule,
    kind: 'text', template: true },
  { source: 'Review', target: '审阅' },
  { source: 'Undo to this point', target: '错误穿透', contentBoundary: user,
    selector: `${user} [data-testid="unrelated"]`, kind: 'attribute', attribute: 'aria-label' },
  { source: 'Zoom in', target: '放大', selector: '[data-testid="toolbar-zoom-in"]',
    kind: 'attribute', attribute: 'data-tooltip' },
];

function mount(html) {
  const records = entries.map(record => ({ scope: 'generic', selectorMode: 'self', ...record }));
  const source = runtime.replace(/\/\*__AGY_ZH_DICTIONARY__\*\/\s*null/, () => JSON.stringify(runtimeDictionary(records)))
    .replace(/\/\*__AGY_ZH_SURFACES__\*\/\s*null/, () => JSON.stringify(surfaces))
    .replace(/\/\*__AGY_ZH_OWNED_LABELS__\*\/\s*null/, () => createOwnedLabels.toString());
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`,
    { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(source);
  return dom;
}

test('only registered fixed leaves can cross their exact protected owner', async () => {
  const dom = mount(`<div data-testid="user-input-step"><button data-testid="revert-button" aria-label="Undo to this point" title="Undo to this point"></button>
    <button data-testid="unrelated" aria-label="Undo to this point">Review</button>
    <div data-testid="planner-response-text"><button data-testid="revert-button" aria-label="Undo to this point"></button></div></div>
    <div data-testid="side-question-question"><span class="shrink-0">Side Question</span><span class="truncate">Review</span></div>
    <div data-testid="settings-error-messages-card"><div class="flex-1 flex flex-col gap-1 min-w-0">
      <span class="text-sm font-medium text-foreground">Error</span><div>Error</div></div>
      <button data-testid="settings-error-messages-copy-button" aria-label="Copy" title="Copy"></button></div>
    <div data-testid="sidecar-detail"><div data-testid="automation-settings"><p class="m-0 text-[15px] leading-7 text-secondary-foreground">Runs <button>Review</button></p>
      <p class="m-0 text-[15px] leading-7 text-secondary-foreground"><button data-testid="automation-schedule-value">every 15 minutes</button></p>
      <p class="m-0 text-[15px] leading-7 text-secondary-foreground"><button data-testid="automation-schedule-value">every tomorrow hours</button></p></div></div>
    <button>Review</button>`);
  const doc = dom.window.document;
  const revert = doc.querySelector('[data-testid="revert-button"]');
  assert.equal(revert.getAttribute('aria-label'), '撤销到此处');
  assert.equal(revert.title, 'Undo to this point');
  assert.equal(doc.querySelector('[data-testid="unrelated"]').getAttribute('aria-label'), 'Undo to this point');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"] button').getAttribute('aria-label'), 'Undo to this point');
  assert.equal(doc.querySelector('[data-testid="side-question-question"] .shrink-0').textContent, '侧问');
  assert.equal(doc.querySelector('[data-testid="side-question-question"] .truncate').textContent, 'Review');
  assert.equal(doc.querySelector('[data-testid="settings-error-messages-card"] span').textContent, '错误');
  assert.equal(doc.querySelector('[data-testid="settings-error-messages-card"] div div').textContent, 'Error');
  assert.equal(doc.querySelector('[data-testid="settings-error-messages-copy-button"]').getAttribute('aria-label'), '复制');
  assert.equal(doc.querySelector('[data-testid="settings-error-messages-copy-button"]').title, 'Copy');
  assert.equal(doc.querySelector('p').childNodes[0].nodeValue, '运行 ');
  assert.equal(doc.querySelector('p button').textContent, 'Review');
  const scheduleValues = doc.querySelectorAll('[data-testid="automation-schedule-value"]');
  assert.equal(scheduleValues[0].textContent, '每 15 分钟');
  assert.equal(scheduleValues[1].textContent, 'every tomorrow hours');
  assert.equal(doc.querySelector('body > button').textContent, '审阅');
  revert.setAttribute('aria-label', 'Other');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  revert.setAttribute('aria-label', 'Undo to this point');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(revert.getAttribute('aria-label'), '撤销到此处');
  dom.window.close();
});

test('custom tooltip attributes translate only explicit PDF toolbar records', async () => {
  const dom = mount(`<div class="pdf-sdk-root jetski-pdf-viewer-host"><div data-testid="pdf-floating-toolbar">
    <button data-testid="toolbar-zoom-in" data-tooltip="Zoom in"></button>
    <button data-testid="other" data-tooltip="Review"></button></div>
    <button data-testid="toolbar-zoom-in" data-tooltip="Zoom in"></button></div>`);
  const buttons = dom.window.document.querySelectorAll('button');
  assert.equal(buttons[0].getAttribute('data-tooltip'), '放大');
  assert.equal(buttons[1].getAttribute('data-tooltip'), 'Review');
  assert.equal(buttons[2].getAttribute('data-tooltip'), 'Zoom in');
  buttons[0].setAttribute('data-tooltip', 'Zoom in');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(buttons[0].getAttribute('data-tooltip'), '放大');
  dom.window.close();
});
