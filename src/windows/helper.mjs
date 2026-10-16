import path from 'node:path';
import * as fs from 'node:fs/promises';
import { open } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { quotePowerShell, runPowerShell } from './powershell.mjs';

const execute = promisify(execFile);
const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const directories = ['bin', 'src', 'runtime', 'locales'];

function dDirectory(value) {
  const resolved = path.win32.normalize(value);
  if (!/^D:\\.+/i.test(resolved) || /[\x00-\x1f"<>|?*]/.test(resolved)
    || resolved.slice(2).includes(':')) {
    throw new Error('工作目录必须为 D 盘内的独立目录。');
  }
  return resolved.replace(/\\+$/, '');
}

export function windowsHelperPaths(workDir = 'D:\\agy-zh-win64') {
  const root = dDirectory(workDir);
  const installation = path.win32.join(root, 'assistant');
  return {
    workDir: root, installation, entry: path.win32.join(installation, 'bin', 'agy-zh.mjs'),
    stateFile: path.win32.join(root, 'helper.json'),
    stdout: path.win32.join(root, 'logs', 'helper.stdout.log'),
    stderr: path.win32.join(root, 'logs', 'helper.stderr.log'),
    temporary: path.win32.join(root, 'tmp'),
    nodeCache: path.win32.join(root, 'cache', 'node'),
    npmCache: path.win32.join(root, 'cache', 'npm'),
  };
}

export function windowsHelperEnvironment(paths, inherited = process.env) {
  const environment = Object.fromEntries(Object.entries(inherited).filter(([name]) =>
    !['TEMP', 'TMP', 'NODE_COMPILE_CACHE', 'NPM_CONFIG_CACHE', 'PSMODULEANALYSISCACHEPATH'].includes(name.toUpperCase())));
  return { ...environment, TEMP: paths.temporary, TMP: paths.temporary,
    NODE_COMPILE_CACHE: paths.nodeCache, npm_config_cache: paths.npmCache,
    PSModuleAnalysisCachePath: path.win32.join(path.win32.dirname(paths.nodeCache), 'powershell-analysis') };
}

export function windowsWatchArguments(paths, appPath, userDataPath, entry = paths.entry) {
  if (!appPath || !path.win32.isAbsolute(appPath)) throw new Error('请指定 Antigravity.exe 的完整路径。');
  const args = [entry, 'watch', '--app', path.win32.normalize(appPath), '--work-dir', paths.workDir];
  if (userDataPath) args.push('--user-data-dir', dDirectory(userDataPath));
  return args;
}

function quoteWindowsArgument(value) {
  if (!/[\s"]/.test(value)) return value;
  return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/\\+$/, '$&$&') + '"';
}

export function helperProcessScript(paths, record, action = 'status') {
  if (!Number.isSafeInteger(record.pid) || record.pid < 1
    || path.win32.basename(record.nodePath || '').toLowerCase() !== 'node.exe') {
    throw new Error('助手进程记录无效。');
  }
  const args = windowsWatchArguments(paths, record.appPath, record.userDataPath);
  const command = [record.nodePath, ...args].map(quoteWindowsArgument).join(' ');
  const stop = action === 'stop' ? 'Stop-Process -Id $p.ProcessId -ErrorAction Stop; ' : '';
  return `$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${record.pid}'; `
    + `$owned = $null -ne $p -and $p.ExecutablePath -ieq ${quotePowerShell(record.nodePath)} `
    + `-and $p.CommandLine -ceq ${quotePowerShell(command)}; `
    + `if ($owned) { ${stop}'true' } else { 'false' }`;
}

function environment(options) {
  const paths = windowsHelperPaths(options.workDir);
  return { paths, io: options.io ?? fs, execute: options.execute ?? execute,
    root: options.root ?? sourceRoot, nodePath: options.nodePath ?? process.execPath,
    launch: options.launch ?? launchBackground,
    control: options.control ?? (async (record, action) =>
      (await runPowerShell(helperProcessScript(paths, record, action))) === 'true') };
}

async function readRecord(env) {
  try { return JSON.parse(await env.io.readFile(env.paths.stateFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
}

async function ownsProcess(env, record, action = 'status') {
  if (!record) return false;
  helperProcessScript(env.paths, record, action);
  return env.control(record, action);
}

export async function windowsHelperStatus(options = {}) {
  const env = environment(options);
  const record = await readRecord(env);
  const loaded = await ownsProcess(env, record);
  return { ...env.paths, loaded, pid: loaded ? record.pid : null };
}

async function launchBackground(nodePath, args, options) {
  const stdout = await open(options.stdout, 'a');
  const stderr = await open(options.stderr, 'a');
  try {
    const child = spawn(nodePath, args, { cwd: options.cwd, env: options.env,
      detached: true, windowsHide: true, stdio: ['ignore', stdout.fd, stderr.fd] });
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.unref();
    return child.pid;
  } finally { await stdout.close(); await stderr.close(); }
}

async function preparePaths(env) {
  await env.io.mkdir(env.paths.workDir, { recursive: true });
  dDirectory(await env.io.realpath(env.paths.workDir));
  for (const target of [env.paths.temporary, env.paths.nodeCache, env.paths.npmCache,
    path.win32.dirname(env.paths.stdout)]) {
    await env.io.mkdir(target, { recursive: true });
    dDirectory(await env.io.realpath(target));
  }
}

async function prepareBundle(env, staging, options) {
  for (const directory of directories) {
    await env.io.cp(path.join(env.root, directory), path.win32.join(staging, directory), { recursive: true });
  }
  const entry = path.win32.join(staging, 'bin', 'agy-zh.mjs');
  const args = windowsWatchArguments(env.paths, options.appPath, options.userDataPath, entry);
  try {
    await env.execute(env.nodePath, [...args, '--dry-run'], { cwd: staging,
      env: windowsHelperEnvironment(env.paths), timeout: 30000, maxBuffer: 65536, windowsHide: true });
  } catch {
    throw new Error('Windows 汉化助手副本检查失败，请先运行 watch --dry-run。');
  }
}

async function startHelper(env, options) {
  const args = windowsWatchArguments(env.paths, options.appPath, options.userDataPath);
  const pid = await env.launch(env.nodePath, args, { ...env.paths, cwd: env.paths.installation,
    env: windowsHelperEnvironment(env.paths) });
  const record = { pid, nodePath: env.nodePath, appPath: options.appPath, userDataPath: options.userDataPath };
  try {
    await env.io.writeFile(env.paths.stateFile, JSON.stringify(record) + '\n');
    if (!(await ownsProcess(env, record))) throw new Error('Windows 汉化助手未能保持运行，请查看 D 盘助手日志。');
  } catch (error) { await ownsProcess(env, record, 'stop'); throw error; }
  return record;
}

async function replaceBundle(env, staging, options) {
  const previous = await readRecord(env);
  const backup = `${staging}.previous`;
  let backedUp = false;
  let activated = false;
  const wasLoaded = await ownsProcess(env, previous);
  try {
    await ownsProcess(env, previous, 'stop');
    try { await env.io.rename(env.paths.installation, backup); backedUp = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await env.io.rename(staging, env.paths.installation);
    activated = true;
    await startHelper(env, options);
  } catch (error) {
    const record = await readRecord(env);
    if (activated) {
      await ownsProcess(env, record, 'stop');
      await env.io.rm(env.paths.installation, { recursive: true, force: true });
    }
    if (backedUp) await env.io.rename(backup, env.paths.installation);
    await env.io.rm(env.paths.stateFile, { force: true });
    if (wasLoaded) await startHelper(env, previous);
    throw error;
  }
  if (backedUp) await env.io.rm(backup, { recursive: true, force: true });
}

export async function enableWindowsHelper({ dryRun = false, ...options } = {}) {
  const env = environment(options);
  windowsWatchArguments(env.paths, options.appPath, options.userDataPath);
  const plan = { ...env.paths, appPath: options.appPath };
  if (dryRun) return { ...plan, state: 'would-enable' };
  await preparePaths(env);
  const staging = await env.io.mkdtemp(path.win32.join(env.paths.workDir, '.assistant-'));
  try {
    await prepareBundle(env, staging, options);
    await replaceBundle(env, staging, options);
  } finally { await env.io.rm(staging, { recursive: true, force: true }); }
  return { ...plan, state: 'enabled' };
}

export async function disableWindowsHelper({ dryRun = false, ...options } = {}) {
  const env = environment(options);
  if (dryRun) return { ...env.paths, state: 'would-disable' };
  await ownsProcess(env, await readRecord(env), 'stop');
  await env.io.rm(env.paths.stateFile, { force: true });
  return { ...env.paths, state: 'disabled' };
}
