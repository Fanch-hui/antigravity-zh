import { open } from 'node:fs/promises';
import path from 'node:path';
import { parsePowerShellJson, runPowerShell } from './powershell.mjs';
import { listWindowsAppProcesses } from './processes.mjs';

export function windowsActivePortFile(userDataPath) {
  if (!userDataPath && !process.env.APPDATA) {
    throw new Error('无法确定 Antigravity 的用户数据目录，请指定 userDataPath。');
  }
  return path.join(userDataPath || path.join(process.env.APPDATA, 'Antigravity'),
    'DevToolsActivePort');
}

async function readWindowsActivePort(file) {
  let handle;
  try { handle = await open(file, 'r'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  try {
    const byte = Buffer.alloc(1);
    let line = '';
    // Leave the browser connection identifier on the following line unread.
    while (line.length < 6 && (await handle.read(byte, 0, 1, null)).bytesRead) {
      if (byte[0] === 10) break;
      line += byte.toString();
    }
    const text = line.replace(/\r$/, '');
    const port = /^\d{1,5}$/.test(text) ? Number(text) : 0;
    return port > 0 && port <= 65535 ? port : null;
  } finally { await handle.close(); }
}

export function parseWindowsLoopbackListeners(output, pids) {
  return parsePowerShellJson(output).filter(item => item && pids.includes(item.pid)
    && item.address === '127.0.0.1' && Number.isInteger(item.port)
    && item.port > 0 && item.port <= 65535)
    .map(({ pid, port }) => ({ pid, port }));
}

async function loopbackListeners(pids, run) {
  const script = `$owners = @(${pids.join(',')}); `
    + '$listeners = @(Get-NetTCPConnection -State Listen -OwningProcess $owners -ErrorAction SilentlyContinue '
    + "| Where-Object { $_.LocalAddress -eq '127.0.0.1' -and $owners -contains [int]$_.OwningProcess } "
    + '| ForEach-Object { [pscustomobject]@{ pid = [int]$_.OwningProcess; '
    + 'address = $_.LocalAddress; port = [int]$_.LocalPort } }); '
    + 'ConvertTo-Json -InputObject @($listeners) -Compress';
  return parseWindowsLoopbackListeners(await run(script), pids);
}

export async function windowsListeningPorts(pid, { run = runPowerShell } = {}) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('进程 PID 无效。');
  return (await loopbackListeners([pid], run)).map(listener => listener.port);
}

export async function discoverWindowsAppSession(appPath, {
  userDataPath, run = runPowerShell,
} = {}) {
  const processes = await listWindowsAppProcesses(appPath, { mainOnly: true, run });
  if (!processes.length) return null;
  const port = await readWindowsActivePort(windowsActivePortFile(userDataPath));
  if (!port) return null;
  const listeners = await loopbackListeners(processes.map(({ pid }) => pid), run);
  return listeners.find(listener => listener.port === port) || null;
}
