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

test('debug and remote browser dialogs explain the exact requirements', () => {
  const upload = 'Uploads logs, settings, conversation summaries, and voice call traces to your Drive. Voice call traces are left out when telemetry is off.';
  const problem = 'DevTools port is still closed. Please make sure Chrome is running with remote debugging enabled.';
  const dom = mount(`<div role="dialog"><h2>Remote Debugging Required</h2><p id="debug">${problem}</p></div>
    <div role="dialog"><p id="upload">${upload}</p></div><div data-testid="planner-response-text">${upload}</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h2').textContent, '需要启用远程调试');
  assert.equal(doc.querySelector('#debug').textContent, 'DevTools 端口仍未开放。请确认 Chrome 正在运行且已启用远程调试。');
  assert.equal(doc.querySelector('#upload').textContent, '将日志、设置、会话摘要和语音通话记录上传到你的云端硬盘。关闭遥测后，不会上传语音通话记录。');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, upload);
  dom.window.close();
});

test('credential warning translates its title and bounded durations, keeping automation names', () => {
  const expired = 'Credentials expired. This automation will not run until credentials are refreshed';
  const soon = 'Credentials expiring soon. Refresh credentials to keep this automation running';
  const timed = 'Credentials expire in 2d 3h 4m. Refresh credentials to keep this automation running';
  const unusual = 'Credentials expire in tomorrow. Refresh credentials to keep this automation running';
  const dom = mount(`<div data-testid="cloud-trigger-row"><span id="automation-name">${expired}</span>
    <span data-testid="cloud-trigger-credential-warning" aria-label="${expired}"></span></div>
    <div role="tooltip" id="cloud-trigger-credential-warning-1">${soon}</div>
    <div role="tooltip" id="cloud-trigger-credential-warning-2">${timed}</div>
    <div role="tooltip" id="cloud-trigger-credential-warning-3">${unusual}</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="cloud-trigger-credential-warning"]').getAttribute('aria-label'), '凭据已过期。刷新凭据前，此自动化不会运行。');
  assert.equal(doc.querySelector('#cloud-trigger-credential-warning-1').textContent, '凭据即将过期，请刷新凭据以使此自动化继续运行。');
  assert.equal(doc.querySelector('#cloud-trigger-credential-warning-2').textContent, '凭据将在 2d 3h 4m 后过期，请刷新凭据以使此自动化继续运行。');
  assert.equal(doc.querySelector('#cloud-trigger-credential-warning-3').textContent, unusual);
  assert.equal(doc.querySelector('#automation-name').textContent, expired);
  dom.window.close();
});

test('built-in alerts translate fixed text without changing site values and dynamic errors', () => {
  const problem = 'Failed to create cloud project';
  const site = 'This site can’t be reached';
  const dom = mount(`<div data-testid="toast-notification" data-notification-tag="new-cloud-project-error">
    <div class="text-sm font-medium leading-normal"><span>${problem}</span></div>
    <div class="text-sm text-secondary-foreground"><span>${problem}</span></div></div>
    <div data-testid="browser-error-overlay"><div><h1>${site}</h1><p>${site}</p>
      <button data-testid="browser-error-open-external-button">Open in External Browser</button></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('.font-medium span').textContent, '创建云端项目失败');
  assert.equal(doc.querySelector('.text-secondary-foreground span').textContent, problem);
  assert.equal(doc.querySelector('h1').textContent, '无法访问此网站');
  assert.equal(doc.querySelector('p').textContent, site);
  assert.equal(doc.querySelector('button').textContent, '在外部浏览器中打开');
  dom.window.close();
});

test('telemetry, shortcut and voice hints stay on their fixed components', () => {
  const hint = 'Working with sensitive data? You can now disable telemetry on a per-conversation basis.';
  const shortcut = 'This shortcut is reserved by browser tabs and may not trigger in Web mode. It works in the Desktop Hub or installed PWA.';
  const voice = 'Input device for voice mode.';
  const dom = mount(`<div class="flex flex-col rounded-xl overflow-hidden border"><div class="p-3 flex flex-col gap-1.5">
    <h3 class="text-sm font-semibold">New: Per-Conversation Telemetry</h3><div class="text-sm text-secondary-foreground">${hint}<br><a href="http://go/jetski-conversation-telemetry">Learn more</a></div></div></div>
    <div data-testid="shortcut-row-example"><div role="status"><span>${shortcut}</span></div></div>
    <div class="max-w-2xl mx-auto flex-col gap-4"><div class="flex-1 flex flex-col gap-0.5"><span class="text-xs text-muted-foreground whitespace-pre-wrap">${voice}</span></div><div data-testid="voice-settings-name">${voice}</div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h3').textContent, '新增：按会话设置遥测');
  assert.equal(doc.querySelector('.text-secondary-foreground').textContent, '正在处理敏感数据？现在可以按会话关闭遥测。了解详情');
  assert.equal(doc.querySelector('[role="status"] span').textContent, '此快捷键已被浏览器标签页占用，在网页版中可能无法触发；可在桌面应用或已安装的 PWA 中使用。');
  assert.equal(doc.querySelector('.whitespace-pre-wrap').textContent, '语音模式使用的输入设备。');
  assert.equal(doc.querySelector('[data-testid="voice-settings-name"]').textContent, voice);
  dom.window.close();
});

test('featured disabled and background-command labels leave plugin and task names alone', () => {
  const disabled = 'Disabled. Open Details to finish setup or enable.';
  const dom = mount(`<div data-testid="featured-carousel-actions"><span data-testid="featured-carousel-primary-action"><span title="${disabled}" aria-label="${disabled}">Disabled</span></span></div>
    <div data-testid="running-items-tasks"><div><span class="text-xs opacity-50 font-medium">Background Commands</span></div>
      <div class="flex flex-col gap-px"><div class="text-muted-foreground text-xs px-2">No background commands</div>
        <div data-testid="background-task-row"><span>Background Commands</span></div></div></div>
    <div data-testid="new-tab-group-Background Commands">Background Commands</div>`);
  const doc = dom.window.document;
  const badge = doc.querySelector('[data-testid="featured-carousel-primary-action"] > span');
  assert.equal(badge.textContent, '已禁用');
  assert.equal(badge.title, '已禁用。打开详情以完成设置或启用。');
  assert.equal(badge.getAttribute('aria-label'), '已禁用。打开详情以完成设置或启用。');
  assert.equal(doc.querySelector('.opacity-50').textContent, '后台命令');
  assert.equal(doc.querySelector('.px-2').textContent, '暂无后台命令');
  assert.equal(doc.querySelector('[data-testid="background-task-row"] span').textContent, 'Background Commands');
  assert.equal(doc.querySelector('[data-testid="new-tab-group-Background Commands"]').textContent, '后台命令');
  dom.window.close();
});
