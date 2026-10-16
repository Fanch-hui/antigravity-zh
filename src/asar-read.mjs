import { readFile } from 'node:fs/promises';

export async function readAsarJson(file, entry) {
  const buffer = await readFile(file);
  const headerSize = buffer.readUInt32LE(4);
  const header = JSON.parse(buffer.subarray(16, 16 + buffer.readUInt32LE(12)).toString('utf8'));
  let node = header;
  for (const part of entry.split('/')) node = node.files?.[part];
  const offset = 8 + headerSize + Number(node?.offset);
  if (!node || node.unpacked || !Number.isSafeInteger(offset) || !Number.isSafeInteger(node.size)
    || offset < 8 + headerSize || offset + node.size > buffer.length) {
    throw new Error('无法读取应用 ASAR 元数据。');
  }
  return JSON.parse(buffer.subarray(offset, offset + node.size).toString('utf8'));
}
