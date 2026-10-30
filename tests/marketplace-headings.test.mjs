import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const section = (id, title, description = '') => `<section id="${id}" aria-label="${title}" class="flex flex-col gap-3">
  <div class="flex flex-col gap-1 px-3"><h2 class="text-base font-medium text-foreground">${title}</h2>
  ${description ? `<p class="text-xs text-muted-foreground">${description}</p>` : ''}</div>
  <div class="grid gap-2 grid-cols-1 sm:grid-cols-2"><div data-testid="bundle-card-example"><div class="min-w-0 flex flex-col gap-2"><h3>More Plugins</h3><div>Explore other marketplace customizations</div></div></div></div>
  ${title === 'Plugins' ? '<div class="flex justify-start"><button aria-label="See more in Plugins">See more</button></div>' : ''}</section>`;

function fiber(tag, stateNode, owner = null, key = null) {
  return { tag, stateNode, key, return: owner, child: null, sibling: null, alternate: null };
}

function appendFiber(parent, child) {
  if (!parent.child) parent.child = child;
  else {
    let sibling = parent.child;
    while (sibling.sibling) sibling = sibling.sibling;
    sibling.sibling = child;
  }
}

function attachFibers(parentElement, items) {
  const rootState = {};
  const root = fiber(3, rootState);
  const parent = fiber(5, parentElement, root);
  root.child = parent;
  rootState.current = root;
  const sections = {};
  for (const { id, dynamic = false, key = null, attached = true } of items) {
    const element = parentElement.querySelector(`#${id}`);
    const owner = dynamic ? fiber(7, null, parent) : parent;
    const item = fiber(5, element, owner, key);
    if (dynamic) owner.child = item;
    appendFiber(parent, dynamic ? owner : item);
    if (attached) element.__reactFiber$test = item;
    sections[id] = item;
  }
  return { rootState, root, parent, sections };
}

test('fixed marketplace sections translate while identical dynamic shelves and cards retain their content', () => {
  const description = 'Explore other marketplace customizations';
  const dom = new JSDOM(`<body><div data-testid="customizations-marketplace"><div class="flex flex-col gap-10">
    ${section('fixed', 'More Plugins', description)}${section('dynamic', 'More Plugins', description)}
    ${section('unkeyed-dynamic', 'More Plugins', description)}${section('without-fiber', 'More Plugins', description)}${section('without-root', 'More Plugins', description)}
    ${section('plugins', 'Plugins')}${section('dynamic-plugins', 'Plugins')}${section('skills', 'Skills')}
  </div></div><div data-testid="planner-response-text">More Plugins</div></body>`,
  { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  const doc = dom.window.document;
  const parent = doc.querySelector('[data-testid="customizations-marketplace"] > div');
  attachFibers(parent, [
    { id: 'fixed' }, { id: 'dynamic', dynamic: true, key: 'shelf-1' },
    { id: 'unkeyed-dynamic', dynamic: true }, { id: 'without-fiber', attached: false },
    { id: 'without-root', attached: false }, { id: 'plugins' },
    { id: 'dynamic-plugins', dynamic: true, key: 'shelf-2' }, { id: 'skills' },
  ]);
  const detachedParent = fiber(5, parent);
  const detachedSection = fiber(5, doc.getElementById('without-root'), detachedParent);
  detachedParent.child = detachedSection;
  doc.getElementById('without-root').__reactFiber$test = detachedSection;
  dom.window.eval(script);
  assert.equal(doc.querySelector('#fixed h2').textContent, '更多插件');
  assert.equal(doc.querySelector('#fixed p').textContent, '探索市场中的其他自定义内容');
  assert.equal(doc.querySelector('#fixed').getAttribute('aria-label'), '更多插件');
  assert.equal(doc.querySelector('#plugins h2').textContent, '插件');
  assert.equal(doc.querySelector('#plugins button').getAttribute('aria-label'), '查看更多插件');
  assert.equal(doc.querySelector('#skills h2').textContent, '技能');
  for (const id of ['dynamic', 'unkeyed-dynamic', 'without-fiber', 'without-root']) {
    const item = doc.getElementById(id);
    assert.equal(item.querySelector('h2').textContent, 'More Plugins');
    assert.equal(item.querySelector('p').textContent, description);
    assert.equal(item.getAttribute('aria-label'), 'More Plugins');
  }
  assert.equal(doc.querySelector('#dynamic-plugins h2').textContent, 'Plugins');
  assert.equal(doc.querySelector('#dynamic-plugins button').getAttribute('aria-label'), 'See more in Plugins');
  assert.equal(doc.querySelector('#fixed h3').textContent, 'More Plugins');
  assert.equal(doc.querySelector('#fixed [data-testid^="bundle-card-"] div > div').textContent, description);
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'More Plugins');
  dom.window.close();
});

test('current React tree controls existing translations even when the DOM text does not change', async () => {
  const description = 'Explore other marketplace customizations';
  const dom = new JSDOM(`<body><div data-testid="customizations-marketplace"><div class="flex flex-col gap-10">
    ${section('fixed', 'More Plugins', description)}</div></div></body>`,
  { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  const doc = dom.window.document;
  const element = doc.getElementById('fixed');
  const tree = attachFibers(element.parentElement, [{ id: 'fixed' }]);
  const currentSection = tree.sections.fixed;
  dom.window.eval(script);
  assert.equal(element.querySelector('h2').textContent, '更多插件');
  assert.equal(element.querySelector('p').textContent, '探索市场中的其他自定义内容');
  assert.equal(element.getAttribute('aria-label'), '更多插件');

  const alternateRoot = fiber(3, tree.rootState);
  const alternateParent = fiber(5, element.parentElement, alternateRoot);
  const alternateSection = fiber(5, element, alternateParent);
  tree.root.alternate = alternateRoot;
  alternateRoot.alternate = tree.root;
  tree.parent.alternate = alternateParent;
  alternateParent.alternate = tree.parent;
  currentSection.alternate = alternateSection;
  alternateSection.alternate = currentSection;
  alternateRoot.child = alternateParent;
  alternateParent.child = alternateSection;
  tree.rootState.current = alternateRoot;
  await new Promise(resolve => dom.window.setTimeout(resolve, 350));
  assert.equal(element.querySelector('h2').textContent, '更多插件');
  assert.equal(element.getAttribute('aria-label'), '更多插件');

  const fragment = fiber(7, null, tree.parent);
  fragment.child = currentSection;
  tree.parent.child = fragment;
  currentSection.return = fragment;
  tree.rootState.current = tree.root;
  await new Promise(resolve => dom.window.setTimeout(resolve, 350));
  assert.equal(element.querySelector('h2').textContent, 'More Plugins');
  assert.equal(element.querySelector('p').textContent, description);
  assert.equal(element.getAttribute('aria-label'), 'More Plugins');
  dom.window.close();
});

test('bundle shelf translates only its fixed description and numeric result counts', async () => {
  const dom = new JSDOM(`<body><div data-testid="customizations-marketplace"><section class="flex flex-col gap-3" data-testid="marketplace-bundles-shelf" aria-label="Bundles">
    <div class="flex flex-col gap-1 px-3"><h2>Bundles</h2><p class="text-xs text-muted-foreground">Curated sets of plugins for common workflows and roles.</p></div>
    <div data-testid="bundle-card-example"><div class="min-w-0 flex flex-col gap-2"><h3>Bundles</h3><div>Curated sets of plugins for common workflows and roles.</div></div></div>
  </section></div></body>`, { url: 'https://127.0.0.1:42000/', runScripts: 'outside-only' });
  dom.window.eval(script);
  const doc = dom.window.document;
  const description = doc.querySelector('p');
  assert.equal(doc.querySelector('h2').textContent, '插件组合包');
  assert.equal(doc.querySelector('section').getAttribute('aria-label'), '插件组合包');
  assert.equal(description.textContent, '为常见工作流程和角色精选的插件组合。');
  assert.equal(doc.querySelector('h3').textContent, 'Bundles');
  assert.equal(doc.querySelector('[data-testid^="bundle-card-"] div > div').textContent, 'Curated sets of plugins for common workflows and roles.');
  for (const [source, target] of [['1 matching bundle', '找到 1 个匹配的插件组合包'], ['3 matching bundles', '找到 3 个匹配的插件组合包'], ['x matching bundles', 'x matching bundles']]) {
    description.textContent = source;
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    assert.equal(description.textContent, target);
  }
  dom.window.close();
});
