import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCompatibleApp } from '../src/app-info.mjs';
import { SUPPORTED_VERSIONS } from '../src/versions.mjs';

test('supported releases retain their own official file fingerprints', () => {
  for (const version of ['2.22.0', '2.23.0']) {
    assert.doesNotThrow(() => assertCompatibleApp({ ...SUPPORTED_VERSIONS[version] }));
  }
  assert.notEqual(SUPPORTED_VERSIONS['2.22.0'].asarHash, SUPPORTED_VERSIONS['2.23.0'].asarHash);
});

test('an unknown release cannot use a supported release fingerprint', () => {
  assert.throws(() => assertCompatibleApp({ ...SUPPORTED_VERSIONS['2.23.0'], version: '2.24.0' }),
    /尚未适配 Antigravity 2\.24\.0/);
});

test('supported version numbers still reject changed application identity or files', () => {
  for (const key of ['id', 'arch', 'asarHash', 'languageServerHash']) {
    assert.throws(() => assertCompatibleApp({ ...SUPPORTED_VERSIONS['2.23.0'], [key]: 'different' }),
      new RegExp(`应用 ${key} 与适配指纹不匹配`));
  }
});
