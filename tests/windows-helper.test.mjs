import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import {
  windowsHelperPaths, windowsHelperEnvironment, windowsWatchArguments, helperProcessScript,
  enableWindowsHelper, disableWindowsHelper, windowsHelperStatus,
} from '../src/windows/helper.mjs';

const workDir = 'D:\\汉化 测试';
const appPath = 'C:\\Program Files\\Antigravity\\Antigravity.exe';
const nodePath = 'D:\\Node Runtime\\node.exe';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agy-windows-helper-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source');
  for (const name of ['bin', 'src', 'runtime', 'locales']) {
    await fs.mkdir(path.join(root, name), { recursive: true });
    await fs.writeFile(path.join(root, name, 'sample.txt'), 'original');
  }
  const local = value => {
    assert.match(value, /^D:\\.+/i);
    const relative = path.win32.relative('D:\\', value);
    assert.ok(!relative.startsWith('..'));
    return path.join(directory, 'drive-d', ...relative.split('\\'));
  };
  const io = {
    mkdir: (name, options) => fs.mkdir(local(name), options),
    readFile: (name, options) => fs.readFile(local(name), options),
    writeFile: (name, value) => fs.writeFile(local(name), value),
    rename: (from, to) => fs.rename(local(from), local(to)),
    rm: (name, options) => fs.rm(local(name), options),
    cp: (from, to, options) => fs.cp(from, local(to), options),
    realpath: async name => { await fs.realpath(local(name)); return name; },
    mkdtemp: async prefix => {
      const result = await fs.mkdtemp(local(prefix));
      return path.win32.join(path.win32.dirname(prefix), path.basename(result));
    },
  };
  let nextPid = 100;
  const processes = new Map();
  const launches = [];
  const execute = async (exe, args, options) => {
    assert.equal(exe, nodePath);
    assert.equal(args.at(-1), '--dry-run');
    assert.ok(args.includes('--work-dir'));
    assert.equal(options.env.TEMP, windowsHelperPaths(workDir).temporary);
    assert.ok(await fs.readFile(local(path.win32.join(options.cwd, 'runtime', 'sample.txt'))));
  };
  const launch = async (exe, args, options) => {
    const pid = nextPid++;
    launches.push({ exe, args, options });
    processes.set(pid, { exe, args });
    return pid;
  };
  const control = async (record, action) => {
    const actual = processes.get(record.pid);
    const args = windowsWatchArguments(windowsHelperPaths(workDir), record.appPath, record.userDataPath);
    const owned = actual?.exe === record.nodePath && JSON.stringify(actual.args) === JSON.stringify(args);
    if (owned && action === 'stop') processes.delete(record.pid);
    return owned;
  };
  return { workDir, appPath, nodePath, root, io, execute, launch, control, processes, launches, local };
}

test('Windows helper confines generated paths and supplied user-data directories to D', () => {
  for (const value of ['C:\\temp', 'D:\\', 'D:\\..\\', '\\\\server\\share', 'D:relative', 'D:\\cache:other']) {
    assert.throws(() => windowsHelperPaths(value), /D 盘/);
  }
  const paths = windowsHelperPaths(workDir);
  for (const value of Object.values(paths)) assert.match(value, /^D:\\/);
  const env = windowsHelperEnvironment(paths, { HOME: 'original', USERPROFILE: 'original-profile',
    Temp: 'C:\\temp', NPM_CONFIG_CACHE: 'C:\\npm-cache' });
  assert.equal(env.HOME, 'original');
  assert.equal(env.USERPROFILE, 'original-profile');
  assert.equal(env.Temp, undefined);
  assert.equal(env.NPM_CONFIG_CACHE, undefined);
  for (const key of ['TEMP', 'TMP', 'NODE_COMPILE_CACHE', 'npm_config_cache']) assert.match(env[key], /^D:\\/);
  assert.deepEqual(windowsWatchArguments(paths, appPath, 'D:\\profiles\\validation'), [
    paths.entry, 'watch', '--app', appPath, '--work-dir', workDir, '--user-data-dir', 'D:\\profiles\\validation',
  ]);
  assert.throws(() => windowsWatchArguments(paths, appPath, 'C:\\profile'), /D 盘/);
});

test('process control checks executable and full helper watch arguments before stopping its PID', () => {
  const paths = windowsHelperPaths(workDir);
  const script = helperProcessScript(paths, { pid: 123, nodePath, appPath }, 'stop');
  assert.match(script, /Get-CimInstance Win32_Process -Filter 'ProcessId = 123'/);
  assert.match(script, /ExecutablePath -ieq 'D:\\Node Runtime\\node.exe'/);
  assert.ok(script.includes('"D:\\汉化 测试\\assistant\\bin\\agy-zh.mjs" watch --app'));
  assert.ok(script.includes('--work-dir "D:\\汉化 测试"'));
  assert.match(script, /if \(\$owned\) \{ Stop-Process -Id \$p.ProcessId/);
  assert.doesNotMatch(script, /Write-Output.*CommandLine/);
  assert.throws(() => helperProcessScript(paths, { pid: '123; other', nodePath, appPath }), /记录无效/);
});

test('dry-run does not create directories, launch or manage processes', async () => {
  const unexpected = async () => { throw new Error('unexpected action'); };
  const options = { workDir, appPath, io: { mkdir: unexpected }, launch: unexpected, control: unexpected, dryRun: true };
  assert.equal((await enableWindowsHelper(options)).state, 'would-enable');
  assert.equal((await disableWindowsHelper(options)).state, 'would-disable');
});

test('enable replaces its packaged helper and repeated enable leaves one managed process', async t => {
  const options = await fixture(t);
  const first = await enableWindowsHelper(options);
  assert.equal(first.state, 'enabled');
  assert.equal((await windowsHelperStatus(options)).loaded, true);
  await fs.writeFile(path.join(options.root, 'runtime', 'sample.txt'), 'updated');
  await enableWindowsHelper(options);
  assert.equal(options.processes.size, 1);
  assert.equal(await options.io.readFile(path.win32.join(first.installation, 'runtime', 'sample.txt'), 'utf8'), 'updated');
  assert.equal(options.launches[0].options.cwd, first.installation);
  assert.equal(options.launches[0].options.env.TMP, first.temporary);
  await disableWindowsHelper(options);
  await disableWindowsHelper(options);
  assert.equal((await windowsHelperStatus(options)).loaded, false);
  assert.equal(options.processes.size, 0);
});

test('a stale PID belonging to unrelated Node arguments is not stopped', async t => {
  const options = await fixture(t);
  await enableWindowsHelper(options);
  const paths = windowsHelperPaths(workDir);
  const record = JSON.parse(await options.io.readFile(paths.stateFile, 'utf8'));
  options.processes.set(record.pid, { exe: nodePath, args: ['D:\\other-service.mjs', 'watch'] });
  assert.equal((await windowsHelperStatus(options)).loaded, false);
  await disableWindowsHelper(options);
  assert.equal(options.processes.size, 1);
});

test('failed staging validation preserves the existing helper and running process', async t => {
  const options = await fixture(t);
  const first = await enableWindowsHelper(options);
  const before = (await windowsHelperStatus(options)).pid;
  await assert.rejects(enableWindowsHelper({ ...options, execute: async () => { throw new Error('invalid'); } }), /副本检查失败/);
  assert.equal((await windowsHelperStatus(options)).pid, before);
  assert.equal(await options.io.readFile(path.win32.join(first.installation, 'runtime', 'sample.txt'), 'utf8'), 'original');
  assert.deepEqual((await fs.readdir(options.local(workDir))).sort(), ['assistant', 'cache', 'helper.json', 'logs', 'tmp']);
});

test('D drive directory junction resolving to another drive is rejected', async t => {
  const options = await fixture(t);
  options.io.realpath = async () => 'C:\\redirected';
  await assert.rejects(enableWindowsHelper(options), /D 盘/);
  assert.equal(options.launches.length, 0);
});
