import { mkdir, writeFile, copyFile, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = path.join(root, 'Antigravity 中文.app');
const macos = path.join(bundle, 'Contents/MacOS');
const resources = path.join(bundle, 'Contents/Resources');
await mkdir(macos, { recursive: true });
await mkdir(resources, { recursive: true });
execFileSync('/usr/bin/swiftc', ['-O', path.join(root, 'launcher/AppMain.swift'), '-o', path.join(macos, 'agy-zh')]);
for (const directory of ['bin', 'src', 'runtime', 'locales']) {
  await cp(path.join(root, directory), path.join(resources, directory), { recursive: true });
}
await copyFile('/Applications/Antigravity.app/Contents/Resources/icon.icns', path.join(resources, 'icon.icns'));
await writeFile(path.join(bundle, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>local.agy-zh.launcher</string>
<key>CFBundleName</key><string>Antigravity 中文</string>
<key>CFBundleExecutable</key><string>agy-zh</string>
<key>CFBundleIconFile</key><string>icon.icns</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.2.4</string>
<key>LSUIElement</key><true/>
</dict></plist>\n`);
execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', bundle]);
console.log(`启动入口已创建：${bundle}`);
