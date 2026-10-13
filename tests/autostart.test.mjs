import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  AUTOSTART_LABEL, autostartPaths, launchAgentPlist, prepareAutostartBundle,
  enableAutostart, disableAutostart, autostartStatus,
} from '../src/autostart.mjs';

const execute = promisify(execFile);

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'agy-autostart-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'project');
  for (const name of ['bin', 'src', 'runtime', 'locales', 'node_modules']) {
    await mkdir(path.join(root, name), { recursive: true });
  }
  await writeFile(path.join(root, 'package.json'), '{"private":true}');
  await writeFile(path.join(root, 'src', 'probe.mjs'), 'export const valid = true;');
  await writeFile(path.join(root, 'runtime', 'translator.js'), '/* runtime */');
  await writeFile(path.join(root, 'locales', 'desktop.json'), '[]');
  await writeFile(path.join(root, 'bin', 'agy-zh.mjs'), `
    import { valid } from '../src/probe.mjs';
    if (!valid || process.argv[2] !== 'watch' || !process.argv.includes('--dry-run') ||
        !process.argv.includes('--app')) process.exit(1);
  `);
  let active = false;
  const control = async (args) => {
    if (args[0] === 'print') return { ok: active, code: active ? 0 : 113 };
    if (args[0] === 'bootstrap') { active = true; return { ok: true }; }
    if (args[0] === 'bootout') {
      assert.equal(args[1], `gui/501/${AUTOSTART_LABEL}`);
      active = false;
      return { ok: true };
    }
    throw new Error(`Unexpected service action: ${args[0]}`);
  };
  return { directory, root, home: path.join(directory, 'home'), uid: 501, control, nodePath: process.execPath };
}

test('launchd plist preserves spaces and XML characters in paths', { skip: process.platform !== 'darwin' }, async (t) => {
  const { directory } = await fixture(t);
  const paths = autostartPaths(path.join(directory, '用户 & <测试> "Home"'));
  const appPath = '/Applications/Test & <App> "\'".app';
  const file = path.join(directory, 'assistant.plist');
  await writeFile(file, launchAgentPlist(paths, appPath));
  const { stdout } = await execute('/usr/bin/plutil', ['-convert', 'json', '-o', '-', file]);
  const plist = JSON.parse(stdout);
  assert.deepEqual(plist.ProgramArguments, [process.execPath, path.join(paths.installation, 'bin', 'agy-zh.mjs'), 'watch', '--app', appPath]);
  assert.equal(plist.Label, AUTOSTART_LABEL);
  assert.equal(plist.RunAtLoad, true);
  assert.equal(plist.KeepAlive, true);
  assert.equal(plist.ThrottleInterval, 30);
  assert.equal(plist.StandardOutPath, paths.stdout);
  assert.equal(plist.StandardErrorPath, paths.stderr);
});

test('bundle copies runtime directories and validates the independent CLI', async (t) => {
  const options = await fixture(t);
  const stagingPath = path.join(options.directory, 'stage');
  await mkdir(stagingPath);
  await prepareAutostartBundle({ ...options, stagingPath, appPath: '/Applications/Antigravity.app' });
  assert.deepEqual((await readdir(stagingPath)).sort(), ['bin', 'locales', 'runtime', 'src']);
  assert.equal(await readFile(path.join(stagingPath, 'src', 'probe.mjs'), 'utf8'), 'export const valid = true;');
});

test('dry-run reports exact paths without writing files or managing services', async (t) => {
  const options = await fixture(t);
  options.control = async () => { throw new Error('dry-run must not manage services'); };
  const enabled = await enableAutostart({ ...options, dryRun: true, appPath: '/Applications/Antigravity.app' });
  const disabled = await disableAutostart({ ...options, dryRun: true });
  assert.equal(enabled.state, 'would-enable');
  assert.equal(disabled.state, 'would-disable');
  assert.equal(enabled.plist, autostartPaths(options.home).plist);
  await assert.rejects(readFile(enabled.plist), { code: 'ENOENT' });
});

test('enable updates only the assistant and disable leaves its packaged code intact', async (t) => {
  const options = await fixture(t);
  const first = await enableAutostart(options);
  assert.equal(first.state, 'enabled');
  assert.equal((await autostartStatus(options)).loaded, true);
  await writeFile(path.join(options.root, 'runtime', 'translator.js'), '/* updated runtime */');
  await enableAutostart(options);
  assert.equal(await readFile(path.join(first.installation, 'runtime', 'translator.js'), 'utf8'), '/* updated runtime */');
  assert.deepEqual((await readdir(path.dirname(first.installation))).sort(), ['Antigravity中文助手']);
  await disableAutostart(options);
  await disableAutostart(options);
  const status = await autostartStatus(options);
  assert.equal(status.installed, false);
  assert.equal(status.loaded, false);
  assert.equal(await readFile(path.join(first.installation, 'runtime', 'translator.js'), 'utf8'), '/* updated runtime */');
});

test('failed validation preserves an already installed assistant and loaded service', async (t) => {
  const options = await fixture(t);
  const first = await enableAutostart(options);
  const previousPlist = await readFile(first.plist, 'utf8');
  await writeFile(path.join(options.root, 'bin', 'agy-zh.mjs'), 'process.exit(1);');
  await assert.rejects(enableAutostart(options), /副本检查失败/);
  assert.equal(await readFile(first.plist, 'utf8'), previousPlist);
  assert.equal((await autostartStatus(options)).loaded, true);
  assert.equal(await readFile(path.join(first.installation, 'runtime', 'translator.js'), 'utf8'), '/* runtime */');
  assert.deepEqual((await readdir(path.dirname(first.installation))).sort(), ['Antigravity中文助手']);
});

test('failed service activation restores the previous bundle, plist and service', async (t) => {
  const options = await fixture(t);
  const first = await enableAutostart(options);
  const previousPlist = await readFile(first.plist, 'utf8');
  await writeFile(path.join(options.root, 'runtime', 'translator.js'), '/* update */');
  let failedBootstraps = 0;
  const originalControl = options.control;
  options.control = async (args) => {
    if (args[0] === 'bootstrap' && failedBootstraps < 2) {
      failedBootstraps++;
      return { ok: false, code: 5 };
    }
    return originalControl(args);
  };
  await assert.rejects(enableAutostart(options), /启用自动汉化服务失败/);
  assert.equal(await readFile(first.plist, 'utf8'), previousPlist);
  assert.equal(await readFile(path.join(first.installation, 'runtime', 'translator.js'), 'utf8'), '/* runtime */');
  assert.equal((await autostartStatus(options)).loaded, true);
  assert.deepEqual((await readdir(path.dirname(first.installation))).sort(), ['Antigravity中文助手']);
});

test('a transient reload error preserves the newly installed assistant after registration settles', async (t) => {
  const options = await fixture(t);
  const first = await enableAutostart(options);
  await writeFile(path.join(options.root, 'runtime', 'translator.js'), '/* updated runtime */');
  let pendingRegistration = true;
  const originalControl = options.control;
  options.control = async args => {
    if (args[0] === 'bootstrap' && pendingRegistration) {
      pendingRegistration = false;
      return { ok: false, code: 5 };
    }
    return originalControl(args);
  };
  assert.equal((await enableAutostart(options)).state, 'enabled');
  assert.equal(await readFile(path.join(first.installation, 'runtime', 'translator.js'), 'utf8'), '/* updated runtime */');
  assert.equal((await autostartStatus(options)).loaded, true);
  assert.deepEqual((await readdir(path.dirname(first.installation))).sort(), ['Antigravity中文助手']);
});
