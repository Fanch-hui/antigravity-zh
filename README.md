# Antigravity 中文 · antigravity-zh

社区维护的简体中文界面工具，适用于 macOS Apple Silicon 上的 Antigravity 2.22.0 和 2.23.0。通过后台助手或独立启动入口动态加载汉化，保留官方应用包及签名。

翻译按完整文案、组件定位和设置语境匹配，支持界面动态更新。权限、删除、计费和错误提示按操作含义校审；token、品牌及必要技术术语保留英文。

## 安装与使用

准备 macOS Apple Silicon、已安装的兼容版本 Antigravity，以及 Node.js 22.12 或更新版本。默认应用路径为 `/Applications/Antigravity.app`。

```sh
git clone https://github.com/Fanch-hui/antigravity-zh.git
cd antigravity-zh
node bin/agy-zh.mjs status
node bin/agy-zh.mjs auto-enable
```

安装和日常运行使用 Node.js 内置能力，无需先安装 npm 依赖。开发检查使用下文的 `npm ci`。

双击本目录的 **开启自动汉化.command**，安装并启用后台助手。以后直接从原来的 Dock 图标、访达或启动台打开 **Antigravity.app**，助手会在主界面就绪后自动加载汉化，首次显示可能短暂出现英文。

助手登录后自动运行，应用关闭后继续等待下一次启动。助手代码独立安装在 `~/Library/Application Support/Antigravity中文助手`，可以移动本项目目录。双击 **关闭自动汉化.command** 停用；已打开页面的中文会保留到应用退出，下次启动使用原界面。

也可以使用独立入口：执行 `npm run shortcut` 生成 **Antigravity 中文.app**，保存工作并完全退出 Antigravity，再双击该入口。生成入口需要 Xcode Command Line Tools，可通过 `xcode-select --install` 安装。

生成的启动入口包含运行代码和词库，可以放入 Dock 或移动到常用位置。更新词库后重新执行 `npm run shortcut` 生成入口。

网页界面采用自然中文，并保留品牌、模型、命令及 token 等英文术语。原生 macOS 菜单由官方应用提供。用户消息、AI 正文、代码、终端输出、名称以及插件简介保持原文。未知服务端错误及尚未定位的静态段落保留原文。

独立入口在应用退出后自动结束。版本升级后需更新适配；每次接入新启动的应用前核对版本、文件指纹和签名，不兼容时停止汉化。更新词库后重新开启自动汉化，以更新已安装的助手副本；重新启动应用后使用新词库。

## 命令

需要 Node.js 22.12 或更新版本。日常启动无需下载依赖；开发检查需要执行 `npm ci`。

```sh
npm run status
npm run launch
npm run auto:enable
npm run auto:disable
npm run auto:status
node bin/agy-zh.mjs auto-enable --dry-run
node bin/agy-zh.mjs launch --dry-run
node bin/agy-zh.mjs launch --app /Applications/Antigravity.app
node bin/agy-zh.mjs auto-enable --app /Applications/Antigravity.app
npm run shortcut
npm ci
npm run check
npm test
```

`npm run shortcut` 在当前目录生成 **Antigravity 中文.app**；也可使用 **启动汉化.command**。

## 翻译与维护

`locales/desktop-*.json` 记录原文、译文、语境和来源。`scope`、`selector` 与 `settingLabel` 限定翻译位置；`selectorMode: "self"` 只匹配文本所在元素，保护其内的动态名称。完整动态句使用 `{0}` 等变量；`captureMappings` 处理已确认的英文复数和固定枚举，`capturePatterns` 限定数字、类型或时间格式，`captureFormats` 转换已确认的时间单位。其他变量原样保留。

`runtime/surfaces.mjs` 维护组件定位与内容保护范围。下拉弹层通过 `aria-controls` 关联设置按钮，避免将产物审阅和命令执行选项混译。

`locales/exclusions-*.json` 记录专名、内部标识、代码及无法独立成句的片段。词库条数表示校审文案数量，实际页面覆盖需要结合界面定位与手动验收。

模型用量等服务端界面文案仅收录已确认的完整原文。受内容保护的工具输出区域，以及未知服务端提示仍可能显示英文。

各版本的官方文件指纹在 `src/versions.mjs` 中独立维护。适配新版本需核对静态界面及内容保护定位，再登记指纹、更新助手。

静态提取工具接收指定脚本文件和版本号，不访问会话、账号或凭据：

```sh
node scripts/extract-catalog.mjs /path/to/main.js .work/catalog.json 2.23.0
```

已适配版本正常启动时自行开启随机端口的本地调试通道。后台助手每两秒检查应用状态，仅读取 `DevToolsActivePort` 的端口行，并核对端口由官方应用主进程监听，然后接入。它不启动或退出应用，不读取账号、会话和用户配置。

汉化仅使用本机回环调试连接，在应用自身的顶层页面注册翻译脚本。DOM 翻译按变化增量处理；窗口发现每秒检查一次，以覆盖新窗口和连接恢复。助手运行记录位于上述安装目录的 `assistant.stdout.log` 与 `assistant.stderr.log`，仅记录助手状态和错误。

## 验收

自动检查覆盖词库变量、设置语境、内容保护、动态句、重新渲染、连接恢复和目标页面边界。最终检查设置说明、权限确认、删除提示、计费提示及中文布局。

保留官方签名不能作为账号风控保障。官方未公开本地界面汉化是否参与风控；使用前可查阅 [Antigravity 服务条款](https://www.antigravity.google/terms)。

## 参与维护

报告问题时提供 Antigravity 版本、芯片架构、界面位置和对应英文文案。翻译修改应保留来源和语境，先完成词库检查与相关回归测试，再提交 Pull Request。

## 许可证与参考

工具代码及贡献者提供的译文采用 [MIT 许可证](LICENSE)。Antigravity、Google 等名称、原始界面文案与图标的权利归各自权利人所有。

实现思路参考 [Antigravity-Hans](https://github.com/yuexps/Antigravity-Hans) 与 [antigravity-hans-optimized](https://github.com/showfor/antigravity-hans-optimized)。版本兼容性由本项目的指纹检查、静态界面分析和必要回归测试确认。
