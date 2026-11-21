import { splitLines } from './repo.mjs';

const pair = /^([^\s:[\]{}&*!>|%@`'"#,]+):(?:[ \t]+(.*)|$)/u;
const indent = text => /^ */.exec(text)[0].length;
const comment = text => !text.trim() || text.trimStart().startsWith('#');
const escapes = new Map(Object.entries({
  '0': '\0', a: '\x07', b: '\b', t: '\t', n: '\n', v: '\v', f: '\f', r: '\r',
  e: '\x1b', ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\u0085',
  _: '\u00a0', L: '\u2028', P: '\u2029', '\t': '\t',
}));

function quoted(text, fail) {
  const single = text[0] === "'";
  let result = '';
  for (let i = 1; i < text.length; i++) {
    const char = text[i];
    if (char === text[0]) {
      if (single && text[i + 1] === "'") {
        result += "'";
        i++;
        continue;
      }
      if (!/^(?:[ \t]+#.*|[ \t]*)$/.test(text.slice(i + 1))) fail('引号标量后有多余内容');
      return result;
    }
    if (!single && char === '\\') {
      const key = text[++i];
      const size = key === 'x' ? 2 : key === 'u' ? 4 : key === 'U' ? 8 : 0;
      if (size) {
        const hex = text.slice(i + 1, i + size + 1);
        const value = Number.parseInt(hex, 16);
        if (hex.length !== size || !/^[0-9a-f]+$/i.test(hex) || value > 0x10ffff ||
            (value >= 0xd800 && value <= 0xdfff)) fail('无效的 Unicode 转义');
        result += String.fromCodePoint(value);
        i += size;
      } else if (escapes.has(key)) {
        result += escapes.get(key);
      } else {
        fail('无效的双引号转义');
      }
    } else {
      result += char;
    }
  }
  fail('标量引号没有闭合');
}

// Header indentation is implicit: the first nonempty content line fixes it.
function block(lines, start, end, parentIndent, indicator, fail) {
  let stop = start;
  while (stop < end && (!lines[stop].trim() || indent(lines[stop]) > parentIndent)) stop++;
  const raw = lines.slice(start, stop);
  const first = raw.findIndex(line => line.trim());
  const base = first === -1 ? parentIndent + 1 : indent(raw[first]);
  const content = raw.map((line, index) => {
    if ((line.trim() && indent(line) < base) || (index < first && indent(line) > base)) {
      fail('块标量缩进不一致', start + index);
    }
    return line.slice(base);
  });
  const finish = result => {
    const trimmed = result.replace(/\n+$/u, '');
    return [trimmed && !indicator.endsWith('-') ? `${trimmed}\n` : trimmed, stop];
  };
  if (indicator[0] === '|') return finish(content.join('\n'));

  let result = '';
  let previous = -1;
  for (let i = 0; i < content.length; i++) {
    if (!content[i]) continue;
    const gap = i - previous - 1;
    if (previous < 0) result += '\n'.repeat(gap);
    else if (/^[ \t]/.test(content[previous]) || /^[ \t]/.test(content[i])) result += '\n'.repeat(gap + 1);
    else result += gap ? '\n'.repeat(gap) : ' ';
    result += content[i];
    previous = i;
  }
  return finish(result);
}

export function parseFrontmatter(text) {
  const lines = splitLines(text);
  if (lines[0] !== '---') return { error: { line: 1, message: '缺少开头的 ---' } };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { error: { line: 1, message: '缺少闭合的 ---' } };
  let cursor = 1;

  function mapping(base, nested = false) {
    const values = new Map();
    while (cursor < end) {
      const row = lines[cursor];
      if (comment(row)) {
        cursor++;
        continue;
      }
      const spaces = indent(row);
      if (spaces < base) break;
      const line = cursor++;
      const fail = (message, at = line) => {
        throw Object.assign(new SyntaxError(message), { line: at + 1 });
      };
      const match = pair.exec(row.slice(base));
      if (!match || spaces !== base) fail('只支持单层 key: value 映射和缩进块标量');
      const [, key, raw = ''] = match;
      if (values.has(key)) fail(`重复键：${key}`);
      const clean = raw.trimStart();
      let value;
      let blockScalar = false;
      if (/^['"]/.test(clean)) {
        if (!nested && key === 'metadata') fail('metadata 必须是单层映射');
        value = quoted(clean, fail);
      } else {
        const plain = clean.replace(/(?:^|[ \t]+)#.*$/u, '').trimEnd();
        if (!nested && key === 'metadata') {
          if (plain) fail('metadata 必须是单层映射');
          while (cursor < end && comment(lines[cursor])) cursor++;
          const next = cursor < end ? indent(lines[cursor]) : 0;
          value = next > base ? mapping(next, true) : new Map();
        } else if (/^[>|]-?$/u.test(plain)) {
          blockScalar = true;
          [value, cursor] = block(lines, cursor, end, base, plain, fail);
        } else {
          if (/^(?:[[\]{}&*!>|%@`]|-(?:[ \t]|$)|\?(?:[ \t]|$)|:(?:[ \t]|$))/u.test(plain)) {
            fail('不支持此 YAML 值，请使用引号或块标量');
          }
          value = plain;
        }
      }
      values.set(key, { value, line: line + 1, blockScalar });
    }
    return values;
  }

  try {
    return { fields: mapping(0) };
  } catch (error) {
    if (!(error instanceof SyntaxError) || !error.line) throw error;
    return { error: { line: error.line, message: error.message } };
  }
}
