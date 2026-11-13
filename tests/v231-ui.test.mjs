import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadDesktopLocales } from '../src/locales.mjs';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const locales = await loadDesktopLocales();
const script = await createRuntimeScript();

function createDom(html) {
  return new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/',
    runScripts: 'outside-only',
  });
}

function mount(html) {
  const dom = createDom(html);
  dom.window.eval(script);
  return dom;
}

test('2.31 locale auto-loads and translates settings without changing product names or input values', () => {
  const entries = locales.filter(record => record.id.startsWith('v231.'));
  assert.ok(entries.some(record => record.id === 'v231.settings.chat-layout'));
  assert.ok(entries.some(record => record.id === 'v231.permissions.inherit-global'));

  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4">
    <h2>Chat Layout</h2><button aria-label="Interface Layout"></button>
    <span>Project 4K</span><p>Project 4K interface without developer tooling.</p>
    <p>Developer-only tools. These settings do not affect other users.</p>
    <p>Configure built-in browser, link opening, and browser subagent preferences.</p>
    <div>Download files</div><p>Allow/deny agent browser file downloads from specific sites.</p>
    <input placeholder="e.g., example.com" value="example.com">
    <p>Share your referral link with friends</p>
    <button aria-label="Toggle Google Cloud projects"></button>
    <p>Your Plan: Google AI Pro (ADC)</p><p>Your Plan (ADC)</p>
    <p>System default</p><button aria-label="Sign in again"></button>
  </div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h2').textContent, '聊天布局');
  assert.equal(doc.querySelector('[aria-label="界面布局"]').getAttribute('aria-label'), '界面布局');
  assert.equal(doc.querySelector('p:nth-of-type(1)').textContent, '不含开发工具的 Project 4K 界面。');
  assert.equal(doc.querySelector('span').textContent, 'Project 4K');
  assert.equal(doc.querySelector('p:nth-of-type(2)').textContent, '仅供开发者使用。这些设置不会影响其他用户。');
  assert.equal(doc.querySelector('p:nth-of-type(3)').textContent, '配置内置浏览器、链接打开方式和浏览器子智能体偏好设置。');
  assert.equal(doc.querySelector('div:not(.max-w-2xl)').textContent, '文件下载');
  assert.equal(doc.querySelectorAll('p')[3].textContent, '管理智能体可从哪些网站下载文件。');
  assert.equal(doc.querySelector('input').getAttribute('placeholder'), '例如：example.com');
  assert.equal(doc.querySelector('input').value, 'example.com');
  assert.equal(doc.querySelectorAll('p')[4].textContent, '与朋友分享你的推荐链接。');
  assert.equal(doc.querySelector('[aria-label="切换 Google Cloud 项目"]').getAttribute('aria-label'), '切换 Google Cloud 项目');
  assert.equal(doc.querySelectorAll('p')[5].textContent, '你的方案：Google AI Pro (ADC)');
  assert.equal(doc.querySelectorAll('p')[6].textContent, '你的方案 (ADC)');
  assert.equal(doc.querySelectorAll('p')[7].textContent, '系统默认');
  assert.equal(doc.querySelector('[aria-label="重新登录"]').getAttribute('aria-label'), '重新登录');
  dom.window.close();
});

test('project and workspace setting templates map fixed type names only', () => {
  const dom = mount(`<div class="p-6 flex flex-col gap-4 w-full max-w-2xl mx-auto">
    <button aria-label="Edit project name"></button><button aria-label="Edit workspace name"></button>
    <p>Manage project resources, agent settings, and permissions.</p>
    <p>Manage workspace folders and settings.</p>
    <span class="text-red-500">A workspace with this name already exists.</span>
    <p>No project selected or project management not available.</p>
    <input value="Release-Tracker">
    <div role="dialog"><button>Delete Project</button><button>Delete Workspace</button></div>
  </div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[aria-label="编辑项目名称"]').getAttribute('aria-label'), '编辑项目名称');
  assert.equal(doc.querySelectorAll('button[aria-label]')[1].getAttribute('aria-label'), '编辑工作区名称');
  assert.equal(doc.querySelectorAll('p')[0].textContent, '管理项目资源、智能体设置和权限。');
  assert.equal(doc.querySelectorAll('p')[1].textContent, '管理工作区文件夹和设置。');
  assert.equal(doc.querySelector('.text-red-500').textContent, '已有同名工作区。');
  assert.equal(doc.querySelectorAll('p')[2].textContent, '未选择项目，或项目管理功能不可用。');
  assert.deepEqual([...doc.querySelectorAll('[role="dialog"] button')].map(button => button.textContent), ['删除项目', '删除工作区']);
  assert.equal(doc.querySelector('input').value, 'Release-Tracker');
  dom.window.close();
});

test('permission preset labels and explanations use the 2.31 selector surfaces', () => {
  const dom = mount(`<div class="max-w-2xl mx-auto flex-col gap-4">
    <button data-testid="permissions-selector-trigger">Inherit Global</button>
    <button data-testid="permissions-selector-trigger">This Conversation</button>
    <button data-testid="permissions-selector-trigger">Project Settings</button>
    <button data-testid="permissions-selector-trigger">Workspace Settings</button>
    <div role="tooltip"><span class="max-w-[300px] block whitespace-normal">Inherits your Global Permissions when working in these conversations.</span></div>
    <div role="tooltip"><span class="max-w-[300px] block whitespace-normal">Inherits your Global Permissions when working in this project.</span></div>
    <div role="tooltip"><span class="max-w-[300px] block whitespace-normal">Manually customize individual settings.</span></div>
    <div role="tooltip"><span class="max-w-[300px] block whitespace-normal">Controls the actions the agent can take.</span></div>
    <div role="tooltip"><span class="max-w-[300px] block whitespace-normal">Only this conversation uses this preset.</span></div>
    <div role="tooltip"><span class="max-w-[300px] block whitespace-normal">This project overrides your global permission settings.</span></div>
    <div role="tooltip"><span class="max-w-[300px] block whitespace-normal">This workspace overrides your global permission settings.</span></div>
    <div class="space-y-2"><div class="flex flex-col gap-1">
      <span class="text-xs text-muted-foreground leading-relaxed">Also includes <span class="text-link">Global Permissions</span> when working in this project.</span>
    </div></div>
  </div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('[data-testid="permissions-selector-trigger"]')].map(button => button.textContent), [
    '继承全局权限', '当前会话', '项目设置', '工作区设置',
  ]);
  assert.deepEqual([...doc.querySelectorAll('[role="tooltip"] > span')].slice(0, 7).map(span => span.textContent), [
    '在这些会话中工作时，继承你的全局权限。',
    '在此项目中工作时，继承你的全局权限。',
    '手动自定义各项设置。',
    '控制智能体可执行的操作。',
    '只有当前会话使用此预设。',
    '此项目覆盖了全局权限设置。',
    '此工作区覆盖了全局权限设置。',
  ]);
  assert.equal(doc.querySelector('.text-link').textContent, '全局权限');
  assert.match(doc.querySelector('.text-xs.text-muted-foreground.leading-relaxed').textContent, /也包括.*在此项目中工作时/);
  dom.window.close();
});

test('authorization and coordinator dialogs translate controls and preserve entered content', () => {
  const dom = mount(`<div class="entrance-auth-panel">
    <button>Trouble signing in? Enter authorization code</button>
    <p>Sign in in your browser, then paste the authorization code shown on the callback page.</p>
    <label>Authorization code</label><input placeholder="Paste authorization code" value="ABCD-1234">
    <button>Submit code</button><a>Having trouble signing in?</a><button aria-label="Sign in again"></button>
  </div>
  <div role="dialog" title="New Coordinator">
    <h2>New Coordinator</h2>
    <input aria-label="Coordinator name" placeholder="e.g. Release helper" value="Release helper custom">
    <textarea aria-label="Coordinator goal" placeholder="What should this coordinator accomplish?">Keep /workspace/demo current</textarea>
    <textarea aria-label="Coordinator instructions">Use /Users/demo/worktree</textarea>
    <button>Create Coordinator</button><div role="alert">Couldn't create the coordinator. Try again.</div>
    <button title="Coordinator settings"></button><div role="tooltip">Coordinator settings</div>
    <div data-testid="pending-coordinator-error"><span class="min-w-0">Couldn't start the coordinator: Error at /private/demo/settings.json</span></div>
  </div>
  <div class="max-w-2xl mx-auto flex-col gap-4"><button aria-label="New coordinator"></button></div>`);
  const doc = dom.window.document;
  const auth = doc.querySelector('.entrance-auth-panel');
  const dialog = doc.querySelector('[role="dialog"]');
  assert.equal(auth.querySelector('button').textContent, '登录遇到问题？输入授权码');
  assert.equal(auth.querySelector('p').textContent, '请在浏览器中登录，然后粘贴回调页面上显示的授权码。');
  assert.equal(auth.querySelector('label').textContent, '授权码');
  assert.equal(auth.querySelector('input').getAttribute('placeholder'), '粘贴授权码');
  assert.equal(auth.querySelector('input').value, 'ABCD-1234');
  assert.equal(auth.querySelectorAll('button')[1].textContent, '提交授权码');
  assert.equal(auth.querySelector('a').textContent, '登录遇到问题？');
  assert.equal(auth.querySelectorAll('button')[2].getAttribute('aria-label'), '重新登录');
  assert.equal(dialog.getAttribute('title'), '新建协调者');
  assert.equal(dialog.querySelector('h2').textContent, '新建协调者');
  assert.equal(dialog.querySelector('input').getAttribute('aria-label'), '协调者名称');
  assert.equal(dialog.querySelector('input').getAttribute('placeholder'), '例如：发布助手');
  assert.equal(dialog.querySelector('input').value, 'Release helper custom');
  assert.equal(dialog.querySelector('textarea[aria-label="协调者目标"]').getAttribute('placeholder'), '这个协调者要完成什么？');
  assert.equal(dialog.querySelector('textarea[aria-label="协调者目标"]').value, 'Keep /workspace/demo current');
  assert.equal(dialog.querySelector('textarea[aria-label="协调者指令"]').value, 'Use /Users/demo/worktree');
  assert.equal(dialog.querySelector('button').textContent, '创建协调者');
  assert.equal(dialog.querySelector('[role="alert"]').textContent, '无法创建协调者，请重试。');
  assert.equal(dialog.querySelector('button[title="协调者设置"]').getAttribute('title'), '协调者设置');
  assert.equal(dialog.querySelector('[role="tooltip"]').textContent, '协调者设置');
  assert.equal(dialog.querySelector('[data-testid="pending-coordinator-error"] span').textContent, '无法启动协调者：Error at /private/demo/settings.json');
  assert.equal(doc.querySelector('[aria-label="新建协调者"]').getAttribute('aria-label'), '新建协调者');
  dom.window.close();
});

test('side-question prefixes localize only fixed leaves and preserve titles and dynamic question text', () => {
  const dynamicQuestion = 'Review /Users/demo/private/request.md before replying';
  const dynamicTabTitle = 'Side Question: Review the cache failure in /workspace/demo';
  const dom = mount(`<section data-testid="side-question-question"><span class="shrink-0">Help:</span><span data-testid="question-body">${dynamicQuestion}</span></section>
    <section data-testid="side-question-question"><span class="shrink-0">Side Question:</span><span data-testid="question-body">Check the request payload</span></section>
    <div data-testid="side-question-tab-header-title" title="${dynamicTabTitle}">
      <span data-testid="side-question-tab-header-prefix">Side Question: </span><span data-testid="side-question-tab-header-name">Review the cache failure in /workspace/demo</span>
    </div>
    <div data-testid="side-question-tab-header-title" title="Side Question">
      <span data-testid="side-question-tab-header-prefix">Side Question</span>
    </div>
    <div data-testid="side-question-tab-header-title" title="New Side Question">New Side Question</div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('[data-testid="side-question-question"] > span.shrink-0')].map(span => span.textContent), ['帮助：', '附加问题：']);
  assert.deepEqual([...doc.querySelectorAll('[data-testid="question-body"]')].map(span => span.textContent), [dynamicQuestion, 'Check the request payload']);
  const headers = [...doc.querySelectorAll('[data-testid="side-question-tab-header-title"]')];
  assert.equal(headers[0].querySelector('[data-testid="side-question-tab-header-prefix"]').textContent, '附加问题： ');
  assert.equal(headers[0].querySelector('[data-testid="side-question-tab-header-name"]').textContent, 'Review the cache failure in /workspace/demo');
  assert.equal(headers[0].getAttribute('title'), dynamicTabTitle);
  assert.equal(headers[1].querySelector('[data-testid="side-question-tab-header-prefix"]').textContent, '附加问题');
  assert.equal(headers[1].getAttribute('title'), 'Side Question');
  assert.equal(headers[2].textContent, '新建附加问题');
  assert.equal(headers[2].getAttribute('title'), 'New Side Question');
  dom.window.close();
});

test('side-question delete and promotion controls translate while preserving dynamic error details', () => {
  const errorDetail = 'Permission denied for /Users/demo/.config/trajectory.json';
  const dom = mount(`<div role="dialog"><h2>Delete Side Question</h2>
      <p>Are you sure you want to delete this side question? This action cannot be undone.</p>
      <button data-testid="confirm-delete-side-question">Delete</button></div>
    <div role="tooltip">Delete Side Question</div>
    <div role="status"><strong>Failed to delete side question</strong><span>${errorDetail}</span></div>
    <button data-testid="side-question-tab-promote" aria-label="Promote to conversation"></button>
    <div role="tooltip">Promote to Conversation</div>
    <div role="tooltip">Cannot promote during Battle Mode — end the battle first</div>
    <div role="tooltip">Cannot promote a subagent's side question</div>
    <div role="tooltip">Cannot promote while side question is running</div>
    <button data-testid="side-question-row-delete" aria-label="Delete side question: Keep the original title"></button>`);
  const doc = dom.window.document;
  const dialog = doc.querySelector('[role="dialog"]');
  assert.equal(dialog.querySelector('h2').textContent, '删除附加问题');
  assert.equal(dialog.querySelector('p').textContent, '确定要删除此附加问题吗？此操作无法撤销。');
  assert.equal(dialog.querySelector('button').textContent, '删除');
  assert.equal(doc.querySelector('[role="tooltip"]').textContent, '删除附加问题');
  assert.equal(doc.querySelector('[role="status"] strong').textContent, '删除附加问题失败');
  assert.equal(doc.querySelector('[role="status"] span').textContent, errorDetail);
  assert.equal(doc.querySelector('[data-testid="side-question-tab-promote"]').getAttribute('aria-label'), '转为会话');
  assert.deepEqual([...doc.querySelectorAll('[role="tooltip"]')].slice(1).map(node => node.textContent), [
    '转为会话',
    'Battle Mode 期间无法转为会话，请先结束 Battle Mode。',
    '无法将子智能体的附加问题转为会话。',
    '附加问题运行期间无法将其转为会话。',
  ]);
  assert.equal(doc.querySelector('[data-testid="side-question-row-delete"]').getAttribute('aria-label'), 'Delete side question: Keep the original title');
  dom.window.close();
});

test('settings and notification errors translate fixed text while keeping details intact', () => {
  const detail = 'Unexpected token in /Users/demo/.config/antigravity/settings.json at line 8';
  const recordingError = 'Permission denied: /Users/demo/Library/recordings/call-1.wav';
  const dom = mount(`<div data-testid="settings-error-messages-card"><div class="flex-1 flex flex-col gap-1 min-w-0">
      <span class="font-medium text-foreground">Failed to parse settings. Fix and restart.</span><div>${detail}</div>
    </div></div>
    <div role="status">Account connection was not completed.</div>
    <div role="status">Failed to delete recordings: ${recordingError}</div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="settings-error-messages-card"] span').textContent, '无法解析设置。请修正后重新启动。');
  assert.equal(doc.querySelector('[data-testid="settings-error-messages-card"] div div').textContent, detail);
  assert.equal(doc.querySelectorAll('[role="status"]')[0].textContent, '账户连接未完成。');
  assert.equal(doc.querySelectorAll('[role="status"]')[1].textContent, `删除录音失败：${recordingError}`);
  dom.window.close();
});

test('browser site-data templates localize fixed text and retain the host unchanged', () => {
  const dom = createDom(`<div role="dialog" data-testid="url-security-popover">
      <h2>Cookies and site data</h2>
      <div class="flex flex-col gap-2.5 px-3 py-2.5"><span class="text-secondary-foreground leading-relaxed"></span>
        <button data-testid="url-security-clear-site-data">Clear cookies and site data</button><span class="text-error"></span>
      </div>
    </div><span data-testid="url-security-site-data-cleared"></span>`);
  const doc = dom.window.document;
  const host = 'internal.example.test:8443';
  const warning = doc.querySelector('.text-secondary-foreground');
  warning.append('Clearing cookies and site data for ', host, ' may sign you out of this site.');
  const failure = doc.querySelector('.text-error');
  failure.append('Could not clear site data for ', host, '.');
  const success = doc.querySelector('[data-testid="url-security-site-data-cleared"]');
  success.append('Site data cleared for ', host, '.');
  dom.window.eval(script);
  assert.equal(doc.querySelector('h2').textContent, 'Cookie 和网站数据');
  assert.equal(doc.querySelector('[data-testid="url-security-clear-site-data"]').textContent, '清除 Cookie 和网站数据');
  assert.equal(warning.textContent, `清除 ${host} 的 Cookie 和网站数据可能会使你退出该网站。`);
  assert.equal(failure.textContent, `无法清除 ${host} 的网站数据。`);
  assert.equal(success.textContent, `已清除 ${host} 的网站数据。`);
  dom.window.close();
});

test('remote instance UI translates loading and errors but retains names and error details', () => {
  const dom = mount(`<button data-testid="instance-selector-trigger"><div class="flex items-center gap-2 min-w-0 flex-1"><span class="truncate text-left flex-1">Loading instances...</span></div></button>
    <button data-testid="instance-selector-trigger"><div class="flex items-center gap-2 min-w-0 flex-1"><span class="truncate text-left flex-1">Review</span></div></button>
    <div role="presentation" data-testid="instance-selector-instances-heading">Remote Control Instances</div>
    <div role="presentation"><span class="text-muted-foreground">No instances yet.</span><button data-testid="instance-selector-set-up" aria-label="Get started with Remote Control">Get started</button></div>
    <div role="presentation" data-testid="instance-selector-listing-error">Failed to load instances: ENOENT: /Users/demo/.config/remote-control.json</div>
    <div role="status">Failed to load instances: EACCES: /Users/demo/.config/remote-control.json</div>`);
  const doc = dom.window.document;
  const triggers = [...doc.querySelectorAll('[data-testid="instance-selector-trigger"]')];
  assert.equal(triggers[0].textContent.trim(), '正在加载实例...');
  assert.equal(triggers[1].textContent.trim(), 'Review');
  assert.equal(doc.querySelector('[data-testid="instance-selector-instances-heading"]').textContent, '远程控制实例');
  assert.equal(doc.querySelector('[role="presentation"] > span').textContent, '暂无实例。');
  assert.equal(doc.querySelector('[data-testid="instance-selector-set-up"]').getAttribute('aria-label'), '开始使用远程控制');
  assert.equal(doc.querySelector('[data-testid="instance-selector-listing-error"]').textContent, '无法加载实例：ENOENT: /Users/demo/.config/remote-control.json');
  assert.equal(doc.querySelector('[role="status"]').textContent, '无法加载实例：EACCES: /Users/demo/.config/remote-control.json');
  dom.window.close();
});
