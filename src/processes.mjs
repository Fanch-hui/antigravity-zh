import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { listWindowsAppProcesses } from './windows/processes.mjs';

const run = promisify(execFile);

export async function listAppProcesses(appPath) {
  if (process.platform === 'win32') return listWindowsAppProcesses(appPath);
  const resolved = await realpath(appPath);
  const { stdout } = await run('/bin/ps', ['-ww', '-axo', 'pid=,comm=']);
  const roots = [...new Set([path.resolve(appPath), resolved])];
  return stdout.split('\n').flatMap(line => {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    return match && roots.some(root => match[2].startsWith(`${root}/`))
      ? [{ pid: Number(match[1]), path: match[2] }] : [];
  });
}

export async function assertAppExited(appPath) {
  if ((await listAppProcesses(appPath)).length) {
    throw new Error('请先完全退出 Antigravity，再安装或恢复补丁。');
  }
}
