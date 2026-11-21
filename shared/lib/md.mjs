/** 钩子级别从强到弱。 */
export const HOOK_ORDER = Object.freeze(['S', 'A', 'B', 'C']);

/** 通用换行规范。 */
export function linesOf(text) {
  return text.split(/\r\n?|\n/);
}

const commentPattern = /<!--[\s\S]*?-->/g;

/** 注释区按码点换成空格，保留行尾及每行码点列。 */
export function maskComments(text) {
  return text.replace(commentPattern, comment => comment.replace(/[^\r\n]/gu, ' '));
}

/** 结构查找用的可见行：代码围栏中的例子不是标题、字段或表格。 */
export function structuralLines(text) {
  let fence = null;
  return linesOf(maskComments(text)).map(line => {
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
      if (close?.[0] === fence[0] && close.length >= fence.length) fence = null;
      return '';
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!opening || (opening[1][0] === '`' && opening[2].includes('`'))) return line;
    fence = opening[1];
    return '';
  });
}

/** 空单元格与占位符归为 null。 */
export function cell(value) {
  const text = value?.trim() ?? '';
  return ['', '-', '—', '无'].includes(text) ? null : text;
}

function cells(line) {
  const parts = [''];
  const text = line.trim().slice(1);
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\\' && text[i + 1] === '|') {
      parts[parts.length - 1] += '|';
      i++;
    } else if (char === '|') {
      if (i !== text.length - 1) parts.push('');
    } else {
      parts[parts.length - 1] += char;
    }
  }
  return parts.map(part => part.trim());
}

/** 读取管道表；保留原单元格、列映射、行号和格式错误（供格式解析器定位）。 */
export function parseTables(text) {
  const lines = structuralLines(text);
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('|')) continue;
    const headers = cells(lines[i]).map(value => value.replace(/\*\*|`/g, '').trim());
    const table = { headers, line: i + 1, rows: [], errors: [] };
    tables.push(table);
    const separator = lines[i + 1]?.startsWith('|') ? cells(lines[i + 1]) : [];
    if (separator.length !== headers.length || !separator.every(value => /^:?-+:?$/.test(value))) {
      table.errors.push({ line: i + 1, message: '表头后缺少匹配的表格分隔行' });
      while (lines[i + 1]?.startsWith('|')) i++;
      continue;
    }
    if (new Set(headers).size !== headers.length || headers.includes('')) {
      table.errors.push({ line: i + 1, message: '表头列名重复或为空' });
    }
    i++;
    while (lines[i + 1]?.startsWith('|')) {
      const values = cells(lines[++i]);
      const fields = Object.fromEntries(headers.map((header, j) => [header, values[j] ?? '']));
      table.rows.push({ line: i + 1, cells: values, fields });
    }
  }
  return tables;
}

/** 读取字段条目及其连续缩进行；保留重复字段供上层检查。 */
export function parseFields(lines) {
  if (typeof lines === 'string') lines = linesOf(lines);
  const fields = [];
  let current;
  for (const [i, line] of lines.entries()) {
    const match = /^- (?:\*\*)?([^*：:]+?)(?:\*\*)?[：:]\s*(.*)$/.exec(line);
    if (match) {
      current = { key: match[1].trim(), value: match[2].trim(), line: i + 1 };
      fields.push(current);
    } else if (current && /^ {2,}/.test(line)) {
      current.value += `\n${line.trim()}`;
    } else {
      current = null;
    }
  }
  return fields;
}

/** 切分通用列表，不改变项目文字。 */
export function splitList(value) {
  return (cell(value) ?? '').split(/[、，,]/).map(part => part.trim()).filter(part => cell(part) !== null);
}

/** 解析章号/闭区间，无值或待定为 null；非法值抛出异常。 */
export function parseChapterRef(value) {
  const text = cell(value);
  if (text === null || text === '?' || text === '待定') return null;
  const match = /^(\d+)(?:\s*[-–—~～]\s*(\d+))?$/.exec(text);
  if (!match) throw new Error(`章号或范围非法：${text}`);
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
    throw new Error(`章号或范围非法：${text}`);
  }
  return { start, end };
}

/** 展开并排序章号集合；不允许用待定成员代表具体章节。 */
export function parseChapterList(value) {
  const chapters = new Set();
  for (const part of splitList(value)) {
    const range = parseChapterRef(part);
    if (!range) throw new Error(`章号列表不能包含待定项：${part}`);
    if (range.end - range.start >= 100_000) throw new Error(`章号列表范围过大：${part}`);
    for (let ch = range.start; ch <= range.end; ch++) {
      chapters.add(ch);
      if (chapters.size > 100_000) throw new Error('章号列表超过 100000 个章号');
    }
  }
  return [...chapters].sort((a, b) => a - b);
}

/** 读取指定层级 ATX 标题及正文；同级或更高一级标题结束当前节。 */
export function sections(text, level) {
  const lines = linesOf(text);
  const visible = structuralLines(text);
  const result = [];
  let current;
  for (const [index, line] of visible.entries()) {
    const match = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/.exec(line);
    if (match && match[1].length <= level) {
      current = null;
      if (match[1].length === level) {
        current = { name: match[2].replace(/[ \t]+#+$/, '').trim(), line: index + 1, lines: [] };
        result.push(current);
      }
    } else if (current) {
      current.lines.push(lines[index]);
    }
  }
  return result;
}

/** 识别单独成行的注释标记，不把嵌入多行注释的伪标记当成标记。 */
export function parseMarkers(text) {
  const result = [];
  const normalized = text.replace(/\r\n?/g, '\n');
  let line = 1;
  let cursor = 0;
  for (const match of normalized.matchAll(commentPattern)) {
    const start = match.index;
    const end = start + match[0].length;
    line += normalized.slice(cursor, start).split('\n').length - 1;
    cursor = start;
    const lineStart = normalized.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = normalized.indexOf('\n', end);
    if (match[0].includes('\n') || normalized.slice(lineStart, start).trim()
      || normalized.slice(end, lineEnd < 0 ? undefined : lineEnd).trim()) continue;
    const content = match[0].slice(4, -3).trim();
    const item = /^(hook|lint-ignore-file|lint-ignore):\s*(.*)$/.exec(content);
    if (item) result.push({ kind: item[1], value: item[2].trim(), line, column: start - lineStart + 1 });
    if (content === 'paywall') result.push({ kind: 'paywall', value: null, line, column: start - lineStart + 1 });
  }
  return result;
}
