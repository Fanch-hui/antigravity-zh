import { validateApp, hasVerifiedFingerprint } from './app-info.mjs';
import { appActivePortFile, discoverAppSession } from './active-session.mjs';
import { runInjection } from './target-injection.mjs';
import { watchActivePort } from './startup-wakeup.mjs';

function beginSession(found, script, inject, { onReady, checkUi, onTiming, startedAt }) {
  const controller = new AbortController();
  const session = { ...found, controller, finished: false, error: null };
  const offset = Date.now() - startedAt;
  session.done = inject({ port: found.port, script, signal: controller.signal, onReady, checkUi,
    onTiming: event => onTiming({ ...event, elapsedMs: offset + event.elapsedMs }) })
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
  onTiming = () => {},
  interval = 2000, retryDelay = 10000, discover = discoverAppSession,
  validate = validateApp, inject = runInjection, workDir, userDataPath,
  createWakeup = watchActivePort } = {}) {
  if (typeof script !== 'string' || !script.trim()) throw new Error('汉化脚本为空。');
  const wakeup = createWakeup(appActivePortFile({ userDataPath }));
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
          const startedAt = Date.now();
          onTiming({ stage: 'app-found', elapsedMs: 0 });
          onTiming({ stage: 'validation-start', elapsedMs: 0 });
          try {
            checkedApp = { pid: found.pid, info: await validate(appPath, { workDir }), startedAt };
            onTiming({ stage: 'validation-complete', elapsedMs: Date.now() - startedAt });
            retryAt = 0;
          }
          catch (error) { blockedPid = found.pid; report(error); }
        }
        if (found && !session && checkedApp?.pid === found.pid && Date.now() >= retryAt) {
          session = beginSession(found, script, inject, {
            onReady: () => { lastError = ''; onReady(); },
            checkUi: !hasVerifiedFingerprint(checkedApp.info ?? {}),
            onTiming, startedAt: checkedApp.startedAt,
          });
        }
      } catch (error) { report(error); }
      await wakeup.wait(interval, signal);
    }
  } finally { wakeup.close(); await stopSession(session); }
}
