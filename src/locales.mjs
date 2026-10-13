import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export async function loadDesktopLocales() {
  const names = (await readdir(new URL('../locales/', import.meta.url)))
    .filter(name => /^desktop-.*\.json$/.test(name)).sort();
  if (!names.length) throw new Error('未找到桌面词库。');
  return (await Promise.all(names.map(async name => JSON.parse(
    await readFile(new URL(`../locales/${name}`, import.meta.url), 'utf8'))))).flat();
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function compileTemplate(record) {
  const positions = new Map();
  let count = 0;
  const pattern = record.source.trim().split(/(\{\d+\})/).map(part => {
    if (!/^\{\d+\}$/.test(part)) return escapeRegExp(part);
    count++;
    if (!positions.has(part)) positions.set(part, count);
    const position = Number(part.slice(1, -1));
    return `(${record.capturePatterns?.[position] ?? '[\\s\\S]*?'})`;
  }).join('');
  const replacement = record.target.trim().replace(/\$/g, '$$$$').replace(/\{\d+\}/g,
    part => `$${positions.get(part)}`);
  return { pattern: `^${pattern}$`, replacement };
}

export function runtimeDictionary(records) {
  return records.map(record => ({
    id: record.id, source: record.source.trim(), target: record.target.trim(),
    context: record.context, scope: record.scope ?? 'generic',
    ...(record.selector ? { selector: record.selector } : {}),
    ...(record.selectorMode ? { selectorMode: record.selectorMode } : {}),
    ...(record.kind ? { kind: record.kind } : {}),
    ...(record.attribute ? { attribute: record.attribute } : {}),
    ...(record.settingLabel ? { settingLabel: record.settingLabel } : {}),
    ...(record.captureMappings ? { captureMappings: record.captureMappings } : {}),
    ...(record.captureFormats ? { captureFormats: record.captureFormats } : {}),
    ...(record.template ? { template: compileTemplate(record) } : {}),
  }));
}
