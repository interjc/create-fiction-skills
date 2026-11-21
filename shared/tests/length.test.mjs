import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const lib = new URL('../lib/length.mjs', import.meta.url);
const { stripMarkdownForLength, countChapterCharacters } = await import(lib);
const root = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [fileURLToPath(lib), ...args, '--root', root], { encoding: 'utf8' });
const keys = (obj, names) => assert.deepEqual(Object.keys(obj).sort(), names.split(' ').sort());

test('§3.3 vectors and code points, headings, front matter, fences and images', () => {
  for (const [text, count] of [
    ['# 第1章：标题\n\n他推门。\n\n---\n\n“走吧。”\n<!-- hook: A -->\n', 9],
    ['**加粗**和[链接](a.md)、`code`\n', 10],
    ['*下章预告：明天见*\n正文', 2],
    ['a_b c\\*d', 5],
  ]) assert.equal(countChapterCharacters(text), count);
  assert.equal(stripMarkdownForLength('---\r\nx: y\r\n---\r## 标题\r\n\n~~~\n𠮷！\n~~~\n![图](a)\n> 他'), '𠮷！他');
});

test('length JSON key sets, frozen states, ranges, exit codes and help', () => {
  const all = run('--all', '--json');
  assert.equal(all.status, 0, all.stderr);
  const data = JSON.parse(all.stdout);
  keys(data, 'tool spec_version root ok min soft_max results summary');
  keys(data.summary, 'checked pass long short skipped');
  keys(data.results[0], 'chapter file count status frozen');
  assert.deepEqual(data.summary, { checked: 2, pass: 2, long: 0, short: 0, skipped: 1 });
  assert.equal(data.results[1].count, null);
  assert.match(run('2-4').stdout, /跳过无定稿章节：4/);
  assert.equal(run('1', '--min', '999', '--json').status, 1);
  const frozen = run('2', '--min', '999', '--json');
  assert.equal(frozen.status, 0);
  assert.equal(JSON.parse(frozen.stdout).results[0].status, 'short');
  const absent = run('88', '--json');
  assert.equal(absent.status, 2);
  keys(JSON.parse(absent.stdout), 'tool spec_version root ok error');
  assert.match(absent.stderr, /没有定稿/);
  assert.equal(run('--help').status, 0);
  assert.match(run('--help').stdout, /^用法：/);
});
