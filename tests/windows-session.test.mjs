import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { powerShellArguments, quotePowerShell, runPowerShell } from '../src/windows/powershell.mjs';
import { listWindowsAppProcesses, parseWindowsAppProcesses } from '../src/windows/processes.mjs';
import { discoverWindowsAppSession, parseWindowsLoopbackListeners } from '../src/windows/active-session.mjs';

const app = 'D:\\应用\\Antigravity';
const exe = `${app}\\Antigravity.exe`;

test('PowerShell receives UTF-16LE encoded commands without profiles or shell interpolation', async () => {
  const script = `$value = ${quotePowerShell("D:\\汉化\\O'Brien")}; $value`;
  const args = powerShellArguments(script);
  assert.deepEqual(args.slice(0, 4), ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand']);
  const source = Buffer.from(args[4], 'base64').toString('utf16le');
  assert.ok(source.includes("'D:\\汉化\\O''Brien'"));
  assert.ok(source.includes('[Console]::OutputEncoding'));
  const output = await runPowerShell(script, { run: async (command, passed, options) => {
    assert.match(command, /powershell\.exe$/i);
    assert.deepEqual(passed, args);
    assert.equal(options.windowsHide, true);
    return { stdout: '\uFEFF[]\r\n' };
  } });
  assert.equal(output, '[]');
});

test('Windows process metadata matches only the selected executable regardless of case', async () => {
  const rows = [{ pid: 12, path: exe.toUpperCase(), CommandLine: 'not returned' },
    { pid: 13, path: 'D:\\Other\\Antigravity.exe' }, { pid: 0, path: exe }];
  assert.deepEqual(parseWindowsAppProcesses(JSON.stringify(rows), app),
    [{ pid: 12, path: exe.toUpperCase() }]);
  const actual = await listWindowsAppProcesses(app, { mainOnly: true, run: async script => {
    assert.ok(script.includes('$_.ExecutablePath -ieq $expected'));
    assert.ok(script.includes("$_.CommandLine -notmatch '(?i)(?:^|\\s)--type='"));
    assert.ok(!script.includes('CommandLine ='));
    return JSON.stringify(rows);
  } });
  assert.deepEqual(actual, [{ pid: 12, path: exe.toUpperCase() }]);
});

test('Windows listeners require both the main process owner and IPv4 loopback', () => {
  const rows = [{ pid: 12, address: '127.0.0.1', port: 51215 },
    { pid: 13, address: '127.0.0.1', port: 51215 },
    { pid: 12, address: '0.0.0.0', port: 51215 },
    { pid: 12, address: '::1', port: 51215 },
    { pid: 12, address: '127.0.0.1', port: 65536 }];
  assert.deepEqual(parseWindowsLoopbackListeners(JSON.stringify(rows), [12]),
    [{ pid: 12, port: 51215 }]);
});

test('Windows session matches the first DevToolsActivePort line to its verified main process', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'agy-win-session-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'DevToolsActivePort'), '51215\r\nignored-browser-id\n');
  let owner = 12;
  const run = async script => {
    if (script.includes('Get-CimInstance')) return JSON.stringify([{ pid: 12, path: exe }]);
    assert.ok(script.includes('Get-NetTCPConnection -State Listen'));
    return JSON.stringify([{ pid: owner, address: '127.0.0.1', port: 51215 }]);
  };
  assert.deepEqual(await discoverWindowsAppSession(app, { userDataPath: directory, run }),
    { pid: 12, port: 51215 });
  owner = 99;
  assert.equal(await discoverWindowsAppSession(app, { userDataPath: directory, run }), null);
});
