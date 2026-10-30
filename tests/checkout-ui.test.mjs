import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const computer = '<svg><path d="M55.39-150.77v-60H904.61"></path></svg>';
const split = '<svg><path d="call-split"></path></svg>';
const option = (id, title, description, icon = '', disabled = false) => `<button id="${id}" class="main-row-trigger" ${disabled ? 'disabled' : ''}>
  <div class="flex items-center justify-start w-full gap-1.5">${icon ? `<div class="shrink-0 flex items-center justify-center">${icon}</div>` : ''}<span class="truncate flex-grow min-w-0">${title}</span></div>
  <span class="text-xs text-muted-foreground whitespace-normal break-words leading-tight py-0.5 w-full">${description}</span></button>`;

test('local checkout labels and workspace hints translate without changing resource and environment names', async () => {
  const resources = '示例项目/, Work locally on Local Checkout/, $HOME/';
  const dom = new JSDOM(`<body>
    <button id="local" aria-label="Select Environment">${computer}<span class="select-none truncate max-w-36">Local Checkout</span></button>
    <button id="environment" aria-label="Select Environment">${split}<span class="select-none truncate max-w-36">Local Checkout</span></button>
    ${option('local-option', 'Local Checkout', `Work locally on ${resources}`, computer)}
    ${option('named-environment', 'Local Checkout', `Work locally on ${resources}`)}
    ${option('worktree', 'New Worktree', 'Worktrees are available for Git repositories', split, true)}
    <div data-testid="planner-response-text">Local Checkout</div></body>`,
  { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(await createRuntimeScript());
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#local span').textContent, '本地工作副本');
  assert.equal(doc.querySelector('#environment span').textContent, 'Local Checkout');
  assert.equal(doc.querySelector('#local-option .truncate').textContent, '本地工作副本');
  assert.equal(doc.querySelector('#local-option > span').textContent, `在本地使用 ${resources}`);
  assert.equal(doc.querySelector('#named-environment .truncate').textContent, 'Local Checkout');
  assert.equal(doc.querySelector('#named-environment > span').textContent, `Work locally on ${resources}`);
  assert.equal(doc.querySelector('#worktree > span').textContent, 'Git 仓库可使用工作树');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Local Checkout');
  doc.querySelector('#local-option > span').textContent = 'Work locally on Documents/, Desktop/';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(doc.querySelector('#local-option > span').textContent, '在本地使用 Documents/, Desktop/');
  dom.window.close();
});
