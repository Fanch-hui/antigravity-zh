import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(html, prepare = () => {}) {
  const dom = new JSDOM(`<body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  prepare(dom.window.document);
  dom.window.eval(script);
  return dom;
}

test('browser settings translate whole descriptions and the changed text after the Chrome link', async () => {
  const tail = 'to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.';
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4">
    <h3>Built-in Browser</h3><p>Configure link opening and built-in browser preferences.</p>
    <button>External Browser</button><button>Built-in Browser</button>
    <div class="space-y-2"><div class="flex flex-col gap-1"><div class="text-xs text-muted-foreground leading-relaxed" id="browser-description"><a href="https://www.google.com/chrome/">Google Chrome</a></div></div></div>
    <p id="unknown">Configure future browser preferences.</p></div>
    <div data-testid="planner-response-text">${tail}</div>`, doc => {
    const description = doc.querySelector('#browser-description');
    description.prepend('Configure the browser subagent. It requires', ' ');
    description.append(' ', tail);
  });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h3').textContent, '内置浏览器');
  assert.equal(doc.querySelector('p').textContent, '配置链接打开方式及内置浏览器偏好。');
  assert.deepEqual([...doc.querySelectorAll('button')].map(button => button.textContent), ['外部浏览器', '内置浏览器']);
  const description = doc.querySelector('#browser-description');
  assert.equal(description.textContent, '配置浏览器子智能体。它需要安装 Google Chrome 才可使用。在对话输入框中输入 /browser，即可调用浏览器子智能体。');
  const link = description.querySelector('a');
  assert.equal(link.href, 'https://www.google.com/chrome/');
  assert.equal(link.textContent, 'Google Chrome');
  description.replaceChildren('Configure the browser subagent. It requires', ' ', link, ' ', tail);
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(description.querySelector('a'), link);
  assert.match(description.textContent, /Google Chrome 才可使用。/);
  assert.equal(doc.querySelector('#unknown').textContent, 'Configure future browser preferences.');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, tail);
  dom.window.close();
});

test('carousel details translate links while preserving plugin names, descriptions and routes', () => {
  const dom = mount(`<section data-testid="featured-carousel">
    <h3 data-testid="featured-carousel-headline" title="Restart to Update">Restart to Update</h3>
    <p data-testid="featured-carousel-description" title="Details">Details</p>
    <div data-testid="featured-carousel-actions"><span><button>Add</button></span><a href="/customizations/plugins/Details" aria-label="Details for Restart to Update"><span>Details</span></a></div></section>`);
  const doc = dom.window.document;
  const link = doc.querySelector('a');
  assert.equal(link.textContent, '详情');
  assert.equal(link.getAttribute('aria-label'), '查看 Restart to Update 的详情');
  assert.equal(link.getAttribute('href'), '/customizations/plugins/Details');
  assert.equal(doc.querySelector('h3').textContent, 'Restart to Update');
  assert.equal(doc.querySelector('h3').title, 'Restart to Update');
  assert.equal(doc.querySelector('p').textContent, 'Details');
  assert.equal(doc.querySelector('p').title, 'Details');
  dom.window.close();
});

test('MCP configure templates stay within the configuration dialog and action', () => {
  const dom = mount(`<div role="dialog"><h2>Configure Demo MCP</h2><div data-testid="mcp-config-modal"></div></div>
    <button data-testid="mcp-server-configure" aria-label="Configure Demo MCP">Configure</button>`);
  assert.equal(dom.window.document.querySelector('h2').textContent, '配置 Demo MCP');
  assert.equal(dom.window.document.querySelector('button').getAttribute('aria-label'), '配置 Demo MCP');
  dom.window.close();
});
