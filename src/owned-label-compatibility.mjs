export function checkOwnedLabelCompatibility(source, nodes, closing) {
  const missing = [];
  function argumentsAfterProps(node) {
    const end = closing(source, node.open, '(', ')');
    const ranges = [];
    let start = node.propsEnd + 2;
    for (let index = start; index < end; index++) {
      const char = source[index];
      if ('\"\'`'.includes(char)) {
        while (++index < end) {
          if (source[index] === '\\') index++;
          else if (source[index] === char) break;
        }
      } else if ('([{'.includes(char)) {
        index = closing(source, index, char, { '(': ')', '[': ']', '{': '}' }[char]);
        if (index < 0) return [];
      } else if (char === ',') { ranges.push([start, index]); start = index + 1; }
    }
    if (start < end) ranges.push([start, end]);
    return ranges;
  }
  function directlyRendered(range, node) {
    if (node.start < range[0] || node.start >= range[1]) return false;
    const prefix = source.slice(range[0], node.start);
    return /^[\s\w$().!<>=&|?:-]*$/.test(prefix) && !/[\w$]\s*\(/.test(prefix)
      && [...prefix].filter(char => char === '(').length === [...prefix].filter(char => char === ')').length;
  }
  const shelves = nodes.filter(node => node.tag === 'section' && node.classes.has('gap-3'));
  const parents = nodes.filter(node => node.tag === 'div'
    && ['flex', 'flex-col', 'gap-10'].every(name => node.classes.has(name)));
  if (source.includes('"More Plugins"') && parents.length) {
    const ranges = parents.flatMap(parent => {
      const children = argumentsAfterProps(parent);
      return children.map(range => ({ range, multiple: children.length > 1 }));
    });
    const fixed = shelves.filter(node => /["']aria-label["']\s*:\s*["'](?:More Plugins|Plugins|Skills)["']/.test(node.props));
    const fixedValid = fixed.length > 0 && fixed.every(node => !/\bkey\s*:/.test(node.props)
      && ranges.some(({ range }) => directlyRendered(range, node)));
    const dynamic = shelves.filter(node => /["']aria-label["']\s*:\s*[\w$]+\.displayName/.test(node.props));
    const dynamicValid = dynamic.length > 0 && dynamic.every(node => ranges.some(({ range: [start, end], multiple }) => {
        if (!multiple) return false;
        const argument = source.slice(start, end);
        const map = /^\s*[\w$]+\.map\s*\(\s*([\w$]+)\s*=>\s*\{/.exec(argument);
        if (!map || node.start < start || node.start >= end) return false;
        const open = start + argument.indexOf('(');
        if (source.slice(closing(source, open, '(', ')') + 1, end).trim()) return false;
        const name = map[1].replace(/[$]/g, '\\$');
        return new RegExp(`\\bkey\\s*:\\s*${name}\\.id\\b`).test(node.props)
          && new RegExp(`["']aria-label["']\\s*:\\s*${name}\\.displayName\\b`).test(node.props);
      }));
    if (!fixedValid || !dynamicValid) missing.push('marketplace-heading-source');
  }
  if (source.includes('"Goal Verification"')) {
    const renderer = /\bsystemMessage\s*:\s*\{[\s\S]*?\brenderer\s*:\s*\(\s*\{\s*step\s*:\s*[\w$]+\s*,\s*debugMode\s*:\s*[\w$]+\s*}\s*\)\s*=>\s*\{/.exec(source);
    const start = renderer ? renderer.index + renderer[0].length - 1 : -1;
    const body = start < 0 ? '' : source.slice(start, closing(source, start, '{', '}') + 1);
    const events = [['goal_stop', 'Goal Verification'], ['idle_no_message', 'Idle Guard Warning'], ['fork_notice', 'Fork Environment Notice']];
    if (!['auto_proceed_uri', 'renderInfo', 'fallbackMarkdown'].every(token => body.includes(token))
      || !events.every(([event, label]) => new RegExp(`case\\s*["']${event}["']\\s*:\\s*return\\s*["']${label}["']`).test(source))
      || !/\bstep\s*:\s*[\w$]+\.step\.value/.test(source)) missing.push('system-heading-source');
  }
  if (source.includes('"local_sot_item"')) {
    const local = nodes.some(node => /\btitle\s*:\s*["']Local Checkout["']/.test(node.props)
      && /\bname\s*:\s*["']computer["']/.test(node.props));
    const trigger = /case\s*["']sot["']\s*:\s*var\s+[\w$]+\s*=\s*[\w$]+\.createElement\([^;]*\bname\s*:\s*["']computer["'][^;]*;break\s+[\w$]+;default:[^;]*\bname\s*:\s*["']call_split["']/.test(source);
    if (!local || !trigger || !source.includes('M55.39-150.77v-60')) missing.push('checkout-label-source');
  }
  return missing;
}
