import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCompatibleApp, hasVerifiedFingerprint } from '../src/app-info.mjs';
import { VERIFIED_RELEASES } from '../src/versions.mjs';

test('verified releases retain their own official file fingerprints', () => {
  for (const version of ['2.22.0', '2.23.0']) {
    assert.doesNotThrow(() => assertCompatibleApp({ ...VERIFIED_RELEASES[version] }));
    assert.equal(hasVerifiedFingerprint(VERIFIED_RELEASES[version]), true);
  }
  assert.notEqual(VERIFIED_RELEASES['2.22.0'].asarHash, VERIFIED_RELEASES['2.23.0'].asarHash);
});

test('new versions and rebuilt releases proceed to signature and UI validation', () => {
  for (const version of ['2.23.1', '2.23.2', '2.24.0']) {
    const info = { ...VERIFIED_RELEASES['2.23.0'], version, asarHash: 'new-build' };
    assert.doesNotThrow(() => assertCompatibleApp(info));
    assert.equal(hasVerifiedFingerprint(info), false);
  }
});

test('application identity and architecture are required for every release', () => {
  const info = { ...VERIFIED_RELEASES['2.23.0'], version: '2.24.0' };
  assert.throws(() => assertCompatibleApp({ ...info, id: 'different' }), /应用标识不是 Antigravity/);
  assert.throws(() => assertCompatibleApp({ ...info, arch: 'x86_64' }), /macOS arm64/);
});
