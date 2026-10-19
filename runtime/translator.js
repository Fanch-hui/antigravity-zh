;(function installAntigravityChinese() {
  'use strict';
  const dictionary = /*__AGY_ZH_DICTIONARY__*/ null;
  if (!Array.isArray(dictionary) || window.__AGY_ZH_RUNTIME__) return;
  if (window.top !== window || location.protocol !== 'https:' || location.hostname !== '127.0.0.1') return;
  const scriptStartedMs = performance.now();

  const attributes = ['title', 'placeholder', 'aria-label'];
  const { protectedSelectors, scopes, staticSurface, controls, commandMenu } = /*__AGY_ZH_SURFACES__*/ null;
  const index = new Map();
  const templates = [];
  const originals = new WeakMap();
  const combinedParents = new WeakMap();

  for (const record of dictionary) {
    if (typeof record.source !== 'string' || typeof record.target !== 'string') continue;
    if (record.template?.pattern?.startsWith('^') && record.template.pattern.endsWith('$')) {
      templates.push({ ...record, regex: new RegExp(record.template.pattern) });
      continue;
    }
    const source = record.source.trim();
    const group = index.get(source) || [];
    group.push(record);
    index.set(source, group);
  }
  for (const group of index.values()) group.sort((a, b) => specificity(b) - specificity(a));
  templates.sort((a, b) => specificity(b) - specificity(a));

  function specificity(record) {
    return record.settingLabel ? 3 : record.selector ? 2 : record.scope && record.scope !== 'generic' ? 1 : 0;
  }

  function closest(element, selector) {
    return selector ? element?.closest(selector) : null;
  }

  function safe(element, attribute) {
    if (!element || closest(element, protectedSelectors)) return false;
    const toast = closest(element, '.border-l-orange-500');
    const button = closest(element, 'button');
    if (toast && button && !button.hasAttribute('aria-label') && !closest(button, '.justify-start')) return false;
    if (element.localName === 'input' || element.localName === 'textarea') return attributes.includes(attribute);
    return true;
  }

  function settingLabels(element) {
    const labels = new Set();
    for (let owner = element; owner && owner !== document.body; owner = owner.parentElement) {
      const owners = [owner];
      if (owner.id && owner.matches('[role="listbox"], [data-select-popup]')) {
        for (const trigger of document.querySelectorAll('[aria-controls]')) {
          if (trigger.getAttribute('aria-controls').split(/\s+/).includes(owner.id)) owners.push(trigger);
        }
      }
      for (const item of owners) {
        const ids = item.getAttribute('aria-labelledby')?.split(/\s+/) || [];
        for (const id of ids) if (id.startsWith('dropdown-label-')) labels.add(document.getElementById(id));
      }
      if (owner.matches('.py-2.px-3.justify-between')) labels.add(owner.querySelector('[id^="dropdown-label-"]'));
    }
    return [...labels].filter(Boolean);
  }

  function settingMatches(element, expected) {
    const accepted = new Set([expected, ...(index.get(expected) || []).map(record => record.target.trim())]);
    return settingLabels(element).some(label => accepted.has(label.textContent.trim()));
  }

  function matchesSlashCommand(record, element, attribute) {
    const option = closest(element, commandMenu.option);
    if (!option && !record.slashCommand) return true;
    return !attribute && !!record.slashCommand && !!option
      && element.matches(commandMenu.description) && !option.querySelector(commandMenu.source)
      && option.querySelector(commandMenu.label)?.textContent.trim() === record.slashCommand;
  }

  function matches(record, element, attribute) {
    if (!matchesSlashCommand(record, element, attribute)) return false;
    if (record.kind === 'attribute' && (!attribute || (record.attribute && record.attribute !== attribute))) return false;
    if (record.kind === 'text' && attribute) return false;
    if (record.attribute && record.attribute !== attribute) return false;
    if (record.selector && !(record.selectorMode === 'self' ? element.matches(record.selector) : closest(element, record.selector))) return false;
    if (record.settingLabel && !settingMatches(element, record.settingLabel)) return false;
    if (record.scope && record.scope !== 'generic') {
      const selector = scopes[record.scope];
      if (!selector || (!closest(element, selector) && !(record.scope === 'settings' && settingLabels(element).length))) return false;
    }
    if (record.selector || record.settingLabel || (record.scope && record.scope !== 'generic')) return true;
    if (attribute && ['input', 'textarea'].includes(element.localName)) return true;
    return !!closest(element, `${controls}, ${staticSurface}`);
  }

  function formatDuration(value) {
    if (value === '<1m') return '不到 1 分钟';
    const units = { d: '天', h: '小时', m: '分钟', day: '天', days: '天', hour: '小时', hours: '小时', minute: '分钟', minutes: '分钟' };
    return value.replace(/,\s*/g, ' ').replace(/(\d+)\s*(days?|hours?|minutes?|[dhm])\b/g,
      (_, number, unit) => number + ' ' + units[unit]);
  }

  function applyTemplate(record, text) {
    const match = record.regex.exec(text);
    return record.template.replacement.replace(/\$\$|\$(\d+)/g, (placeholder, number) => {
      if (placeholder === '$$') return '$';
      const capture = match[Number(number)] || '';
      const mapping = record.captureMappings?.[Number(number) - 1];
      if (mapping && Object.hasOwn(mapping, capture)) return mapping[capture];
      return record.captureFormats?.[Number(number) - 1] === 'duration' ? formatDuration(capture) : capture;
    });
  }

  function localized(value, element, attribute, selfOnly = false) {
    const text = value.trim();
    if (!text || !safe(element, attribute)) return value;
    let target;
    const eligible = item => (!selfOnly || item.selector && item.selectorMode === 'self')
      && matches(item, element, attribute);
    const record = (index.get(text) || []).find(eligible);
    if (record) target = record.target.trim();
    else {
      const template = templates.find(item => item.regex.test(text) && eligible(item));
      if (template) target = applyTemplate(template, text).trim();
    }
    if (target === undefined) return value;
    const start = value.indexOf(text);
    return value.slice(0, start) + target + value.slice(start + text.length);
  }

  function recoverCombined(parent, snapshot) {
    for (const entry of snapshot.entries) {
      if (entry.node.parentElement === parent && entry.node.nodeValue === entry.target) {
        entry.node.nodeValue = entry.source;
      }
    }
    combinedParents.delete(parent);
  }

  function sourceText(node, entry) {
    const previous = entry || originals.get(node);
    return previous?.target === node.nodeValue ? previous.source : node.nodeValue;
  }

  function translateCombined(parent) {
    if (!parent || closest(parent, commandMenu.option)) return false;
    const nodes = [...parent.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
    let snapshot = combinedParents.get(parent);
    const sameNodes = snapshot && nodes.length === snapshot.entries.length &&
      nodes.every((node, position) => node === snapshot.entries[position].node);
    if (snapshot && (!sameNodes || !safe(parent))) {
      recoverCombined(parent, snapshot);
      snapshot = undefined;
    }
    if (nodes.length < 2 || !safe(parent)) return false;
    const sources = nodes.map((node, position) => sourceText(node, snapshot?.entries[position]));
    const source = sources.join('');
    // Joining around inline shortcuts requires an exact label selector.
    const target = localized(source, parent, undefined, parent.children.length > 0);
    if (target === source) {
      if (snapshot) recoverCombined(parent, snapshot);
      return false;
    }
    const entries = nodes.map((node, position) => ({ node, source: sources[position], target: position === 0 ? target : '' }));
    combinedParents.set(parent, { entries });
    for (const entry of entries) {
      originals.delete(entry.node);
      if (entry.node.nodeValue !== entry.target) entry.node.nodeValue = entry.target;
    }
    return true;
  }

  function translateCommandDescription(element) {
    const description = closest(element, commandMenu.description);
    if (!description || !closest(description, commandMenu.option)) return false;
    if (description.querySelector(protectedSelectors)) return true;
    const walker = document.createTreeWalker(description, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    const sources = nodes.map(node => sourceText(node));
    const source = sources.join('');
    const target = localized(source, description);
    for (let i = 0; i < nodes.length; i++) {
      const value = target === source ? sources[i] : i === 0 ? target : '';
      originals.set(nodes[i], { source: sources[i], target: value });
      if (nodes[i].nodeValue !== value) nodes[i].nodeValue = value;
    }
    return true;
  }

  function translateText(node) {
    const element = node.parentElement;
    if (translateCommandDescription(element)) return;
    if (translateCombined(element)) return;
    const value = node.nodeValue;
    const previous = originals.get(node);
    const source = previous?.target === value ? previous.source : value;
    const target = localized(source, element);
    if (target === value) return;
    originals.set(node, { source, target });
    node.nodeValue = target;
  }

  function translateAttributes(element) {
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const target = localized(value, element, attribute);
      if (target !== value) element.setAttribute(attribute, target);
    }
  }

  function translate(root = document.body) {
    if (!root || !root.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) return translateText(root);
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    translateAttributes(root);
    translateCombined(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(protectedSelectors)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translateText(node);
      else translateAttributes(node);
    }
  }

  function start() {
    const firstPassStartedMs = performance.now();
    translate();
    const firstPassMs = performance.now() - firstPassStartedMs;
    const observer = new MutationObserver(records => {
      const roots = new Set();
      for (const record of records) {
        const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        const option = closest(element, commandMenu.option);
        if (option) roots.add(option);
        if (record.type === 'childList') {
          if (combinedParents.has(record.target)) roots.add(record.target);
          for (const node of record.addedNodes) roots.add(node);
        }
        else roots.add(record.target);
        if (record.type === 'attributes' && ['aria-controls', 'aria-labelledby'].includes(record.attributeName)) {
          const ids = record.target.getAttribute('aria-controls')?.split(/\s+/) || [];
          for (const id of ids) if (document.getElementById(id)) roots.add(document.getElementById(id));
        }
      }
      for (const root of roots) translate(root);
    });
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes, 'aria-labelledby', 'aria-controls']
    });
    const timing = Object.freeze({ scriptStartedMs, firstPassStartedMs, firstPassMs, readyMs: performance.now() });
    window.__AGY_ZH_RUNTIME__ = Object.freeze({ version: '0.2.3', translate, timing });
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
