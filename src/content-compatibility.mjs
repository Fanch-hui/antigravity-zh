export function checkContentCompatibility(source, queries, closing) {
  const missing = [];
  const { matching, contains, childOf, marker } = queries;
  const requireRule = (name, valid) => { if (!valid) missing.push(name); };
  const content = node => source.slice(node.propsEnd + 1, closing(source, node.open, '(', ')'));
  const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (marker('browser-autocomplete-dropdown').length) {
    const validOption = marker('browser-autocomplete-option').some(option => {
      const name = option.props.match(/["']data-suggestion-kind["']\s*:\s*([\w$]+)\.kind\b/)?.[1];
      if (!name) return false;
      const item = escape(name);
      const primary = matching('span', 'truncate text-foreground font-normal').some(node =>
        contains(option, node) && new RegExp(`^,\\s*${item}\\.primaryText\\s*$`).test(content(node)));
      const secondary = matching('span', 'truncate text-muted-foreground font-normal').some(node =>
        contains(option, node) && new RegExp(`^,\\s*["'][^"']*["']\\s*,\\s*${item}\\.secondaryText\\s*$`).test(content(node)));
      return primary && secondary;
    });
    const searchLabel = /\bkind\s*:\s*["']search-web["'][^{}]*?\bsecondaryText\s*:\s*["']Google Search["']/.test(source);
    requireRule('browser-autocomplete-content', validOption && searchLabel);
  }

  if (marker('project-selector-github-loading').length) {
    const valid = marker('project-selector-github-repo-item').some(owner => {
      const slug = owner.props.match(/["']data-repo-slug["']\s*:\s*([\w$]+)/)?.[1];
      return slug && matching('span', 'truncate flex-1 min-w-0').some(node => childOf(owner, node)
        && new RegExp(`^,\\s*[\\w$]+\\.displayName\\s*\\|\\|\\s*${escape(slug)}\\s*$`).test(content(node)));
    });
    requireRule('project-selector-github-content', valid);
  }

  if (marker('webview-download-item').length) {
    const names = marker('webview-download-filename');
    const buttons = marker('webview-download-open');
    const valid = marker('webview-download-item').some(item => buttons.some(button => {
      if (!contains(item, button)) return false;
      const nested = names.find(name => name.tag === 'span' && childOf(button, name));
      const field = nested && content(nested).match(/^,\s*([\w$]+)\s*$/)?.[1];
      const value = field && escape(field);
      if (!value || !new RegExp(`\\btitle\\s*:\\s*${value}(?=\\s*[,}])`).test(button.props)) return false;
      return names.some(name => name !== nested && name.tag === 'span' && contains(item, name)
        && !contains(button, name) && new RegExp(`^,\\s*${value}\\s*$`).test(content(name))
        && new RegExp(`\\btitle\\s*:\\s*${value}(?=\\s*[,}])`).test(name.props));
    }));
    requireRule('webview-download-content', valid);
  }

  if (marker('voice-settings-change').length) {
    requireRule('voice-settings-content', marker('voice-settings-name').some(node => node.tag === 'span')
      && marker('voice-settings-mic').some(owner => matching(null, '').some(node => contains(owner, node)
        && /\bariaLabelledBy\s*:\s*["']voice-microphone-label["']/.test(node.props)
        && /\boptions\s*:/.test(node.props) && /\bdisplayResolver\s*:/.test(node.props)))
      && source.includes('"data-select-popup"') && source.includes('"aria-expanded"'));
  }

  if (marker('running-group').length) {
    const group = marker('running-group').some(owner => /["']aria-label["']\s*:\s*[\w$]+\.[\w$]+/.test(owner.props)
      && matching('div', 'flex items-center').some(header => childOf(owner, header)
        && matching('span', 'truncate font-medium').some(node => childOf(header, node))));
    const row = marker('running-row').some(owner => matching('span', 'text-sm text-foreground truncate')
      .some(node => contains(owner, node)));
    requireRule('running-content', group && row);
  }

  if (marker('automation-instructions-text').length) {
    const instructions = marker('automation-instructions-text').some(owner =>
      marker('automation-instructions-markdown').some(node => childOf(owner, node)));
    const names = marker('automation-name');
    const metadata = matching('div', 'col-start-1 row-start-1 min-w-0').some(owner =>
      matching('div', 'flex').some(header => childOf(owner, header) && names.some(node => childOf(header, node)))
      && matching('div', 'truncate text-muted-foreground').some(node => childOf(owner, node)));
    const runs = marker('automation-run').some(owner => matching('span', 'truncate')
      .some(node => contains(owner, node)));
    const details = marker('sidecar-detail').some(owner =>
      matching('p', 'm-0 text-[15px] leading-7 text-secondary-foreground').some(node => contains(owner, node))
      && matching('p', 'm-0 text-[13px] text-muted-foreground').some(node => contains(owner, node)
        && !/["']data-testid["']\s*:/.test(node.props)));
    requireRule('automation-content', instructions && metadata && runs && details);
  }
  return missing;
}

export function checkFixedControlCompatibility(source, queries, closing) {
  const missing = [];
  const { matching, contains, childOf, marker } = queries;
  const content = node => source.slice(node.propsEnd + 1, closing(source, node.open, '(', ')'));
  const requireRule = (name, valid) => { if (!valid) missing.push(name); };
  const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (marker('revert-button').length) {
    const valid = marker('revert-button').some(node => {
      const label = node.props.match(/["']aria-label["']\s*:\s*([\w$]+)/)?.[1];
      return node.tag === 'button' && label && new RegExp(`\\b${escape(label)}\\s*=\\s*[\\w$]+\\.revertTooltip\\b`)
        .test(source.slice(Math.max(0, node.start - 350), node.start));
    });
    requireRule('revert-control', valid);
  }
  if (marker('side-question-panel').length) {
    const valid = marker('side-question-question').some(owner => matching('span', 'shrink-0').some(node =>
      childOf(owner, node) && /^,\s*[\w$]+\s*\?\s*["']Side Question:["']\s*:\s*["']Side Question["']\s*$/.test(content(node))));
    requireRule('side-question-label', valid);
  }
  if (marker('settings-error-messages-card').length) {
    const valid = marker('settings-error-messages-card').some(owner =>
      matching('div', 'flex-1 flex flex-col gap-1 min-w-0').some(body => childOf(owner, body)
        && matching('span', 'text-sm font-medium text-foreground').some(node => childOf(body, node)
          && /^,\s*["']Failed to parse settings\. Fix and restart\.["']\s*$/.test(content(node))))
      && marker('settings-error-messages-copy-button').some(node => childOf(owner, node)
        && /["']aria-label["']\s*:\s*[\w$]+\s*\?\s*["']Copied["']\s*:\s*["']Copy error messages["']/.test(node.props)
        && /\btitle\s*:\s*[\w$]+\s*\?\s*["']Copied["']\s*:\s*["']Copy error messages["']/.test(node.props)));
    requireRule('settings-error-controls', valid);
  }

  if (marker('automation-instructions-text').length) {
    const schedule = String.raw`[\w$]+\.createElement\(\s*([\w$]+)\s*,\s*\{[^{}]*\btestId\s*:\s*["']automation-schedule-value["'][^{}]*\}\s*,\s*[\w$]+\s*\)`;
    const project = String.raw`[\w$]+&&[\w$]+!==[\w$]+\.sidecarId&&[\w$]+\.createElement\([\w$]+\.Fragment\s*,\s*null\s*,\s*["'] ["']\s*,\s*["']in["']\s*,\s*["'] ["']\s*,\s*[\w$]+\.createElement\(\s*\1\s*,\s*\{[^{}]*\btestId\s*:\s*["']sidecar-project-link["'][^{}]*\}\s*,\s*[\w$]+\s*\)\s*\)`;
    const model = String.raw`[\w$]+\.createElement\(\s*\1\s*,\s*\{[^{}]*\btestId\s*:\s*["']automation-model-value["'][^{}]*\}\s*,\s*[\w$]+\s*\)`;
    const sentence = new RegExp(String.raw`^,\s*["']Runs["']\s*,\s*["'] ["']\s*,\s*${schedule}\s*,\s*${project}\s*,\s*["'] ["']\s*,\s*["']with["']\s*,\s*["'] ["']\s*,\s*${model}\s*,\s*["'] ["']\s*,\s*["']on this computer\.["']\s*$`);
    const valid = marker('automation-settings').some(owner => matching('p', 'm-0 text-[15px] leading-7 text-secondary-foreground')
      .some(node => {
        if (!childOf(owner, node)) return false;
        const component = sentence.exec(content(node))?.[1];
        if (!component) return false;
        const declaration = new RegExp(`function\\s+${escape(component)}\\s*\\(\\s*\\{[^}]*\\bchildren\\s*:\\s*([\\w$]+)[^}]*\\btestId\\s*:\\s*([\\w$]+)[^}]*\\}\\s*\\)\\s*\\{`).exec(source);
        if (!declaration) return false;
        const bodyStart = declaration.index + declaration[0].length - 1;
        const bodyEnd = closing(source, bodyStart, '{', '}');
        return matching(null, 'inline').some(child => child.start > bodyStart && child.start < bodyEnd
          && new RegExp(`["']data-testid["']\\s*:\\s*${escape(declaration[2])}(?=\\s*[,}])`).test(child.props)
          && new RegExp(`^,\\s*${escape(declaration[1])}\\s*$`).test(content(child)));
      }));
    requireRule('automation-settings-sentence', valid);
  }
  return missing;
}

export function checkAdditionalContentCompatibility(source, queries, closing) {
  const missing = [];
  const { matching, contains, childOf, marker } = queries;
  const requireRule = (name, valid) => { if (!valid) missing.push(name); };
  const content = node => source.slice(node.propsEnd + 1, closing(source, node.open, '(', ')'));
  const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (marker('location-local').length) {
    const local = marker('location-local').some(owner => matching('span', 'flex items-baseline min-w-0')
      .some(body => contains(owner, body) && matching('span', 'truncate').some(node => childOf(body, node))));
    const cloud = matching(null, '').some(node => /["']data-testid["']\s*:\s*[\w$]+\.id===\s*["']default["']\s*\?\s*["']location-cloud["']\s*:\s*`location-cloud-\$\{/.test(node.props)
      && /["']data-env-id["']\s*:\s*[\w$]+\.id/.test(node.props)
      && /^,\s*[\w$]+\.name\s*$/.test(content(node)));
    const wrapper = matching('span', 'flex min-w-0 flex-col').some(owner =>
      matching('span', 'truncate').some(node => childOf(owner, node))
      && matching('span', 'truncate text-xs text-muted-foreground').some(node => childOf(owner, node)));
    requireRule('location-content', local && cloud && wrapper);
  }

  if (source.includes('"plugin-connection-local"')) {
    const calls = matching(null, '').filter(node => /\btestId\s*:\s*["']plugin-connection-(?:local|cloud)["']/.test(node.props));
    const names = calls.map(node => source.slice(node.open + 1).match(/^\s*([\w$]+)/)?.[1]);
    const declaration = names[0] && new RegExp(`function\\s+${escape(names[0])}\\s*\\(\\s*\\{[^}]*\\bsubtitle\\s*:\\s*([\\w$]+)[^}]*\\btestId\\s*:\\s*([\\w$]+)[^}]*\\}\\s*\\)`).exec(source);
    const valid = calls.length >= 2 && names.every(name => name === names[0]) && declaration
      && matching('div', 'flex flex-wrap items-center gap-3 p-3 text-sm text-foreground').some(owner =>
        new RegExp(`["']data-testid["']\\s*:\\s*${escape(declaration[2])}(?=\\s*[,}])`).test(owner.props)
        && matching('div', 'min-w-[10rem]').some(body => childOf(owner, body)
          && matching('div', 'truncate text-xs text-muted-foreground').some(node => childOf(body, node)
            && new RegExp(`\\btitle\\s*:\\s*${escape(declaration[1])}(?=\\s*[,}])`).test(node.props)
            && new RegExp(`^,\\s*${escape(declaration[1])}\\s*$`).test(content(node)))));
    requireRule('plugin-connection-content', Boolean(valid));
  }

  if (marker('media-modal-header').length) {
    const valid = marker('media-modal-title').some(owner => matching('div', 'truncate text-sm font-medium text-white')
      .some(node => contains(owner, node) && /^,\s*[\w$]+\.title\s*$/.test(content(node)))
      && matching('div', 'line-clamp-2 text-xs text-white/70')
        .some(node => contains(owner, node) && /^,\s*[\w$]+\.description\s*$/.test(content(node))));
    requireRule('media-title-content', valid);
  }

  if (marker('url-security-host').length) {
    const values = ['url-security-host', 'url-security-origin'].every(id => marker(id).some(node =>
      node.tag === 'span' && new RegExp(`^,\\s*[\\w$]+\\.${id === 'url-security-host' ? 'host' : 'origin'}\\s*$`).test(content(node))));
    const certificate = /["']data-testid["']\s*:\s*["']url-security-certificate["']/.test(source)
      && /\.subjectName\b/.test(source) && /\.issuer\b/.test(source);
    requireRule('security-certificate-content', values && certificate);
  }
  if (marker('pdf-floating-toolbar').length) {
    const viewport = /element\(\s*["']div["']\s*,\s*\{\s*className\s*:\s*["']pdf-viewport["']\s*,\s*["']data-testid["']\s*:\s*["']pdf-viewport["']/.test(source);
    const comments = /className\s*:\s*`floating-comment-card\s/.test(source)
      && /className\s*:\s*["']comment-content["']/.test(source);
    requireRule('pdf-document-content', viewport && comments && source.includes('jetski-pdf-viewer-host'));
  }
  return missing;
}
