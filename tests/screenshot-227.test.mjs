import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const row = (title, percentage, detail = '') => `<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-2 py-1 rounded-md text-xs"><span class="truncate text-muted-foreground">${title}</span><span class="flex items-center justify-end gap-1.5"><span class="text-foreground" data-percentage="${percentage}"></span><svg></svg></span>${detail ? `<span class="truncate text-muted-foreground">${detail}</span>` : ''}</div>`;

test('2.27 quota panel translates all screenshot labels even when reset tooltips are absent', async () => {
  const dom = new JSDOM(`<body><div class="flex flex-col min-h-0 select-none"><div>Usage</div><div class="flex flex-col gap-1 min-h-0 overflow-y-auto custom-scrollbar">
    <div><div>Gemini Models</div>${row('Weekly limit', 99)}${row('5h limit', 100)}</div>
    <div><div>Claude and GPT models</div>${row('Weekly limit', 100)}${row('5h limit', 100)}</div>
    ${row('Gemini 4 Argon', 70, 'Weekly limit')}${row('Unknown model', 0, 'Daily limit')}
    </div></div><div data-testid="planner-response-text">Weekly limit 99% left</div><p>Weekly limit</p></body>`,
  { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  const doc = dom.window.document;
  for (const span of doc.querySelectorAll('[data-percentage]')) span.append(span.dataset.percentage, '% left');
  dom.window.eval(script);
  const panel = doc.querySelector('.select-none');
  assert.match(panel.textContent, /Gemini 模型/);
  assert.match(panel.textContent, /Claude 和 GPT 模型/);
  assert.equal(panel.querySelectorAll('.grid')[0].querySelector('.truncate').textContent, '每周额度');
  assert.equal(panel.querySelectorAll('.grid')[1].querySelector('.truncate').textContent, '5 小时额度');
  assert.equal(panel.querySelectorAll('.grid')[4].querySelector('.truncate').textContent, 'Gemini 4 Argon');
  assert.equal(panel.querySelectorAll('.grid')[5].querySelector('.truncate').textContent, 'Unknown model');
  assert.deepEqual([...doc.querySelectorAll('[data-percentage]')].map(e => e.textContent), ['剩余 99%', '剩余 100%', '剩余 100%', '剩余 100%', '剩余 70%', '剩余 0%']);
  const percent = doc.querySelector('[data-percentage]');
  percent.replaceChildren('98', '% left');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(percent.textContent, '剩余 98%');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Weekly limit 99% left');
  assert.equal(doc.querySelector('body > p').textContent, 'Weekly limit');
  dom.window.close();
});

test('extension menu translates fixed entry labels and preserves the named extensions', () => {
  const dom = new JSDOM(`<body><div role="menu"><button data-testid="plugins-submenu-trigger"><span>Extensions</span></button>
    <button data-testid="plugins-submenu-item"><span class="truncate">Android Compose Preview</span></button>
    <button data-testid="plugins-submenu-item"><span class="truncate">Android Device Hub</span></button></div>
    <button data-testid="overview-panel-row-plugins"><span>Extensions</span></button><p>Extensions</p></body>`,
  { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(script);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="plugins-submenu-trigger"]').textContent, '扩展');
  assert.equal(doc.querySelector('[data-testid="overview-panel-row-plugins"]').textContent, '扩展');
  assert.deepEqual([...doc.querySelectorAll('[data-testid="plugins-submenu-item"]')].map(e => e.textContent), ['Android Compose Preview', 'Android Device Hub']);
  assert.equal(doc.querySelector('p').textContent, 'Extensions');
  dom.window.close();
});
