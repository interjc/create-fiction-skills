import { coversSection } from './formats.mjs';
import { splitLines } from './repo.mjs';

const fieldLine = /^- (?:\*\*)?([^*：:]+?)(?:\*\*)?[：:]\s*(.*)$/u;
const specNames = /docs\/spec|story-bible\.md|scripts\.md|skill-authoring\.md/g;
const sectionRefs = /SB §(\d+(?:\.\d+)?)/g;

export function checkSpecRefs(text, sections, report) {
  for (const [i, line] of splitLines(text).entries()) {
    for (const match of line.matchAll(specNames)) {
      report(i + 1, `装好的 skill 无法读取契约文件：${match[0]}`, match.index + 1);
    }
    if (sections) for (const match of line.matchAll(sectionRefs)) {
      if (!coversSection(sections, match[1])) {
        report(i + 1, `本 skill 的格式参考未收录：${match[0]}`, match.index + 1);
      }
    }
  }
}

export function checkDialectCard(text, name, report) {
  const rows = splitLines(text);
  const fields = new Map();
  let start = rows.findIndex(row => row.trim());
  if (start !== -1 && /^# /.test(rows[start])) start++;
  let previous;
  for (let i = start; i >= 0 && i < rows.length; i++) {
    const row = rows[i];
    if (!row.trim()) {
      previous = undefined;
      continue;
    }
    const match = fieldLine.exec(row);
    if (match) {
      previous = { line: i + 1, value: match[2].trim() };
      const key = match[1].trim();
      if (!fields.has(key)) fields.set(key, []);
      fields.get(key).push(previous);
    } else if (previous && /^ {2}/.test(row)) {
      previous.value += `\n${row.trim()}`;
    } else {
      break;
    }
  }

  for (const [key, valid, expected] of [
    ['方言', value => value === name, `必须等于文件名 ${name}`],
    ['适用', value => value === '图片' || value === '视频', '必须为图片或视频'],
    ['核对日期', value => /^\d{4}-\d{2}-\d{2}$/.test(value), '必须为 YYYY-MM-DD'],
    ['官方文档', value => value.startsWith('https://') || (name === 'generic' && value === '-'),
      name === 'generic' ? '必须以 https:// 开头或为 -' : '必须以 https:// 开头'],
  ]) {
    const matches = fields.get(key);
    if (!matches) report(null, `开头缺少字段：${key}`);
    else if (matches.length > 1) report(matches[1].line, `开头重复字段：${key}`);
    else if (!valid(matches[0].value)) report(matches[0].line, `${key}${expected}`);
  }
}
