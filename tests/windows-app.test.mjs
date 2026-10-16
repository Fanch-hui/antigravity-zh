import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { readAsarJson } from '../src/asar-read.mjs';
import { readPeArchitecture, windowsFingerprint, hasGoogleWindowsSignature,
  verifyWindowsApp, trustWindowsApp } from '../src/windows/app-info.mjs';
import { assertCompatibleApp } from '../src/app-info.mjs';

const sample = { id: 'com.google.antigravity', platform: 'win32', arch: 'x64', version: '2.15.0',
  executableHash: 'a'.repeat(64), asarHash: 'b'.repeat(64), languageServerHash: 'c'.repeat(64),
  signature: { status: 'NotSigned', subject: null }, serverSignature: { status: 'NotSigned', subject: null } };

test('Windows metadata reads PE architecture and packaged ASAR version without executing the app', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agy-win-meta-'));
  try {
    const pe = Buffer.alloc(128);
    pe.writeUInt16LE(0x5a4d, 0); pe.writeUInt32LE(64, 0x3c);
    pe.writeUInt32LE(0x4550, 64); pe.writeUInt16LE(0x8664, 68);
    const executable = path.join(root, 'Antigravity.exe');
    await writeFile(executable, pe);
    assert.equal(await readPeArchitecture(executable), 'x64');
    pe.writeUInt16LE(0xaa64, 68); await writeFile(executable, pe);
    assert.equal(await readPeArchitecture(executable), 'arm64');
    const pkg = Buffer.from(JSON.stringify({ name: 'antigravity', productName: 'Antigravity', version: '2.15.0' }));
    const header = Buffer.from(JSON.stringify({ files: { 'package.json': { offset: '0', size: pkg.length } } }));
    const prefix = Buffer.alloc(16);
    prefix.writeUInt32LE(8 + header.length, 4); prefix.writeUInt32LE(header.length, 12);
    const asar = path.join(root, 'app.asar');
    await writeFile(asar, Buffer.concat([prefix, header, pkg]));
    assert.equal((await readAsarJson(asar, 'package.json')).version, '2.15.0');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Windows x64 and Google certificate trust remain separate from local file fingerprints', async () => {
  assert.doesNotThrow(() => assertCompatibleApp(sample));
  assert.throws(() => assertCompatibleApp({ ...sample, arch: 'arm64' }), /Windows x64/);
  assert.equal(hasGoogleWindowsSignature(sample), false);
  const signature = { status: 'Valid', subject: 'CN=Google LLC, O=Google LLC, C=US' };
  assert.equal(await verifyWindowsApp({ ...sample, signature, serverSignature: signature }), 'google-signature');
  assert.equal(hasGoogleWindowsSignature({ ...sample, signature, serverSignature: { ...signature, subject: 'CN=Other Publisher' } }), false);
  const snapshot = windowsFingerprint(sample);
  assert.deepEqual(Object.keys(snapshot), ['id', 'platform', 'version', 'arch', 'executableHash', 'asarHash', 'languageServerHash']);
  assert.equal((await trustWindowsApp(sample, { workDir: 'D:\\isolated\\agy', dryRun: true })).state, 'would-trust');
  await assert.rejects(trustWindowsApp(sample, { workDir: 'C:\\other', dryRun: true }), /D 盘/);
});

test('explicit Windows trust accepts only the recorded build and detects changes to every binary', {
  skip: process.platform !== 'win32',
}, async () => {
  const parent = 'D:\\agy-zh-win64\\tests';
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, 'trust-'));
  try {
    await assert.rejects(verifyWindowsApp(sample, { workDir: root }), /trust-app/);
    await trustWindowsApp(sample, { workDir: root });
    assert.equal(await verifyWindowsApp(sample, { workDir: root }), 'local-fingerprint');
    for (const key of ['executableHash', 'asarHash', 'languageServerHash']) {
      await assert.rejects(verifyWindowsApp({ ...sample, [key]: 'changed' }, { workDir: root }), /指纹不匹配/);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
