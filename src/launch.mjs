import { inspectApp, assertCompatibleApp } from './app-info.mjs';
import { listAppProcesses } from './processes.mjs';
import { allocatePort, startApp } from './launch-process.mjs';
import { runInjection } from './target-injection.mjs';

export async function launchApp(appPath, { script, dryRun = false } = {}) {
  const app = await inspectApp(appPath);
  assertCompatibleApp(app);
  if ((await listAppProcesses(app.path)).length) {
    throw new Error('请先完全退出 Antigravity，再通过汉化入口启动。');
  }
  if (dryRun) return { state: 'would-launch', app };
  if (typeof script !== 'string' || !script.trim()) throw new Error('汉化脚本为空。');
  const port = await allocatePort();
  const { exited } = startApp(app.executablePath, port);
  const controller = new AbortController();
  let release;
  const closed = new Promise(resolve => { release = resolve; });
  const close = () => { controller.abort(); release(); };
  let markReady;
  const ready = new Promise(resolve => { markReady = resolve; });
  const injecting = runInjection({ port, script, signal: controller.signal, onReady: markReady });
  const done = Promise.race([exited, closed, injecting]).finally(async () => {
    close();
    await injecting.catch(() => {});
  });
  done.catch(() => {});
  await Promise.race([ready, done.then(() => {
    throw new Error('Antigravity 在汉化连接建立前退出。');
  })]);
  return { state: 'launched', app, done, close };
}
