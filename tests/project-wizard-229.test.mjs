import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
const settle = dom => new Promise(resolve => dom.window.setTimeout(resolve, 0));
function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  dom.window.eval(script);
  return dom;
}

test('sidebar creation popup translates the whole remote project action only', async () => {
  const dom = mount(`<div data-testid="project-selector-item">New Remote Project</div>
    <div data-popover-popup class="agy-overlay"><button class="main-row-trigger"><div class="flex items-center justify-start w-full"><span class="truncate flex-grow min-w-0">New Remote Project</span></div></button></div>`);
  const doc = dom.window.document;
  const popup = doc.createElement('div');
  popup.setAttribute('data-popover-popup', '');
  popup.className = 'agy-overlay !w-max max-w-[80vw] py-0.5 flex flex-col origin-top-left overflow-hidden';
  popup.innerHTML = `<button class="main-row-trigger"><div class="flex items-center justify-start w-full gap-1.5 min-w-0"><div class="shrink-0"><svg></svg></div><span class="truncate flex-grow min-w-0">New Remote Project</span></div></button>`;
  doc.body.append(popup);
  await settle(dom);
  assert.equal(popup.querySelector('span').textContent, '新建远程项目');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"]').textContent, 'New Remote Project');
  assert.equal(doc.querySelector('[data-popover-popup]:not(.origin-top-left) span').textContent, 'New Remote Project');
  dom.window.close();
});

test('resource and folder actions translate without changing resource names', async () => {
  const dom = mount(`<div data-testid="project-folder-selection-step"><button data-testid="project-add-folder-button"><svg></svg><span>Add Resource</span></button>
    <div data-testid="project-selector-item">Add Resource</div></div><button id="ordinary">Add Resource</button>`);
  const doc = dom.window.document;
  const label = doc.querySelector('[data-testid="project-add-folder-button"] > span');
  assert.equal(label.textContent, '添加资源');
  assert.equal(doc.querySelector('[data-testid="project-selector-item"]').textContent, 'Add Resource');
  assert.equal(doc.querySelector('#ordinary').textContent, 'Add Resource');
  label.textContent = 'Add Folder';
  await settle(dom);
  assert.equal(label.textContent, '添加文件夹');
  dom.window.close();
});

test('project naming title and label translate while the project value remains untouched', () => {
  const dom = mount(`<div role="dialog" class="agy-dialog">
    <div class="flex items-center mb-4 justify-between"><h2 class="text-md font-medium text-foreground">Set Project Name</h2><button aria-label="Close"></button></div>
    <div class="overflow-y-auto"><div><div class="flex flex-col items-center justify-center h-full w-full">
      <form class="w-full flex flex-col gap-2"><div class="flex flex-col gap-1.5 w-full align-start text-left">
        <div class="text-xs text-secondary-foreground">Project Name</div><input placeholder="Enter project name..." value="New Remote Project">
      </div><button type="submit">Create</button></form></div></div></div></div>
    <div role="dialog" class="agy-dialog"><div class="flex items-center mb-4"><h2 class="text-md font-medium text-foreground">Set Project Name</h2></div></div>
    <div data-testid="planner-response-text">Project Name</div>`);
  const doc = dom.window.document;
  const dialogs = doc.querySelectorAll('[role="dialog"]');
  assert.equal(dialogs[0].querySelector('h2').textContent, '设置项目名称');
  assert.equal(dialogs[0].querySelector('form div > div').textContent, '项目名称');
  assert.equal(dialogs[0].querySelector('input').placeholder, '输入项目名称...');
  assert.equal(dialogs[0].querySelector('input').value, 'New Remote Project');
  assert.equal(dialogs[1].querySelector('h2').textContent, 'Set Project Name');
  assert.equal(doc.querySelector('[data-testid="planner-response-text"]').textContent, 'Project Name');
  dom.window.close();
});

test('new and add templates only translate confirmed automation terms', () => {
  const dom = mount(`<div role="dialog"><h2>New automation</h2><h2>New scheduled task</h2><h2>New Remote Project</h2></div>
    <button aria-label="Add automation"></button><button aria-label="Add scheduled task"></button>
    <button aria-label="Add Custom Device">Add Resource</button><button>New Remote Project</button>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll('h2')].map(node => node.textContent), ['新建自动化', '新建计划任务', 'New Remote Project']);
  assert.deepEqual([...doc.querySelectorAll('button')].map(node => node.getAttribute('aria-label')), ['添加自动化', '添加计划任务', 'Add Custom Device', null]);
  assert.equal(doc.querySelectorAll('button')[2].textContent, 'Add Resource');
  assert.equal(doc.querySelectorAll('button')[3].textContent, 'New Remote Project');
  dom.window.close();
});
