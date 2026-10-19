import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
// tZ wraps xZ in the shimmer span; file pills and command strings remain separate children.
const step = content => `<div class="flex flex-col"><div class="group flex w-full min-w-0 items-center min-h-8 py-1 px-2 select-none transition-[background-color]">
  <div class="flex min-w-0 items-center gap-x-1 text-sm"><span class="truncate">${content}</span></div>
  <div class="flex items-center shrink-0"><svg></svg></div></div></div>`;
const title = content => `<div class="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-muted-foreground">${content}</div>`;
const file = '<span class="inline-flex text-muted-foreground [&_.text-foreground]:text-muted-foreground"><button><span class="font-mono">Settings</span></button></span>';
const prefix = text => step(title(`<span class="text-muted-foreground" id="status">${text}</span>${file}`));
const content = text => step(title(`<span class="truncate text-muted-foreground [&_.text-foreground]:text-muted-foreground" id="content">${text}</span>`));
function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only'
  });
  dom.window.eval(script);
  return dom;
}

test('file action lifecycle localizes its prefix and preserves the file pill', () => {
  const dom = mount(prefix('Editing'));
  const doc = dom.window.document;
  for (const [source, expected] of [['Editing', '正在编辑'], ['Edited', '已编辑'],
    ['Canceled edit to', '已取消编辑'], ['Creating', '正在创建'], ['Created', '已创建'],
    ['Canceled creation of', '已取消创建'], ['Deleting', '正在删除'], ['Deleted', '已删除'],
    ['Canceled deletion of', '已取消删除'], ['Bookmarking', '正在添加书签'],
    ['Canceled bookmark of', '已取消添加书签'], ['Bookmarked', '已添加书签'],
    ['Removing bookmark', '正在移除书签'], ['Canceled removal of bookmark', '已取消移除书签'],
    ['Removed bookmark', '已移除书签'], ['Rejected', '已拒绝'], ['Canceled', '已取消'], ['Errored', '执行出错']]) {
    doc.querySelector('#status').textContent = source;
    dom.window.__AGY_ZH_RUNTIME__.translate();
    assert.equal(doc.querySelector('#status').textContent, expected);
    assert.equal(doc.querySelector('.font-mono').textContent, 'Settings');
  }
  doc.querySelector('#status').textContent = 'Running custom analysis';
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.equal(doc.querySelector('#status').textContent, 'Running custom analysis');
  dom.window.close();
});

test('fixed error branches translate both fallback text and the label beside a file pill', () => {
  const dom = mount(prefix('Error during tool execution') + step(title(`<span class="text-muted-foreground"><span class="flex flex-row items-center gap-1" id="file-error">Error while viewing${file}</span></span><span class="truncate text-muted-foreground" id="raw">Arbitrary service error</span>`)));
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#status').textContent, '执行工具时出错');
  assert.equal(doc.querySelector('#file-error').firstChild.nodeValue, '查看时出错');
  assert.equal(doc.querySelector('#file-error .font-mono').textContent, 'Settings');
  assert.equal(doc.querySelector('#raw').textContent, 'Arbitrary service error');
  for (const [source, expected] of [['Invalid tool call', '工具调用无效'], ['Error editing file', '编辑文件时出错'],
    ['Error while semantic searching', '语义搜索时出错'], ['Error while running MCP tool', '运行 MCP 工具时出错']]) {
    doc.querySelector('#status').textContent = source;
    dom.window.__AGY_ZH_RUNTIME__.translate();
    assert.equal(doc.querySelector('#status').textContent, expected);
  }
  dom.window.close();
});

test('text-transition wrappers and the generic-tool outer span retain complete fixed labels', () => {
  for (const outer of [false, true]) {
    let node = title(`<span class="text-muted-foreground"><span id="status">Canceled</span></span>${file}`);
    if (outer) node = `<span class="text-muted-foreground">${node}</span>`;
    const dom = mount(step(node));
    const doc = dom.window.document;
    assert.equal(doc.querySelector('#status').textContent, '已取消');
    assert.equal(doc.querySelector('.font-mono').textContent, 'Settings');
    const label = doc.querySelector('#status');
    label.innerHTML = '<span data-slot="0"><span data-out="0">Read</span><span data-in="0">Reading</span></span>';
    dom.window.__AGY_ZH_RUNTIME__.translate();
    assert.equal(label.textContent, 'ReadReading');
    label.textContent = 'Reading';
    dom.window.__AGY_ZH_RUNTIME__.translate();
    assert.equal(label.textContent, '正在读取');
    dom.window.close();
  }
  const dom = mount(content('<span id="wrapped-content">Retrieved Browser Pages</span>'));
  assert.equal(dom.window.document.querySelector('#wrapped-content').textContent, '已获取浏览器页面');
  dom.window.close();
});

test('browser and command-input status branches keep descriptions and dynamic tool content intact', () => {
  const dom = mount(content('Retrieving Browser Pages'));
  const node = dom.window.document.querySelector('#content');
  for (const [source, expected] of [['Retrieving Browser Pages', '正在获取浏览器页面'],
    ['Retrieved Browser Pages', '已获取浏览器页面'], ['Refreshing Browser page', '正在刷新浏览器页面'],
    ['Refreshed Browser page', '已刷新浏览器页面'], ['Taking Screenshot', '正在截屏'],
    ['Took Screenshot', '已截屏'], ['Sending input to command', '正在向命令发送输入'],
    ['Sent termination request to command', '已向命令发送终止请求'],
    ['Rejected sending input to command', '已拒绝向命令发送输入'],
    ['Suggested sending input to command', '建议向命令发送输入'],
    ['Error sending input to command', '向命令发送输入时出错'],
    ['5 questions', '5 个问题'], ['1 question', '1 个问题']]) {
    node.textContent = source;
    dom.window.__AGY_ZH_RUNTIME__.translate();
    assert.equal(node.textContent, expected);
  }
  for (const source of ['Clicking element "Settings"', 'Custom browser operation', 'Sending secret payload to command']) {
    node.textContent = source;
    dom.window.__AGY_ZH_RUNTIME__.translate();
    assert.equal(node.textContent, source);
  }
  dom.window.close();
});

test('waiting feedback preserves its separate duration and animated dots nodes', () => {
  const dom = mount(step('<span id="wait">Wait for <span class="font-medium">15s</span></span>') +
    '<div class="flex flex-col"><div class="flex flex-col"><div class="mt-0.5 px-2 h-8 text-sm text-muted-foreground select-none flex items-center" id="waiting">Waiting for user input<span>...</span></div></div></div>');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#wait').textContent, '等待 15s');
  assert.equal(doc.querySelector('#wait .font-medium').textContent, '15s');
  assert.equal(doc.querySelector('#waiting').textContent, '等待用户输入...');
  assert.equal(doc.querySelector('#waiting > span').textContent, '...');
  dom.window.close();
});

test('fragment labels, command checks, and completed question counts follow their actual sibling structure', () => {
  const dom = mount(step(title('<span class="inline-flex text-muted-foreground [&_.text-foreground]:text-muted-foreground"><span id="network">Fetching network requests</span><svg></svg></span>')) +
    step('<div class="flex flex-row items-center gap-1"><span class="shrink-0" id="check">Checking command status</span></div>') +
    '<div class="rounded-xl border border-border mt-0.5"><div class="flex items-center gap-1.5 border-b border-border px-2 py-1.5 text-xs text-secondary-foreground"><svg></svg><span id="questions"></span></div><div class="flex flex-col divide-y divide-border"><div class="markdown">Do we proceed?</div></div></div>');
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#network').textContent, '正在获取网络请求');
  assert.equal(doc.querySelector('#check').textContent, '正在检查命令状态');
  doc.querySelector('#check').textContent = 'Waiting for command completion (up to 10 seconds)';
  doc.querySelector('#questions').append('2', ' question', 's');
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.equal(doc.querySelector('#check').textContent, '等待命令完成（最多 10 seconds）');
  assert.equal(doc.querySelector('#questions').textContent, '2 个问题');
  assert.equal(doc.querySelector('.markdown').textContent, 'Do we proceed?');
  dom.window.close();
});

const notice = (heading, body) => `<div class="flex flex-col p-2.5 pl-3 rounded-2xl border bg-card max-h-[300px] overflow-y-auto shadow-md">
  <div class="flex items-center justify-between gap-2"><div class="flex items-center gap-1.5 select-none overflow-hidden text-ellipsis whitespace-nowrap text-xs text-secondary-foreground font-medium min-w-0">
  <div class="flex items-center gap-1.5 min-w-0"><svg></svg><span class="truncate" id="heading">${heading}</span></div></div></div>
  <div class="text-sm text-foreground"><div class="flex flex-col gap-2 pt-1.5 pb-0.5" id="body">${body}</div></div>
  <div class="flex flex-row items-center justify-end gap-2 w-full pt-1"><button>Log back in</button></div></div>`;

test('input error cards translate fixed title and plain message siblings without requiring a button ancestor', () => {
  const dom = mount(notice('Authentication expired', 'Your session has expired. Please log back in to continue.'));
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#heading').textContent, '登录已过期');
  assert.equal(doc.querySelector('#body').textContent, '您的登录已过期。请重新登录以继续使用。');
  assert.equal(doc.querySelector('button').textContent, '重新登录');
  doc.querySelector('#heading').textContent = 'Insufficient AI Credits';
  doc.querySelector('#body').textContent = 'Your AI credits balance is too low to continue.';
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.equal(doc.querySelector('#heading').textContent, 'AI 点数不足');
  assert.equal(doc.querySelector('#body').textContent, '您的 AI 点数余额不足，无法继续使用。');
  doc.querySelector('#body').textContent = 'Custom organization error';
  dom.window.__AGY_ZH_RUNTIME__.translate();
  assert.equal(doc.querySelector('#body').textContent, 'Custom organization error');
  dom.window.close();
});

test('footer just-now state and fixed labels stay scoped away from ordinary text and response bodies', () => {
  const dom = mount('<div data-testid="cascade-system-message-toolbar"><div><span data-screenshot-volatile="true" data-tooltip-id="created-at" class="text-xs text-muted-foreground select-none px-1 whitespace-nowrap" id="relative">just now</span></div></div>' +
    '<p id="ordinary">just now</p>' + ['planner-response-text', 'user-input-step', 'terminal-tab-surface'].map(id =>
      `<div data-testid="${id}">${prefix('Error while running command')}${content('Taking Screenshot')}${notice('Authentication expired', 'Your AI credits balance is too low to continue.')}</div>`).join(''));
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#relative').textContent, '刚刚');
  assert.equal(doc.querySelector('#ordinary').textContent, 'just now');
  for (const id of ['planner-response-text', 'user-input-step', 'terminal-tab-surface']) {
    const region = doc.querySelector(`[data-testid="${id}"]`);
    assert.equal(region.querySelector('#status').textContent, 'Error while running command');
    assert.equal(region.querySelector('#content').textContent, 'Taking Screenshot');
    assert.equal(region.querySelector('#heading').textContent, 'Authentication expired');
    assert.equal(region.querySelector('#body').textContent, 'Your AI credits balance is too low to continue.');
  }
  dom.window.close();
});
