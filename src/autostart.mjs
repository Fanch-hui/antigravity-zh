import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

const execute = promisify(execFile);
export const AUTOSTART_LABEL = 'local.agy-zh.auto';
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const directories = ['bin', 'src', 'runtime', 'locales'];

export function autostartPaths(home = os.homedir()) {
  const support = path.join(home, 'Library', 'Application Support');
  const installation = path.join(support, 'Antigravity中文助手');
  return {
    installation,
    plist: path.join(home, 'Library', 'LaunchAgents', `${AUTOSTART_LABEL}.plist`),
    stdout: path.join(installation, 'assistant.stdout.log'),
    stderr: path.join(installation, 'assistant.stderr.log'),
  };
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

export function launchAgentPlist(paths, appPath, nodePath = process.execPath) {
  const args = [nodePath, path.join(paths.installation, 'bin', 'agy-zh.mjs'), 'watch', '--app', path.resolve(appPath)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${AUTOSTART_LABEL}</string>
<key>ProgramArguments</key><array>${args.map((value) => `<string>${escapeXml(value)}</string>`).join('')}</array>
<key>WorkingDirectory</key><string>${escapeXml(paths.installation)}</string>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>StandardOutPath</key><string>${escapeXml(paths.stdout)}</string>
<key>StandardErrorPath</key><string>${escapeXml(paths.stderr)}</string>
</dict></plist>
`;
}

async function exists(target) {
  try { await access(target); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function launchctl(args) {
  return new Promise((resolve, reject) => {
    // launchctl print includes inherited environment values; its output is unnecessary.
    const child = spawn('/bin/launchctl', args, { stdio: 'ignore', timeout: 15_000 });
    child.once('error', () => reject(new Error('无法执行 macOS 登录服务管理命令。')));
    child.once('exit', code => resolve({ ok: code === 0, code }));
  });
}

function environment(options = {}) {
  return {
    paths: autostartPaths(options.home),
    root: options.root ?? sourceRoot,
    nodePath: options.nodePath ?? stableNodePath(),
    control: options.control ?? launchctl,
    domain: `gui/${options.uid ?? process.getuid()}`,
  };
}

function stableNodePath() {
  const brew = process.execPath.match(/^(\/opt\/homebrew|\/usr\/local)\/Cellar\/(node(?:@\d+)?)\/[^/]+\/bin\/node$/);
  if (!brew) return process.execPath;
  const candidate = path.join(brew[1], 'opt', brew[2], 'bin/node');
  try { if (realpathSync(candidate) === realpathSync(process.execPath)) return candidate; }
  catch { /* A standalone Node installation can use its original executable path. */ }
  return process.execPath;
}

async function loaded(env) {
  return (await env.control(['print', `${env.domain}/${AUTOSTART_LABEL}`])).ok;
}

async function command(env, args, message) {
  const result = await env.control(args);
  if (!result.ok) throw new Error(`${message}（launchctl 状态 ${result.code ?? '未知'}）。`);
}

async function stopService(env, message) {
  await command(env, ['bootout', `${env.domain}/${AUTOSTART_LABEL}`], message);
  const deadline = Date.now() + 5000;
  while (await loaded(env)) {
    if (Date.now() >= deadline) throw new Error('自动汉化服务尚未完成停止。');
    await delay(50);
  }
}

async function startService(env, message) {
  const args = ['bootstrap', env.domain, env.paths.plist];
  let result = await env.control(args);
  // launchd can briefly reject re-registration after bootout even when the files are valid.
  if (!result.ok && result.code === 5 && !(await loaded(env))) {
    await delay(250);
    result = await env.control(args);
  }
  if (!result.ok) throw new Error(`${message}（launchctl 状态 ${result.code ?? '未知'}）。`);
}

export async function autostartStatus(options = {}) {
  const env = environment(options);
  return { ...env.paths, installed: await exists(env.paths.plist), loaded: await loaded(env) };
}

export async function prepareAutostartBundle({ root, stagingPath, nodePath, appPath }) {
  for (const directory of directories) {
    await cp(path.join(root, directory), path.join(stagingPath, directory), { recursive: true });
  }
  try {
    await execute(nodePath, [path.join(stagingPath, 'bin', 'agy-zh.mjs'), 'watch', '--dry-run', '--app', appPath], {
      cwd: stagingPath, timeout: 30_000, maxBuffer: 64 * 1024,
    });
  } catch {
    throw new Error('自动汉化助手副本检查失败；请先运行 watch --dry-run 核对应用兼容性。');
  }
}

function installationPlan(env, appPath) {
  return {
    ...env.paths, appPath, label: AUTOSTART_LABEL,
    actions: ['准备并检查独立助手副本', '更新助手及登录启动文件', '重新加载本用户的自动汉化服务'],
  };
}

async function restoreInstallation(env, state) {
  if (state.replaced) await rm(env.paths.installation, { recursive: true, force: true });
  if (state.backedUp) await rename(state.backup, env.paths.installation);
  if (state.plistChanged) {
    if (state.previousPlist) await writeFile(env.paths.plist, state.previousPlist, { mode: 0o600 });
    else await rm(env.paths.plist, { force: true });
  }
  if (state.stopped && state.wasLoaded) {
    await startService(env, '恢复原自动汉化服务失败');
  }
}

async function activateInstallation(env, staging, plist, state) {
  if (state.wasLoaded) {
    await stopService(env, '停止原自动汉化服务失败');
    state.stopped = true;
  }
  if (await exists(env.paths.installation)) {
    await rename(env.paths.installation, state.backup);
    state.backedUp = true;
  }
  await rename(staging, env.paths.installation);
  state.replaced = true;
  await rename(plist, env.paths.plist);
  state.plistChanged = true;
  await startService(env, '启用自动汉化服务失败');
}

export async function enableAutostart({ appPath = '/Applications/Antigravity.app', dryRun = false, ...options } = {}) {
  const env = environment(options);
  appPath = path.resolve(appPath);
  const plan = installationPlan(env, appPath);
  if (dryRun) return { ...plan, state: 'would-enable' };
  await mkdir(path.dirname(env.paths.installation), { recursive: true });
  await mkdir(path.dirname(env.paths.plist), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(env.paths.installation), '.agy-zh-'));
  const temporaryPlist = `${staging}.plist`;
  const state = { backup: `${staging}.previous`, wasLoaded: false };
  try {
    await prepareAutostartBundle({ root: env.root, stagingPath: staging, nodePath: env.nodePath, appPath });
    await writeFile(temporaryPlist, launchAgentPlist(env.paths, appPath, env.nodePath), { mode: 0o600 });
    state.previousPlist = await exists(env.paths.plist) ? await readFile(env.paths.plist) : null;
    state.wasLoaded = await loaded(env);
    await activateInstallation(env, staging, temporaryPlist, state);
  } catch (error) {
    try { await restoreInstallation(env, state); }
    catch (restoreError) { throw new Error(`${error.message} ${restoreError.message}`, { cause: error }); }
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(temporaryPlist, { force: true });
  }
  if (state.backedUp) await rm(state.backup, { recursive: true, force: true });
  return { ...plan, state: 'enabled' };
}

export async function disableAutostart({ dryRun = false, ...options } = {}) {
  const env = environment(options);
  const plan = { ...env.paths, label: AUTOSTART_LABEL, actions: ['停止本用户的自动汉化服务', '删除本助手的登录启动文件'] };
  if (dryRun) return { ...plan, state: 'would-disable' };
  if (await loaded(env)) {
    await stopService(env, '停止自动汉化服务失败');
  }
  await rm(env.paths.plist, { force: true });
  return { ...plan, state: 'disabled' };
}
