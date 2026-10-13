import { readFile } from 'node:fs/promises';
import { loadDesktopLocales, runtimeDictionary } from './locales.mjs';
import { surfaces } from '../runtime/surfaces.mjs';

export async function createRuntimeScript() {
  const records = runtimeDictionary(await loadDesktopLocales());
  const runtime = await readFile(new URL('../runtime/translator.js', import.meta.url), 'utf8');
  const marker = /\/\*__AGY_ZH_DICTIONARY__\*\/\s*null/;
  const surfaceMarker = /\/\*__AGY_ZH_SURFACES__\*\/\s*null/;
  if (!marker.test(runtime)) throw new Error('翻译模块的词库注入点不匹配。');
  if (!surfaceMarker.test(runtime)) throw new Error('翻译模块的组件定位不匹配。');
  return runtime.replace(marker, () => JSON.stringify(records))
    .replace(surfaceMarker, () => JSON.stringify(surfaces));
}
