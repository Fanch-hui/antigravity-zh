import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
// tZ expanded content -> Fzb -> vzb -> t2a, Antigravity 2.24.0.
const errorDetails = text => `<div class="flex flex-col">
  <div class="group flex w-full min-w-0 items-center min-h-8 py-1 px-2 select-none transition-[background-color] cursor-pointer rounded-lg hover:bg-muted" role="button" tabindex="0">
    <div class="flex min-w-0 items-center gap-x-1 text-sm"><span class="truncate">Error</span></div>
    <div class="flex items-center shrink-0"><svg></svg></div>
  </div>
  <div class="relative"><div class="overflow-y-auto outline-none focus-visible:ring-1 focus-visible:ring-ring rounded pl-3">
    <div class="pl-2 py-1 hidden-if-empty"><div class="flex flex-col gap-y-1">
      <div class="flex flex-col gap-1"><div class="flex items-center justify-between">
        <span class="shrink overflow-hidden flex flex-col gap-1 text-sm text-muted-foreground"><span>${text} <a href="https://example.com/plans?utm_campaign=ARGON_LIMIT_REACHED" target="_blank" rel="noopener noreferrer" class="underline opacity-70 transition-opacity hover:opacity-100 cursor-pointer underline-offset-2">See plans</a>.</span></span>
      </div></div>
    </div></div>
  </div></div>
</div>`;

function mount(html, prepare = () => {}) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only'
  });
  prepare(dom.window.document);
  dom.window.eval(script);
  return dom;
}

test('expanded quota error localizes its fixed explanation and keeps the date and plan link', () => {
  const source = " Your plan's baseline quota will refresh on 2026/10/23 09:05:48. You can upgrade to a Google AI Ultra plan to receive higher rate limits.";
  let link;
  let attributes;
  let clicks = 0;
  const dom = mount(errorDetails(source), doc => {
    link = doc.querySelector('span.shrink > span > a');
    attributes = [...link.attributes].map(attribute => [attribute.name, attribute.value]);
    link.addEventListener('click', event => { event.preventDefault(); clicks++; });
  });
  const doc = dom.window.document;
  const message = doc.querySelector('span.shrink > span');
  assert.equal(message.textContent, ' 您的订阅方案基础额度将于 2026/10/23 09:05:48 重置。您可以升级到 Google AI Ultra 方案，以获得更高的使用限额。 查看订阅方案.');
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.equal(message.querySelector('a'), link);
  assert.deepEqual([...link.attributes].map(attribute => [attribute.name, attribute.value]), attributes);
  link.click();
  assert.equal(clicks, 1);
  dom.window.close();
});

test('quota detail branches cover a date alone and the confirmed upgrade sentence', () => {
  const sources = [
    [" Your plan's baseline quota will refresh on 10/23/2026, 9:05:48 AM.", ' 您的订阅方案基础额度将于 10/23/2026, 9:05:48 AM 重置。 查看订阅方案.'],
    ['You can upgrade to a Google AI Ultra plan to receive higher rate limits.', '您可以升级到 Google AI Ultra 方案，以获得更高的使用限额。 查看订阅方案.']
  ];
  for (const [source, expected] of sources) {
    const dom = mount(errorDetails(source));
    assert.equal(dom.window.document.querySelector('span.shrink > span').textContent, expected);
    dom.window.close();
  }
});

test('quota detail rules leave ordinary content, diagnostic text and unknown dates unchanged', () => {
  const source = "Your plan's baseline quota will refresh on 2026/10/23 09:05:48. You can upgrade to a Google AI Ultra plan to receive higher rate limits.";
  const diagnostic = 'The subagent Example Reviewer (research) with id "example-id" encountered an error and has either stopped or failed to start execution: RESOURCE_EXHAUSTED (code 429): Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 149h29m53s.';
  const unknown = "Your plan's baseline quota will refresh on an unknown date.";
  const dom = mount(`<p>${source}</p><div data-testid="planner-response-text">${errorDetails(source)}</div>
    <pre>${diagnostic}</pre>${errorDetails(unknown)}`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('p').textContent, source);
  assert.equal(doc.querySelector('[data-testid="planner-response-text"] span.shrink > span').textContent, source + ' See plans.');
  assert.equal(doc.querySelector('pre').textContent, diagnostic);
  assert.equal([...doc.querySelectorAll('span.shrink > span')].at(-1).firstChild.nodeValue, unknown + ' ');
  dom.window.close();
});
