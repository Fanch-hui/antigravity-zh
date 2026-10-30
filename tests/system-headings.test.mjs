import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const systemRenderer = ({ step, debugMode }) => {
  const metadata = step.metadata?.auto_proceed_uri;
  const info = step.renderInfo;
  return { metadata, info, debugMode, fallbackMarkdown: step.message };
};
const unrelatedRenderer = ({ step }) => step;

function systemMessage(id, text, { plain = false, transition = false } = {}) {
  const content = transition ? `<span>${text}</span>` : text;
  const title = `<div class="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground">
    <span class="truncate text-muted-foreground [&amp;_.text-foreground]:text-muted-foreground" title="${text}" id="${id}">${content}</span></div>`;
  if (plain) return `<div class="w-full my-0.5 px-2 min-h-8 py-1 flex items-center select-none text-sm">${title}</div>`;
  return `<div class="w-full my-0.5"><div class="relative"><button type="button" aria-expanded="true" class="group flex items-center gap-1 w-full text-left text-sm px-2 min-h-8 py-1 rounded-lg tabular-nums select-none">${title}</button>
    <div class="text-secondary-foreground pl-2"><div class="markdown">Goal Verification</div></div></div></div>`;
}

function attachHost(element, parent) {
  const host = { tag: 5, stateNode: element, return: parent, child: null, sibling: null };
  Object.defineProperty(element, '__reactFiber$test', { value: host, configurable: true, enumerable: true });
  let previous = null;
  for (const child of element.children) {
    const fiber = attachHost(child, host);
    if (previous) previous.sibling = fiber;
    else host.child = fiber;
    previous = fiber;
  }
  return host;
}

function attachFiber(element, step, renderer = systemRenderer) {
  const root = { tag: 3, stateNode: {}, return: null, child: null, sibling: null };
  const owner = { tag: 0, type: renderer, memoizedProps: { step, debugMode: false }, return: root, child: null, sibling: null };
  const wrapper = { tag: 0, type: () => null, memoizedProps: {}, return: owner, child: null, sibling: null };
  root.stateNode.current = root;
  root.child = owner;
  owner.child = wrapper;
  wrapper.child = attachHost(element, wrapper);
  return { root, owner };
}

function alternateTree(fiber, parent = null) {
  const alternate = { ...fiber, return: parent, child: null, sibling: null, alternate: fiber };
  fiber.alternate = alternate;
  if (fiber.child) alternate.child = alternateTree(fiber.child, alternate);
  if (fiber.sibling) alternate.sibling = alternateTree(fiber.sibling, parent);
  return alternate;
}

function mount(html, prepare) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  prepare?.(dom.window.document);
  dom.window.eval(script);
  return dom;
}

test('built-in event headings translate only their matching system message identities', () => {
  const dom = mount(systemMessage('goal', 'Goal Verification') +
    systemMessage('idle', 'Idle Guard Warning', { plain: true }) +
    systemMessage('fork', 'Fork Environment Notice', { transition: true }), doc => {
    attachFiber(doc.querySelector('#goal'), { eventType: 'goal_stop', message: 'diagnostic text' });
    const { root } = attachFiber(doc.querySelector('#idle'), { eventType: 'idle_no_message', renderInfo: { titleParts: [] } });
    const wrapper = root.child.child;
    wrapper.child = { tag: 5, stateNode: doc.createElement('span'), return: wrapper, child: null, sibling: wrapper.child };
    attachFiber(doc.querySelector('#fork'), { eventType: 'fork_notice' });
  });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#goal').textContent, '目标验证');
  assert.equal(doc.querySelector('#idle').textContent, '空闲保护提示');
  assert.equal(doc.querySelector('#fork').textContent, '分叉环境提示');
  assert.equal(doc.querySelector('#goal').title, 'Goal Verification');
  assert.equal(doc.querySelector('.markdown').textContent, 'Goal Verification');
  dom.window.close();
});

test('dynamic title sources and mismatched event types stay intact even when their labels match', () => {
  const dom = mount(systemMessage('title', 'Goal Verification') + systemMessage('parts', 'Goal Verification') +
    systemMessage('unknown', 'Goal Verification') + systemMessage('wrong', 'Goal Verification') +
    systemMessage('fallback', 'Goal Verification') + systemMessage('other-renderer', 'Goal Verification') +
    systemMessage('missing', 'Goal Verification') + systemMessage('uncommitted', 'Goal Verification') +
    systemMessage('detached', 'Goal Verification'), doc => {
    attachFiber(doc.querySelector('#title'), { eventType: 'goal_stop', renderInfo: { title: 'Goal Verification' } });
    attachFiber(doc.querySelector('#parts'), { eventType: 'goal_stop', renderInfo: { titleParts: [{ part: { case: 'text', value: 'Goal Verification' } }] } });
    attachFiber(doc.querySelector('#unknown'), { eventType: 'goal_verification' });
    attachFiber(doc.querySelector('#wrong'), { eventType: 'fork_notice' });
    attachFiber(doc.querySelector('#fallback'), { message: 'Goal Verification' });
    attachFiber(doc.querySelector('#other-renderer'), { eventType: 'goal_stop' }, unrelatedRenderer);
    const { root } = attachFiber(doc.querySelector('#uncommitted'), { eventType: 'goal_stop' });
    root.stateNode.current = null;
    const detached = attachFiber(doc.querySelector('#detached'), { eventType: 'goal_stop' });
    detached.root.child.child.child = null;
  });
  for (const id of ['title', 'parts', 'unknown', 'wrong', 'fallback', 'other-renderer', 'missing', 'uncommitted', 'detached']) {
    assert.equal(dom.window.document.querySelector(`#${id}`).textContent, 'Goal Verification', id);
  }
  dom.window.close();
});

test('user text and similarly structured tool feedback preserve identical phrases', () => {
  const body = systemMessage('protected', 'Goal Verification');
  const tool = `<div class="group flex w-full min-w-0 items-center min-h-8 py-1 px-2 select-none"><div class="flex min-w-0 items-center gap-x-1 text-sm"><span class="truncate"><div class="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground"><span class="truncate text-muted-foreground" id="tool">Goal Verification</span></div></span></div></div>`;
  const dom = mount(`<div data-testid="planner-response-text">${body}</div>${tool}`, doc => {
    attachFiber(doc.querySelector('#protected'), { eventType: 'goal_stop' });
    attachFiber(doc.querySelector('#tool'), { eventType: 'goal_stop' }, unrelatedRenderer);
  });
  assert.equal(dom.window.document.querySelector('#protected').textContent, 'Goal Verification');
  assert.equal(dom.window.document.querySelector('#tool').textContent, 'Goal Verification');
  dom.window.close();
});

test('settled title transitions use their current complete event text', async () => {
  const dom = mount(systemMessage('transition', 'Goal Verification', { transition: true }), doc => {
    attachFiber(doc.querySelector('#transition'), { eventType: 'goal_stop' });
  });
  const title = dom.window.document.querySelector('#transition');
  title.innerHTML = '<span><span data-slot><span data-slot-in>Goal Verification</span><span data-slot-out aria-hidden="true">Previous</span></span></span>';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(title.textContent, 'Goal VerificationPrevious');
  const settled = dom.window.document.createElement('span');
  settled.textContent = 'Goal Verification';
  title.replaceChildren(settled);
  const titleFiber = title.__reactFiber$test;
  titleFiber.child = attachHost(settled, titleFiber);
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(title.textContent, '目标验证');
  dom.window.close();
});

test('the current alternate fiber restores a dynamic title when its visible text did not change', async () => {
  let root;
  const dom = mount(systemMessage('stable', 'Goal Verification'), doc => {
    ({ root } = attachFiber(doc.querySelector('#stable'), { eventType: 'goal_stop' }));
  });
  const title = dom.window.document.querySelector('#stable');
  assert.equal(title.textContent, '目标验证');
  const current = alternateTree(root);
  current.child.memoizedProps = {
    step: { eventType: 'goal_stop', renderInfo: { title: 'Goal Verification' } }, debugMode: false,
  };
  root.stateNode.current = current;
  await new Promise(resolve => dom.window.setTimeout(resolve, 350));
  assert.equal(title.textContent, 'Goal Verification');
  dom.window.close();
});

test('shared bailout children use the committed owner rather than a stale return pointer', async () => {
  let root;
  const dom = mount(systemMessage('shared', 'Goal Verification'), doc => {
    ({ root } = attachFiber(doc.querySelector('#shared'), { eventType: 'goal_stop' }));
  });
  const title = dom.window.document.querySelector('#shared');
  assert.equal(title.textContent, '目标验证');
  const current = alternateTree(root);
  current.child.child = root.child.child;
  current.child.memoizedProps = { step: { eventType: 'goal_stop', renderInfo: { title: 'Goal Verification' } } };
  root.stateNode.current = current;
  await new Promise(resolve => dom.window.setTimeout(resolve, 350));
  assert.equal(title.textContent, 'Goal Verification');
  dom.window.close();
});
