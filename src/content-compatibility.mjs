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
