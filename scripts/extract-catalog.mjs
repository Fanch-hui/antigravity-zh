import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'acorn';
import { createHash } from 'node:crypto';

const [input = '.work/assets/main.js', output = '.work/catalog.json', version = '2.22.0'] = process.argv.slice(2);
const source = await readFile(input, 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
const fields = new Set(['label', 'description', 'title', 'placeholder', 'aria-label',
  'tooltip', 'text', 'message', 'detail', 'subtitle', 'buttonText', 'screen', 'heading',
  'emptyMessage', 'emptyText', 'secondaryText', 'primaryText', 'confirmText', 'cancelText',
  'content', 'tooltipText', 'tooltipContent', 'ariaLabel', 'editTitle', 'deleteTitle',
  'shortDescription', 'longDescription', 'newTabLabel', 'paneTitle', 'submitLabel',
  'renameLabel', 'moveUpLabel', 'moveDownLabel', 'deleteLabel', 'scopeAriaLabel',
  'actionsAriaLabel', 'accessibilityLabel']);
const records = new Map();

function key(node) { return node?.name ?? node?.value; }
function isElement(node) {
  return node?.type === 'CallExpression' && node.callee?.type === 'MemberExpression'
    && key(node.callee.property) === 'createElement';
}
function visible(node, parents) {
  const parent = parents.at(-1);
  if (parent?.type === 'Property' && parent.value === node && fields.has(key(parent.key))) {
    return `property:${key(parent.key)}`;
  }
  if (parent?.type === 'AssignmentPattern' && parent.right === node) {
    const property = parents.at(-2);
    const name = property?.type === 'Property' ? key(property.key) : key(parent.left);
    if (fields.has(name)) return `default:${name}`;
  }
  if (parents.slice(-9).some(p => p.type === 'Property' && /^resolveOptionTo(String|Description)$/.test(key(p.key)))) {
    return 'option:display';
  }
  for (let i = parents.length - 1; i >= Math.max(0, parents.length - 8); i--) {
    const ancestor = parents[i];
    const child = parents[i + 1] ?? node;
    if (isElement(ancestor) && ancestor.arguments.indexOf(child) >= 2) return 'element:children';
    if (ancestor.type === 'Property' && /^resolveOptionTo(String|Description)$/.test(key(ancestor.key))) {
      return `option:${key(ancestor.key)}`;
    }
    if (['FunctionExpression', 'ArrowFunctionExpression', 'ObjectExpression', 'Property'].includes(ancestor.type)) break;
    if (ancestor.type === 'CallExpression' && !isElement(ancestor)) break;
  }
  return null;
}
function isText(value) {
  if (!/[A-Za-z]{2}/.test(value) || value.length > 6000) return false;
  if (/^(https?:|\/|#|\.|@|--|data:|[A-Z_]{3,}$)/.test(value)) return false;
  if (/^[\w.-]+\.(js|json|md|html|css|svg|png)$/.test(value)) return false;
  if (/^[a-z]+(?:-[a-z\d]+)+$/.test(value) || /[{}]|=>/.test(value)) return false;
  return !/^(auto|none|flex|grid|block|inline|relative|absolute|inherit|transparent)$/.test(value);
}
function visit(node, parents = []) {
  if (!node?.type) return;
  const value = node.type === 'TemplateLiteral'
    ? node.quasis.map((q, i) => q.value.cooked + (i < node.expressions.length ? `{${i}}` : '')).join('')
    : node.type === 'Literal' ? node.value : null;
  if (typeof value === 'string' && isText(value.replace(/\{\d+\}/g, ''))) {
    const origin = visible(node, parents);
    if (origin) {
      let record = records.get(value);
      if (!record) {
        record = { id: createHash('sha256').update(value).digest('hex').slice(0, 12),
          source: value, origins: [], context: source.slice(Math.max(0, node.start - 170), node.end + 150) };
        if (node.type === 'TemplateLiteral' && node.expressions.length) record.template = true;
        records.set(value, record);
      }
      record.origins.push({ start: node.start, end: node.end, kind: origin });
    }
  }
  const next = [...parents, node];
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => { if (child?.type) visit(child, next); });
    else if (value?.type) visit(value, next);
  }
}
visit(ast);
await mkdir(output.slice(0, output.lastIndexOf('/')) || '.', { recursive: true });
await writeFile(output, JSON.stringify({ version, assetHash: createHash('sha256').update(source).digest('hex'),
  records: [...records.values()] }, null, 2) + '\n');
console.log(`提取 ${records.size} 条候选文案：${output}`);
