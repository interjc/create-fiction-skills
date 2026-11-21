// A lexical scan, not evaluation: checking a repository must not run its scripts.
import { stripBom } from './repo.mjs';

const idStart = /[$_\p{ID_Start}]/u;
const idContinue = /[$\u200c\u200d\p{ID_Continue}]/u;
const beforeExpression = new Set([
  'return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'in', 'instanceof',
  'of', 'yield', 'await', 'else', 'do',
]);
const control = new Set(['if', 'while', 'for', 'with', 'catch', 'switch']);
const escapeChars = new Map(Object.entries({
  n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0',
}));

function unicodeEscape(source, at) {
  const match = /^(?:u\{([0-9a-f]+)\}|u([0-9a-f]{4}))/i.exec(source.slice(at));
  if (!match) return;
  const point = Number.parseInt(match[1] ?? match[2], 16);
  if (point <= 0x10ffff) return [String.fromCodePoint(point), at + match[0].length];
}

export function jsTokens(text) {
  const source = stripBom(text).replace(/\r\n?|\u2028|\u2029/g, '\n');
  const tokens = [];
  let i = 0;
  let line = 1;
  const push = (kind, value, at = line, column) => tokens.push({ kind, value, line: at, column });
  const pointAt = at => at < source.length ? String.fromCodePoint(source.codePointAt(at)) : '';

  function string(quote, startLine) {
    const column = i - (i ? source.lastIndexOf('\n', i - 1) : -1);
    i++;
    let value = '';
    let template = false;
    while (i < source.length) {
      const char = source[i++];
      if (char === quote) {
        push(template ? 'template' : 'string', template ? quote : value, startLine, column);
        return;
      }
      if (char === '\\') {
        const esc = source[i++];
        const unicode = esc === 'u' && unicodeEscape(source, i - 1);
        const hex = esc === 'x' && /^[0-9a-f]{2}/i.exec(source.slice(i));
        const octal = /[0-7]/.test(esc ?? '') && /^[0-7]{1,3}/.exec(source.slice(i - 1));
        if (unicode) {
          [value, i] = [value + unicode[0], unicode[1]];
        } else if (hex) {
          value += String.fromCharCode(Number.parseInt(hex[0], 16));
          i += 2;
        } else if (octal) {
          const digits = octal[0][0] > '3' ? octal[0].slice(0, 2) : octal[0];
          value += String.fromCharCode(Number.parseInt(digits, 8));
          i += digits.length - 1;
        } else if (esc === '\n') {
          line++;
        } else {
          value += escapeChars.get(esc) ?? esc ?? '';
        }
      } else if (quote === '`' && char === '$' && source[i] === '{') {
        template = true;
        i++;
        push('punct', '${');
        scan(true);
        push('punct', '}');
      } else {
        if (char === '\n') line++;
        value += char;
      }
    }
  }

  function regexEnd(at) {
    let inClass = false;
    for (let j = at + 1; j < source.length && source[j] !== '\n'; j++) {
      if (source[j] === '\\') {
        if (source[++j] === '\n') return;
      } else if (source[j] === '[') inClass = true;
      else if (source[j] === ']') inClass = false;
      else if (source[j] === '/' && !inClass) {
        while (idContinue.test(pointAt(j + 1))) j += pointAt(j + 1).length;
        return j + 1;
      }
    }
  }

  function scan(interpolation = false) {
    const braces = [];
    const parens = [];
    let expression = true;
    let closedControl = false;
    while (i < source.length) {
      const char = source[i];
      const previous = tokens.at(-1);
      if (/\s/.test(char)) {
        if (char === '\n') line++;
        i++;
        continue;
      }
      if (source.startsWith('//', i) || (line === 1 && i <= 1 && source.startsWith('#!', i))) {
        const end = source.indexOf('\n', i);
        i = end < 0 ? source.length : end;
        continue;
      }
      if (source.startsWith('/*', i)) {
        const end = source.indexOf('*/', i + 2);
        const stop = end < 0 ? source.length : end + 2;
        line += source.slice(i, stop).match(/\n/g)?.length ?? 0;
        i = stop;
        continue;
      }
      if (char === '}' && interpolation && !braces.length) {
        i++;
        return;
      }
      const afterControl = closedControl;
      closedControl = false;
      if (['"', "'", '`'].includes(char)) {
        string(char, line);
        expression = false;
        continue;
      }
      const regex = char === '/' && expression && regexEnd(i);
      if (regex) {
        push('other', '/regex/');
        i = regex;
        expression = false;
        continue;
      }
      const point = pointAt(i);
      let escaped = char === '\\' && unicodeEscape(source, i + 1);
      if (idStart.test(point) || (escaped && idStart.test(escaped[0]))) {
        let word = '';
        while (escaped ? idContinue.test(escaped[0]) : idContinue.test(pointAt(i))) {
          const next = escaped ? escaped[0] : pointAt(i);
          word += next;
          i = escaped ? escaped[1] : i + next.length;
          escaped = source[i] === '\\' && unicodeEscape(source, i + 1);
        }
        push('word', word);
        expression = previous?.value !== '.' && previous?.value !== '?.' && beforeExpression.has(word);
        continue;
      }
      if (/[0-9]/.test(char)) {
        while (i < source.length && /[A-Za-z0-9_.]/.test(source[i])) i++;
        push('other', 'number');
        expression = false;
        continue;
      }
      const punct = ['...', '?.', '=>', '++', '--'].find(mark => source.startsWith(mark, i)) ?? char;
      i += punct.length;
      push('punct', punct);
      if (punct === '(') {
        const before = tokens.at(-3);
        parens.push(previous?.kind === 'word' && control.has(previous.value) &&
          !['.', '?.', '#'].includes(before?.value));
      }
      if (punct === ')') closedControl = parens.pop();
      if (punct === '{') {
        braces.push(afterControl || !previous || [')', '=>', ';', 'else', 'try', 'finally', '}'].includes(previous.value));
      }
      const closedBlock = punct === '}' && braces.pop();
      expression = closedControl || closedBlock || ![')', ']', '}', '.', '?.', '++', '--'].includes(punct);
    }
  }
  scan();
  return tokens;
}

const is = (token, value) => token?.kind !== 'string' && token?.value === value;
const literal = token => token?.kind === 'string';

function afterBraces(tokens, at) {
  while (at < tokens.length && !is(tokens[at], '}')) at++;
  return at + 1;
}

function fromIndex(tokens, at) {
  if (is(tokens[at], '{')) at = afterBraces(tokens, at + 1);
  else if (is(tokens[at], '*')) at += is(tokens[at + 1], 'as') ? 3 : 1;
  return is(tokens[at], 'from') && literal(tokens[at + 1]) ? at + 1 : -1;
}

export function* importSpecifiers(text) {
  const tokens = jsTokens(text);
  for (const [i, token] of tokens.entries()) {
    if (token.kind !== 'word' || ['.', '?.', '#'].some(mark => is(tokens[i - 1], mark))) continue;
    let at = i + 1;
    if (token.value === 'import' || token.value === 'require') {
      if (is(tokens[at], '(')) {
        if (literal(tokens[at + 1]) && [')', ','].some(mark => is(tokens[at + 2], mark))) {
          yield { ...tokens[at + 1], commonJS: token.value === 'require' };
        }
      } else if (token.value === 'import') {
        if (literal(tokens[at])) yield tokens[at];
        else {
          if (tokens[at]?.kind === 'word') at += is(tokens[at + 1], ',') ? 2 : 1;
          const from = fromIndex(tokens, at);
          if (from !== -1) yield tokens[from];
        }
      }
    } else if (token.value === 'export' && ['{', '*'].some(mark => is(tokens[at], mark))) {
      const from = fromIndex(tokens, at);
      if (from !== -1) yield tokens[from];
    }
  }
}

const openings = ['(', '[', '{', '${'];
const closings = [')', ']', '}'];
const statementStarts = new Set(['const', 'let', 'var', 'function', 'class', 'export', 'import',
  'if', 'switch', 'for', 'while', 'throw', 'try', 'return', 'do']);

function skipExpression(tokens, start, stop, allowASI = false) {
  const stack = [];
  for (let i = start; i < tokens.length; i++) {
    const token = tokens[i];
    const previous = tokens[i - 1];
    if (allowASI && i > start && !stack.length && token.line > previous.line && token.kind === 'word' &&
        statementStarts.has(token.value) &&
        (previous.kind !== 'punct' ? !beforeExpression.has(previous.value) : [')', ']', '}', '++', '--'].includes(previous.value))) {
      return i;
    }
    if (token.kind !== 'punct') continue;
    if (!stack.length && (stop.includes(token.value) || closings.includes(token.value))) return i;
    if (openings.includes(token.value)) stack.push(token.value);
    if (closings.includes(token.value)) {
      stack.pop();
    }
  }
  return tokens.length;
}

function readBinding(tokens, start, name) {
  const token = tokens[start];
  if (token?.kind === 'word') return [start + 1, token.value === name];
  if (!['[', '{'].some(mark => is(token, mark))) return [start, false];
  const object = token.value === '{';
  const close = object ? '}' : ']';
  let at = start + 1;
  let matched = false;
  while (at < tokens.length && !is(tokens[at], close)) {
    if (is(tokens[at], ',')) {
      at++;
      continue;
    }
    if (is(tokens[at], '...')) at++;
    else if (object) {
      if (is(tokens[at], '[')) at = skipExpression(tokens, at + 1, [']']) + 1;
      else at++;
      if (is(tokens[at], ':')) at++;
      else {
        matched ||= is(tokens[at - 1], name);
        if (is(tokens[at], '=')) at = skipExpression(tokens, at + 1, [',', close]);
        if (![',', close].some(mark => is(tokens[at], mark))) return [start, false];
        continue;
      }
    }
    const [next, found] = readBinding(tokens, at, name);
    if (next === at) return [start, false];
    matched ||= found;
    at = is(tokens[next], '=') ? skipExpression(tokens, next + 1, [',', close]) : next;
    if (![',', close].some(mark => is(tokens[at], mark))) return [start, false];
  }
  return is(tokens[at], close) ? [at + 1, matched] : [start, false];
}

function declares(tokens, start, name) {
  let at = start;
  while (at < tokens.length) {
    const [next, found] = readBinding(tokens, at, name);
    if (found) return true;
    if (next === at) return false;
    const end = is(tokens[next], '=') ? skipExpression(tokens, next + 1, [',', ';'], true) : next;
    if (!is(tokens[end], ',')) return false;
    at = end + 1;
  }
  return false;
}

export function namedExport(text, name) {
  const tokens = jsTokens(text);
  const stars = [];
  let depth = 0;
  for (const [i, token] of tokens.entries()) {
    if (token.kind === 'punct') {
      if (openings.includes(token.value)) depth++;
      if (closings.includes(token.value)) depth--;
    }
    if (depth || !is(token, 'export') || is(tokens[i - 1], '.')) continue;
    let at = i + 1;
    if (is(tokens[at], '{')) {
      const from = fromIndex(tokens, at);
      for (let j = at + 1; j < tokens.length && !is(tokens[j], '}'); j++) {
        const alias = is(tokens[j + 1], 'as');
        if (tokens[alias ? j + 2 : j]?.value === name) {
          return from === -1
            ? { explicit: true, stars }
            : { explicit: true, from: tokens[from].value, imported: tokens[j].value, stars };
        }
        if (alias) j += 2;
      }
    } else if (is(tokens[at], '*')) {
      if (is(tokens[at + 1], 'as') && tokens[at + 2]?.value === name) return { explicit: true, stars };
      const from = fromIndex(tokens, at);
      if (from !== -1 && name !== 'default' && !is(tokens[at + 1], 'as')) stars.push(tokens[from].value);
    } else {
      if (is(tokens[at], 'default') && name === 'default') return { explicit: true, stars };
      if (is(tokens[at], 'async')) at++;
      if (['function', 'class'].some(kind => is(tokens[at], kind))) {
        if (is(tokens[at + 1], '*')) at++;
        if (is(tokens[at + 1], name)) return { explicit: true, stars };
      }
      if (['const', 'let', 'var'].some(kind => is(tokens[at], kind)) && declares(tokens, at + 1, name)) {
        return { explicit: true, stars };
      }
    }
  }
  return { explicit: false, stars };
}
