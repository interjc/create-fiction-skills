import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const bible = await import(new URL('../lib/bible.mjs', import.meta.url));
const book = new URL('./fixtures-shared/watch-shop/', import.meta.url);
const read = file => readFileSync(new URL(file, book), 'utf8');

const formats = [
  ['parseSources', 'bible/sources.md', 'sources.md', 4],
  ['parseForeshadows', 'bible/foreshadows.md', 'foreshadows.md', 5],
  ['parseSubplots', 'bible/subplots.md', 'subplots.md', 2],
  ['parseCharacters', 'bible/characters.md', 'characters.md', 3],
  ['parseAppearances', 'bible/appearances.md', 'appearances.md', 3],
  ['parseDynamics', 'bible/character-dynamics.md', 'character-dynamics.md', 3],
  ['parseTimeline', 'bible/timeline.md', 'timeline.md', 6],
  ['parseInventory', 'bible/inventory.md', 'inventory.md', 2],
  ['parseStorylines', 'bible/storylines.md', 'storylines.md', 2],
  ['parseVolumePlan', 'bible/volumes/1.md', 'volume-plan.md', 4],
  ['parseVolInfo', 'chapters/1/vol-info.md', 'vol-info.md', 1],
  ['parseOutline', 'chapters/1/3/outline.md', 'outline.md', 1],
  ['parseSettingTags', 'bible/canon.md', 'settings.md', 1],
];

for (const [name, valid, invalid, count] of formats) {
  test(`${name}: valid and invalid original samples`, () => {
    const parsed = bible[name](read(valid), valid);
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.items.length, count);
    assert.ok(parsed.items.every(item => item.file === valid && Number.isInteger(item.line)));
    const file = `invalid/${invalid}`;
    const broken = bible[name](read(file), file);
    assert.ok(broken.errors.length > 0);
    assert.ok(broken.errors.every(error => error.file === file && Number.isInteger(error.line)));
  });
}

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
