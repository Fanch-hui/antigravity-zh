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

test('2.28 terminal permissions and remote data deletion explain their exact effects', () => {
  const allow = "The agent auto-executes commands matched by an allow list entry. For Unix shells, an allow list entry matches a command if its space-separated tokens form a prefix of the command's tokens. For PowerShell, the entry tokens may match any contiguous subsequence of the command tokens.";
  const deny = 'The agent asks for permission before executing commands matched by a deny list entry. The deny list follows the same matching rules as the allow list and takes precedence over the allow list.';
  const warning = "This permanently deletes all of your Remote Agents conversations, projects, scheduled tasks, connected plugins and settings, and stops any running remote agents. It can't be undone. Data in the desktop app and your Google account are not affected, and you can keep using Remote Agents afterwards.";
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4">
    <span id="allow">${allow}</span><span id="deny">${deny}</span>
    <h3>Remote Agents Data</h3><button data-testid="delete-all-user-data-button">Delete All Data</button></div>
    <div role="dialog"><h2>Delete All Remote Agents Data?</h2><p>${warning}</p><button data-testid="confirm-delete-all-user-data">Delete All Data</button></div>
    <div data-testid="planner-response-text">${allow}</div>`);
  const doc = dom.window.document;
  assert.match(doc.querySelector('#allow').textContent, /Unix shell.*前缀.*PowerShell.*连续子序列/);
  assert.match(doc.querySelector('#deny').textContent, /请求授权.*优先于允许列表/);
  assert.equal(doc.querySelector('h3').textContent, '远程智能体数据');
  assert.equal(doc.querySelector('h2').textContent, '删除所有远程智能体数据？');
  assert.match(doc.querySelector('[role="dialog"] p').textContent, /停止正在运行的远程智能体。此操作无法撤销。桌面应用及 Google 账号中的数据不受影响/);
  assert.deepEqual([...doc.querySelectorAll('button')].map(button => button.textContent), ['删除所有数据', '删除所有数据']);
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, allow);
  dom.window.close();
});

test('2.28 browser security labels and fixed warnings leave certificate and site values intact', () => {
  const warning = 'You should not enter any sensitive information on this site (for example, passwords or credit cards), because it could be stolen by attackers.';
  const dom = mount(`<button data-testid="url-security-indicator" title="View site information" aria-label="Not secure. View site information"><span>Not secure</span></button>
    <div data-testid="url-security-popover">
      <div class="flex items-center gap-2 px-1 pt-2 pb-2 border-b border-border"><div class="flex flex-col min-w-0"><span class="text-sm font-medium text-foreground">Security</span><span data-testid="url-security-origin">Security</span></div></div>
      <div><span data-testid="url-security-summary">Your connection to this site is not secure</span><span>${warning}</span></div>
      <div class="flex flex-col gap-1 min-w-0"><span class="text-foreground">Certificate details</span><span class="text-error">The certificate has expired or is not yet valid.</span>
        <dl data-testid="url-security-certificate"><dt>Issued to</dt><dd>Certificate details</dd><dt>Issued by</dt><dd>Protocol</dd><dt>Valid until</dt><dd>2026-12-01</dd><dt>Protocol</dt><dd>TLS 1.3</dd></dl></div>
      <span data-testid="url-security-host">Certificate details</span></div>
    <div data-testid="planner-response-text">${warning}</div>`);
  const doc = dom.window.document;
  const indicator = doc.querySelector('[data-testid="url-security-indicator"]');
  assert.equal(indicator.title, '查看网站信息');
  assert.equal(indicator.getAttribute('aria-label'), '不安全。查看网站信息');
  assert.equal(indicator.textContent, '不安全');
  assert.equal(doc.querySelector('[data-testid="url-security-summary"]').textContent, '你与此网站的连接不安全');
  assert.equal(doc.querySelector('[data-testid="url-security-summary"] + span').textContent, '请勿在此网站输入任何敏感信息（例如密码或信用卡信息），否则可能被攻击者窃取。');
  assert.equal(doc.querySelector('.text-error').textContent, '证书已过期或尚未生效。');
  assert.deepEqual([...doc.querySelectorAll('dt')].map(element => element.textContent), ['颁发给', '颁发者', '有效期至', '协议']);
  assert.deepEqual([...doc.querySelectorAll('dd')].map(element => element.textContent), ['Certificate details', 'Protocol', '2026-12-01', 'TLS 1.3']);
  assert.equal(doc.querySelector('[data-testid="url-security-origin"]').textContent, 'Security');
  assert.equal(doc.querySelector('[data-testid="url-security-host"]').textContent, 'Certificate details');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, warning);
  dom.window.close();
});

test('2.28 permission grants translate fixed categories and counts while preserving values', () => {
  const dom = mount(`<div data-testid="access-grant-group" data-grant-action="unsandboxed">
    <button data-testid="access-grant-group-toggle" aria-label="Unsandboxed commands, 2 grants"><span class="font-medium">Unsandboxed commands</span><span>(2)</span></button>
    <div><span class="font-mono">Unsandboxed commands</span><span class="font-mono">Read files</span></div></div>
    <div data-testid="access-grant-group" data-grant-action="read_file">
      <button data-testid="access-grant-group-toggle" aria-label="Read files, 1 grant"><span class="font-medium">Read files</span></button></div>
    <div data-testid="access-grant-group"><button data-testid="access-grant-group-toggle" aria-label="Workspace, 3 grants"><span class="font-medium">Workspace</span></button></div>`);
  const doc = dom.window.document;
  const buttons = [...doc.querySelectorAll('[data-testid="access-grant-group-toggle"]')];
  assert.equal(buttons[0].getAttribute('aria-label'), '沙盒外命令，2 项授权');
  assert.equal(buttons[0].querySelector('.font-medium').textContent, '沙盒外命令');
  assert.equal(buttons[1].getAttribute('aria-label'), '读取文件，1 项授权');
  assert.equal(buttons[1].textContent, '读取文件');
  assert.equal(buttons[2].getAttribute('aria-label'), 'Workspace, 3 grants');
  assert.deepEqual([...doc.querySelectorAll('.font-mono')].map(element => element.textContent), ['Unsandboxed commands', 'Read files']);
  dom.window.close();
});

test('2.28 voice and paused environment controls preserve file names and message content', () => {
  const dom = mount(`<div data-testid="vm-paused-notice"><h3>This chat's environment is paused</h3><p>Resume it to load this file.</p><button data-testid="vm-paused-resume">Resume environment</button></div>
    <div role="region" data-testid="voice-dock" aria-label="Live chat in progress"><div role="status">Drag to move</div>
      <div data-testid="voice-dock-composer"><span id="file">Send</span><button data-tooltip-id="voice-dock-add-tooltip" aria-label="Add files"></button>
        <textarea data-testid="voice-dock-input" placeholder="Message this chat" aria-label="Message this chat">Send</textarea><button data-testid="voice-dock-send" aria-label="Send"></button></div>
      <button data-testid="voice-dock-end" aria-label="End Live chat"></button></div>
    <div data-testid="voice-link-status">Still connecting…</div><div data-testid="user-input-step">Resume environment</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="vm-paused-notice"] h3').textContent, '此会话的环境已暂停');
  assert.equal(doc.querySelector('[data-testid="vm-paused-notice"] p').textContent, '恢复环境以加载此文件。');
  assert.equal(doc.querySelector('[data-testid="vm-paused-resume"]').textContent, '恢复环境');
  assert.equal(doc.querySelector('[data-testid="voice-dock"]').getAttribute('aria-label'), '正在进行实时聊天');
  assert.equal(doc.querySelector('[data-testid="voice-dock"] [role="status"]').textContent, '拖动以移动');
  assert.equal(doc.querySelector('[data-tooltip-id="voice-dock-add-tooltip"]').getAttribute('aria-label'), '添加文件');
  assert.equal(doc.querySelector('textarea').getAttribute('placeholder'), '向此会话发送消息');
  assert.equal(doc.querySelector('textarea').value, 'Send');
  assert.equal(doc.querySelector('[data-testid="voice-dock-send"]').getAttribute('aria-label'), '发送');
  assert.equal(doc.querySelector('[data-testid="voice-dock-end"]').getAttribute('aria-label'), '结束实时聊天');
  assert.equal(doc.querySelector('#file').textContent, 'Send');
  assert.equal(doc.querySelector('[data-testid="voice-link-status"]').textContent, '仍在连接…');
  assert.equal(doc.querySelector('[data-testid="user-input-step"]').textContent, 'Resume environment');
  dom.window.close();
});

test('2.28 shortcut, extension and plugin link labels stay on their own controls', () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4"><div data-testid="shortcut-row-reopenClosedAuxTab"><span>Reopen Closed Tab</span></div>
    <input placeholder="Search shortcuts..." aria-label="Search shortcuts"></div>
    <div data-testid="plugins-submenu-empty">No extensions available</div>
    <button data-testid="plugins-visibility-trigger" aria-label="Show or Hide Extensions"></button>
    <div data-testid="plugin-detail-footer"><a data-testid="plugin-detail-footer-homepage" href="https://example.com"><span>Website</span></a><a data-testid="plugin-detail-footer-repository" href="https://example.com/repo"><span>Repository</span></a></div>
    <div data-testid="planner-response-text">Reopen Closed Tab</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid^="shortcut-row-"]').textContent, '重新打开已关闭的标签页');
  assert.equal(doc.querySelector('input').placeholder, '搜索快捷键…');
  assert.equal(doc.querySelector('input').getAttribute('aria-label'), '搜索快捷键');
  assert.equal(doc.querySelector('[data-testid="plugins-submenu-empty"]').textContent, '暂无可用扩展');
  assert.equal(doc.querySelector('[data-testid="plugins-visibility-trigger"]').getAttribute('aria-label'), '显示或隐藏扩展');
  assert.equal(doc.querySelector('[data-testid="plugin-detail-footer-homepage"]').textContent, '网站');
  assert.equal(doc.querySelector('[data-testid="plugin-detail-footer-repository"]').getAttribute('href'), 'https://example.com/repo');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Reopen Closed Tab');
  dom.window.close();
});
