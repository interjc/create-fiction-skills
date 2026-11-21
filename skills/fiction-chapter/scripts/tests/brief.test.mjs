import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const lib = new URL('../lib/brief.mjs', import.meta.url);
const { buildBrief } = await import(lib);
const root = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [fileURLToPath(lib), ...args, '--root', root], { encoding: 'utf8' });
const keys = (obj, names) => assert.deepEqual(Object.keys(obj).sort(), names.split(' ').sort());
const fsKeys = 'id name status planted target resolved touched last_touch future reader_view author_truth subplots characters file line';

test('brief exact JSON keys, overlay, ordered foreshadows, history and owner selection', () => {
  const proc = run('3', '--json');
  assert.equal(proc.status, 0, proc.stderr);
  const data = JSON.parse(proc.stdout);
  keys(data, 'tool spec_version root ok chapter volume plan previous foreshadows subplots characters warnings timeline owners settings');
  keys(data.plan, 'source title core_event beat hook weight subplots foreshadow_actions characters');
  keys(data.plan.subplots[0], 'id step');
  keys(data.plan.foreshadow_actions[0], 'action id');
  keys(data.plan.characters, 'present mentioned');
  keys(data.previous, 'chapter file tail');
  keys(data.foreshadows, 'resolve plant touch overdue nearby');
  keys(data.foreshadows.resolve[0], fsKeys);
  keys(data.foreshadows.resolve[0].target, 'start end');
  keys(data.subplots[0], 'id name level status current_step current_chapter advance_here planned_step');
  keys(data.characters[0], 'name tier last_present last_mentioned gap note relationship dormant unknown');
  keys(data.warnings[0], 'type name gap file line message');
  keys(data.timeline, 'now near upcoming');
  keys(data.timeline.now, 'id time chapter event kind prose_form');
  keys(data.owners[0], 'key file anchor purpose read_when write_when mode');
  keys(data.settings[0], 'name tags file line');
  assert.equal(data.plan.source, 'outline');
  assert.deepEqual(data.plan.characters, { present: ['林砚', '唐七'], mentioned: ['葛婶'] });
  assert.deepEqual(data.previous, {
    chapter: 2, file: 'chapters/1/2/v1.md',
    tail: '“连盖带底都是空的。”\n林砚把盒子翻过来。\n底缝里沾的是潮盐。\n他把铁盒贴在耳边。里头还在响。',
  });
  assert.deepEqual(Object.values(data.foreshadows).map(items => items.map(item => item.id)), [
    ['F001'], ['F003'], [], ['F002'], ['F004'],
  ]);
  assert.equal(data.foreshadows.resolve[0].last_touch, 2);
  assert.equal(data.subplots[0].planned_step, 'chain');
  assert.equal(data.characters[1].relationship, '暂且同路');
  assert.deepEqual(data.warnings.map(item => [item.type, item.name, item.gap]), [['absent', '葛婶', 2]]);
  assert.equal(data.timeline.now.id, 'T004');
  assert.deepEqual(data.timeline.upcoming.map(item => item.id), ['T005', 'T006']);
  assert.equal(data.owners.at(-1).file, 'chapters/1/3/outline.md');
  assert.equal(data.owners.at(-1).anchor, '第3章');
  assert.deepEqual(data.settings.map(item => item.name), ['表壳刻痕', '灯绳']);
  const future = buildBrief(root, 4);
  assert.equal(future.plan.source, 'volume_plan');
  assert.equal(future.plan.weight, 'heavy');
});

test('brief human headings, warning success, invalid exit and help', () => {
  const output = run('3');
  assert.equal(output.status, 0);
  assert.deepEqual(output.stdout.split('\n').filter(line => line.startsWith('#')), [
    '# 第3章写作简报（卷1）', '## 主写入口', '## 本章规划', '## 上一章结尾', '## 本章要回收的伏笔',
    '## 本章要埋设的伏笔', '## 本章触及的伏笔', '## 逾期与附近伏笔', '## 活跃支线', '## 出场人物',
    '## 提醒', '## 时间锚点', '## 关联设定',
  ]);
  assert.match(output.stdout, /## 本章触及的伏笔\n（无）/);
  assert.equal(run('三').status, 2);
  assert.equal(run('9', '--vol', '1').status, 0);
  assert.equal(run('--help').status, 0);
  assert.match(run('--help').stdout, /^用法：/);
});

test('brief clips by code point and reports parse, missing and unknown-character warnings', t => {
  const book = mkdtempSync(path.join(tmpdir(), 'fiction-brief-'));
  t.after(() => rmSync(book, { recursive: true, force: true }));
  cpSync(root, book, { recursive: true });
  writeFileSync(path.join(book, 'chapters/1/2/v1.md'), `# 第2章：回拨\n\n${'𠮷'.repeat(610)}\n<!-- hook: A -->`);
  writeFileSync(path.join(book, 'bible/appearances.md'), '坏表格');
  rmSync(path.join(book, 'bible/world-rules.md'));
  writeFileSync(path.join(book, 'bible/characters.md'), '### 林砚\n- 身份：修表匠\n- 级别：核心');
  const data = buildBrief(book, 3);
  assert.equal(data.previous.tail, `……${'𠮷'.repeat(600)}`);
  assert.ok(data.warnings.some(item => item.type === 'parse' && item.file === 'bible/appearances.md' && item.line === 1));
  assert.ok(data.warnings.some(item => item.type === 'missing_file' && item.file === 'bible/world-rules.md'));
  assert.ok(data.warnings.some(item => item.type === 'unknown_character' && item.name === '阿七'));
});
