import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const mount = html => {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only'
  });
  dom.window.eval(script);
  return dom;
};
const option = text => `<div><label data-testid="ask-question-option"><input type="radio" name="ask-question-1" value="1">
  <div data-testid="ask-question-option-text"><div class="leading-relaxed md-divider-spacing"><p>${text}</p></div></div>
  </label></div>`;
const request = (heading, options, extra = '') => `<div data-testid="interaction-takeover-card"><div class="relative flex flex-col gap-0 p-1.5">
  <div class="outline-none flex flex-col gap-2 no-focus-ring no-focus-agent-input">
  <div class="flex flex-col gap-1 py-1"><div class="flex justify-between items-center gap-1 px-1">
    <div><div data-testid="ask-question-header-text"><div class="flex flex-col gap-0.5 w-full min-w-0 pb-1" data-command-plugin-state="pending">
      <span class="text-sm font-medium text-foreground min-w-0 break-words">${heading}</span></div></div></div></div>
    <div class="flex flex-col gap-1 px-1 w-full"><p class="px-1 pb-0.5 text-xs text-secondary-foreground leading-relaxed">${extra}</p>
      <div class="flex items-center gap-2 px-1 text-xs text-amber-500"><span>⚠️</span><span class="leading-relaxed truncate block">Confirm the command is safe to run outside of the sandbox with full network and disk access.</span></div>
      <div class="grid"><pre><code>Yes, allow this time</code></pre><textarea data-testid="permission-target-editor" aria-label="Edit permission target">Yes, allow this time</textarea></div></div></div>
  <div role="radiogroup">${options.map(option).join('')}
    <div><label><input type="radio" name="ask-question-1" value="writein"><div class="flex gap-1 flex-1 min-w-0 items-baseline"><span>No</span>
      <textarea data-testid="ask-question-writein" placeholder="(tell the agent what to do instead)">No</textarea></div></label>
      <button data-testid="interaction-skip-button">Skip</button><button data-testid="interaction-continue-button">Submit</button></div>
  </div></div></div></div>`;

test('permission prompts translate fixed choices and scope while retaining rule targets and typed values', () => {
  const options = [
    'Yes, allow this time', 'Yes, and always allow in this conversation',
    "Yes, and always allow '/tmp/Work Project/*.txt' in this project",
    "Yes, save rule for 'git status' in this workspace", 'Yes, save rule globally',
    'Yes, and always allow', 'Unknown future option',
  ];
  const dom = mount(request('Allow running this command outside the sandbox?', options, 'Yes, allow this time'));
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-command-plugin-state] > span').textContent, '是否允许在沙盒外运行此命令？');
  assert.deepEqual([...doc.querySelectorAll('[data-testid="ask-question-option-text"] p')].map(p => p.textContent), [
    '是，仅允许本次', '是，在此对话中始终允许', '是，在此项目中始终允许‘/tmp/Work Project/*.txt’',
    '是，在此工作区中保存‘git status’的规则', '是，全局保存规则', '是，始终允许', 'Unknown future option',
  ]);
  assert.equal(doc.querySelector('.text-amber-500 > span:last-child').textContent,
    '请确认：在拥有完整网络和磁盘访问权限的情况下，此命令可以安全地在沙盒外运行。');
  assert.equal(doc.querySelector('[data-testid="permission-target-editor"]').getAttribute('aria-label'), '编辑权限目标');
  assert.equal(doc.querySelector('[data-testid="permission-target-editor"]').value, 'Yes, allow this time');
  assert.equal(doc.querySelector('[data-testid="ask-question-writein"]').placeholder, '（告诉智能体接下来该怎么做）');
  assert.equal(doc.querySelector('[data-testid="ask-question-writein"]').value, 'No');
  assert.equal(doc.querySelector('[data-testid="ask-question-writein"]').previousElementSibling.textContent, '否');
  assert.equal(doc.querySelector('[data-testid="interaction-skip-button"]').textContent, '跳过');
  assert.equal(doc.querySelector('[data-testid="interaction-continue-button"]').textContent, '提交');
  assert.equal(doc.querySelector('.px-1.pb-0\\.5').textContent, 'Yes, allow this time');
  assert.equal(doc.querySelector('pre code').textContent, 'Yes, allow this time');
  assert.equal(doc.querySelector('[data-testid="ask-question-option"] input').value, '1');
  dom.window.close();
});

test('permission prompts preserve plugin descriptions and all unrelated question or structured Markdown text', () => {
  const dom = mount(request('Allow access to this resource?', ["Yes, and always allow '/tmp/<strong>dir</strong>' in this project"]) +
    `<div data-testid="interaction-takeover-card"><div><div class="outline-none flex flex-col gap-2 no-focus-ring no-focus-agent-input">
       <div data-testid="ask-question-header-text"><div class="md-divider-spacing"><p>Allow access to this resource?</p></div></div>
       <label data-testid="ask-question-option"><div data-testid="ask-question-option-text"><div class="md-divider-spacing"><p>Yes, allow this time</p><p>Review</p></div></div></label>
     </div></div></div><div data-testid="planner-response-text">Yes, allow this time</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-command-plugin-state] > span').textContent, '是否允许访问此资源？');
  assert.equal(doc.querySelector('strong').textContent, 'dir');
  assert.equal(doc.querySelector('[data-testid="ask-question-option-text"] p').textContent,
    "Yes, and always allow '/tmp/dir' in this project");
  assert.equal(doc.querySelectorAll('[data-testid="ask-question-option-text"] p')[1].textContent, 'Yes, allow this time');
  assert.equal(doc.querySelectorAll('[data-testid="ask-question-option-text"] p')[2].textContent, 'Review');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Yes, allow this time');
  dom.window.close();
  const plugin = mount(request('Allow access to this resource?', []).replace('<span class="text-sm font-medium',
    '<span data-testid="permission-app-header" class="text-xs">App</span><span class="text-sm font-medium'));
  assert.equal(plugin.window.document.querySelector('[data-command-plugin-state] > span.text-sm').textContent, 'Allow access to this resource?');
  plugin.window.close();
});

test('new options added to a permission request receive translated scope labels', async () => {
  const dom = mount(request('Allow reading this URL?', []));
  const group = dom.window.document.querySelector('[role="radiogroup"]');
  group.insertAdjacentHTML('afterbegin', option("Yes, save rule for 'https://example.com' in this conversation"));
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(group.querySelector('[data-testid="ask-question-option-text"] p').textContent,
    '是，在此对话中保存‘https://example.com’的规则');
  dom.window.close();
});

test('non-command permissions use the same prompt without a command-plugin state attribute', () => {
  const cases = [
    ['Allow read access to this path?', '是否允许读取此路径？'],
    ['Allow write access to this path?', '是否允许写入此路径？'],
    ['Allow reading this URL?', '是否允许读取此网址？'],
    ['Allow executing actions on this URL?', '是否允许在此网址执行操作？'],
    ['Allow using this MCP tool?', '是否允许使用此 MCP 工具？'],
    ['Allow a one-time administrator (UAC) elevation?', '是否允许本次提升至管理员权限（UAC）？'],
    ['Save rule to always allow read access to this path?', '是否保存规则，始终允许读取此路径？'],
    ['Allow use an unrecognized integration?', 'Allow use an unrecognized integration?'],
    ['Save rule to always allow a new external integration?', 'Save rule to always allow a new external integration?'],
  ];
  for (const [source, target] of cases) {
    const dom = mount(request(source, ['Yes, allow']).replace(' data-command-plugin-state="pending"', ''));
    const doc = dom.window.document;
    assert.equal(doc.querySelector('[data-testid="ask-question-header-text"] span').textContent, target);
    assert.equal(doc.querySelector('[data-testid="ask-question-option-text"] p').textContent, '是，允许');
    dom.window.close();
  }
});

test('all saved permission scopes retain the exact rule value', () => {
  const choices = [
    ["Yes, save rule for '/tmp/a' in this conversation", '是，在此对话中保存‘/tmp/a’的规则'],
    ["Yes, save rule for '/tmp/a' in this project", '是，在此项目中保存‘/tmp/a’的规则'],
    ["Yes, save rule for '/tmp/a' when not in a project", '是，在不属于项目时保存‘/tmp/a’的规则'],
    ["Yes, save rule for '/tmp/a' in this workspace", '是，在此工作区中保存‘/tmp/a’的规则'],
    ["Yes, save rule for '/tmp/a' globally", '是，全局保存‘/tmp/a’的规则'],
    ["Yes, and always allow '/tmp/a' in this conversation", '是，在此对话中始终允许‘/tmp/a’'],
    ["Yes, and always allow '/tmp/a' in this project", '是，在此项目中始终允许‘/tmp/a’'],
    ["Yes, and always allow '/tmp/a' when not in a project", '是，在不属于项目时始终允许‘/tmp/a’'],
    ["Yes, and always allow '/tmp/a' in this workspace", '是，在此工作区中始终允许‘/tmp/a’'],
    ["Yes, and always allow '/tmp/a'", '是，始终允许‘/tmp/a’'],
  ];
  const dom = mount(request('Allow read access to this path?', choices.map(([source]) => source)));
  assert.deepEqual([...dom.window.document.querySelectorAll('[data-testid="ask-question-option-text"] p')].map(p => p.textContent),
    choices.map(([, target]) => target));
  dom.window.close();
});

test('rule targets with quotes, dollar signs and scope-like text stay intact', () => {
  const value = "/tmp/Mary's $project/in this project/report.txt";
  const options = [
    `Yes, save rule for '${value}' in this project`,
    `Yes, and always allow '${value}' in this workspace`,
  ];
  const dom = mount(request('Allow read access to this path?', options));
  assert.deepEqual([...dom.window.document.querySelectorAll('[data-testid="ask-question-option-text"] p')].map(p => p.textContent), [
    `是，在此项目中保存‘${value}’的规则`,
    `是，在此工作区中始终允许‘${value}’`,
  ]);
  dom.window.close();
});
