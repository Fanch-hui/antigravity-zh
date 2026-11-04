import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const settle = dom => new Promise(resolve => dom.window.setTimeout(resolve, 0));
function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  dom.window.eval(script);
  return dom;
}

test('settings feedback and project descriptions translate at their actual UI surfaces', () => {
  const dom = mount(`<div data-testid="settings-sidebar"><button data-testid="settings-nav-item-Provide Feedback"><span>Give Feedback</span></button></div>
    <div class="max-w-2xl mx-auto flex flex-col gap-4"><div class="flex flex-col gap-2 w-full mb-2"><div class="flex justify-between items-start gap-4 w-full bg-transparent"><div class="flex-1 flex flex-col gap-1 min-w-0 bg-transparent">
      <h2 class="text-xl m-0 font-medium truncate flex-1 text-foreground">Give Feedback</h2></div></div></div><div><input type="radio" name="feedbackType"></div></div>
    <div class="max-w-2xl mx-auto flex flex-col gap-4"><div class="flex flex-col gap-2 w-full mb-2"><div class="flex justify-between items-start gap-4 w-full bg-transparent"><div class="flex-1 flex flex-col gap-1 min-w-0 bg-transparent">
      <h2 id="project-name" class="text-xl m-0 font-medium truncate flex-1 text-foreground">Give Feedback</h2>
      <div class="text-sm text-muted-foreground bg-transparent">Manage project folders and settings.</div></div></div></div></div>
    <div class="max-w-2xl mx-auto flex flex-col gap-4"><div class="flex flex-col gap-2 w-full mb-2"><div class="flex justify-between items-start gap-4 w-full bg-transparent"><div class="flex-1 flex flex-col gap-1 min-w-0 bg-transparent">
      <div class="text-sm text-muted-foreground bg-transparent">Settings for conversations outside of projects.</div></div></div></div></div>
    <div data-testid="planner-response-text">Manage project folders and settings.</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="settings-nav-item-Provide Feedback"] > span').textContent, '提供反馈');
  assert.equal(doc.querySelector('.max-w-2xl:has(input[name="feedbackType"]) h2').textContent, '提供反馈');
  assert.equal(doc.querySelector('#project-name').textContent, 'Give Feedback');
  const descriptions = doc.querySelectorAll('.max-w-2xl .text-sm.text-muted-foreground.bg-transparent');
  assert.equal(descriptions[0].textContent, '管理项目的文件夹和设置。');
  assert.equal(descriptions[1].textContent, '项目外会话的设置。');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Manage project folders and settings.');
  dom.window.close();
});

test('project and workspace descriptions cover their known fixed variants', () => {
  const variants = [
    ['Manage project resources and settings.', '管理项目的资源和设置。'],
    ['Manage workspace folders and settings.', '管理工作区的文件夹和设置。'],
    ['Manage workspace resources and settings.', '管理工作区的资源和设置。'],
    ['Manage project folders, agent settings, and permissions.', '管理项目的文件夹、智能体设置和权限。'],
    ['Manage workspace resources, agent settings, and permissions.', '管理工作区的资源、智能体设置和权限。'],
    ['Settings for conversations outside of workspaces.', '工作区外会话的设置。'],
    ['Agent settings and permissions for conversations outside of projects.', '项目外会话的智能体设置和权限。'],
    ['Agent settings and permissions for conversations outside of workspaces.', '工作区外会话的智能体设置和权限。'],
  ];
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4"><div class="flex flex-col gap-2 w-full mb-2">${variants.map(([source]) =>
    `<div class="text-sm text-muted-foreground bg-transparent">${source}</div>`).join('')}</div></div>`);
  const texts = [...dom.window.document.querySelectorAll('.text-sm.text-muted-foreground')].map(element => element.textContent);
  assert.deepEqual(texts, variants.map(([, target]) => target));
  dom.window.close();
});

test('home greeting keeps the supplied name while handling a later change and the anonymous form', async () => {
  const dom = mount(`<div data-testid="home-greeting"><style></style><svg></svg><h1 class="text-2xl text-center text-foreground">Hi Ming, what can we get done today?</h1></div>
    <div data-testid="planner-response-text">Hi Ming, what can we get done today?</div>`);
  const heading = dom.window.document.querySelector('[data-testid="home-greeting"] > h1');
  assert.equal(heading.textContent, 'Ming，你好，今天想完成什么？');
  heading.textContent = 'Hi Alex, what can we get done today?';
  await settle(dom);
  assert.equal(heading.textContent, 'Alex，你好，今天想完成什么？');
  heading.textContent = 'What can we get done today?';
  await settle(dom);
  assert.equal(heading.textContent, '今天想完成什么？');
  assert.equal(dom.window.document.querySelector('[data-testid="planner-response-text"]').textContent, 'Hi Ming, what can we get done today?');
  dom.window.close();
});

test('permission trigger follows preset changes and keeps the preset identity and lock reason', async () => {
  const dom = mount(`<button data-testid="permissions-selector-trigger" data-mode="auto" aria-label="Agent permissions preset selector, current: Auto (Preview)"><svg></svg><span class="@max-[400px]/input-footer:hidden">Auto (Preview)</span><svg></svg></button>
    <div data-testid="planner-response-text">Auto (Preview)</div>`);
  const button = dom.window.document.querySelector('button');
  const label = button.querySelector('span');
  assert.equal(label.textContent, '自动（预览）');
  assert.equal(button.getAttribute('aria-label'), '智能体权限预设选择器，当前：自动（预览）');
  button.dataset.mode = 'request_review';
  button.setAttribute('aria-label', 'Agent permissions preset selector, current: Request Review');
  label.textContent = 'Request Review';
  await settle(dom);
  assert.equal(label.textContent, '请求审阅');
  assert.equal(button.dataset.mode, 'request_review');
  assert.equal(button.getAttribute('aria-label'), '智能体权限预设选择器，当前：请求审阅');
  button.setAttribute('aria-label', 'Agent permissions preset: Auto (Preview), Managed by administrator');
  label.textContent = 'Auto (Preview)';
  await settle(dom);
  assert.equal(button.getAttribute('aria-label'), '智能体权限预设：自动（预览），Managed by administrator');
  assert.equal(dom.window.document.querySelector('[data-testid="planner-response-text"]').textContent, 'Auto (Preview)');
  dom.window.close();
});

test('third-party privacy notice translates the complete text while preserving the live link', () => {
  const source = 'Google does not control the availability or functionality of third party developer tools. Your data from third party developer tools connected to your Antigravity instance may be shared with Google. Google will protect any such data in accordance with the Google Privacy Policy, found here:';
  const dom = mount(`<p data-testid="third-party-tools-disclaimer" class="m-0 text-xs text-muted-foreground leading-relaxed">${source} <span><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">https://policies.google.com/privacy</a></span></p>
    <p data-testid="third-party-tools-disclaimer" id="changed">${source} Updated terms.</p><div data-testid="planner-response-text">${source}</div>`);
  const doc = dom.window.document;
  const note = doc.querySelector('p[data-testid="third-party-tools-disclaimer"]');
  assert.equal(note.textContent, 'Google 无法控制第三方开发者工具的可用性或功能。连接到你的 Antigravity 实例的第三方开发者工具产生的数据可能会与 Google 共享。Google 将根据 Google 隐私权政策保护这些数据，详情请参阅： https://policies.google.com/privacy');
  assert.equal(note.querySelector('a').getAttribute('href'), 'https://policies.google.com/privacy');
  assert.equal(note.querySelector('a').getAttribute('target'), '_blank');
  assert.equal(doc.querySelector('#changed').textContent, `${source} Updated terms.`);
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, source);
  dom.window.close();
});
