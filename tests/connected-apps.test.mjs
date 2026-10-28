import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(html, prepare = () => {}) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  prepare(dom.window.document);
  dom.window.eval(script);
  return dom;
}

test('plugin replacement explains the operation and preserves both plugins’ content', () => {
  const dom = mount(`<div role="dialog"><div><h2 class="text-md font-medium text-foreground">Install folder "demo" is already in use</h2></div>
    <div data-testid="plugin-install-conflict-modal"><div class="text-secondary-foreground text-sm mb-4">Replacing removes the currently installed plugin and installs the new one in its place.</div>
      <div class="flex flex-col gap-3 mb-4"><div data-testid="conflict-current-plugin"><div class="text-xs font-medium text-muted-foreground mb-1.5">Currently installed</div>
        <div class="flex items-start gap-3 p-3 rounded-lg border"><div class="flex-1 min-w-0 flex flex-col gap-0.5"><div><span class="font-medium text-sm text-foreground truncate">Replace</span></div><div class="text-xs text-muted-foreground truncate">Cancel</div></div></div></div>
      <div data-testid="conflict-incoming-plugin"><div class="text-xs font-medium text-muted-foreground mb-1.5">Replace with</div>
        <div class="flex items-start gap-3 p-3 rounded-lg border"><div class="flex-1 min-w-0 flex flex-col gap-0.5"><div><span class="font-medium text-sm text-foreground truncate">Currently installed</span></div><div class="text-xs text-muted-foreground truncate">Replace</div></div></div></div></div>
      <button data-testid="cancel-plugin-install-conflict">Cancel</button><button data-testid="replace-conflicting-plugin">Replace</button></div></div>
    <p>Replacing removes the currently installed plugin and installs the new one in its place.</p>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h2').textContent, '安装文件夹“demo”已被占用');
  assert.equal(doc.querySelector('[data-testid="plugin-install-conflict-modal"] > div').textContent, '替换会移除当前安装的插件，并安装新插件。');
  assert.equal(doc.querySelector('[data-testid="conflict-current-plugin"] > div').textContent, '当前已安装');
  assert.equal(doc.querySelector('[data-testid="conflict-incoming-plugin"] > div').textContent, '替换为');
  assert.equal(doc.querySelector('[data-testid="conflict-current-plugin"] span').textContent, 'Replace');
  assert.equal(doc.querySelector('[data-testid="conflict-current-plugin"] .truncate:not(span)').textContent, 'Cancel');
  assert.equal(doc.querySelector('[data-testid="conflict-incoming-plugin"] span').textContent, 'Currently installed');
  assert.equal(doc.querySelector('[data-testid="replace-conflicting-plugin"]').textContent, '替换');
  assert.equal(doc.querySelector('[data-testid="cancel-plugin-install-conflict"]').textContent, '取消');
  assert.equal(doc.querySelector('body > p').textContent, 'Replacing removes the currently installed plugin and installs the new one in its place.');
  dom.window.close();
});

test('plugin account instructions and statuses translate without changing account data', () => {
  const dom = mount(`<section aria-label="Accounts"><p id="intro" class="text-xs text-muted-foreground"></p>
    <p class="mt-1 text-xs text-muted-foreground">Enable this plugin to manage its accounts.</p>
    <div class="mt-4 space-y-2"><div class="rounded-md border p-3 space-y-3">
      <div class="flex items-center gap-2"><span class="text-sm text-foreground">Connected</span><span class="rounded bg-muted text-green-500">2 accounts</span><span class="rounded bg-muted text-muted-foreground">No sign-in needed</span></div>
      <p id="domains" class="mt-1 truncate text-xs text-muted-foreground"></p>
      <div class="mt-0.5 text-xs text-muted-foreground">Scopes:<ul class="ml-3"><li>Connected</li></ul></div>
      <p class="mt-1 text-xs text-muted-foreground">Waiting for you to finish signing in… <a class="text-link">Reopen sign-in page</a></p>
      <ul class="space-y-1.5" aria-label="Signed-in accounts"><li><span class="truncate text-xs text-foreground">Default</span><span class="rounded bg-muted text-muted-foreground">Default</span><span class="rounded bg-muted text-amber-500">Needs re-auth</span><button aria-label="Make Alice the default Example account">Make default</button><input aria-label="New secret for Alice"></li></ul>
      <div role="status">Checking…</div></div></div></section><div role="dialog"><section aria-label="Accounts"><p class="mt-1 text-xs text-muted-foreground">Enable this plugin to manage its accounts.</p></section></div>`, doc => {
    doc.querySelector('#intro').append('Services this plugin connects to on your behalf. Credentials stay on this machine and are only sent to the domains listed.', ' If you add multiple accounts, MCP servers use the one marked Default.');
    doc.querySelector('#domains').append('Domains: ', 'example.com');
  });
  const doc = dom.window.document;
  assert.equal(doc.querySelector('#intro').textContent, '此插件代表你连接的服务。凭据保存在本机，仅发送至列出的域名。添加多个账户时，MCP 服务器使用标记为默认的账户。');
  assert.equal(doc.querySelector('#domains').textContent, '域名： example.com');
  assert.equal(doc.querySelector('div.mt-0\\.5').textContent, '权限范围：Connected');
  assert.equal(doc.querySelector('ul.space-y-1\\.5').getAttribute('aria-label'), '已登录的账户');
  assert.equal(doc.querySelector('li > .truncate').textContent, 'Default');
  assert.equal(doc.querySelector('li > .text-muted-foreground').textContent, '默认');
  assert.equal(doc.querySelector('li > .text-amber-500').textContent, '需要重新验证身份');
  assert.equal(doc.querySelector('button').textContent, '设为默认');
  assert.equal(doc.querySelector('button').getAttribute('aria-label'), '将 Alice 设为默认的 Example 账户');
  assert.equal(doc.querySelector('input').getAttribute('aria-label'), 'Alice 的新机密凭据');
  assert.equal(doc.querySelector('[role="status"]').textContent, '正在检查…');
  assert.equal(doc.querySelector('span.text-sm').textContent, 'Connected');
  assert.equal(doc.querySelector('span.text-green-500').textContent, '2 个账户');
  assert.equal(doc.querySelector('span.text-muted-foreground.rounded').textContent, '无需登录');
  assert.equal(doc.querySelector('[role="dialog"] section').getAttribute('aria-label'), '账户');
  assert.equal(doc.querySelector('[role="dialog"] section p').textContent, '启用此插件后才能管理其账户。');
  dom.window.close();
});

test('connected app controls and plugin configuration protect dynamic text', () => {
  const dom = mount(`<div data-testid="plugin-detail"><div class="p-3 rounded-md border border-border/60 text-sm text-foreground flex flex-col gap-2">
    <div class="flex items-center justify-between gap-3"><span class="font-medium">Account</span></div>
    <div class="flex items-center justify-between gap-3 min-w-0"><div class="flex items-center gap-2 min-w-0"><span class="truncate">Needs reconnect</span><span class="inline-flex rounded-full">Default</span><span class="text-xs text-muted-foreground">Needs reconnect</span></div><div><button aria-label="Reconnect user@example.com">Reconnect</button><button aria-label="Disconnect user@example.com">Disconnect</button></div></div></div>
    <div class="p-3 rounded-md border text-sm text-foreground flex items-center justify-between"><div class="flex items-center gap-2"><span>Connect an account so the agent can use this app.</span></div><button aria-label="Connect Example app">Connect</button></div>
    <section class="flex flex-col gap-3"><div><h3><button>Context Providers</button></h3></div><div data-testid="plugin-context-provider-list"><div data-testid="plugin-context-provider-demo"><span class="text-sm font-medium text-foreground truncate">App update required</span><span data-testid="plugin-context-provider-status-demo">App update required</span><p class="text-xs text-muted-foreground leading-relaxed">Needs reconnect</p></div></div></section></div>
    <div role="dialog"><div data-testid="mcp-config-modal"><div class="text-secondary-foreground text-xs select-none">Enter the configuration values this MCP server needs. Saving restarts the server with them.</div><div data-testid="mcp-config-variable"><div><label>Save</label></div><span>Cancel</span><input data-testid="mcp-config-variable-input" placeholder="Save"></div></div></div>`);
  const doc = dom.window.document;
  const card = doc.querySelector('.flex.flex-col.gap-2');
  assert.equal(card.querySelector('.font-medium').textContent, '账户');
  assert.equal(card.querySelector('.truncate').textContent, 'Needs reconnect');
  assert.equal(card.querySelector('.rounded-full').textContent, '默认');
  assert.equal(card.querySelector('.text-xs').textContent, '需要重新连接');
  assert.equal(card.querySelector('button').getAttribute('aria-label'), '重新连接 user@example.com');
  assert.equal(card.querySelectorAll('button')[1].getAttribute('aria-label'), '断开与 user@example.com 的连接');
  assert.equal(doc.querySelector('[aria-label="连接 Example app"]').textContent, '连接');
  assert.equal(doc.querySelector('h3 button').textContent, '上下文提供者');
  assert.equal(doc.querySelector('[data-testid="plugin-context-provider-status-demo"]').textContent, '需要更新应用');
  assert.equal(doc.querySelector('[data-testid="plugin-context-provider-demo"] .truncate').textContent, 'App update required');
  assert.equal(doc.querySelector('[data-testid="plugin-context-provider-demo"] p').textContent, 'Needs reconnect');
  assert.equal(doc.querySelector('[data-testid="mcp-config-modal"] > div').textContent, '输入此 MCP 服务器所需的配置值。保存后服务器会使用新配置重启。');
  assert.equal(doc.querySelector('[data-testid="mcp-config-variable"] label').textContent, 'Save');
  assert.equal(doc.querySelector('[data-testid="mcp-config-variable"] span').textContent, 'Cancel');
  assert.equal(doc.querySelector('[data-testid="mcp-config-variable"] input').placeholder, 'Save');
  dom.window.close();
});

test('customization sources and connected app listing use localized labels and preserve app metadata', () => {
  const dom = mount(`<span data-testid="automation-kind-icon" title="Runs in the cloud" aria-label="Runs in the cloud"></span>
    <div role="group" data-testid="plugins-source" aria-label="Customizations source"><button data-testid="plugins-source-local" aria-label="On this computer"></button><button data-testid="plugins-source-remote" aria-label="Connected apps"></button></div>
    <div class="compact-tooltip" role="tooltip"><div class="flex flex-col gap-0.5 max-w-[220px]"><span class="font-medium">Connected apps</span><span class="opacity-80">Sign in once and your agent can use these apps on any device. Nothing is installed on this computer.</span></div></div>
    <div class="max-w-4xl w-full mx-auto px-8 py-6"><div class="flex flex-col gap-6">
      <div class="flex gap-3 items-start px-4 py-3 rounded-xl border border-border"><div class="flex flex-col gap-1"><p class="text-sm font-medium text-foreground m-0">Apps connected to your account</p><p class="text-xs text-muted-foreground m-0">Sign in to an app once and your agent can use it on any device. Open an app to see the account it uses or to disconnect it.</p></div></div>
      <section class="flex flex-col gap-3"><div><h3><button>Apps</button></h3></div><div class="flex items-center justify-center gap-2 py-8 px-4"><span>Loading apps...</span></div><p data-testid="customizations-empty-state">No apps found for "Example".</p>
      <div data-testid="customization-card" class="relative flex items-center gap-3 p-3 rounded-xl"><div class="flex-1 min-w-0 flex flex-col gap-0.5 pr-4"><div class="font-medium text-sm text-foreground truncate">Connected apps</div><div class="text-xs text-muted-foreground truncate">Loading apps...</div></div><div class="relative z-10 flex-shrink-0 flex items-center"><button aria-label="Connect Example app">Connect</button></div></div></section></div></div>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="automation-kind-icon"]').getAttribute('title'), '在云端运行');
  assert.equal(doc.querySelector('[data-testid="automation-kind-icon"]').getAttribute('aria-label'), '在云端运行');
  assert.equal(doc.querySelector('[data-testid="plugins-source"]').getAttribute('aria-label'), '自定义内容来源');
  assert.equal(doc.querySelector('[data-testid="plugins-source-local"]').getAttribute('aria-label'), '此电脑');
  assert.equal(doc.querySelector('[data-testid="plugins-source-remote"]').getAttribute('aria-label'), '已连接的应用');
  assert.equal(doc.querySelector('[role="tooltip"] .font-medium').textContent, '已连接的应用');
  assert.equal(doc.querySelector('p.text-sm').textContent, '与账户连接的应用');
  assert.equal(doc.querySelector('h3 button').textContent, '应用');
  assert.equal(doc.querySelector('.justify-center span').textContent, '正在加载应用...');
  assert.equal(doc.querySelector('[data-testid="customizations-empty-state"]').textContent, '未找到与“Example”匹配的应用。');
  assert.equal(doc.querySelector('[data-testid="customization-card"] .truncate').textContent, 'Connected apps');
  assert.equal(doc.querySelector('[data-testid="customization-card"] .text-xs').textContent, 'Loading apps...');
  assert.equal(doc.querySelector('[data-testid="customization-card"] button').textContent, '连接');
  assert.equal(doc.querySelector('[data-testid="customization-card"] button').getAttribute('aria-label'), '连接 Example app');
  dom.window.close();
});
