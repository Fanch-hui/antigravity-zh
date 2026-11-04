import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntimeScript } from '../src/runtime-script.mjs';

const script = await createRuntimeScript();
function mount(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://127.0.0.1:42000/', runScripts: 'outside-only',
  });
  dom.window.eval(script);
  return dom;
}

test('schedule controls translate fixed choices and preserve values and unrelated text', () => {
  const dom = mount(`<div data-testid="automation-schedule-editor">
    <div><button data-testid="schedule-repeat" aria-label="How often"><span class="truncate select-none">Every week</span></button>
      <span class="text-muted-foreground select-none">on</span><button data-testid="schedule-weekday" aria-label="Day of the week"><span>Monday</span></button>
      <span class="text-muted-foreground select-none">at</span><span data-testid="schedule-timezone" title="America/New_York">EST</span></div>
    <div data-testid="schedule-custom"><div><span class="text-muted-foreground select-none">Repeat every</span>
      <button data-testid="schedule-custom-unit" aria-label="Repeat unit"><span>month</span></button>
      <span class="text-muted-foreground select-none">on the</span><button data-testid="schedule-day-of-month" aria-label="Day of the month"><span>21st</span></button></div>
      <div data-slot="toggle-group" aria-label="Days"><button aria-label="Monday">M</button></div></div></div>
    <div role="option" data-testid="schedule-repeat-option" data-value="weekdays">Every weekday</div>
    <div role="option" data-testid="schedule-custom-unit-option" data-value="hours">hours</div>
    <div role="option" data-testid="schedule-day-of-month-option" data-value="2">2nd</div>
    <div data-testid="planner-response-text">Every weekday</div><p>Repeat every</p>`);
  const doc = dom.window.document;
  const query = selector => doc.querySelector(selector);
  assert.equal(query('[data-testid="schedule-repeat"]').getAttribute('aria-label'), '多久执行一次');
  assert.equal(query('[data-testid="schedule-repeat"] span').textContent, '每周');
  assert.equal(query('[data-testid="schedule-weekday"]').getAttribute('aria-label'), '星期几');
  assert.equal(query('[data-testid="schedule-weekday"] span').textContent, '星期一');
  assert.equal(query('[data-testid="schedule-repeat-option"]').textContent, '每个工作日');
  assert.equal(query('[data-testid="schedule-repeat-option"]').getAttribute('data-value'), 'weekdays');
  assert.equal(query('[data-testid="schedule-custom-unit-option"]').textContent, '小时');
  assert.equal(query('[data-testid="schedule-custom-unit"] span').textContent, '月');
  assert.equal(query('[data-testid="schedule-day-of-month"] span').textContent, '21日');
  assert.equal(query('[data-testid="schedule-day-of-month-option"]').textContent, '2日');
  assert.equal(query('[data-slot="toggle-group"]').getAttribute('aria-label'), '星期');
  assert.equal(query('[data-testid="schedule-timezone"]').title, 'America/New_York');
  assert.equal(query('[data-testid="planner-response-text"]').textContent, 'Every weekday');
  assert.equal(query('body > p').textContent, 'Repeat every');
  dom.window.close();
});

test('automation creation translates fixed prompts and leaves name, identity, and search text intact', () => {
  const dom = mount(`<div data-testid="new-sidecar-modal" data-kind="local">
    <ol data-testid="new-sidecar-steps"><li><span>1</span><span>Task</span></li><li><span>2</span><span>Where</span></li><li><span>3</span><span>When</span></li></ol>
    <div><span>What should it do?</span><textarea data-testid="new-sidecar-prompt" aria-label="What should it do?" placeholder="For example: every morning, summarize new bugs assigned to me and anything that changed overnight.">No runs yet</textarea></div>
    <div><input data-testid="new-sidecar-name" value="No runs yet" placeholder="For example: Morning bug summary"></div>
    <div><span class="text-sm font-medium select-none">Where should it run?</span><div data-testid="automation-kind-toggle"><span data-testid="automation-kind-local"><span class="flex items-center">This computer</span><span>private content</span></span></div></div>
    <span data-testid="new-sidecar-name-exists"></span><span data-testid="new-sidecar-summary">Step 2 of 3</span><button data-testid="new-sidecar-submit">Create automation</button>
    </div><p data-testid="sidecar-list-empty"></p><div data-testid="sidecar-list-empty"><p class="m-0 text-base text-foreground"></p><p class="m-0 mt-1 max-w-md text-sm text-muted-foreground">Run a prompt on a schedule, like a morning summary of yesterday's changes. Runs show up here.</p></div>`);
  const doc = dom.window.document;
  const exists = doc.querySelector('[data-testid="new-sidecar-name-exists"]');
  exists.append('An ', 'automation', ' with this name already exists on this computer. Run it remotely, or go back and rename it.');
  const search = doc.querySelector('p[data-testid="sidecar-list-empty"]');
  search.append('No ', 'automations', ' match “', 'Review', '”.');
  const empty = doc.querySelector('div[data-testid="sidecar-list-empty"] > p');
  empty.append('No ', 'scheduled tasks', ' yet');
  dom.window.__AGY_ZH_RUNTIME__.translate(doc.body);
  const query = selector => doc.querySelector(selector);
  assert.deepEqual([...doc.querySelectorAll('[data-testid="new-sidecar-steps"] li span:last-child')].map(n => n.textContent), ['任务', '位置', '时间']);
  assert.equal(query('[data-testid="new-sidecar-prompt"]').getAttribute('aria-label'), '需要执行什么操作？');
  assert.equal(query('[data-testid="new-sidecar-prompt"]').value, 'No runs yet');
  assert.equal(query('[data-testid="new-sidecar-name"]').value, 'No runs yet');
  assert.equal(query('[data-testid="automation-kind-local"] > span').textContent, '此电脑');
  assert.equal(exists.textContent, '本机已存在同名自动化。请改为远程运行，或返回修改名称。');
  assert.equal(query('[data-testid="new-sidecar-summary"]').textContent, '第 2 步，共 3 步');
  assert.equal(query('[data-testid="new-sidecar-submit"]').textContent, '创建自动化');
  assert.equal(search.textContent, '没有与“Review”匹配的自动化。');
  assert.equal(empty.textContent, '暂无计划任务');
  dom.window.close();
});

test('automation detail localizes status labels without changing dynamic project names or prompts', () => {
  const dom = mount(`<div data-testid="automation-settings"><div><p data-testid="automation-next-run">Paused. Resume it to schedule the next run.</p><button data-testid="automation-settings-edit" aria-label="Edit schedule and model">Edit</button></div></div>
    <section data-testid="automation-instructions"><div><h2>Instructions</h2></div><div><div><div data-testid="automation-instructions-text"><div data-testid="automation-instructions-markdown"><div class="markdown">No instructions.</div></div><button>Show all</button></div></div></div></section>
    <section data-testid="automation-runs"><div><h2>Runs</h2><button data-testid="automation-runs-all">All runs</button></div><p class="m-0 px-3 py-2.5 text-sm text-muted-foreground">No runs yet</p><button data-testid="automation-run"><span><span>time</span><span class="truncate text-secondary-foreground">No runs yet</span></span></button></section>
    <div data-testid="automation-group"><span class="hidden">Next run</span><span class="hidden">Last run</span></div>
    <div data-testid="sidecar-row"><span data-testid="automation-name">No runs yet</span><span data-testid="automation-last-run"><span class="text-muted-foreground">Up 2h 30m</span></span><button data-testid="automation-restart" aria-label="Restart Review"></button></div>`);
  const doc = dom.window.document;
  const query = selector => doc.querySelector(selector);
  assert.equal(query('[data-testid="automation-next-run"]').textContent, '已暂停。恢复后将安排下一次执行。');
  assert.equal(query('[data-testid="automation-settings-edit"]').getAttribute('aria-label'), '编辑执行计划和模型');
  assert.equal(query('[data-testid="automation-instructions"] h2').textContent, '指令');
  assert.equal(query('[data-testid="automation-instructions-text"] button').textContent, '显示全部');
  assert.equal(query('[data-testid="automation-instructions-markdown"] .markdown').textContent, 'No instructions.');
  assert.equal(query('[data-testid="automation-runs"] p').textContent, '暂无运行记录');
  assert.equal(query('[data-testid="automation-runs"] h2').textContent, '运行记录');
  assert.equal(query('[data-testid="automation-run"] .truncate').textContent, 'No runs yet');
  assert.equal(query('[data-testid="automation-name"]').textContent, 'No runs yet');
  assert.equal(query('[data-testid="automation-last-run"] span').textContent, '已运行 2h 30m');
  assert.equal(query('[data-testid="automation-restart"]').getAttribute('aria-label'), '重新启动 Review');
  dom.window.close();
});

test('generated schedule summaries translate bounded time templates', () => {
  const dom = mount(`<div data-testid="automation-schedule-value"><span><span class="text-sm leading-5 text-foreground">Daily at 9:00 AM</span></span></div>
    <button data-testid="automation-schedule-value">weekdays at 6:30 PM</button>
    <button data-testid="automation-schedule-value">monthly on the 21st at 8:00 AM</button>
    <button data-testid="automation-schedule-value">every 3 hours</button>
    <button data-testid="automation-schedule-value">daily at tomorrow</button>
    <button data-testid="schedule-repeat"><span>Keep: Custom schedule</span></button>
    <span data-testid="automation-name">Daily at 9:00 AM</span>`);
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-testid="automation-schedule-value"] span.text-sm').textContent, '每天 9:00 AM');
  assert.deepEqual([...doc.querySelectorAll('button[data-testid="automation-schedule-value"]')].map(el => el.textContent), [
    '每个工作日 6:30 PM', '每月 21 日 8:00 AM', '每 3 小时', 'daily at tomorrow',
  ]);
  assert.equal(doc.querySelector('[data-testid="schedule-repeat"] span').textContent, '保留：Custom schedule');
  assert.equal(doc.querySelector('[data-testid="automation-name"]').textContent, 'Daily at 9:00 AM');
  dom.window.close();
});
