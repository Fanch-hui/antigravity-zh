function closing(source, start, open, close) {
  let depth = 0;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      while (++index < source.length) {
        if (source[index] === '\\') index++;
        else if (source[index] === quote) break;
      }
    } else if (char === '/' && source[index + 1] === '*') {
      index = source.indexOf('*/', index + 2);
      if (index < 0) return -1;
      index++;
    } else if (char === '/' && source[index + 1] === '/') {
      index = source.indexOf('\n', index + 2);
      if (index < 0) return -1;
    } else if (char === open) depth++;
    else if (char === close && --depth === 0) return index;
  }
  return -1;
}

function readElements(source) {
  const nodes = [];
  const calls = /\.createElement\s*\(\s*(?:(["'])([\w-]+)\1|[\w$]+)\s*,\s*\{/g;
  for (const match of source.matchAll(calls)) {
    const propsStart = match.index + match[0].length - 1;
    const propsEnd = closing(source, propsStart, '{', '}');
    if (propsEnd < 0) continue;
    const props = source.slice(propsStart, propsEnd + 1);
    const classes = props.match(/\bclassName\s*:\s*(?:[\w$]+\(\s*)?["']([^"']*)["']/)?.[1] ?? '';
    nodes.push({ start: match.index, open: source.indexOf('(', match.index), propsEnd,
      tag: match[2], props, classes: new Set(classes.split(/\s+/)) });
  }
  return nodes;
}

function structureQueries(source, nodes) {
  function hasClasses(node, classes) {
    return classes.split(' ').every(name => node.classes.has(name));
  }
  function matching(tag, classes) {
    return nodes.filter(node => (!tag || node.tag === tag) && hasClasses(node, classes));
  }
  function contains(parent, child) {
    parent.end ??= closing(source, parent.open, '(', ')');
    return child.start > parent.propsEnd && child.start < parent.end;
  }
  function childOf(parent, child) {
    return contains(parent, child) && !nodes.some(node => node !== parent
      && node.start > parent.propsEnd && node.start < child.start
      && contains(parent, node) && contains(node, child));
  }
  function marker(name, prefix = false) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = prefix ? `\x60${escaped}\\$\\{` : `["']${escaped}["']`;
    return nodes.filter(node => new RegExp(`["']data-testid["']\\s*:\\s*${pattern}`).test(node.props));
  }
  return { matching, contains, childOf, marker };
}

export function checkUiCompatibility(source) {
  const missing = [];
  const { matching, contains, childOf, marker } = structureQueries(source, readElements(source));
  const requireRule = (name, valid) => { if (!valid) missing.push(name); };
  for (const name of ['user-input-step', 'planner-response-text', 'pending-user-messages',
    'terminal-active', 'terminal-tab-surface', 'setup-script-output', 'file-title-name',
    'breadcrumb-segment', 'project-selector-item', 'branch-option', 'entity-pill',
    'activity-lane-label', 'subagent-tab-header-title', 'model-selector-item', 'input-attachment']) {
    requireRule(name, marker(name).length > 0);
  }
  requireRule('github-repo-option', marker('github-repo-option-', true).length > 0);
  requireRule('settings-surface', matching(null, 'max-w-2xl mx-auto flex-col gap-4').length > 0);
  const cards = matching('div', 'relative flex items-center gap-3 p-3 rounded-xl');
  const bodies = matching('div', 'flex-1 min-w-0 flex flex-col gap-0.5 pr-4');
  const titles = matching(null, 'font-medium text-sm text-foreground truncate');
  const descriptions = matching(null, 'text-xs text-muted-foreground truncate');
  requireRule('plugin-card-content', cards.some(card => bodies.some(body => childOf(card, body)
    && titles.some(title => contains(body, title))
    && descriptions.some(description => childOf(body, description)))));
  const shelfHeaders = matching('div', 'flex flex-col gap-1 px-3');
  requireRule('marketplace-shelf-content', matching('section', 'flex flex-col gap-3')
    .some(section => /["']aria-label["']\s*:\s*[\w$]+\.[\w$]+/.test(section.props)
      && shelfHeaders.some(header => childOf(section, header))));
  if (source.includes('/bundles/') || marker('bundle-card-', true).length) {
    requireRule('bundle-shelf', marker('marketplace-bundles-shelf').some(section =>
      shelfHeaders.some(header => childOf(section, header))));
    requireRule('bundle-card-content', marker('bundle-card-', true).some(card =>
      matching('div', 'min-w-0 flex flex-col gap-2').some(body => childOf(card, body)
        && matching('h3', 'font-medium text-sm text-foreground truncate').some(title => contains(body, title))
        && matching('div', 'text-xs text-muted-foreground leading-relaxed').some(description => childOf(body, description)))));
  }
  requireRule('plugin-detail-content', matching('div', 'flex flex-col gap-3').some(parent =>
    matching('h1', 'text-lg font-medium tracking-tight leading-tight text-foreground truncate min-w-0')
      .some(title => contains(parent, title))
    && matching('p', 'text-sm text-muted-foreground leading-relaxed').some(description => childOf(parent, description))));
  return { compatible: missing.length === 0, missing };
}

export async function assertUiCompatibility(client, origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.hostname !== '127.0.0.1' || !url.port
    || url.origin !== origin) throw new Error('界面兼容检查地址无效。');
  const expression = `(async () => {
    if (window.top !== window || location.origin !== ${JSON.stringify(origin)} || location.pathname !== '/') {
      return { compatible: false, missing: ['application-page'] };
    }
    try {
      const response = await fetch('/main.js', { method: 'GET', credentials: 'omit',
        redirect: 'error', mode: 'same-origin', cache: 'force-cache', signal: AbortSignal.timeout(5000) });
      if (!response.ok) return { compatible: false, missing: ['static-script'] };
      ${[closing, readElements, structureQueries, checkUiCompatibility].map(fn => fn.toString()).join('\n')}
      return checkUiCompatibility(await response.text());
    } catch { return { compatible: false, missing: ['static-script'] }; }
  })()`;
  const result = await client.call('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  }, 10000);
  const value = result.result?.value;
  if (result.exceptionDetails || value?.compatible !== true) {
    const missing = Array.isArray(value?.missing) ? value.missing.filter(name => /^[a-z-]+$/.test(name)) : [];
    throw new Error(`当前界面结构与汉化保护规则不兼容${missing.length ? `：${missing.join('、')}` : '。'}`);
  }
  return value;
}
