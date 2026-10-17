#!/usr/bin/env node
import path from 'node:path';
import { inspectApp, assertCompatibleApp, validateApp, hasVerifiedFingerprint } from '../src/app-info.mjs';
import { launchApp } from '../src/launch.mjs';
import { createRuntimeScript } from '../src/runtime-script.mjs';
import { watchApp } from '../src/watch.mjs';
import { enableAutostart, disableAutostart, autostartStatus } from '../src/autostart.mjs';
import { defaultWindowsAppPath, trustWindowsApp } from '../src/windows/app-info.mjs';
import { enableWindowsHelper, disableWindowsHelper, windowsHelperStatus,
  windowsHelperPaths, windowsHelperEnvironment } from '../src/windows/helper.mjs';

const windows = process.platform === 'win32';

function argumentsOf(argv) {
  const command = argv.shift() ?? 'status';
  const options = { app: windows ? defaultWindowsAppPath() : '/Applications/Antigravity.app', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--dry-run') options.dryRun = true;
    else if (['--app', '--work-dir', '--user-data-dir'].includes(flag)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${flag} 缺少路径。`);
      const key = ({ '--app': 'app', '--work-dir': 'workDir', '--user-data-dir': 'userDataPath' })[flag];
      options[key] = path.resolve(value);
    } else throw new Error(`未知参数：${flag}`);
  }
  return { command, options };
}

try {
  const { command, options } = argumentsOf(process.argv.slice(2));
  if (windows) Object.assign(process.env, windowsHelperEnvironment(windowsHelperPaths(options.workDir)));
  if (['help', '--help', '-h'].includes(command)) {
    console.log('agy-zh status|launch|watch|auto-enable|auto-disable|auto-status|trust-app [--app 应用路径] [--dry-run]');
    if (windows) console.log('Windows：--work-dir D:\\agy-zh-win64 [--user-data-dir D:\\独立配置目录]');
  } else if (command === 'status') {
    const app = await validateApp(options.app, options);
    console.log(`${app.trust === 'local-fingerprint' ? '本机构建指纹' : '官方签名'}检查通过：Antigravity ${app.version} (${app.arch})`);
    console.log(hasVerifiedFingerprint(app) ? '文件指纹：与已验证版本一致。' : '文件指纹：新构建，将自动检查界面兼容性。');
    console.log(`应用：${app.path}`);
  } else if (command === 'trust-app') {
    if (!windows) throw new Error('trust-app 适用于 Windows 本机构建。');
    const app = await inspectApp(options.app);
    assertCompatibleApp(app);
    const result = await trustWindowsApp(app, options);
    console.log(`${options.dryRun ? '将记录' : '已记录'} Antigravity ${app.version} (${app.arch}) 的本机文件指纹。`);
    console.log(`记录：${result.file}`);
  } else if (command === 'launch') {
    const script = options.dryRun ? undefined : await createRuntimeScript();
    const result = await launchApp(options.app, { ...options, script });
    if (options.dryRun) console.log('检查通过，可以通过汉化入口启动。');
    else {
      console.log('Antigravity 中文界面已加载。');
      console.log('关闭 Antigravity 后，汉化启动器会自动退出。');
      const close = () => result.close();
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
      await result.done;
      process.removeListener('SIGINT', close);
      process.removeListener('SIGTERM', close);
    }
  } else if (command === 'auto-status') {
    const status = windows ? await windowsHelperStatus(options) : await autostartStatus();
    console.log(`自动汉化：${status.loaded ? '已启用' : status.installed ? '已安装，尚未加载' : '未启用'}`);
    console.log(`助手：${status.installation}`);
  } else if (command === 'auto-enable') {
    await validateApp(options.app, options);
    const settings = { ...options, appPath: options.app };
    const result = windows ? await enableWindowsHelper(settings) : await enableAutostart(settings);
    console.log(options.dryRun ? '检查通过，可以启用自动汉化。' : '自动汉化已启用。今后直接打开原来的 Antigravity 即可。');
    console.log(`助手：${result.installation}`);
    if (windows) console.log('本次登录期间助手会保持运行；重新登录后再次开启。');
    else console.log(`登录启动文件：${result.plist}`);
  } else if (command === 'auto-disable') {
    if (windows) await disableWindowsHelper(options);
    else await disableAutostart({ dryRun: options.dryRun });
    console.log(options.dryRun ? '将停止自动汉化助手。' : '自动汉化已关闭。下次启动 Antigravity 时使用原界面。');
  } else if (command === 'watch') {
    const script = await createRuntimeScript();
    if (options.dryRun) {
      await validateApp(options.app, options);
      console.log('自动汉化助手检查通过。');
    } else {
      const controller = new AbortController();
      const close = () => controller.abort();
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
      console.log('自动汉化助手已运行，等待 Antigravity 启动。');
      try {
        await watchApp(options.app, { script, signal: controller.signal, ...options,
          onReady: () => console.log('Antigravity 中文界面已自动加载。'),
          onTiming: ({ stage, elapsedMs }) => console.log(`[启动计时] ${stage} ${elapsedMs} ms`),
          onError: error => console.error(`自动汉化暂不可用：${error.message}`) });
      } finally {
        process.removeListener('SIGINT', close);
        process.removeListener('SIGTERM', close);
      }
    }
  } else throw new Error(`未知命令：${command}。使用 --help 查看可用命令。`);
} catch (error) {
  console.error(`启动失败：${error.message}`);
  process.exitCode = 1;
}
