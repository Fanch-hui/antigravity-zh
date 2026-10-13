import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTemplate } from '../src/locales.mjs';

test('compiled templates preserve dynamic names, reordered variables, and literal currency', () => {
  const rule = compileTemplate({ source: 'Delete {0} from {1}?', target: '从 {1} 删除 {0}？费用为 $5。' });
  const regex = new RegExp(rule.pattern);
  assert.equal('Delete project.txt from workspace?'.replace(regex, rule.replacement), '从 workspace 删除 project.txt？费用为 $5。');
  assert.equal('Please Delete project.txt from workspace?'.replace(regex, rule.replacement), 'Please Delete project.txt from workspace?');
});
