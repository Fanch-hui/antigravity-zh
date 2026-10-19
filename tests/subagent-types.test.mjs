import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const chip = (id, name, title = 'Subagent') => `<div class="py-1 px-2 flex items-center gap-1 rounded-md text-secondary-foreground" title="${title}">
  <svg class="text-secondary-foreground"></svg><span class="text-xs select-none" id="${id}">${name}</span></div>`;
const input = content => `<div data-testid="agent-input-box" class="flex flex-col w-full shrink-0">
  <div id="antigravity.agentSidePanelInputBox" class="relative flex flex-col p-px rounded-2xl bg-card-border">
    <div class="relative flex flex-col gap-0 p-1 rounded-[calc(theme(borderRadius.2xl)-1px)] bg-card">
      <div class="@container/input-footer flex w-full items-center justify-between gap-1 p-0.5">
        <div class="flex min-w-0 flex-1 items-center gap-0"><div class="flex items-center gap-0 min-w-0">${content}</div></div>
        <div class="shrink-0 flex items-center gap-0.5"></div></div></div></div></div>`;

function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only'
  });
  dom.window.eval(script);
  return dom;
}

test('subagent composer displays built-in type labels and translates their tooltip', () => {
  const dom = mount(input(chip('research', 'research') + chip('self', 'self')));
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#research').textContent, '调研');
  assert.equal(doc.querySelector('#self').textContent, '通用');
  assert.equal(doc.querySelector('#research').parentElement.title, '子智能体');
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.equal(doc.querySelector('#research').textContent, '调研');
  dom.window.close();
});

test('subagent labels remain eligible after the tooltip has already been translated', async () => {
  const dom = mount(input(chip('label', 'research', '子智能体')));
  const label = dom.window.document.querySelector('#label');
  assert.equal(label.textContent, '调研');
  label.textContent = 'self';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(label.textContent, '通用');
  dom.window.close();
});

test('ordinary agent scripts, custom roles and matching conversation text retain their names', () => {
  const dom = mount(input(chip('script', 'research', 'Agent Script') + chip('role', 'Storage and performance reviewer')) +
    chip('outside', 'research') + '<div data-testid="subagent-tab-header-title">research</div>' +
    `<div data-testid="planner-response-text">${input(chip('answer', 'research'))}</div>` +
    `<div data-testid="user-input-step">${input(chip('user', 'self'))}</div>` +
    '<div data-testid="menu-option-label">research</div><p id="plain">self</p>');
  const doc = dom.window.document;
  for (const id of ['script', 'outside', 'answer']) assert.equal(doc.querySelector(`#${id}`).textContent, 'research');
  assert.equal(doc.querySelector('#role').textContent, 'Storage and performance reviewer');
  assert.equal(doc.querySelector('#user').textContent, 'self');
  assert.equal(doc.querySelector('#plain').textContent, 'self');
  assert.equal(doc.querySelector('[data-testid="subagent-tab-header-title"]').textContent, 'research');
  assert.equal(doc.querySelector('[data-testid="menu-option-label"]').textContent, 'research');
  dom.window.close();
});
