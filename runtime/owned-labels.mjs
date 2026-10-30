export function createOwnedLabels(records, protectedSelectors, retranslate) {
  const owned = record => Boolean(record.marketplaceShelf || record.systemEvent);
  const selectors = [...new Set(records.filter(owned).map(record => record.selector))].join(',');
  const tracked = new Map();
  const rendererTypes = new WeakMap();
  let timer;

  function currentFiber(element) {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    const stored = key && element[key];
    if (!stored || stored.tag !== 5 || stored.stateNode !== element) return null;
    const path = [];
    let root = stored;
    while (root.return) { path.push(root); root = root.return; }
    if (root.tag !== 3 || !root.stateNode?.current) return null;
    let current = root.stateNode.current;
    const committed = [current];
    for (let index = path.length - 1; index >= 0; index--) {
      let child = current.child;
      while (child && child !== path[index] && child !== path[index].alternate) child = child.sibling;
      if (!child) return null;
      current = child;
      committed.push(current);
    }
    return committed.reverse();
  }

  function builtinShelf(element) {
    const section = element.closest('[data-testid="customizations-marketplace"] section.flex.flex-col.gap-3');
    if (!section || !section.parentElement.matches('div.flex.flex-col.gap-10')) return false;
    const chain = currentFiber(section);
    return Boolean(chain && chain[0].key === null && chain[1]?.tag === 5
      && chain[1].stateNode === section.parentElement);
  }

  function isSystemRenderer(type) {
    if (typeof type !== 'function') return false;
    if (!rendererTypes.has(type)) {
      const source = Function.prototype.toString.call(type);
      rendererTypes.set(type, ['auto_proceed_uri', 'fallbackMarkdown', 'renderInfo'].every(token => source.includes(token)));
    }
    return rendererTypes.get(type);
  }

  function systemEvent(element, expected) {
    for (const fiber of currentFiber(element) ?? []) {
      if (isSystemRenderer(fiber.type)) {
        const step = fiber.memoizedProps?.step;
        return step?.eventType === expected && !step.renderInfo?.title
          && !(step.renderInfo?.titleParts?.length);
      }
    }
    return false;
  }

  function matches(record, element) {
    if (record.marketplaceShelf && !builtinShelf(element)) return false;
    return !record.systemEvent || systemEvent(element, record.systemEvent);
  }

  function isProtected(element, record) {
    const section = record?.marketplaceShelf ? element.closest('section') : null;
    for (let owner = element.closest(protectedSelectors); owner; owner = owner.parentElement?.closest(protectedSelectors)) {
      // Only the verified shelf header may cross the marketplace metadata boundary.
      if (section && owner.parentElement === section && owner.matches('div.flex.flex-col.gap-1.px-3')) continue;
      return true;
    }
    return false;
  }

  function remember(element, attribute, record, source, target) {
    if (!owned(record) || source === target) return;
    let entries = tracked.get(element);
    if (!entries) tracked.set(element, entries = new Map());
    entries.set(attribute, { record, source, target });
    timer ??= setTimeout(refresh, 200);
  }

  function refresh() {
    timer = undefined;
    for (const [element, entries] of tracked) {
      if (!element.isConnected) { tracked.delete(element); continue; }
      for (const [attribute, entry] of entries) {
        if (matches(entry.record, element) && !isProtected(element, entry.record)) continue;
        if (attribute && element.getAttribute(attribute) === entry.target) element.setAttribute(attribute, entry.source);
        entries.delete(attribute);
      }
      // React may change the source props without writing an equal virtual text value.
      retranslate(element);
      if (!entries.size) tracked.delete(element);
    }
    if (tracked.size) timer ??= setTimeout(refresh, 200);
  }

  function visit(root, translateText, translateAttributes) {
    if (!selectors || root.nodeType !== 1) return;
    const candidates = [...(root.matches(selectors) ? [root] : []), ...root.querySelectorAll(selectors)];
    for (const element of candidates) {
      translateAttributes(element);
      for (const node of element.childNodes) if (node.nodeType === 3) translateText(node);
    }
  }

  return { matches, isProtected, remember, visit };
}
