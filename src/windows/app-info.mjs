import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile, mkdir, writeFile } from 'node:fs/promises';
import { readAsarJson } from '../asar-read.mjs';
import { windowsExecutablePath } from './processes.mjs';
import { quotePowerShell, runPowerShell } from './powershell.mjs';
import { windowsHelperPaths } from './helper.mjs';

export function defaultWindowsAppPath() {
  if (!process.env.LOCALAPPDATA) throw new Error('请通过 --app 指定 Antigravity.exe。');
  return path.win32.join(process.env.LOCALAPPDATA, 'Programs', 'antigravity', 'Antigravity.exe');
}

async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function readPeArchitecture(file) {
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(64);
    await handle.read(header, 0, 64, 0);
    if (header.readUInt16LE(0) !== 0x5a4d) throw new Error('应用不是有效的 Windows PE 文件。');
    const machine = Buffer.alloc(6);
    await handle.read(machine, 0, 6, header.readUInt32LE(0x3c));
    if (machine.readUInt32LE(0) !== 0x4550) throw new Error('应用 PE 头无效。');
    return ({ 0x8664: 'x64', 0xaa64: 'arm64', 0x14c: 'ia32' })[machine.readUInt16LE(4)] ?? 'unknown';
  } finally { await handle.close(); }
}

export async function inspectWindowsApp(appPath) {
  const executablePath = windowsExecutablePath(appPath);
  const root = path.win32.dirname(executablePath);
  const asar = path.win32.join(root, 'resources', 'app.asar');
  const server = path.win32.join(root, 'resources', 'bin', 'language_server.exe');
  const [pkg, arch, asarHash, languageServerHash, executableHash, signatures] = await Promise.all([
    readAsarJson(asar, 'package.json'), readPeArchitecture(executablePath),
    hashFile(asar), hashFile(server), hashFile(executablePath),
    runPowerShell(`$files = @(${quotePowerShell(executablePath)}, ${quotePowerShell(server)}); `
      + '$result = @($files | ForEach-Object { $s = Get-AuthenticodeSignature -LiteralPath $_; '
      + '[pscustomobject]@{ status = $s.Status.ToString(); subject = $s.SignerCertificate.Subject } }); '
      + 'ConvertTo-Json -InputObject @($result) -Compress'),
  ]);
  if (pkg.name !== 'antigravity' || pkg.productName !== 'Antigravity'
    || !/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('应用元数据不是 Antigravity。');
  const [signature, serverSignature] = JSON.parse(signatures);
  return { path: executablePath, executablePath, platform: 'win32', id: 'com.google.antigravity',
    version: pkg.version, arch, asarHash, languageServerHash, executableHash, signature, serverSignature };
}

export function windowsFingerprint(info) {
  return Object.fromEntries(['id', 'platform', 'version', 'arch', 'executableHash', 'asarHash', 'languageServerHash']
    .map(key => [key, info[key]]));
}

export function hasGoogleWindowsSignature(info) {
  return [info.signature, info.serverSignature].every(signature => signature?.status === 'Valid'
    && /(?:^|,\s*)(?:CN|O)=Google LLC(?:,|$)/.test(signature.subject ?? ''));
}

function trustFile(workDir) {
  return path.win32.join(windowsHelperPaths(workDir).workDir, 'trusted-app.json');
}

export async function verifyWindowsApp(info, { workDir } = {}) {
  if (hasGoogleWindowsSignature(info)) return 'google-signature';
  let trusted;
  try { trusted = JSON.parse(await readFile(trustFile(workDir), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const fingerprint = windowsFingerprint(info);
  if (trusted && Object.entries(fingerprint).every(([key, value]) => trusted[key] === value)) return 'local-fingerprint';
  throw new Error('Windows 构建未通过 Google 签名校验或本机指纹不匹配。确认安装来源后运行 trust-app 记录此构建。');
}

export async function trustWindowsApp(info, { workDir, dryRun = false } = {}) {
  if (info.id !== 'com.google.antigravity' || info.platform !== 'win32' || info.arch !== 'x64') {
    throw new Error('本机指纹确认适用于 Windows x64 Antigravity。');
  }
  const file = trustFile(workDir);
  if (!dryRun) {
    await mkdir(path.win32.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(windowsFingerprint(info), null, 2) + '\n');
  }
  return { file, state: dryRun ? 'would-trust' : 'trusted' };
}
