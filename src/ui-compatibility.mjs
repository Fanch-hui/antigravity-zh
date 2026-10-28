import { isAppPath } from './app-page.mjs';

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

function customizationStructures({ matching, contains, childOf }) {
  const cards = matching('div', 'relative flex items-center gap-3 p-3 rounded-xl');
  const titles = matching(null, 'font-medium text-sm text-foreground truncate');
  const protectedCard = (bodies, descriptions, candidates = cards) => candidates.some(card =>
    bodies.some(body => childOf(card, body) && titles.some(title => contains(body, title))
      && descriptions.some(description => childOf(body, description))));
  const modernCard = protectedCard(matching('div', 'flex-1 min-w-0 flex flex-col gap-0.5 pr-4'),
    matching(null, 'text-xs text-muted-foreground truncate'));
  const legacyCard = protectedCard(matching('div', 'flex-1 min-w-0 flex flex-col gap-0.5')
    .filter(body => !body.classes.has('pr-4')), matching(null, 'text-sm text-muted-foreground truncate'),
  cards.filter(card => card.classes.has('h-[72px]')));
  const dynamicSection = section => /["']aria-label["']\s*:\s*[\w$]+\.[\w$]+/.test(section.props);
  const modernShelf = matching('section', 'flex flex-col gap-3').some(section =>
    dynamicSection(section) && matching('div', 'flex flex-col gap-1 px-3').some(header => childOf(section, header)));
  const legacyShelf = matching('div', 'space-y-10').some(parent => matching('section', '').some(section =>
    childOf(parent, section) && dynamicSection(section)
    && matching('h2', 'text-xl font-medium text-foreground').some(title => childOf(section, title))
    && matching('p', 'text-xs text-muted-foreground mt-1').some(description => childOf(section, description))));
  const detail = (parents, headings, descriptions) => parents.some(parent =>
    headings.some(title => contains(parent, title)) && descriptions.some(description => childOf(parent, description)));
  const modernDetail = detail(matching('div', 'flex flex-col gap-3'),
    matching('h1', 'text-lg font-medium tracking-tight leading-tight text-foreground truncate min-w-0'),
    matching('p', 'text-sm text-muted-foreground leading-relaxed'));
  const legacyDetail = detail(matching('div', 'mt-2'),
    matching('h1', 'text-2xl font-bold tracking-tight leading-tight text-foreground truncate min-w-0'),
    matching('p', 'text-sm text-muted-foreground mt-3 leading-relaxed'));
  return { modernCard, legacyCard, modernShelf, legacyShelf, modernDetail, legacyDetail,
    legacy: legacyCard && legacyShelf && legacyDetail };
}

function checkPluginConfiguration(source, nodes, queries, requireRule) {
  const { matching, marker, contains, childOf } = queries;
  if (marker('plugin-install-conflict-modal').length) {
    const cards = nodes.filter(node => /["']data-testid["']\s*:\s*[\w$]+\s*}/.test(node.props));
    requireRule('plugin-conflict-content', ['conflict-current-plugin', 'conflict-incoming-plugin']
      .every(name => source.includes(`"${name}"`))
      && cards.some(card => matching('div', 'flex items-start').some(body => childOf(card, body)
        && matching('span', 'font-medium text-sm text-foreground truncate').some(title => contains(body, title))
        && matching('div', 'text-xs text-muted-foreground truncate').some(description => contains(body, description)))));
  }
  if (marker('mcp-config-variable').length) {
    requireRule('mcp-configuration-content', marker('mcp-config-variable').some(variable =>
      nodes.some(label => label.tag === 'label' && contains(variable, label))
      && matching('span', 'text-xs text-muted-foreground').some(description => childOf(variable, description))
      && marker('mcp-config-variable-input').some(input => childOf(variable, input))));
  }
  if (marker('plugin-context-provider-list').length) {
    requireRule('context-provider-content', marker('plugin-context-provider-list').some(list =>
      marker('plugin-context-provider-', true).some(card => contains(list, card)
        && matching('span', 'text-sm font-medium text-foreground truncate').some(title => contains(card, title))
        && matching('p', 'text-xs text-muted-foreground leading-relaxed').some(description => childOf(card, description)))));
  }
}

export function checkUiCompatibility(source) {
  const missing = [];
  const nodes = readElements(source);
  const queries = structureQueries(source, nodes);
  const { matching, childOf, marker } = queries;
  const customizations = customizationStructures(queries);
  const requireRule = (name, valid) => { if (!valid) missing.push(name); };
  checkPluginConfiguration(source, nodes, queries, requireRule);
  for (const name of ['user-input-step', 'planner-response-text', 'pending-user-messages',
    'terminal-active', 'setup-script-output', 'file-title-name',
    'breadcrumb-segment', 'project-selector-item', 'branch-option',
    'activity-lane-label', 'model-selector-item', 'input-attachment']) {
    requireRule(name, marker(name).length > 0);
  }
  for (const name of ['terminal-tab-surface', 'entity-pill', 'subagent-tab-header-title', 'github-repo-option']) {
    const legacyReplacement = {
      'terminal-tab-surface': marker('terminal-surface').length && marker('terminal-split-container').length,
      'entity-pill': nodes.some(node => /["']data-uri["']\s*:/.test(node.props)
        && /["']data-quotable-inline["']\s*:\s*["']true["']/.test(node.props)),
      'subagent-tab-header-title': marker('subagent-node').length && matching('span', 'text-xs font-medium truncate flex-1 min-w-0').length,
      'github-repo-option': true,
    }[name];
    requireRule(name, marker(name === 'github-repo-option' ? name + '-' : name,
      name === 'github-repo-option').length > 0 || customizations.legacy && legacyReplacement);
  }
  requireRule('settings-surface', matching(null, 'max-w-2xl mx-auto flex-col gap-4').length > 0);
  const modelNames = matching('span', 'truncate text-xs text-left');
  requireRule('model-name-content', marker('model-selector-panel').length > 0
    && marker('model-selector-effort-group').some(group => modelNames.includes(group))
    && marker('model-selector-effort-option').length > 0
    && modelNames.some(node => /^,\s*[\w$]+\.label\s*$/.test(
      source.slice(node.propsEnd + 1, closing(source, node.open, '(', ')')))));
  requireRule('plugin-card-content', customizations.modernCard || customizations.legacyCard);
  const shelfHeaders = matching('div', 'flex flex-col gap-1 px-3');
  requireRule('marketplace-shelf-content', customizations.modernShelf || customizations.legacyShelf);
  if (source.includes('/bundles/') || marker('bundle-card-', true).length) {
    requireRule('bundle-shelf', marker('marketplace-bundles-shelf').some(section =>
      shelfHeaders.some(header => childOf(section, header))));
    requireRule('bundle-card-content', marker('bundle-card-', true).some(card =>
      matching('div', 'min-w-0 flex flex-col gap-2').some(body => childOf(card, body)
        && matching('h3', 'font-medium text-sm text-foreground truncate').some(title => queries.contains(body, title))
        && matching('div', 'text-xs text-muted-foreground leading-relaxed').some(description => childOf(body, description)))));
  }
  requireRule('plugin-detail-content', customizations.modernDetail || customizations.legacyDetail);
  return { compatible: missing.length === 0, missing };
}

export async function assertUiCompatibility(client, origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.hostname !== '127.0.0.1' || !url.port
    || url.origin !== origin) throw new Error('界面兼容检查地址无效。');
  const expression = `(async () => {
    ${isAppPath.toString()}
    if (window.top !== window || location.origin !== ${JSON.stringify(origin)} || !isAppPath(location.pathname)) {
      return { compatible: false, missing: ['application-page'] };
    }
    try {
      const response = await fetch('/main.js', { method: 'GET', credentials: 'omit',
        redirect: 'error', mode: 'same-origin', cache: 'force-cache', signal: AbortSignal.timeout(5000) });
      if (!response.ok) return { compatible: false, missing: ['static-script'] };
      ${[closing, readElements, structureQueries, customizationStructures, checkPluginConfiguration, checkUiCompatibility].map(fn => fn.toString()).join('\n')}
      return checkUiCompatibility(await response.text());
    } catch { return { compatible: false, missing: ['static-script'] }; }
  })()`;
  const result = await client.call('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  }, 10000);
  const value = result.result?.value;
  if (result.exceptionDetails || value?.compatible !== true) {
    const missing = Array.isArray(value?.missing) ? value.missing.filter(name => /^[a-z-]+$/.test(name)) : [];
    const error = new Error(`当前界面结构与汉化保护规则不兼容${missing.length ? `：${missing.join('、')}` : '。'}`);
    if (!result.exceptionDetails && missing.length === 1 && missing[0] === 'application-page') {
      error.code = 'AGY_APPLICATION_PAGE_PENDING';
    }
    throw error;
  }
  return value;
}
