import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

function fixture() {
  const dom = new JSDOM(`<!DOCTYPE html><body><div class="max-w-2xl mx-auto flex-col gap-4">
    <div class="flex flex-col gap-2 w-full mb-2"><div class="text-sm text-muted-foreground bg-transparent">Agent settings and permissions for conversations outside of projects.</div></div>
    <div class="space-y-2"><div class="flex flex-col gap-1"><div class="text-xs text-muted-foreground leading-relaxed"><span id="description"></span></div></div></div>
    <div role="option">Inherits your Global Permissions when working in these conversations.</div>
    <div data-testid="planner-response-text">Agent settings and permissions for conversations outside of projects.</div>
    </div></body>`, { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  const doc = dom.window.document;
  const description = doc.querySelector('#description');
  description.append('Also includes', ' ');
  const global = doc.createElement('span');
  global.className = 'text-link hover:underline cursor-pointer font-medium';
  global.textContent = 'Global Permissions';
  description.append(global, ' ', 'when working ');
  const location = doc.createTextNode('in these conversations');
  description.append(location, '.', ' ');
  const help = doc.createElement('a');
  help.href = 'https://example.com/permissions';
  help.textContent = 'Learn more';
  description.append(help, '.');
  return { dom, doc, description, global, location, help };
}

test('conversation permissions preserve interactive links and translate full split explanation', async () => {
  const { dom, doc, description, global, location, help } = fixture();
  dom.window.eval(await createRuntimeScript());
  assert.equal(doc.querySelector('.mb-2 .text-sm').textContent, '项目外会话的智能体设置和权限。');
  assert.equal(description.textContent, '也包括 全局权限 （在这些会话中工作时）。 了解更多.');
  assert.equal(description.querySelector('span'), global);
  assert.equal(description.querySelector('a'), help);
  assert.equal(help.getAttribute('href'), 'https://example.com/permissions');
  assert.equal(doc.querySelector('[role="option"]').textContent, '在这些会话中工作时，继承你的全局权限。');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Agent settings and permissions for conversations outside of projects.');
  location.nodeValue = 'in this project';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(description.textContent, '也包括 全局权限 （在此项目中工作时）。 了解更多.');
  dom.window.close();
});

test('other inline text and user project names retain their original content', async () => {
  const { dom, doc, description } = fixture();
  const other = doc.createElement('span');
  other.append('when working ', 'in these conversations', '.');
  doc.body.append(other);
  description.prepend(doc.createTextNode('Project Alpha '));
  dom.window.eval(await createRuntimeScript());
  assert.equal(other.textContent, 'when working in these conversations.');
  assert.match(description.textContent, /^Project Alpha /);
  assert.match(description.textContent, /全局权限 （在这些会话中工作时）。/);
  dom.window.close();
});
