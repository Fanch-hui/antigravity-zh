#!/usr/bin/env node
import path from 'node:path';
import { inspectApp, assertCompatibleApp, verifyOriginalApp } from '../src/app-info.mjs';
import { launchApp } from '../src/launch.mjs';
import { createRuntimeScript } from '../src/runtime-script.mjs';
import { watchApp, validateWatchApp } from '../src/watch.mjs';
import { enableAutostart, disableAutostart, autostartStatus } from '../src/autostart.mjs';

function argumentsOf(argv) {
  const command = argv.shift() ?? 'status';
  const options = { app: '/Applications/Antigravity.app', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--app') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error('--app 缺少路径。');
      options.app = path.resolve(value);
    } else throw new Error(`未知参数：${flag}`);
  }
  return { command, options };
}

try {
  const { command, options } = argumentsOf(process.argv.slice(2));
  if (['help', '--help', '-h'].includes(command)) {
    console.log('agy-zh status|launch|watch|auto-enable|auto-disable|auto-status [--app 应用.app] [--dry-run]');
  } else if (command === 'status') {
    const app = await inspectApp(options.app);
    assertCompatibleApp(app);
    console.log(`已适配：Antigravity ${app.version} (${app.arch})`);
    console.log(`应用：${app.path}`);
  } else if (command === 'launch') {
    const info = await inspectApp(options.app);
    assertCompatibleApp(info);
    await verifyOriginalApp(info.path);
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
    const status = await autostartStatus();
    console.log(`自动汉化：${status.loaded ? '已启用' : status.installed ? '已安装，尚未加载' : '未启用'}`);
    console.log(`助手：${status.installation}`);
  } else if (command === 'auto-enable') {
    await validateWatchApp(options.app);
    const result = await enableAutostart({ appPath: options.app, dryRun: options.dryRun });
    console.log(options.dryRun ? '检查通过，可以启用自动汉化。' : '自动汉化已启用。今后直接打开原来的 Antigravity 即可。');
    console.log(`助手：${result.installation}`);
    console.log(`登录启动文件：${result.plist}`);
  } else if (command === 'auto-disable') {
    await disableAutostart({ dryRun: options.dryRun });
    console.log(options.dryRun ? '将停止自动汉化并删除本助手的登录启动文件。' : '自动汉化已关闭。下次启动 Antigravity 时使用原界面。');
  } else if (command === 'watch') {
    const script = await createRuntimeScript();
    if (options.dryRun) {
      await validateWatchApp(options.app);
      console.log('自动汉化助手检查通过。');
    } else {
      const controller = new AbortController();
      const close = () => controller.abort();
      process.once('SIGINT', close);
      process.once('SIGTERM', close);
      console.log('自动汉化助手已运行，等待 Antigravity 启动。');
      try {
        await watchApp(options.app, { script, signal: controller.signal,
          onReady: () => console.log('Antigravity 中文界面已自动加载。'),
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
