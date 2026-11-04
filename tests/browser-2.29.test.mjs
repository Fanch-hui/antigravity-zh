import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';
const script = await createRuntimeScript();
function mount(html) {
  const dom = new JSDOM(`<body>${html}</body>`, {url:'https://127.0.0.1:42000/',runScripts:'outside-only'});
  dom.window.eval(script);
  return dom;
}
test('download controls preserve filenames while translating actions, status and progress', () => {
  const dom=mount(`<div data-testid="webview-download-drawer"><div><span class="text-sm font-medium">Downloads</span></div>
    <div data-testid="webview-download-item"><button data-testid="webview-download-open" title="Settings" aria-label="Open Settings"><span data-testid="webview-download-filename">Settings</span></button>
    <span data-testid="webview-download-status">Interrupted</span><div role="progressbar" aria-label="Settings download progress"></div>
    <button data-testid="webview-download-cancel" title="Cancel download" aria-label="Cancel Settings"></button></div></div>
    <button data-testid="webview-url-bar-downloads" aria-label="Downloads, 37% complete" title="Downloads"></button>
    <div data-testid="planner-response-text">No recent downloads</div>`);
  const doc=dom.window.document;
  assert.equal(doc.querySelector('[data-testid="webview-download-filename"]').textContent,'Settings');
  assert.equal(doc.querySelector('[data-testid="webview-download-open"]').title,'Settings');
  assert.equal(doc.querySelector('[data-testid="webview-download-open"]').getAttribute('aria-label'),'Open Settings');
  assert.equal(doc.querySelector('[role="progressbar"]').getAttribute('aria-label'),'Settings 的下载进度');
  assert.equal(doc.querySelector('[data-testid="webview-download-status"]').textContent,'已中断');
  assert.equal(doc.querySelector('[data-testid="webview-download-cancel"]').getAttribute('aria-label'),'取消下载 Settings');
  assert.equal(doc.querySelector('[data-testid="webview-url-bar-downloads"]').getAttribute('aria-label'),'下载，已完成 37%');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent,'No recent downloads');
  dom.window.close();
});
test('browser suggestions and error messages preserve site values and search input', () => {
  const dom=mount(`<div data-testid="browser-autocomplete-dropdown" aria-label="Address bar suggestions">
    <div data-testid="browser-autocomplete-option" data-suggestion-kind="search-web"><span class="truncate text-foreground font-normal">Settings</span><span class="text-muted-foreground">Google Search</span></div>
    <div data-testid="browser-autocomplete-option" data-suggestion-kind="navigate-url"><span class="truncate text-foreground font-normal">Downloads</span><span class="truncate text-muted-foreground font-normal">https://example.com</span></div></div>
    <div data-testid="browser-error-overlay"><h1>This page isn’t working</h1><p>example.com could not find the requested page.</p><div>https://example.com</div><code>HTTP ERROR 404</code></div>`);
  const doc=dom.window.document;
  assert.equal(doc.querySelector('[data-suggestion-kind="search-web"] > span').textContent,'Settings');
  assert.equal(doc.querySelector('[data-suggestion-kind="search-web"] > span + span').textContent,'Google 搜索');
  assert.equal(doc.querySelector('[data-suggestion-kind="navigate-url"] > span').textContent,'Downloads');
  assert.equal(doc.querySelector('h1').textContent,'此页面无法正常运行');
  assert.equal(doc.querySelector('p').textContent,'example.com 找不到请求的页面。');
  assert.equal(doc.querySelector('code').textContent,'HTTP ERROR 404');
  dom.window.close();
});
