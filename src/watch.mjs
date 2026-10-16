import { setTimeout as delay } from 'node:timers/promises';
import { validateApp, hasVerifiedFingerprint } from './app-info.mjs';
import { discoverAppSession } from './active-session.mjs';
import { runInjection } from './target-injection.mjs';

function beginSession(found, script, inject, onReady, checkUi) {
  const controller = new AbortController();
  const session = { ...found, controller, finished: false, error: null };
  session.done = inject({ port: found.port, script, signal: controller.signal, onReady, checkUi })
    .catch(error => { session.error = error; })
    .finally(() => { session.finished = true; });
  return session;
}

async function stopSession(session) {
  if (!session) return;
  session.controller.abort();
  await session.done;
}

export async function watchApp(appPath, { script, signal, onReady = () => {}, onError = () => {},
  interval = 2000, retryDelay = 10000, discover = discoverAppSession,
  validate = validateApp, inject = runInjection, workDir, userDataPath } = {}) {
  if (typeof script !== 'string' || !script.trim()) throw new Error('汉化脚本为空。');
  let session = null;
  let checkedApp = null;
  let blockedPid = null;
  let retryAt = 0;
  let lastError = '';
  const report = error => {
    if (error.message !== lastError) onError(error);
    lastError = error.message;
  };
  try {
    while (!signal.aborted) {
      try {
        const found = await discover(appPath, { userDataPath });
        if (session && (!found || session.pid !== found.pid || session.port !== found.port || session.finished)) {
          if (session.error) { report(session.error); retryAt = Date.now() + retryDelay; }
          await stopSession(session);
          session = null;
        }
        if (!found) { checkedApp = null; blockedPid = null; retryAt = 0; }
        if (found && found.pid !== checkedApp?.pid && found.pid !== blockedPid) {
          try { checkedApp = { pid: found.pid, info: await validate(appPath, { workDir }) }; retryAt = 0; }
          catch (error) { blockedPid = found.pid; report(error); }
        }
        if (found && !session && checkedApp?.pid === found.pid && Date.now() >= retryAt) {
          session = beginSession(found, script, inject, () => { lastError = ''; onReady(); },
            !hasVerifiedFingerprint(checkedApp.info ?? {}));
        }
      } catch (error) { report(error); }
      await delay(interval, undefined, { signal }).catch(error => {
        if (error.name !== 'AbortError') throw error;
      });
    }
  } finally { await stopSession(session); }
}
