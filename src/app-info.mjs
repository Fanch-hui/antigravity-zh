import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { SUPPORTED_VERSIONS } from './versions.mjs';

const run = promisify(execFile);

export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function readPlist(file, key) {
  const { stdout } = await run('/usr/libexec/PlistBuddy', ['-c', `Print ${key}`, file]);
  return stdout.trim();
}

export async function inspectApp(appPath) {
  const resolved = path.resolve(appPath);
  const appStat = await stat(resolved);
  if (!appStat.isDirectory()) throw new Error('应用路径必须是 .app 目录。');
  const plist = path.join(resolved, 'Contents/Info.plist');
  const [id, version, executable] = await Promise.all([
    readPlist(plist, 'CFBundleIdentifier'), readPlist(plist, 'CFBundleShortVersionString'),
    readPlist(plist, 'CFBundleExecutable'),
  ]);
  if (path.basename(executable) !== executable) throw new Error('应用可执行文件名称无效。');
  const executablePath = path.join(resolved, 'Contents/MacOS', executable);
  const { stdout } = await run('/usr/bin/lipo', ['-archs', executablePath]);
  const [asarHash, languageServerHash] = await Promise.all([
    sha256(path.join(resolved, 'Contents/Resources/app.asar')),
    sha256(path.join(resolved, 'Contents/Resources/bin/language_server')),
  ]);
  return { path: resolved, id, version, arch: stdout.trim(), executablePath,
    asarHash, languageServerHash };
}

export function fingerprint(info) {
  return Object.fromEntries(['id', 'version', 'arch', 'asarHash', 'languageServerHash']
    .map(key => [key, info[key]]));
}

export function assertFingerprint(info, expected) {
  for (const key of ['id', 'version', 'arch', 'asarHash', 'languageServerHash']) {
    if (info[key] !== expected?.[key]) throw new Error(`应用 ${key} 与适配指纹不匹配。`);
  }
}

export function assertCompatibleApp(info) {
  const expected = SUPPORTED_VERSIONS[info.version];
  if (!expected) throw new Error(`尚未适配 Antigravity ${info.version}，需要更新汉化助手。`);
  assertFingerprint(info, expected);
}

export async function verifyOriginalApp(appPath) {
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', appPath]);
}
