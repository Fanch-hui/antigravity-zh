import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
test('catalog captures bound React calls and returned labels without treating props as children', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'agy-catalog-'));
  try {
    const input = path.join(directory, 'main.js');
    const output = path.join(directory, 'catalog.json');
    await writeFile(input, `function Card(){var el=A.createElement;return el.call(A,"div",{className:"hidden-layout",title:"Project settings"},"Manage project folders and settings.")}
      A.createElement.call(A,"p",null,"Settings for conversations outside of projects.");
      function title(mode){switch(mode){case "review":return "Require Review";default:return "Give Feedback"}}
      const message=name=>\`Hi \${name}, what can we get done today?\`;
      function greeting(name){let label=name?\`Hello \${name}\`:"Welcome home";return A.createElement("h1",null,label)}
      function details(){let info="Manage local folders";return A.createElement(Panel,{description:info})}
      const headings=new Map([["Feedback", "Give Feedback"]]);
      function unrelated(){const el=console.log;el.call(console,"Debug message")}`);
    await run(process.execPath, ['scripts/extract-catalog.mjs', input, output, '2.29.0']);
    const records = JSON.parse(await readFile(output, 'utf8')).records;
    const sources = new Set(records.map(record => record.source));
    for (const source of ['Project settings', 'Manage project folders and settings.',
      'Settings for conversations outside of projects.', 'Require Review', 'Give Feedback',
      'Hi {0}, what can we get done today?', 'Hello {0}', 'Welcome home', 'Manage local folders']) assert(sources.has(source), source);
    assert(records.find(record => record.source === 'Give Feedback').origins.some(origin => origin.kind === 'map:value'));
    assert(!sources.has('Debug message'));
    assert(!sources.has('hidden-layout'));
    assert(records.find(record => record.source.startsWith('Hi ')).template);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
