import path from 'node:path';
import { parsePowerShellJson, quotePowerShell, runPowerShell } from './powershell.mjs';

export function windowsExecutablePath(appPath) {
  const resolved = path.win32.resolve(appPath);
  return path.win32.basename(resolved).toLowerCase() === 'antigravity.exe'
    ? resolved : path.win32.join(resolved, 'Antigravity.exe');
}

export function parseWindowsAppProcesses(output, appPath) {
  const executable = windowsExecutablePath(appPath).toLowerCase();
  const processes = parsePowerShellJson(output).filter(item => item
    && Number.isInteger(item.pid) && item.pid > 0 && typeof item.path === 'string'
    && path.win32.normalize(item.path).toLowerCase() === executable);
  return processes.map(({ pid, path: executablePath }) => ({ pid, path: executablePath }));
}

export async function listWindowsAppProcesses(appPath, {
  mainOnly = false, run = runPowerShell,
} = {}) {
  const executable = windowsExecutablePath(appPath);
  const mainFilter = mainOnly
    ? " -and $_.CommandLine -and $_.CommandLine -notmatch '(?i)(?:^|\\s)--type='" : '';
  const script = `$expected = ${quotePowerShell(executable)}; `
    + "$selected = @(Get-CimInstance Win32_Process -Filter \"Name = 'Antigravity.exe'\" "
    + `| Where-Object { $_.ExecutablePath -ieq $expected${mainFilter} } `
    + '| ForEach-Object { [pscustomobject]@{ pid = [int]$_.ProcessId; path = $_.ExecutablePath } }); '
    + 'ConvertTo-Json -InputObject @($selected) -Compress';
  return parseWindowsAppProcesses(await run(script), executable);
}
