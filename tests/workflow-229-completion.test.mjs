import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  dom.window.eval(script);
  return dom;
}

test('sidebar and project menu translate fixed empty states without changing dynamic names', () => {
  const dom = mount(`<div data-sidebar-section-drop-id="workspace"><div data-testid="section-header"><div><h2><button><span class="truncate">Current Workspace</span></button></h2></div></div></div>
    <div data-sidebar-section-drop-id="convgroup:custom"><div data-testid="section-header"><div><h2><button><span class="truncate">Current Workspace</span></button></h2></div></div></div>
    <div data-sidebar-section-drop-id="pinned"><span class="pr-2.5 select-none text-sm opacity-30 h-8 flex items-center justify-start truncate whitespace-nowrap">No pinned conversations</span></div>
    <div role="menu"><div data-testid="project-selector-list"><div class="text-xs px-2 pb-1 text-muted-foreground font-medium select-none">Recent</div>
    <div class="text-xs px-2 py-2 text-muted-foreground" id="project-empty">No matching projects</div><button data-testid="project-selector-item">Recent</button></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-sidebar-section-drop-id="workspace"] span').textContent, '当前工作区');
  assert.equal(doc.querySelector('[data-sidebar-section-drop-id="convgroup:custom"] span').textContent, 'Current Workspace');
  assert.equal(doc.querySelector('[data-sidebar-section-drop-id="pinned"] span').textContent, '暂无已固定的会话');
  assert.equal(doc.querySelector('[data-testid="project-selector-list"] div').textContent, '最近使用');
  assert.equal(doc.querySelector('#project-empty').textContent, '没有匹配的项目');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"]').textContent, 'Recent');
  dom.window.close();
});

test('protected message content stays untouched while fixed side-question and revert labels translate', async () => {
  const dom = mount(`<div data-testid="user-input-step"><p>Undo to this point</p>
      <button data-testid="revert-button" aria-label="Undo to this point" title="Undo to this point"></button></div>
    <button data-testid="revert-button" aria-label="Undo to this point"></button>
    <div data-testid="side-question-question"><span class="shrink-0">Side Question:</span><span class="truncate">Side Question</span></div>
    <div data-testid="side-question-answer">Side Question:</div>
    <div data-testid="planner-response-text"><div data-testid="side-question-question"><span class="shrink-0">Side Question:</span></div></div>`);
  const doc = dom.window.document;
  const button = doc.querySelector('[data-testid="user-input-step"] button');
  assert.equal(button.getAttribute('aria-label'), '撤销到此处');
  assert.equal(button.title, 'Undo to this point');
  assert.equal(doc.querySelector('[data-testid="user-input-step"] p').textContent, 'Undo to this point');
  assert.equal(doc.querySelector('body > [data-testid="revert-button"]').getAttribute('aria-label'), 'Undo to this point');
  assert.equal(doc.querySelector('body > [data-testid="side-question-question"] .shrink-0').textContent, '附加问题：');
  assert.equal(doc.querySelector('body > [data-testid="side-question-question"] .truncate').textContent, 'Side Question');
  assert.equal(doc.querySelector('[data-testid="side-question-answer"]').textContent, 'Side Question:');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"] .shrink-0').textContent, 'Side Question:');
  button.setAttribute('aria-label', 'Cannot revert a message sent while the agent was running');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(button.getAttribute('aria-label'), '无法撤销到智能体运行期间发送的消息');
  dom.window.close();
});

test('automation summary translates fixed direct text and preserves project, model and schedule nodes', async () => {
  const dom = mount(`<div data-testid="sidecar-detail"><div data-testid="automation-settings">
    <p class="m-0 text-[15px] leading-7 text-secondary-foreground" id="summary">Runs <button data-testid="automation-schedule-value">daily at 9:00 AM</button> in <button data-testid="sidecar-project-link">Runs</button> with <button data-testid="automation-model-value"><span class="text-sm leading-5 text-foreground">with</span></button> on this computer.</p></div>
    <p class="m-0 text-[15px] leading-7 text-secondary-foreground" id="description">Runs</p></div>
    <p data-testid="automation-instructions-reads" class="m-0 text-[13px] text-muted-foreground"></p>`);
  const doc = dom.window.document;
  const summary = doc.querySelector('#summary');
  assert.equal(summary.textContent, '执行计划： 每天 9:00 AM 项目： Runs 模型： with 在此电脑上。');
  assert.equal(doc.querySelector('[data-testid="sidecar-project-link"]').textContent, 'Runs');
  assert.equal(doc.querySelector('[data-testid="automation-model-value"] span').textContent, 'with');
  assert.equal(doc.querySelector('#description').textContent, 'Runs');
  const reads = doc.querySelector('[data-testid="automation-instructions-reads"]');
  reads.append('Reads ', 'Calendar and Drive', ', read-only');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(reads.textContent, '读取：Calendar and Drive（只读）');
  dom.window.close();
});

test('location status, error text and automation controls retain variable values', () => {
  const dom = mount(`<div data-testid="location-cloud" role="menuitem"><span class="flex min-w-0 flex-col"><span class="truncate">Online</span>
      <span class="truncate text-xs text-muted-foreground"><span class="flex items-center gap-1.5"><span>Online</span><span aria-hidden="true">·</span><span class="inline-block"></span><span>Online</span></span></span></span></div>
    <div data-testid="mcp-app-pane-error">Could not load <span class="font-mono">Settings</span>: provider unavailable</div>
    <div data-testid="mcp-app-view-error"></div><button data-testid="subagent-node-children-toggle">Show 2 more subagents</button>
    <div data-testid="new-sidecar-oauth-consent-prompt"><div><span>Connect an account so the agent can run automations.</span></div></div>`);
  const doc = dom.window.document;
  const status = doc.querySelector('[data-testid="location-cloud"] span.flex.items-center > span:last-child');
  assert.equal(status.textContent, '在线');
  assert.equal(doc.querySelector('[data-testid="location-cloud"] > span > span.truncate').textContent, 'Online');
  assert.equal(doc.querySelector('[data-testid="location-cloud"] span.flex.items-center > span:first-child').textContent, 'Online');
  assert.equal(doc.querySelector('[data-testid="mcp-app-pane-error"] .font-mono').textContent, 'Settings');
  assert.equal(doc.querySelector('[data-testid="subagent-node-children-toggle"]').textContent, '再显示 2 个子智能体');
  assert.equal(doc.querySelector('[data-testid="new-sidecar-oauth-consent-prompt"] span').textContent, '连接账号后，智能体即可运行自动化。');
  const pane = doc.querySelector('[data-testid="mcp-app-pane-error"]');
  pane.replaceChildren('Could not load ', 'Calendar', ': ', 'Service: unavailable');
  dom.window.__AGY_ZH_RUNTIME__.translate(pane);
  assert.equal(pane.textContent, '无法加载 Calendar: Service: unavailable');
  pane.replaceChildren('Could not load ', 'Calendar: Tools', ': ', 'Service unavailable');
  dom.window.__AGY_ZH_RUNTIME__.translate(pane);
  assert.equal(pane.textContent, '无法加载 Calendar: Tools: Service unavailable');
  const error = doc.querySelector('[data-testid="mcp-app-view-error"]');
  error.append('Could not load the app view: ', 'provider unavailable');
  dom.window.__AGY_ZH_RUNTIME__.translate(error);
  assert.equal(error.textContent, '无法加载应用视图：provider unavailable');
  dom.window.close();
});
