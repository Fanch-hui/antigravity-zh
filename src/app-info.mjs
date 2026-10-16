import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { VERIFIED_RELEASES } from './versions.mjs';
import { inspectWindowsApp, verifyWindowsApp } from './windows/app-info.mjs';

const run = promisify(execFile);
const officialRequirement = '=identifier "com.google.antigravity" and anchor apple generic and certificate leaf[subject.OU] = "EQHXZ8M8AV"';

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
  if (process.platform === 'win32') return inspectWindowsApp(appPath);
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

export function hasVerifiedFingerprint(info) {
  const expected = VERIFIED_RELEASES[info.version];
  return Boolean(expected && Object.entries(fingerprint(info)).every(([key, value]) => expected[key] === value));
}

export function assertCompatibleApp(info) {
  if (info.id !== 'com.google.antigravity') throw new Error('应用标识不是 Antigravity。');
  if (info.platform === 'win32') {
    if (info.arch !== 'x64') throw new Error('当前汉化助手适用于 Windows x64。');
    return;
  }
  if (info.arch !== 'arm64') throw new Error('当前汉化助手适用于 macOS arm64。');
}

export async function verifyOriginalApp(appPath, { info, ...options } = {}) {
  if (process.platform === 'win32') return verifyWindowsApp(info ?? await inspectWindowsApp(appPath), options);
  try {
    await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '-R', officialRequirement, appPath]);
  } catch {
    throw new Error('官方应用签名校验失败，请使用 Google 官方 Antigravity 应用。');
  }
}

export async function validateApp(appPath, options = {}) {
  const app = await inspectApp(appPath);
  assertCompatibleApp(app);
  app.trust = await verifyOriginalApp(app.path, { ...options, info: app });
  return app;
}
