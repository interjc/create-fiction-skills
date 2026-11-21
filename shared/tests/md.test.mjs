import assert from 'node:assert/strict';
import { test } from 'node:test';

const { HOOK_ORDER, linesOf, maskComments, parseChapterList, parseChapterRef, parseFields, parseMarkers,
  parseTables, sections, splitList } = await import(new URL('../lib/md.mjs', import.meta.url));

test('table escapes, reordering, multiple tables, row line numbers and malformed separator', () => {
  const tables = parseTables('标题\r\n| `右` | **左** | 多余 |\r\n| :--- | ---: | --- |\r\n| 甲\\|乙 |  丙 | |\r\n结束\n| 左 |\n|---|\n| 戊 |\n\n| 坏 |\n');
  assert.deepEqual(tables.map(t => t.line), [2, 6, 10]);
  assert.deepEqual(tables[0].headers, ['右', '左', '多余']);
  assert.deepEqual(tables[0].rows[0], { line: 4, cells: ['甲|乙', '丙', ''], fields: { 右: '甲|乙', 左: '丙', 多余: '' } });
  assert.equal(tables[1].rows[0].fields.左, '戊');
  assert.equal(tables[2].errors[0].line, 10);
});

test('fields, empty values, selectors and nested sections', () => {
  assert.deepEqual(parseFields(['- **身份**：修表', '  看店', '- tier: core']), [
    { key: '身份', value: '修表\n看店', line: 1 }, { key: 'tier', value: 'core', line: 3 },
  ]);
  assert.deepEqual(splitList(' —、林砚, ，唐七、无'), ['林砚', '唐七']);
  assert.deepEqual(parseChapterRef('3～5'), { start: 3, end: 5 });
  assert.equal(parseChapterRef('待定'), null);
  assert.deepEqual(parseChapterList('5, 0–2、2—3，5~6'), [0, 1, 2, 3, 5, 6]);
  assert.throws(() => parseChapterRef('3-2'));
  assert.throws(() => parseChapterList('1, ?'));
  assert.deepEqual(sections('## 一\n甲\n### 附页\n乙\n# 截止\n丙\n## 二\n丁', 2), [
    { name: '一', line: 1, lines: ['甲', '### 附页', '乙'] }, { name: '二', line: 7, lines: ['丁'] },
  ]);
});

test('comments and markers retain Unicode code-point positions and ignore inline pseudo-markers', () => {
  assert.deepEqual(HOOK_ORDER, ['S', 'A', 'B', 'C']);
  assert.equal(maskComments('甲<!--⌚𠮷\r\n注-->乙'), '甲      \r\n    乙');
  assert.deepEqual(parseMarkers('甲 <!-- hook:B -->\r\n  <!--hook:A-->\r\n<!-- paywall -->\n<!-- lint-ignore:AT01 -->'), [
    { kind: 'hook', value: 'A', line: 2, column: 3 },
    { kind: 'paywall', value: null, line: 3, column: 1 },
    { kind: 'lint-ignore', value: 'AT01', line: 4, column: 1 },
  ]);
});

test('fenced examples do not make tables or headings; extra cells do not change column mapping', () => {
  const text = '```md\n## 示例\n| 假表 |\n|---|\n```\n## 真表\n| 键 | 值 |\n|---|---|\n| 门 | 木 | 忽略 |';
  assert.deepEqual(sections(text, 2).map(section => section.name), ['真表']);
  assert.deepEqual(parseTables(text).map(table => table.rows[0].fields), [{ 键: '门', 值: '木' }]);
});

test('Markdown strips exactly one leading BOM, preserving in-body BOMs and marker columns', () => {
  assert.deepEqual(linesOf('\uFEFF\uFEFF甲\r\n\uFEFF乙'), ['\uFEFF甲', '\uFEFF乙']);
  assert.equal(maskComments('\uFEFF\uFEFF<!-- 注 -->乙'), '\uFEFF          乙');
  assert.deepEqual(sections('\uFEFF### 人物\n- 身份：修表匠', 3),
    [{ name: '人物', line: 1, lines: ['- 身份：修表匠'] }]);
  assert.deepEqual(sections('\uFEFF\uFEFF### 人物', 3), []);
  assert.equal(parseTables('\uFEFF| 左 |\n|---|\n| 甲 |')[0].rows[0].fields.左, '甲');
  assert.deepEqual(parseMarkers('\uFEFF<!-- hook: A -->'), [{ kind: 'hook', value: 'A', line: 1, column: 1 }]);
});
