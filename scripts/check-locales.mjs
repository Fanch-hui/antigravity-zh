import { readFile, readdir } from 'node:fs/promises';
import { runtimeDictionary } from '../src/locales.mjs';

const directory = new URL('../locales/', import.meta.url);
const files = (await readdir(directory)).filter(name => /^desktop-.*\.json$/.test(name));
const issues = [];
let desktop = 0;
const keys = new Map();
const placeholders = value => [...value.matchAll(/\{\d+\}/g)].map(m => m[0]).sort().join(',');
for (const file of files) {
  const records = JSON.parse(await readFile(new URL(file, directory), 'utf8'));
  if (!Array.isArray(records)) throw new Error(`${file} 必须包含词条数组。`);
  for (const record of records) {
    const label = `${file}:${record.id}`;
    if (![record.source, record.context].every(v => typeof v === 'string' && v.trim())
      || typeof record.target !== 'string' || (!record.target.trim() && record.allowEmpty !== true)) issues.push(`${label} 文案或语境为空`);
    if (record.reviewed !== true) issues.push(`${label} 尚未校审`);
    desktop++;
    if (placeholders(record.source) !== placeholders(record.target)) issues.push(`${label} 动态变量不一致`);
    const key = [record.source.trim(), record.scope ?? 'generic', record.selector ?? '', record.settingLabel ?? ''].join('\0');
    if (keys.has(key) && keys.get(key) !== record.target.trim()) issues.push(`${label} 同语境译文冲突`);
    keys.set(key, record.target.trim());
    if (record.template) {
      const [compiled] = runtimeDictionary([record]);
      try { new RegExp(compiled.template.pattern); }
      catch { issues.push(`${label} 模板语法错误`); }
    }
  }
}
if (desktop === 0) issues.push('桌面词库为空');
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else console.log(`词库检查通过：桌面 ${desktop} 条。`);
