import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const header = content => `<div class="group flex w-full min-w-0 items-center min-h-8 py-1 px-2 select-none">
  <div class="flex min-w-0 items-center gap-x-1 text-sm"><span class="truncate">${content}</span></div></div>`;
const title = (id, text) => header(`<div class="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground">
  <span class="text-muted-foreground">Error</span><span class="truncate text-muted-foreground" id="${id}">${text}</span></div>`);
const agentReference = name => `<div role="button" aria-label="Open Subagent: ${name}" data-tooltip-id="agent-reference" class="inline-flex items-center gap-1 max-w-full overflow-hidden rounded-sm group/agent-ref">
  <svg></svg><span class="truncate min-w-0 text-muted-foreground group-hover/agent-ref:text-foreground transition-colors">${name}</span></div>`;
const eventTitle = (id, text, { structured = false, generic = false, transitions = false, custom = false } = {}) => {
  const content = structured
    ? `<span class="inline-flex text-muted-foreground"><span class="inline-flex items-center gap-1 overflow-hidden text-muted-foreground">
      <span id="${id}" class="truncate min-w-0 text-muted-foreground">${text}</span>${agentReference('Settings (research)')}</span></span>`
    : custom ? `<span class="truncate" id="${id}">${text}</span>`
      : `<span class="truncate text-muted-foreground"${transitions ? '' : ` id="${id}"`}>${transitions ? `<span id="${id}">${text}</span>` : text}</span>`;
  const view = `<div class="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground">${content}</div>`;
  return header(generic ? `<span>${view}</span>` : view);
};
const systemMessage = (text, { expanded = false, plain = false, structured = false, prefixed = false } = {}) => {
  let content = `<span>${text}</span>`;
  if (structured) {
    const prefix = prefixed ? '' : `<span class="truncate min-w-0 text-muted-foreground">${text}</span>`;
    content = `<span class="inline-flex items-center gap-1 overflow-hidden text-muted-foreground">${prefix}${agentReference('Storage and performance reviewer (research)')}</span>`;
  }
  if (prefixed) content = `<span class="inline-flex items-center gap-1">${text}${content}</span>`;
  const view = `<div class="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground">
    <span class="${structured ? 'inline-flex' : 'truncate'} text-muted-foreground [&_.text-foreground]:text-muted-foreground">${content}</span></div>`;
  if (plain) return `<div class="w-full my-0.5 px-2 min-h-8 py-1 flex items-center select-none text-sm">${view}</div>`;
  return `<div class="w-full my-0.5"><div class="relative">
    <button type="button" aria-expanded="${expanded}" class="group flex items-center gap-1 w-full text-left text-sm px-2 min-h-8 py-1 rounded-lg tabular-nums select-none cursor-pointer text-foreground hover:bg-muted transition-[opacity,background-color]">${view}<svg></svg></button>
    ${expanded ? '<div class="overflow-y-auto outline-none focus-visible:ring-1 focus-visible:ring-ring rounded bleed-contain pl-3 pt-0.5"><div><div class="text-secondary-foreground pl-2"><div class="markdown">Diagnostic output</div></div></div></div>' : ''}</div></div>`;
};
const launched = (id, status, count) => header(`<div class="flex items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground" id="${id}">
  <span>${status}</span><span>${count} subagents</span></div>`);
const banner = content => `<div class="flex flex-col p-2.5 pl-3 rounded-2xl border bg-card max-h-[300px] overflow-y-auto shadow-md">${content}</div>`;
function mount(html, prepare = () => {}) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only'
  });
  prepare(dom.window.document);
  dom.window.eval(script);
  return dom;
}

test('work duration translates its fixed prefix and preserves original units', async () => {
  const dom = mount(`<button data-testid="worked-for-collapsible"><span class="text-muted-foreground" id="worked">Worked for 3m</span><svg></svg></button>
    <div data-testid="planner-response-text">Worked for 3m</div><div data-testid="user-input-step">Worked for 3m</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#worked').textContent, '耗时 3m');
  doc.querySelector('#worked').textContent = 'Worked for 1d 2h 5m';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(doc.querySelector('#worked').textContent, '耗时 1d 2h 5m');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Worked for 3m');
  assert.equal(doc.querySelector('[data-testid="user-input-step"]').textContent, 'Worked for 3m');
  doc.querySelector('#worked').textContent = 'Worked for an unknown duration';
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.equal(doc.querySelector('#worked').textContent, 'Worked for an unknown duration');
  dom.window.close();
});

test('subagent startup preserves separate status and count nodes', () => {
  const dom = mount(launched('started', 'Started', 5) + launched('starting', 'Starting', 2) + header(
    '<div class="flex items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground"><span>Started</span>' +
    '<div role="button" class="inline-flex items-center gap-1 max-w-full overflow-hidden rounded-sm"><svg></svg>' +
    '<span id="single-agent" class="truncate min-w-0 text-muted-foreground">Settings</span></div></div>'));
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('#started > span')].map(node => node.textContent), ['已启动', '5 个子智能体']);
  assert.deepEqual([...doc.querySelectorAll('#starting > span')].map(node => node.textContent), ['正在启动', '2 个子智能体']);
  assert.equal(doc.querySelector('#single-agent').textContent, 'Settings');
  dom.window.close();
});

test('event headers cover plain, transitioning, generic and structured official title renderers', () => {
  const dom = mount(eventTitle('message', 'Message from Example Reviewer (self)') +
    eventTitle('transition', 'Error from Example Analyst (research)', { generic: true, transitions: true }) +
    eventTitle('custom', 'Message from Example Reviewer (self)', { custom: true }) +
    eventTitle('structured-message', 'Message from', { structured: true, generic: true }) +
    eventTitle('structured-error', 'Error from', { structured: true }) +
    '<div data-testid="subagent-tab-header-title">research</div><div data-testid="planner-response-text">Message from Example Reviewer (self)</div>');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#message').textContent, '消息来自 Example Reviewer (self)');
  assert.equal(doc.querySelector('#transition').textContent, '错误来自 Example Analyst (research)');
  assert.equal(doc.querySelector('#custom').textContent, '消息来自 Example Reviewer (self)');
  assert.equal(doc.querySelector('#structured-message').textContent, '消息来自');
  assert.equal(doc.querySelector('#structured-error').textContent, '错误来自');
  for (const name of doc.querySelectorAll('.group\\/agent-ref > span')) assert.equal(name.textContent, 'Settings (research)');
  assert.equal(doc.querySelector('[data-testid="subagent-tab-header-title"]').textContent, 'research');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Message from Example Reviewer (self)');
  dom.window.close();
});

test('event headers translate after official text transitions settle and preserve reference nodes', async () => {
  const dom = mount(eventTitle('transition-text', '', { transitions: true, generic: true }) +
    eventTitle('event-prefix', 'Message from', { structured: true }));
  const doc = dom.window.document;
  const reference = doc.querySelector('.group\\/agent-ref');
  const label = reference.lastElementChild;
  const transition = doc.querySelector('#transition-text');
  transition.innerHTML = '<span data-slot><span data-slot-in>Error from Example Analyst (research)</span><span data-slot-out="Message from Example Analyst (research)" aria-hidden="true"></span></span>';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(transition.textContent, 'Error from Example Analyst (research)');
  transition.textContent = 'Error from Example Analyst (research)';
  doc.querySelector('#event-prefix').textContent = 'Error from';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(transition.textContent, '错误来自 Example Analyst (research)');
  assert.equal(doc.querySelector('#event-prefix').textContent, '错误来自');
  assert.equal(doc.querySelector('.group\\/agent-ref'), reference);
  assert.equal(reference.lastElementChild, label);
  assert.equal(label.textContent, 'Settings (research)');
  assert.equal(reference.getAttribute('aria-label'), '打开子智能体：Settings (research)');
  dom.window.close();
});

test('system-message titles use the official collapsible and plain frames outside tool-step headers', () => {
  const cases = [
    ['Message from Parent Agent', {}, '消息来自 Parent Agent'],
    ['Error from Storage and performance reviewer (research)', { expanded: true }, '错误来自 Storage and performance reviewer (research)'],
    ['Message from Parent Agent', { plain: true }, '消息来自 Parent Agent'],
    ['Message from', { structured: true }, '消息来自'],
    ['Error from', { structured: true, prefixed: true }, '错误来自']
  ];
  for (const [source, options, expected] of cases) {
    const dom = mount(systemMessage(source, options));
    const doc = dom.window.document;
    const title = doc.querySelector('.flex.flex-row.items-center.gap-1.overflow-hidden.whitespace-nowrap.text-muted-foreground');
    assert.ok(title.textContent.trim().startsWith(expected), title.textContent);
    const name = doc.querySelector('.group\\/agent-ref > span');
    if (name) assert.equal(name.textContent, 'Storage and performance reviewer (research)');
    const diagnostic = doc.querySelector('.markdown');
    if (diagnostic) assert.equal(diagnostic.textContent, 'Diagnostic output');
    dom.window.close();
  }
});

test('system-message title rules preserve matching user content and unrelated controls', () => {
  const source = 'Message from Example Reviewer (research)';
  const dom = mount(['planner-response-text', 'user-input-step'].map(id =>
    `<div data-testid="${id}">${systemMessage(source)}</div>`).join('') +
    '<button><div class="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground"><span class="truncate text-muted-foreground"><span>Message from Example Reviewer (research)</span></span></div></button>');
  const doc = dom.window.document;
  for (const title of doc.querySelectorAll('.flex.flex-row.items-center.gap-1.overflow-hidden.whitespace-nowrap.text-muted-foreground')) {
    assert.equal(title.textContent.trim(), source);
  }
  dom.window.close();
});

test('subagent reference tooltips keep complete names and type identifiers', () => {
  const dom = mount(eventTitle('prefix', 'Message from', { structured: true }) +
    '<div role="tooltip" id="reference-tooltip">Open Subagent: Settings (research)</div>' +
    '<div data-testid="planner-response-text"><div role="tooltip" id="body-tooltip">Open Subagent: Settings (research)</div></div>');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#reference-tooltip').textContent, '打开子智能体：Settings (research)');
  assert.equal(doc.querySelector('#body-tooltip').textContent, 'Open Subagent: Settings (research)');
  dom.window.close();
});

test('fixed quota errors preserve reset duration and split error identifiers', () => {
  const text = 'Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 149h29m49s.';
  const dom = mount(title('quota', text) + title('quota-transition', `<span>${text}</span>`) +
    header(`<div class="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground">
      <span class="text-muted-foreground">Error</span><span class="inline-flex text-muted-foreground">
      <span class="flex-row flex-wrap items-center gap-1" id="quota-parts"></span></span></div>`) +
    `<div class="text-xs text-muted-foreground select-none pb-1 flex flex-col gap-y-0.5"><div id="error-id"></div></div>
    <div data-testid="terminal-tab-surface">${text}</div><pre>${text}</pre>`, doc => {
    doc.querySelector('#error-id').append('Error ID: ', 'example-error-42');
    doc.querySelector('#quota-parts').append('Error ', text);
  });
  const doc = dom.window.document;
  const translated = '个人额度已用尽。请升级订阅以提高额度。将在 149h29m49s 后重置。';
  assert.equal(doc.querySelector('#quota').textContent, translated);
  assert.equal(doc.querySelector('#quota-transition').textContent, translated);
  assert.ok(doc.querySelector('#quota-parts').textContent.endsWith(translated));
  assert.equal(doc.querySelector('#error-id').textContent, '错误 ID：example-error-42');
  assert.equal(doc.querySelector('[data-testid="terminal-tab-surface"]').textContent, text);
  assert.equal(doc.querySelector('pre').textContent, text);
  dom.window.close();
});

test('baseline quota notification preserves locale date strings and clarifies credit overages', () => {
  const dom = mount(banner(`<div class="flex items-center justify-between gap-2"><div class="flex items-center gap-1.5 select-none overflow-hidden text-ellipsis whitespace-nowrap text-xs text-secondary-foreground font-medium min-w-0">
    <div class="flex items-center gap-1.5 min-w-0"><svg></svg><span class="truncate" id="quota-title">Baseline model quota reached</span></div></div></div>
    <div class="text-sm text-foreground"><div class="flex flex-col gap-2 pt-1.5 pb-0.5" id="refresh"></div></div>`), doc => {
    doc.querySelector('#refresh').append(" Your plan's baseline quota will refresh on 2026/10/23 09:05:48.",
      ' To continue using this model now, enable AI Credit overages.');
  });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#quota-title').textContent, '模型基础额度已用尽');
  assert.equal(doc.querySelector('#refresh').textContent, ' 您的订阅方案基础额度将于 2026/10/23 09:05:48 重置。如需立即继续使用此模型，请启用超额用量（使用 AI 点数）。');
  doc.querySelector('#refresh').textContent = "Your plan's baseline quota will refresh on 10/23/2026, 9:05:48 AM. To continue using this model now, enable AI Credit overages.";
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.match(doc.querySelector('#refresh').textContent, /将于 10\/23\/2026, 9:05:48 AM 重置/);
  for (const [source, target] of [
    ["Your plan's baseline quota will refresh on 2026/10/23 09:05:48.", '您的订阅方案基础额度将于 2026/10/23 09:05:48 重置。'],
    ['To continue using this model now, enable AI Credit overages.', '如需立即继续使用此模型，请启用超额用量（使用 AI 点数）。'],
    ['You need at least 15 AI Credits to send messages. To continue using Gemini 4 Argon now, purchase more AI Credits.', '发送消息至少需要 15 AI 点数。如需立即继续使用 Gemini 4 Argon，请购买更多 AI 点数。'],
    ["You need more AI Credits to send messages. To continue using this model now, purchase more AI Credits. Your plan's baseline quota will refresh on 2026/10/23 09:05:48.", '发送消息需要更多 AI 点数。如需立即继续使用 此模型，请购买更多 AI 点数。 您的订阅方案基础额度将于 2026/10/23 09:05:48 重置。']
  ]) {
    doc.querySelector('#refresh').textContent = source;
    dom.window.__AGY_ZH_RUNTIME__.translate();
    assert.equal(doc.querySelector('#refresh').textContent, target);
  }
  dom.window.close();
});

test('feedback-like text in ordinary content and tool output stays unchanged', () => {
  const phrases = ['Worked for 3m', 'Started 5 subagents', 'Message from Example Reviewer (self)',
    'Error from Example Analyst (research)', 'Error ID: example-error-42'];
  const dom = mount(phrases.map((text, index) => `<p id="plain-${index}">${text}</p>
    <div data-testid="user-input-step">${title(`user-${index}`, text)}</div>
    <div data-testid="planner-response-text">${title(`answer-${index}`, text)}</div>
    <div data-testid="terminal-tab-surface">${title(`terminal-${index}`, text)}</div>`).join(''));
  const doc = dom.window.document;
  for (const [index, text] of phrases.entries()) {
    for (const prefix of ['plain', 'user', 'answer', 'terminal']) assert.equal(doc.querySelector(`#${prefix}-${index}`).textContent, text);
  }
  dom.window.close();
});

test('message footer relative time keeps its units and protects matching body text', () => {
  const dom = mount(`<div data-testid="cascade-system-message-toolbar"><div class="flex min-w-0 flex-wrap-reverse items-center justify-end">
    <span data-screenshot-volatile="true" data-tooltip-id="example-created-at" class="text-xs text-muted-foreground select-none px-1 whitespace-nowrap" id="relative-time">2d ago</span>
    <button aria-label="Copy"></button><button aria-label="Good response"></button></div></div>
    <div data-testid="planner-response-text">2d ago</div><p id="ordinary-time">2d ago</p>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#relative-time').textContent, '2d 前');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, '2d ago');
  assert.equal(doc.querySelector('#ordinary-time').textContent, '2d ago');
  doc.querySelector('#relative-time').textContent = '2mo ago';
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.equal(doc.querySelector('#relative-time').textContent, '2mo 前');
  dom.window.close();
});
