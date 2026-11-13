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
    requireRule('voice-settings-content', marker('voice-settings-name').some(node => node.tag === 'span'
        && /^,\s*[\w$]+\s*\|\|\s*["']Not set["']\s*$/.test(content(node)))
      && marker('voice-settings-mic').some(owner => matching(null, '').some(node => contains(owner, node)
        && /\bariaLabelledBy\s*:\s*["']voice-microphone-label["']/.test(node.props)
        && /\boptions\s*:/.test(node.props) && /\bdisplayResolver\s*:/.test(node.props)))
      && source.includes('"data-select-popup"') && source.includes('"aria-expanded"'));
  }

  if (marker('voice-picker-name').length) {
    requireRule('voice-picker-content', marker('voice-picker-name').every(node =>
      /^,\s*[\w$]+\.name\s*$/.test(content(node))));
  }

  if (marker('running-group').length) {
    const group = marker('running-group').some(owner => /["']aria-label["']\s*:\s*([\w$]+)\.title\b/.test(owner.props)
      && matching('div', 'flex items-center').some(header => {
        if (!childOf(owner, header)) return false;
        const titles = ['button', 'span'].flatMap(tag => matching(tag, 'truncate font-medium')
          .filter(node => childOf(header, node)));
        return titles.length > 0 && titles.every(node => /^,\s*[\w$]+\.title\s*$/.test(content(node)));
      }));
    const row = marker('running-row').some(owner => matching('span', 'text-foreground truncate')
      .some(node => contains(owner, node) && /^,\s*[\w$]+\.title\s*$/.test(content(node))));
    requireRule('running-content', group && row);
  }

  if (marker('automation-instructions-text').length) {
    const instructions = marker('automation-instructions-text').some(owner =>
      marker('automation-instructions-markdown').some(node => childOf(owner, node)));
    const names = marker('automation-name');
    const metadata = matching('div', 'col-start-1 row-start-1 min-w-0').some(owner =>
      matching('div', 'flex').some(header => childOf(owner, header) && names.some(node => childOf(header, node)))
      && matching('div', 'truncate text-muted-foreground').some(node => childOf(owner, node)));
    const runs = marker('automation-run').some(owner => matching('span', 'truncate').some(node =>
      contains(owner, node) && /^[,]\s*[\w$]+\s*$/.test(content(node))));
    const modelCalls = matching(null, '').filter(node => /\btestId\s*:\s*["']automation-model-value["']/.test(node.props));
    const modelValue = modelCalls.some(call => {
      const component = source.slice(call.open + 1).match(/^\s*([\w$]+)/)?.[1];
      const declaration = component && new RegExp(`function\\s+${escape(component)}\\s*\\(\\s*\\{[^}]*?(?:\\bvalue\\s*:\\s*|\\bchildren\\s*:\\s*)([\\w$]+)[^}]*\\btestId\\s*:\\s*([\\w$]+)[^}]*\\}`).exec(source);
      if (!declaration) return false;
      const current = matching('div', 'flex min-w-0 items-center p-3').some(owner =>
        new RegExp(`["']data-testid["']\\s*:\\s*${escape(declaration[2])}(?=\\s*[,}])`).test(owner.props)
        && matching('span', 'leading-5 text-foreground').some(value => contains(owner, value)
          && new RegExp(`^,\\s*${escape(declaration[1])}\\s*$`).test(content(value))));
      if (current) return true;
      const bodyStart = declaration.index + declaration[0].length;
      const helper = source.slice(bodyStart, closing(source, bodyStart, '{', '}') + 1);
      const rendersValue = new RegExp(`\\.createElement\\([^;]*,\\s*${escape(declaration[1])}\\s*\\)`).test(helper);
      return rendersValue && marker('automation-settings').some(owner => contains(owner, call)
        && matching('p', 'm-0 text-[15px] leading-7 text-secondary-foreground').some(sentence =>
          contains(owner, sentence) && contains(sentence, call)));
    });
    const details = marker('sidecar-detail').some(owner => {
      const current = matching('span', 'text-foreground truncate').some(title => contains(owner, title)
        && /^,\s*[\w$]+\s*$/.test(content(title)))
        && matching('p', 'm-0 text-[15px] leading-7 text-secondary-foreground').some(node => contains(owner, node))
        && matching('p', 'm-0 text-muted-foreground').some(node => contains(owner, node)
          && (node.classes.has('text-compact') || node.classes.has('text-[13px]'))
          && /\.status\s*===/.test(content(node)) && /lastError|startTimeMs/.test(content(node)));
      const legacy = matching('p', 'm-0 text-[15px] leading-7 text-secondary-foreground').some(description =>
        contains(owner, description) && /^,\s*[\w$]+\s*$/.test(content(description)))
        && matching('p', 'm-0 text-muted-foreground').some(error => contains(owner, error)
          && (error.classes.has('text-[13px]') || error.classes.has('text-compact'))
          && /^,\s*[\w$]+\s*$/.test(content(error)));
      return current || legacy;
    });
    const nextRun = !marker('automation-next-run').length || marker('automation-next-run').some(node => {
      if (node.tag !== 'p') return false;
      const value = content(node);
      if (/\.timestamp\b/.test(value)) return true;
      const call = value.match(/^,\s*([\w$]+)\s*\?\s*([\w$]+)\s*\?\s*[\w$]+\(\s*([\w$]+)\s*,\s*([\w$]+)\s*,\s*([\w$]+)\s*\)\s*:/);
      if (!call || call[2] !== call[3]) return false;
      const start = source.lastIndexOf('function ', node.start);
      const component = source.slice(start < 0 ? 0 : start, node.start);
      const now = component.match(/\bnow\s*:\s*([\w$]+)/)?.[1];
      const pattern = component.match(/\bcronPattern\s*:\s*([\w$]+)/)?.[1];
      const timeZone = component.match(/\btimeZone\s*:\s*([\w$]+)/)?.[1];
      const enabled = component.match(/\benabled\s*:\s*([\w$]+)/)?.[1];
      return enabled === call[1] && now === call[4] && timeZone === call[5] && pattern
        && new RegExp(`\\b${escape(call[2])}\\s*=\\s*\\([^)]*\\.userConfig\\?\\.enabled[^)]*\\)\\s*\\?\\s*[\\w$]+\\(\\s*${escape(pattern)}\\s*,\\s*${escape(now)}\\s*\\)`).test(component);
    });
    requireRule('automation-content', instructions && metadata && runs && modelValue && nextRun && details);
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
  if (marker('user-message-actions').length) {
    const times = matching('span', 'text-muted-foreground select-none px-1 mr-1 self-center whitespace-nowrap');
    const valid = marker('user-message-actions').some(owner => times.some(node => {
      const value = content(node).match(/^,\s*([\w$]+)\s*$/)?.[1];
      if (!value || !/["']data-screenshot-volatile["']\s*:\s*!0/.test(node.props)) return false;
      const name = escape(value);
      const prefix = source.slice(Math.max(0, node.start - 600), node.start);
      const child = new RegExp(`^,\\s*${name}\\s*,`);
      const dynamicTimestamp = new RegExp(`\\bformattedTime\\s*:\\s*${name}\\b`).test(prefix)
        && child.test(content(owner));
      const legacyActions = matching('div', 'user-input-buttons-container').some(legacy => child.test(content(legacy)));
      const currentActions = owner.props.includes('user-input-buttons-container');
      return dynamicTimestamp && (legacyActions || currentActions);
    }));
    const contentMarkers = marker('user-message-content');
    const contentBodies = contentMarkers.filter(body => body.classes.has('relative') && body.classes.has('p-0.5'));
    const legacyBodies = matching('div', 'relative flex-1 p-0.5');
    const message = marker('user-input-step').some(owner => marker('user-message-bubble').some(bubble =>
      contains(owner, bubble) && (contentBodies.some(body => contains(bubble, body))
        || contentMarkers.some(body => contains(owner, body))
          && legacyBodies.some(body => childOf(bubble, body)))));
    requireRule('user-message-time-control', valid && message);
  }
  if (marker('side-question-panel').length) {
    const valid = marker('side-question-question').some(owner => matching('span', 'shrink-0').some(node => {
      if (!childOf(owner, node)) return false;
      const label = content(node);
      const oldLabel = /^,\s*[\w$]+\s*\?\s*["']Side Question:["']\s*:\s*["']Side Question["']\s*$/.test(label);
      const currentLabel = /^,\s*[\w$]+\s*\?\s*[\w$]+\s*\?\s*["']Help:["']\s*:\s*["']Help["']\s*:\s*[\w$]+\s*\?\s*["']Side Question:["']\s*:\s*["']Side Question["']\s*$/.test(label);
      return oldLabel || currentLabel;
    }));
    requireRule('side-question-label', valid);
  }
  if (marker('settings-error-messages-card').length) {
    const valid = marker('settings-error-messages-card').some(owner =>
      matching('div', 'flex-1 flex flex-col gap-1 min-w-0').some(body => childOf(owner, body)
        && matching('span', 'font-medium text-foreground').some(node => childOf(body, node)
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

  if (marker('side-question-tab-header-title').length) {
    const dynamicHeader = marker('side-question-tab-header-title').some(owner =>
      /\btitle\s*:\s*[\w$]+\b/.test(owner.props)
      && marker('side-question-tab-header-prefix').some(prefix => childOf(owner, prefix)
        && /^,\s*[\w$]+\s*\|\|[\w$]+\.isEditing\s*\?\s*["']Side Question: ["']\s*:\s*["']Side Question["']\s*$/.test(content(prefix)))
      && marker('side-question-tab-header-name').some(name => childOf(owner, name)
        && /["']aria-label["']\s*:\s*[\w$]+\.isEditing\s*\?\s*void 0\s*:\s*`Edit side question title: \$\{[\w$]+\}`/.test(name.props)));
    const newHeader = marker('side-question-tab-header-title').some(owner =>
      /\btitle\s*:\s*["']New Side Question["']/.test(owner.props)
      && /,\s*["']New Side Question["']\s*$/.test(content(owner)));
    requireRule('side-question-header-content', dynamicHeader && newHeader);
  }

  if (marker('instance-selector-trigger').length) {
    const trigger = marker('instance-selector-trigger').some(owner =>
      matching('span', 'truncate text-left flex-1').some(node => contains(owner, node)
        && /^,\s*[\w$]+\s*\?\s*[\w$]+\.displayName\s*:\s*["']Loading instances\.\.\.["']\s*$/.test(content(node))));
    const items = marker('instance-selector-item-', true).some(item =>
      /\bvalue\s*:\s*[\w$]+\.uuid/.test(item.props)
      && /^,\s*[\w$]+\.displayName\s*$/.test(content(item)));
    const heading = marker('instance-selector-instances-heading').some(node =>
      /^,\s*["']Remote Control Instances["']\s*$/.test(content(node)));
    const error = marker('instance-selector-listing-error').some(node => {
      const value = content(node).match(/^,\s*([\w$]+)\s*$/)?.[1];
      if (!value) return false;
      const start = source.lastIndexOf('function ', node.start);
      const component = source.slice(start < 0 ? 0 : start, node.start);
      const parameter = component.match(/\{\s*message\s*:\s*([\w$]+)/)?.[1];
      const template = component.match(/\b([\w$]+)\s*=\s*`Failed to load instances: \$\{([\w$]+)\}`/)?.slice(1);
      return parameter && template?.[0] === value && template[1] === parameter;
    });
    requireRule('instance-selector-content', trigger && items && heading && error);
  }

  if (marker('location-local').length) {
    const local = marker('location-local').some(owner => matching('span', 'flex items-baseline min-w-0')
      .some(body => contains(owner, body) && matching('span', 'truncate').some(node => childOf(body, node))));
    const cloud = matching(null, '').some(node => /["']data-testid["']\s*:\s*[\w$]+\.id===\s*["']default["']\s*\?\s*["']location-cloud["']\s*:\s*`location-cloud-\$\{/.test(node.props)
      && /["']data-env-id["']\s*:\s*[\w$]+\.id/.test(node.props)
      && /^,\s*[\w$]+\.name\s*$/.test(content(node)));
    requireRule('location-content', local && cloud);
  }

  if (source.includes('"plugin-connection-local"')) {
    const calls = matching(null, '').filter(node => /\btestId\s*:\s*["']plugin-connection-(?:local|cloud)["']/.test(node.props));
    const names = calls.map(node => source.slice(node.open + 1).match(/^\s*([\w$]+)/)?.[1]);
    const declaration = names[0] && new RegExp(`function\\s+${escape(names[0])}\\s*\\(\\s*\\{[^}]*\\bsubtitle\\s*:\\s*([\\w$]+)[^}]*\\btestId\\s*:\\s*([\\w$]+)[^}]*\\}\\s*\\)`).exec(source);
    const valid = calls.length >= 2 && names.every(name => name === names[0]) && declaration
      && matching('div', 'flex flex-wrap items-center gap-3 p-3').some(owner =>
        new RegExp(`["']data-testid["']\\s*:\\s*${escape(declaration[2])}(?=\\s*[,}])`).test(owner.props)
        && matching('div', 'min-w-[10rem]').some(body => childOf(owner, body)
          && matching('div', 'truncate text-muted-foreground').some(node => childOf(body, node)
            && new RegExp(`\\btitle\\s*:\\s*${escape(declaration[1])}(?=\\s*[,}])`).test(node.props)
            && new RegExp(`^,\\s*${escape(declaration[1])}\\s*$`).test(content(node)))));
    requireRule('plugin-connection-content', Boolean(valid));
  }

  if (marker('media-modal-header').length) {
    const valid = marker('media-modal-title').some(owner => matching('div', 'truncate font-medium text-white')
      .some(node => contains(owner, node) && /^,\s*[\w$]+\.title\s*$/.test(content(node)))
      && matching('div', 'line-clamp-2 text-white/70')
        .some(node => contains(owner, node) && /^,\s*[\w$]+\.description\s*$/.test(content(node))));
    requireRule('media-title-content', valid);
  }

  if (marker('url-security-host').length) {
    const host = marker('url-security-host').some(node => node.tag === 'span'
      && /^,\s*[\w$]+\.host\s*$/.test(content(node)));
    const originCall = matching(null, '').find(node => /\bsubtitleTestId\s*:\s*["']url-security-origin["']/.test(node.props)
      && /\bsubtitle\s*:\s*[\w$]+\.origin\b/.test(node.props));
    const originComponent = originCall && source.slice(originCall.open + 1).match(/^\s*([\w$]+)/)?.[1];
    const originParameters = originComponent && new RegExp(
      'function\\s+' + escape(originComponent) + '\\s*\\(\\s*\\{[^}]*\\bsubtitle\\s*:\\s*([\\w$]+)[^}]*\\bsubtitleTestId\\s*:\\s*([\\w$]+)[^}]*\\}'
    ).exec(source);
    const directOrigin = marker('url-security-origin').some(node => node.tag === 'span'
      && /^,\s*[\w$]+\.origin\s*$/.test(content(node)));
    const origin = directOrigin || originParameters && matching('span', 'text-secondary-foreground break-all').some(node =>
      node.props.match(/["']data-testid["']\s*:\s*([\w$]+)/)?.[1] === originParameters[2]
      && new RegExp('^,\\s*' + escape(originParameters[1]) + '\\s*$').test(content(node)));
    const summary = marker('url-security-summary').some(node => /^,\s*[\w$]+\.summary\s*$/.test(content(node)));
    const certificate = marker('url-security-certificate').some(owner => {
      const direct = ['subjectName', 'issuer'].every(field => matching('dd', 'text-foreground').some(node =>
        contains(owner, node) && new RegExp('\\.' + field + '\\b').test(content(node))));
      if (direct) return true;
      const scopeStart = Math.max(0, owner.start - 5000);
      const scope = source.slice(scopeStart, owner.start);
      const declaration = [...scope.matchAll(
        /([\w$]+)\s*=\s*\(\s*\{[^}]*\bcertificate\s*:\s*[\w$]+[^}]*\}\s*\)\s*=>\s*\{/g
      )].at(-1);
      if (!declaration) return false;
      const bodyStart = scopeStart + declaration.index + declaration[0].length - 1;
      const bodyEnd = closing(source, bodyStart, '{', '}');
      if (bodyEnd < owner.start) return false;
      const body = source.slice(bodyStart, bodyEnd);
      const args = content(owner);
      return ['subjectName', 'issuer'].every(field => {
        const node = matching('dd', 'break-all text-foreground').find(candidate =>
          candidate.start > bodyStart && candidate.start < owner.start
          && new RegExp('\\.' + field + '\\b').test(content(candidate)));
        if (!node) return false;
        const prefix = source.slice(Math.max(bodyStart, node.start - 100), node.start);
        const variable = prefix.match(/(?:^|[,;])\s*(?:var\s+)?([\w$]+)\s*=\s*[\w$]+$/)?.[1];
        return Boolean(variable && body.includes('.' + field)
          && new RegExp('(?:^|,)\\s*' + escape(variable) + '\\s*(?=,|$)').test(args));
      });
    });
    const siteData = !marker('url-security-site-data-cleared').length || marker('url-security-popover').some(owner => {
      const warning = matching('span', 'text-secondary-foreground leading-relaxed').some(node => contains(owner, node)
        && /^,\s*["']Clearing cookies and site data for ["']\s*,\s*[\w$]+\.host\s*,\s*["'] may sign you out of this site\.["']\s*$/.test(content(node)));
      const cleared = marker('url-security-site-data-cleared').some(node => contains(owner, node)
        && /^,\s*["']Site data cleared for ["']\s*,\s*[\w$]+\.host\s*,\s*["']\.["']\s*$/.test(content(node)));
      const failed = matching('span', 'text-error').some(node => contains(owner, node)
        && /^,\s*["']Could not clear site data for ["']\s*,\s*[\w$]+\.host\s*,\s*["']\.["']\s*$/.test(content(node)));
      return warning && cleared && failed;
    });
    requireRule('security-certificate-content', host && origin && summary && certificate && siteData);
  }
  if (marker('pdf-floating-toolbar').length) {
    const viewport = /element\(\s*["']div["']\s*,\s*\{\s*className\s*:\s*["']pdf-viewport["']\s*,\s*["']data-testid["']\s*:\s*["']pdf-viewport["']/.test(source);
    const comments = /className\s*:\s*`floating-comment-card\s/.test(source)
      && /className\s*:\s*["']comment-content["']/.test(source);
    requireRule('pdf-document-content', viewport && comments && source.includes('jetski-pdf-viewer-host'));
  }
  return missing;
}
