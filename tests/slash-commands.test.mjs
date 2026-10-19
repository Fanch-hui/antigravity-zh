import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const commands = JSON.parse(await readFile(new URL('../locales/desktop-slash-commands.json', import.meta.url), 'utf8'));
const row = (command, description, source = '') => `<div id="typeahead-item-${command}" role="option">
  <div class="flex w-full px-2 py-1 items-center gap-2"><span data-testid="menu-option-label">${command}</span>
    <span data-testid="menu-option-description" dir="auto">${description}</span>
    ${source ? `<span data-testid="menu-option-trailing-label">${source}</span>` : ''}</div></div>`;
const menu = content => `<div role="listbox" data-mention-menu aria-label="Mentions">${content}</div>`;
function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  dom.window.eval(script);
  return dom;
}
const settle = dom => new Promise(resolve => dom.window.setTimeout(resolve, 0));

test('conversation counts require numbers and do not rewrite sentences as counts', () => {
  const description = 'Compact the conversation now (summarize history to free up the context window).';
  const dom = mount(`<div role="dialog"><span id="one">1 conversation</span>
    <span id="many">12 conversations</span><p id="description">${description}</p></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#one').textContent, '1 个对话');
  assert.equal(doc.querySelector('#many').textContent, '12 个对话');
  assert.equal(doc.querySelector('#description').textContent, description);
  dom.window.close();
});

test('official slash command descriptions translate while command labels stay callable', () => {
  const dom = mount(menu(commands.map(record => row(record.slashCommand, record.source)).join('')));
  const doc = dom.window.document;
  for (const record of commands) {
    const option = doc.getElementById(`typeahead-item-${record.slashCommand}`);
    assert.equal(option.querySelector('[data-testid="menu-option-label"]').textContent, record.slashCommand);
    assert.equal(option.querySelector('[data-testid="menu-option-description"]').textContent, record.target);
  }
  dom.window.close();
});

test('custom commands and plugin content keep names and descriptions even when UI phrases match', () => {
  const plan = commands.find(record => record.slashCommand === 'plan');
  const dom = mount(menu(row('Settings', 'New Conversation') + row('custom', plan.source) +
    row('goal', 'Settings') + row('plan', plan.source, 'Example Plugin')) +
    `<div data-testid="planner-response-text">${menu(row('plan', plan.source))}</div>`);
  const options = [...dom.window.document.querySelectorAll('[role="option"]')];
  assert.deepEqual(options.map(option => option.querySelector('[data-testid="menu-option-label"]').textContent),
    ['Settings', 'custom', 'goal', 'plan', 'plan']);
  assert.deepEqual(options.map(option => option.querySelector('[data-testid="menu-option-description"]').textContent),
    ['New Conversation', plan.source, 'Settings', plan.source, plan.source]);
  assert.equal(dom.window.document.querySelector('[data-testid="menu-option-trailing-label"]').textContent, 'Example Plugin');
  dom.window.close();
});

test('highlighted descriptions retain their nodes and restore English when an option is reused', async () => {
  const compact = commands.find(record => record.slashCommand === 'compact');
  const dom = mount(menu(row('compact', 'Compact <span class="search-match">the conversation</span> now (summarize history to free up the context window).')));
  const doc = dom.window.document;
  const label = doc.querySelector('[data-testid="menu-option-label"]');
  const description = doc.querySelector('[data-testid="menu-option-description"]');
  const highlight = description.querySelector('.search-match');
  assert.equal(description.textContent, compact.target);
  assert.ok(highlight.isConnected);
  label.textContent = 'custom-command';
  await settle(dom);
  assert.equal(description.textContent, compact.source);
  assert.equal(description.querySelector('.search-match'), highlight);
  label.textContent = 'compact';
  await settle(dom);
  assert.equal(description.textContent, compact.target);
  description.replaceChildren('Compact the ', 'conversation now (summarize history to free up the context window).');
  await settle(dom);
  assert.equal(description.textContent, compact.target);
  dom.window.close();
});
