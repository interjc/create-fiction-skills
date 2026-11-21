import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { parseSeries, parseAdaptationMap, parseEpisode } = await import(new URL('../lib/drama.mjs', import.meta.url));
const book = new URL('./fixtures-shared/watch-shop/drama/', import.meta.url);
const read = file => readFileSync(new URL(file, book), 'utf8');

test('parse short drama series, mapping and episode valid and invalid samples', () => {
  const cases = [
    [parseSeries, 'series.md', 'series.md'],
    [parseAdaptationMap, 'adaptation-map.md', 'adaptation-map.md'],
    [parseEpisode, 'episodes/ep001.md', 'episodes/ep003.md'],
  ];
  for (const [parse, filename, bad] of cases) {
    const validFile = `stopped-clock/${filename}`;
    const valid = parse(read(validFile), validFile);
    assert.deepEqual(valid.errors, []);
    assert.ok(valid.items.every(item => item.file === validFile && Number.isInteger(item.line)));
    const badFile = `bad-cut/${bad}`;
    const invalid = parse(read(badFile), badFile);
    assert.ok(invalid.errors.length > 0);
    assert.ok(invalid.errors.every(error => error.file === badFile));
  }
  const [series] = parseSeries(read('stopped-clock/series.md')).items;
  assert.deepEqual(series.duration, [1, 15]);
  assert.deepEqual(series.characters, ['林砚', '阿七']);
  const [adapted, original] = parseAdaptationMap(read('stopped-clock/adaptation-map.md')).items;
  assert.deepEqual(adapted.source_chapters, [1, 2]);
  assert.equal(original.original, true);
  const [episode] = parseEpisode(read('stopped-clock/episodes/ep001.md')).items;
  assert.equal(episode.chars, 17);
  assert.equal(episode.scenes[0].actions, 2);
});

test('episode parser skips annotations, supports Unicode and enforces marker position', () => {
  const text = '# 第4集：时针\n\n## 场景1：闸房·内外·昏\n人物：葛婶\n△ 𠮷 ⌚\n旁白：（敲门）两 声。\n'
    + '<!-- hook: S -->\n<!-- paywall -->\n<!-- 批注 -->';
  const valid = parseEpisode(text, 'ep004.md');
  assert.equal(valid.items[0].chars, 5);
  assert.deepEqual(valid.errors, []);
  const invalid = parseEpisode(`${text}\n人物：葛婶`, 'ep004.md');
  assert.deepEqual(invalid.errors.map(error => error.rule), ['hook', 'paywall-placement', 'bad-line']);
});
