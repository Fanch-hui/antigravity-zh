import { open, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import path from 'node:path';
import { listAppProcesses } from './processes.mjs';

const run = promisify(execFile);

export function activePortFile(home = homedir()) {
  return path.join(home, 'Library/Application Support/Antigravity/DevToolsActivePort');
}

export async function readActivePort(file = activePortFile()) {
  let handle;
  try { handle = await open(file, 'r'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  try {
    const byte = Buffer.alloc(1);
    let line = '';
    // Only the first line is needed; leave the browser connection identifier unread.
    while (line.length < 6 && (await handle.read(byte, 0, 1, null)).bytesRead) {
      if (byte[0] === 10) break;
      line += byte.toString();
    }
    const port = /^\d{1,5}$/.test(line) ? Number(line) : 0;
    return port > 0 && port <= 65535 ? port : null;
  } finally { await handle.close(); }
}

export function parseLoopbackPorts(output) {
  return output.split('\n').flatMap(line => {
    const match = line.match(/^n127\.0\.0\.1:(\d+)$/);
    const port = match ? Number(match[1]) : 0;
    return port > 0 && port <= 65535 ? [port] : [];
  });
}

export async function listeningPorts(pid) {
  try {
    const { stdout } = await run('/usr/sbin/lsof', [
      '-nP', '-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN', '-Fn',
    ]);
    return parseLoopbackPorts(stdout);
  } catch (error) {
    if (error.code === 1) return [];
    throw new Error('无法核对 Antigravity 的本地监听端口。');
  }
}

export async function discoverAppSession(appPath) {
  const root = await realpath(appPath);
  const mainPath = path.join(root, 'Contents/MacOS/Antigravity');
  const processes = await listAppProcesses(appPath);
  const main = processes.find(process => process.path === mainPath
    || process.path === path.join(path.resolve(appPath), 'Contents/MacOS/Antigravity'));
  if (!main) return null;
  const port = await readActivePort();
  if (!port || !(await listeningPorts(main.pid)).includes(port)) return null;
  return { pid: main.pid, port };
}
