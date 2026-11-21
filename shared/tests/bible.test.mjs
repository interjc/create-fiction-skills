import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const bible = await import(new URL('../lib/bible.mjs', import.meta.url));
const book = new URL('./fixtures-shared/watch-shop/', import.meta.url);
const read = file => readFileSync(new URL(file, book), 'utf8');

const formats = [
  ['parseSources', 'bible/sources.md', 'sources.md', 4, [[3, '主写入口不是有效的相对路径']]],
  ['parseForeshadows', 'bible/foreshadows.md', 'foreshadows.md', 5, [
    [3, '未来出现方式为空'], [4, '非已回收伏笔不得填写实际回收章'], [5, '计划回收不得早于埋设章'],
    [6, '已放弃伏笔须填写备注'], [7, '伏笔状态须恰好命中一种取值'],
  ]],
  ['parseSubplots', 'bible/subplots.md', 'subplots.md', 2, [[9, '实际章不符合生命周期顺序']]],
  ['parseCharacters', 'bible/characters.md', 'characters.md', 3, [
    [1, '身份不能为空'], [3, '人物级别须恰好命中一种取值'], [7, '常驻须为是或否'],
  ]],
  ['parseAppearances', 'bible/appearances.md', 'appearances.md', 3, [[3, '出场备注格式非法']]],
  ['parseDynamics', 'bible/character-dynamics.md', 'character-dynamics.md', 3, [[3, '章须为单个章号']]],
  ['parseTimeline', 'bible/timeline.md', 'timeline.md', 6, [[3, '锚点类型须恰好命中一种取值']]],
  ['parseInventory', 'bible/inventory.md', 'inventory.md', 2, [[3, 'ID非法']]],
  ['parseStorylines', 'bible/storylines.md', 'storylines.md', 2, [[3, '故事线类型非法']]],
  ['parseVolumePlan', 'bible/volumes/1.md', 'volume-plan.md', 4, [[2, '章号或范围非法'], [8, '钩子级别非法']]],
  ['parseVolInfo', 'chapters/1/vol-info.md', 'vol-info.md', 1, [[1, '卷摘要标题格式非法'], [2, '章节范围须为章号或范围']]],
  ['parseOutline', 'chapters/1/3/outline.md', 'outline.md', 1, [[13, '伏笔动作非法'], [15, '定稿节须指定一个稿次']]],
  ['parseSettingTags', 'bible/canon.md', 'settings.md', 1, [[2, '章号或范围非法']]],
];

for (const [name, valid, invalid, count, expected] of formats) {
  test(`${name}: valid and invalid original samples`, () => {
    const parsed = bible[name](read(valid), valid);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.items.length, count);
    assert.ok(parsed.items.every(item => item.file === valid && Number.isInteger(item.line)));
    const file = `invalid/${invalid}`;
    const broken = bible[name](read(file), file);
    assert.equal(broken.errors.length, expected.length);
    for (const [index, [line, reason]] of expected.entries()) {
      const error = broken.errors[index];
      assert.equal(error.file, file);
      assert.equal(error.line, line);
      assert.ok(error.message.includes(reason), error.message);
    }
  });
}

test('volume plan requires the exact chapter-planning heading', () => {
  const source = read('bible/volumes/1.md');
  for (const replacement of ['', '## 章节计划']) {
    const { items, errors } = bible.parseVolumePlan(source.replace('## 章节规划', replacement));
    assert.deepEqual(errors.map(({ line, message }) => [line, message]), [[1, '缺少「## 章节规划」节']]);
    assert.deepEqual(items.map(item => item.chapter), [null]);
  }
});

test('vol-info and outline titles ignore trailing whitespace and inline HTML comments', () => {
  for (const [parse, file] of [
    [bible.parseVolInfo, 'chapters/1/vol-info.md'],
    [bible.parseOutline, 'chapters/1/3/outline.md'],
  ]) {
    const source = read(file);
    for (const suffix of [' \t', ' <!-- 批注 --> \t']) {
      const annotated = source.replace(/^[^\r\n]+/, `$&${suffix}`);
      assert.deepEqual(parse(annotated, file), parse(source, file));
    }
  }
});

test('normalized references, statuses, notes and sections', () => {
  const fs = bible.parseForeshadows(read('bible/foreshadows.md')).items;
  assert.deepEqual(fs[0].target, { start: 3, end: 4 });
  assert.deepEqual(fs[0].touched, [2, 5]);
  assert.equal(fs[4].source_anchor, '河边');
  assert.equal(fs[4].planted, 0);
  const bad = bible.parseForeshadows(read('invalid/foreshadows.md'));
  assert.deepEqual(bad.errors.map(f => [f.line, f.level]), [
    [3, 'suggest'], [4, 'block'], [5, 'block'], [6, 'block'], [7, 'block'],
  ]);
  assert.deepEqual(bad.items.map(item => item.id), ['F011']);
  const [subplot] = bible.parseSubplots(read('bible/subplots.md')).items;
  assert.equal(subplot.current_step, 'remind');
  assert.equal(subplot.steps[2].planned_chapter, 3);
  const people = bible.parseCharacters(read('bible/characters.md')).items;
  assert.equal(people[0].role, '修表匠\n也替河街的照相铺修快门。');
  assert.equal(bible.aliasesOf(people).get('葛姨'), '葛婶');
  const [appearance] = bible.parseAppearances(read('bible/appearances.md')).items;
  assert.equal(appearance.notes.葛婶, '借了木尺');
  const [source] = bible.parseSources(read('bible/sources.md')).items.filter(row => row.key === 'world_rules');
  assert.deepEqual(source.keywords, ['闸房', '白绳']);
  const [setting] = bible.parseSettingTags(read('bible/canon.md')).items;
  assert.deepEqual(setting.chapters, [1, 3, 4]);
});
test('D-06 permits never-planted drops; invalid records identify ID and name', () => {
  const table = '| ID | 伏笔 | 读者已知 | 作者真相 | 埋设章 | 计划回收章 | 实际回收章 | 状态 | 未来出现方式 | 备注 |\n'
    + '|---|---|---|---|---|---|---|---|---|---|\n'
    + '| F031 | 未响的铃 | 尚无 | 铃心遗失 | ? | ? | | 已放弃 | | 删去市集一场 |\n'
    + '| F032 | 折叠的纸 | 有一道痕 | 夹层里有信 | ? | ? | | 已埋设 | 收信时展开 | |\n'
    + '| F033 | 未亮的灯 | 尚无 | 灯芯沾水 | ? | ? | | 已放弃 | | |\n';
  const { items, errors } = bible.parseForeshadows(table);
  assert.deepEqual(items.map(({ id, status, planted }) => [id, status, planted]), [['F031', 'dropped', null]]);
  assert.deepEqual(errors.map(({ id, excerpt }) => [id, excerpt]), [['F032', 'F032 折叠的纸'], ['F033', 'F033 未亮的灯']]);
});
