import { splitLines } from './repo.mjs';

const escaped = (text, at) => {
  let before = at;
  while (text[before - 1] === '\\') before--;
  return (at - before) % 2 !== 0;
};

function maskCode(rows) {
  const ignored = new Set();
  let fence;
  for (const [i, row] of rows.entries()) {
    const quote = /^(?: {0,3}>[ \t]?)+/.exec(row)?.[0] ?? '';
    const depth = quote.match(/>/g)?.length ?? 0;
    let line = row.slice(quote.length);
    if (fence && (depth !== fence.depth || (line.trim() && !line.startsWith(' '.repeat(fence.indent))))) {
      fence = undefined;
    }
    let indent = fence?.indent ?? 0;
    if (fence) line = line.slice(indent);
    else {
      const list = /^ {0,3}(?:[-+*]|\d{1,9}[.)]) {1,4}/.exec(line);
      if (list) {
        indent = list[0].length;
        line = line.slice(indent);
      }
    }
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      ignored.add(i);
      if (match && match[1][0] === fence.mark[0] && match[1].length >= fence.mark.length && !match[2].trim()) {
        fence = undefined;
      }
    } else if (match && (match[1][0] === '~' || !match[2].includes('`'))) {
      ignored.add(i);
      fence = { mark: match[1], depth, indent };
    }
  }
  // Preserve columns and prevent code punctuation from becoming Markdown syntax.
  const joined = rows.map((row, i) => ignored.has(i) || !row.trim() ? '\0'.repeat(row.length) : row).join('\n');
  const masked = joined.split('');
  for (const paragraph of joined.matchAll(/[^\n\0]+(?:\n[^\n\0]+)*/g)) {
    const runs = [...paragraph[0].matchAll(/`+/g)];
    const next = new Map();
    const partners = runs.map(() => undefined);
    for (let i = runs.length - 1; i >= 0; i--) {
      const size = runs[i][0].length;
      partners[i] = next.get(size);
      next.set(size, i);
    }
    for (let i = 0; i < runs.length; i++) {
      const at = paragraph.index + runs[i].index;
      const partner = partners[i];
      if (escaped(joined, at) || partner === undefined) continue;
      const end = paragraph.index + runs[partner].index + runs[partner][0].length;
      for (let j = at; j < end; j++) if (masked[j] !== '\n') masked[j] = '\0';
      i = partner;
    }
  }
  return masked.join('');
}

function destination(text, start, inline) {
  let i = start;
  while (/[ \t]/.test(text[i] ?? '')) i++;
  if (text[i] === '\n' && !/^[ \t]*\n/.test(text.slice(i + 1))) {
    i++;
    while (/[ \t]/.test(text[i] ?? '')) i++;
  }
  let target;
  if (text[i] === '<') {
    const begin = ++i;
    while (i < text.length && text[i] !== '\n' && text[i] !== '\0' &&
           (text[i] !== '>' || escaped(text, i))) i++;
    if (text[i] !== '>') return;
    target = text.slice(begin, i++);
  } else {
    const begin = i;
    let depth = 0;
    for (; i < text.length && !/[\s\0]/.test(text[i]); i++) {
      if (escaped(text, i)) continue;
      if (text[i] === '(') depth++;
      if (text[i] === ')' && --depth < 0) break;
    }
    if (depth > 0) return;
    target = text.slice(begin, i);
  }
  if (!inline && !target) return;
  if (inline) {
    const after = i;
    while (/[ \t\n]/.test(text[i] ?? '')) i++;
    if (i > after && ['"', "'", '('].includes(text[i])) {
      const close = text[i] === '(' ? ')' : text[i];
      i++;
      while (i < text.length && text[i] !== '\0' &&
             (text[i] !== close || escaped(text, i))) i++;
      if (text[i] !== close) return;
      i++;
      while (/[ \t\n]/.test(text[i] ?? '')) i++;
    }
    if (text[i] !== ')') return;
  } else if (text[i] !== undefined && !/\s/.test(text[i])) {
    return;
  }
  return { target: target.replace(/\\([!-/:-@[-`{-~])/g, '$1'), end: i };
}

export function* markdownLinks(source) {
  const rows = splitLines(source);
  const original = rows.join('\n');
  const text = maskCode(rows);
  let line = 1;
  let lineStart = 0;
  const labels = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      if (!original.slice(lineStart, i).trim()) labels.length = 0;
      lineStart = i + 1;
    } else if (text[i] === '[' && !escaped(text, i)) {
      const prefix = text.slice(lineStart, i).replace(/^(?: {0,3}>[ \t]?)+/, '');
      labels.push({ line, column: i - lineStart + 1, definition: /^ {0,3}$/.test(prefix) });
    } else if (text[i] === ']' && labels.length && !escaped(text, i)) {
      const label = labels.pop();
      const inline = text[i + 1] === '(';
      if (!inline && !(label.definition && text[i + 1] === ':')) continue;
      const link = destination(original, i + 2, inline);
      if (link) {
        yield { target: link.target, line: label.line, column: label.column };
        // Skip parsed destination/title punctuation without losing line positions.
        for (let j = i + 1; j < link.end; j++) if (text[j] === '\n') {
          line++;
          lineStart = j + 1;
        }
        i = inline ? link.end : link.end - 1;
      }
    }
  }
}
