import { CdpClient } from './cdp-client.mjs';
import { assertUiCompatibility } from './ui-compatibility.mjs';
import { isAppPath } from './app-page.mjs';

export function isAppTarget(target, debugPort) {
  if (target.type !== 'page' || typeof target.id !== 'string') return false;
  try {
    const page = new URL(target.url);
    const socket = new URL(target.webSocketDebuggerUrl);
    return page.protocol === 'https:' && page.hostname === '127.0.0.1'
      && Boolean(page.port) && isAppPath(page.pathname) && !page.username && !page.password
      && socket.protocol === 'ws:' && socket.hostname === '127.0.0.1'
      && socket.port === String(debugPort) && !socket.username && !socket.password;
  } catch { return false; }
}

export function scopedScript(script, origin) {
  return `(() => {
${isAppPath.toString()}
function loadChinese() {
  if (window.top !== window || location.origin !== ${JSON.stringify(origin)} || !isAppPath(location.pathname)) {
    window.__AGY_ZH_BOOT__ = 'outside-app'; return;
  }
  window.__AGY_ZH_BOOT__ = 'initializing';
  try {
${script}
    window.__AGY_ZH_BOOT__ = window.__AGY_ZH_RUNTIME__ ? 'ready' : 'runtime-pending';
  } catch (error) { window.__AGY_ZH_BOOT__ = 'initialization-error'; throw error; }
}
if (document.readyState === 'loading') {
  window.__AGY_ZH_BOOT__ = 'document-loading';
  document.addEventListener('DOMContentLoaded', loadChinese, { once: true });
}
else loadChinese();
})();`;
}

async function listTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(2500), redirect: 'error',
  });
  if (!response.ok) throw new Error('应用汉化通道暂不可用。');
  const targets = await response.json();
  if (!Array.isArray(targets)) throw new Error('应用汉化通道格式不兼容。');
  return targets;
}

async function waitForUiCompatibility(client, origin, signal, timing) {
  const deadline = Date.now() + 20000;
  let waiting = false;
  timing('ui-check-start');
  while (!signal.aborted) {
    try {
      await assertUiCompatibility(client, origin);
      timing('ui-check-complete');
      return;
    } catch (error) {
      const navigating = ['AGY_APPLICATION_PAGE_PENDING', 'AGY_CDP_CONTEXT_NAVIGATING'].includes(error.code);
      if (!navigating || !client.isOpen || Date.now() >= deadline) throw error;
      if (!waiting) { waiting = true; timing('application-page-wait'); }
      await pause(150, signal);
    }
  }
  throw new Error('汉化连接已停止。');
}

async function injectTarget(target, script, signal, checkedOrigins, checkUi, timing) {
  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  timing('cdp-connected');
  const close = () => client.close();
  signal.addEventListener('abort', close, { once: true });
  try {
    if (signal.aborted) throw new Error('汉化连接已停止。');
    const origin = new URL(target.url).origin;
    if (checkUi && !checkedOrigins.has(origin)) {
      await waitForUiCompatibility(client, origin, signal, timing);
      checkedOrigins.add(origin);
    }
    if (signal.aborted) throw new Error('汉化连接已停止。');
    const source = scopedScript(script, origin);
    await client.call('Page.addScriptToEvaluateOnNewDocument', { source });
    timing('script-registered');
    const evaluated = await client.call('Runtime.evaluate', { expression: source, returnByValue: true });
    if (evaluated.exceptionDetails) throw new Error('界面汉化脚本执行失败。');
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const state = await client.call('Runtime.evaluate', {
        expression: 'Boolean(window.__AGY_ZH_RUNTIME__)', returnByValue: true,
      });
      if (state.result?.value === true) { timing('runtime-ready'); return client; }
      const retry = await client.call('Runtime.evaluate', { expression: source, returnByValue: true });
      if (retry.exceptionDetails) throw new Error('界面汉化模块初始化失败。');
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('汉化模块未能初始化，请重新启动中文入口。');
  } catch (error) {
    client.close();
    throw error;
  } finally { signal.removeEventListener('abort', close); }
}

function pause(milliseconds, signal) {
  return new Promise(resolve => {
    const timer = setTimeout(finish, milliseconds);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

export async function runInjection({ port, script, signal, onReady = () => {},
  interval = 1000, startupInterval = 150, checkUi = true, onTiming = () => {} }) {
  const sessions = new Map();
  const checkedOrigins = new Set();
  let unavailableSince = Date.now();
  const startedAt = Date.now();
  const timing = stage => onTiming({ stage, elapsedMs: Date.now() - startedAt });
  let ready = false;
  try {
    while (!signal.aborted) {
      let targets;
      try { targets = await listTargets(port); }
      catch {
        if (signal.aborted) break;
        if (Date.now() - unavailableSince > 20000) throw new Error('无法建立汉化连接，请退出 Antigravity 后重新启动汉化入口。');
        await pause(ready ? interval : Math.min(interval, startupInterval), signal);
        continue;
      }
      unavailableSince = Date.now();
      for (const [id, session] of sessions) {
        const target = targets.find(candidate => candidate.id === id);
        if (!target || !session.client.isOpen || !isAppTarget(target, port)
          || new URL(target.url).origin !== session.origin) {
          session.client.close();
          sessions.delete(id);
        }
      }
      for (const target of targets) {
        if (signal.aborted || !isAppTarget(target, port) || sessions.has(target.id)) continue;
        timing('target-found');
        const client = await injectTarget(target, script, signal, checkedOrigins, checkUi, timing);
        if (signal.aborted) { client.close(); break; }
        sessions.set(target.id, { client, origin: new URL(target.url).origin });
      }
      if (!ready && sessions.size) { ready = true; onReady(); }
      if (!ready && Date.now() - startedAt > 20000) {
        throw new Error('未找到 Antigravity 主界面，请退出应用后重新启动汉化入口。');
      }
      await pause(ready ? interval : Math.min(interval, startupInterval), signal);
    }
  } finally {
    for (const { client } of sessions.values()) client.close();
  }
}
