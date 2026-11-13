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
const coordinator = '[data-testid="pending-coordinator-error"]';
const security = '[data-testid="url-security-popover"]';
const warning = `${security} > div.flex.flex-col.gap-2\\.5.px-3.py-2\\.5 > span.text-secondary-foreground.leading-relaxed`;
const cleared = '[data-testid="url-security-site-data-cleared"]';
const clearFailure = `${security} > div.flex.flex-col.gap-2\\.5.px-3.py-2\\.5 > span.text-error`;
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
  { source: "Couldn't start the coordinator: {0}", target: '无法启动协调者：{0}',
    contentBoundary: coordinator, selector: `${coordinator} > span.min-w-0`, kind: 'text', template: true },
  { source: 'Clearing cookies and site data for {0} may sign you out of this site.',
    target: '清除 {0} 的网站数据可能会让你退出该网站。', contentBoundary: warning, selector: warning,
    kind: 'text', template: true },
  { source: 'Site data cleared for {0}.', target: '已清除 {0} 的网站数据。',
    contentBoundary: cleared, selector: cleared, kind: 'text', template: true },
  { source: 'Could not clear site data for {0}.', target: '无法清除 {0} 的网站数据。',
    contentBoundary: clearFailure, selector: clearFailure, kind: 'text', template: true },
  { source: 'Review', target: '审阅' },
  { source: 'Side Question: ', target: '侧问： ', contentBoundary: '[data-testid="side-question-tab-header-title"]',
    selector: '[data-testid="side-question-tab-header-title"] > [data-testid="side-question-tab-header-prefix"]', kind: 'text' },

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

test('exact text boundaries translate split fixed templates and preserve dynamic values', async () => {
  const dom = mount(`<div data-testid="pending-coordinator-error"><span class="min-w-0">Couldn't start the coordinator: <!-- -->E42 Review</span></div>
    <div data-testid="url-security-popover"><div class="flex flex-col gap-2.5 px-3 py-2.5">
      <span class="text-secondary-foreground leading-relaxed">Clearing cookies and site data for <!-- -->Review.test<!-- --> may sign you out of this site.</span>
      <span data-testid="url-security-site-data-cleared">Site data cleared for <!-- -->Review.test<!-- -->.</span>
      <span class="text-error">Could not clear site data for <!-- -->Review.test<!-- -->.</span></div></div>
    <div data-testid="planner-response-text">Review</div>`);
  const doc = dom.window.document;
  const message = doc.querySelector('[data-testid="pending-coordinator-error"] > span.min-w-0');
  assert.equal(message.textContent, '无法启动协调者：E42 Review');
  const warningNode = doc.querySelector(warning);
  assert.equal(warningNode.textContent, '清除 Review.test 的网站数据可能会让你退出该网站。');
  assert.equal(doc.querySelector(cleared).textContent, '已清除 Review.test 的网站数据。');
  assert.equal(doc.querySelector(clearFailure).textContent, '无法清除 Review.test 的网站数据。');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Review');

  const owner = message.parentElement;
  owner.dataset.testid = 'renamed-coordinator-error';
  dom.window.__AGY_ZH_RUNTIME__.translate(owner);
  assert.equal(message.textContent, "Couldn't start the coordinator: E42 Review");
  owner.dataset.testid = 'pending-coordinator-error';
  dom.window.__AGY_ZH_RUNTIME__.translate(owner);
  assert.equal(message.textContent, '无法启动协调者：E42 Review');

  message.textContent = "Couldn't start the coordinator: New Review";
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(message.textContent, '无法启动协调者：New Review');
  message.textContent = 'Unregistered Review text';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(message.textContent, 'Unregistered Review text');
  dom.window.close();
});

test('2.31 typography changes preserve dynamic labels while adjacent controls translate', () => {
  const dom = mount(`<div role="dialog">
    <div data-testid="model-selector-panel"><button data-testid="model-selector-item"><span class="truncate text-sm text-left">Review</span></button></div>
    <div class="relative flex items-center gap-3 p-3 rounded-xl"><div class="flex-1 min-w-0 flex flex-col gap-0.5 pr-4">
      <div class="font-medium text-foreground truncate">Review</div><div class="text-sm text-muted-foreground truncate">Review</div></div><button>Review</button></div>
    <div class="flex flex-col gap-3"><h1 class="font-medium tracking-tight leading-tight text-foreground truncate min-w-0">Review</h1>
      <p class="text-muted-foreground leading-relaxed">Review</p><button>Review</button></div>
    <section data-testid="running-group"><div class="flex items-center"><button class="truncate font-medium">Review</button></div>
      <button data-testid="running-row"><span class="text-foreground truncate">Review</span></button><button>Review</button></section>
    <div data-testid="sidecar-detail"><span class="text-foreground truncate">Review</span><p class="m-0 text-muted-foreground text-compact">Review</p><button>Review</button></div>
    <div data-testid="automation-model-value"><span class="leading-5 text-foreground">Review</span></div>
    <div class="mt-3 bg-background/50 border border-border/50 rounded p-2 max-h-40 overflow-y-auto"><ul class="space-y-1">
      <li class="text-sm text-muted-foreground truncate max-w-[340px]">Review</li></ul></div>
    <button>Review</button></div>`);
  const doc = dom.window.document;
  const protectedLabels = doc.querySelectorAll('[data-testid="model-selector-item"] span, .rounded-xl .truncate, h1, h1 + p, [data-testid="running-group"] .truncate, [data-testid="sidecar-detail"] span, [data-testid="sidecar-detail"] p, [data-testid="automation-model-value"] span, li');
  assert.equal(protectedLabels.length, 11);
  for (const label of protectedLabels) assert.equal(label.textContent, 'Review', label.outerHTML);
  assert.equal(doc.querySelectorAll('button').length, 8);
  assert.equal([...doc.querySelectorAll('button')].filter(button => button.textContent === '审阅').length, 5);
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
