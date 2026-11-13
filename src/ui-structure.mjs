export function closing(source, start, open, close) {
  function skipTemplateExpression(text, index) {
    let depth = 1;
    for (; index < text.length; index++) {
      const char = text[index];
      if ('"\'`'.includes(char)) index = skipString(text, index) - 1;
      else if (char === '/' && text[index + 1] === '*') {
        index = text.indexOf('*/', index + 2);
        if (index < 0) return text.length;
        index++;
      } else if (char === '/' && text[index + 1] === '/') {
        index = text.indexOf('\n', index + 2);
        if (index < 0) return text.length;
      } else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) return index + 1;
    }
    return text.length;
  }
  function skipString(text, start) {
    const quote = text[start];
    for (let index = start + 1; index < text.length; index++) {
      if (text[index] === '\\') index++;
      else if (quote === '`' && text[index] === '$' && text[index + 1] === '{') {
        index = skipTemplateExpression(text, index + 2) - 1;
      } else if (text[index] === quote) return index + 1;
    }
    return text.length;
  }

  let depth = 0;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if ('"\'`'.includes(char)) index = skipString(source, index) - 1;
    else if (char === '/' && source[index + 1] === '*') {
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

export function readElements(source) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  function skipTemplateExpression(text, start, limit = text.length) {
    let depth = 1;
    for (let index = start; index < limit; index++) {
      const char = text[index];
      if ('"\'`'.includes(char)) index = skipString(text, index, limit) - 1;
      else if (char === '/' && text[index + 1] === '*') {
        index = text.indexOf('*/', index + 2);
        if (index < 0 || index >= limit) return limit;
        index++;
      } else if (char === '/' && text[index + 1] === '/') {
        index = text.indexOf('\n', index + 2);
        if (index < 0 || index >= limit) return limit;
      } else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) return index;
    }
    return limit;
  }
  function skipString(text, start, limit = text.length) {
    const quote = text[start];
    for (let index = start + 1; index < limit; index++) {
      if (text[index] === '\\') index++;
      else if (quote === '`' && text[index] === '$' && text[index + 1] === '{') {
        index = skipTemplateExpression(text, index + 2, limit);
      } else if (text[index] === quote) return index + 1;
    }
    return limit;
  }
  function skipComment(text, index, limit) {
    if (text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      return end < 0 || end >= limit ? limit : end + 2;
    }
    if (text[index + 1] === '/') {
      const end = text.indexOf('\n', index + 2);
      return end < 0 || end >= limit ? limit : end + 1;
    }
    return index;
  }
  function valueEnd(text, start, limit) {
    const stack = [];
    for (let index = start; index < limit; index++) {
      const char = text[index];
      if ('"\'`'.includes(char)) index = skipString(text, index, limit) - 1;
      else if (char === '/' && ['*', '/'].includes(text[index + 1])) index = skipComment(text, index, limit) - 1;
      else if (pairs[char]) stack.push(pairs[char]);
      else if (stack.length && char === stack.at(-1)) stack.pop();
      else if (!stack.length && (char === ',' || char === '}')) return index;
    }
    return limit;
  }
  function keyColon(text, start, limit) {
    const stack = [];
    for (let index = start; index < limit; index++) {
      const char = text[index];
      if ('"\'`'.includes(char)) index = skipString(text, index, limit) - 1;
      else if (char === '/' && ['*', '/'].includes(text[index + 1])) index = skipComment(text, index, limit) - 1;
      else if (pairs[char]) stack.push(pairs[char]);
      else if (stack.length && char === stack.at(-1)) stack.pop();
      else if (!stack.length && char === ':') return index;
      else if (!stack.length && (char === ',' || char === '}')) return -1;
    }
    return -1;
  }
  function propertyName(text) {
    const key = text.trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      return key.slice(1, -1);
    }
    if (key.startsWith('[') && key.endsWith(']')) return propertyName(key.slice(1, -1));
    return key;
  }
  function properties(object) {
    const values = new Map();
    const limit = object.length - 1;
    let index = 1;
    while (index < limit) {
      while (index < limit && (object[index] === ',' || /\s/.test(object[index]))) index++;
      if (index >= limit) break;
      const colon = keyColon(object, index, limit);
      if (colon < 0) {
        const end = valueEnd(object, index, limit);
        if (end >= limit) break;
        index = end + 1;
        continue;
      }
      const key = propertyName(object.slice(index, colon));
      const start = colon + 1;
      const end = valueEnd(object, start, limit);
      values.set(key, object.slice(start, end).trim());
      index = end < limit && object[end] === ',' ? end + 1 : limit;
    }
    return values;
  }
  function stringValues(expression) {
    const values = [];
    for (let index = 0; index < expression.length; index++) {
      const quote = expression[index];
      if (quote === '"' || quote === "'") {
        const end = skipString(expression, index);
        values.push(expression.slice(index + 1, end - 1).replace(/\\([\\'"`])/g, '$1'));
        index = end - 1;
      } else if (quote === '`') {
        let value = '';
        for (index++; index < expression.length; index++) {
          if (expression[index] === '\\') value += expression[++index] ?? '';
          else if (expression[index] === '$' && expression[index + 1] === '{') {
            values.push(value);
            value = '';
            const end = skipTemplateExpression(expression, index + 2);
            values.push(...stringValues(expression.slice(index + 2, end)));
            index = end;
          } else if (expression[index] === '`') {
            values.push(value);
            break;
          } else value += expression[index];
        }
      }
    }
    return values;
  }
  function templateStrings(value) {
    const strings = [];
    let text = '';
    for (let index = 1; index < value.length - 1; index++) {
      if (value[index] === '\\') text += value[++index] ?? '';
      else if (value[index] === '$' && value[index + 1] === '{') {
        strings.push(text);
        text = '';
        index = skipTemplateExpression(value, index + 2);
      } else text += value[index];
    }
    strings.push(text);
    return strings;
  }
  function literalClassStrings(expression) {
    const value = expression.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return stringValues(value);
    }
    if (value.startsWith('`') && value.endsWith('`')) return templateStrings(value);
    return [];
  }
  function splitArguments(expression, start, end) {
    const ranges = [];
    const stack = [];
    let partStart = start;
    for (let index = start; index < end; index++) {
      const char = expression[index];
      if ('"\'`'.includes(char)) index = skipString(expression, index, end) - 1;
      else if (char === '/' && ['*', '/'].includes(expression[index + 1])) index = skipComment(expression, index, end) - 1;
      else if (pairs[char]) stack.push(pairs[char]);
      else if (stack.length && char === stack.at(-1)) stack.pop();
      else if (!stack.length && char === ',') {
        ranges.push(expression.slice(partStart, index));
        partStart = index + 1;
      }
    }
    ranges.push(expression.slice(partStart, end));
    return ranges;
  }
  function classStrings(expression) {
    const value = expression.trim();
    const direct = literalClassStrings(value);
    if (direct.length) return direct;
    if (!/^[\w$]+\s*\(/.test(value)) return [];
    const start = value.indexOf('(');
    const end = closing(value, start, '(', ')');
    return end < 0 ? [] : splitArguments(value, start + 1, end).flatMap(literalClassStrings);
  }
  function addNode(nodes, start, match, tag) {
    const open = source.indexOf('(', start);
    const propsStart = start + match.length - 1;
    const propsEnd = closing(source, propsStart, '{', '}');
    if (propsEnd < 0) return;
    const props = source.slice(propsStart, propsEnd + 1);
    const attributes = properties(props);
    const classes = new Set(classStrings(attributes.get('className') ?? '')
      .flatMap(value => value.split(/\s+/)).filter(Boolean));
    nodes.push({ start, open, propsEnd, tag, props, attributes, classes });
  }

  const nodes = [];
  const directCalls = /\.createElement\s*\(\s*(?:(['"])([\w$-]+)\1|([\w$]+(?:\.[\w$]+)*))\s*,\s*\{/g;
  for (const match of source.matchAll(directCalls)) {
    addNode(nodes, match.index, match[0], match[2] ?? match[3]);
  }
  const factoryAliases = new Set([...source.matchAll(/\b([\w$]+)\s*=\s*[\w$]+\.createElement\b/g)]
    .map(match => match[1]));
  const callInvocations = /\b([\w$]+)\.call\s*\(\s*[\w$]+\s*,\s*(?:(['"])([\w$-]+)\2|([\w$]+(?:\.[\w$]+)*))\s*,\s*\{/g;
  for (const match of source.matchAll(callInvocations)) {
    if (factoryAliases.has(match[1])) addNode(nodes, match.index, match[0], match[3] ?? match[4]);
  }
  return nodes.sort((left, right) => left.start - right.start);
}
