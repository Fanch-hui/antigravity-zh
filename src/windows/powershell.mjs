import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execute = promisify(execFile);

export function quotePowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function powerShellArguments(script) {
  const source = "$ErrorActionPreference = 'Stop'; "
    + '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); '
    + script;
  return ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(source, 'utf16le').toString('base64')];
}

export async function runPowerShell(script, { run = execute } = {}) {
  const executable = path.win32.join(process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { stdout } = await run(executable, powerShellArguments(script), {
    windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
  });
  return stdout.replace(/^\uFEFF/, '').trim();
}

export function parsePowerShellJson(output) {
  const value = JSON.parse(output || '[]');
  return Array.isArray(value) ? value : [value];
}
