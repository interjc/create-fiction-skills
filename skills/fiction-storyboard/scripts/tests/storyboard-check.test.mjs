import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const lib = new URL('../lib/storyboard-check.mjs', import.meta.url);
const { buildStoryboardBrief, checkStoryboards } = await import(lib);
const { parseVisualAssets, parseContinuity, resolveAsset, usableFrom } = await import('../lib/visual.mjs');
const { parseAdaptationMap } = await import('../lib/drama.mjs');
const { splitHeading, parseFences } = await import('../lib/md.mjs');
const root = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));
const base = 'drama/paper-lantern';
const sb = 'storyboards/ep003.md';
const ep = 'episodes/ep003.md';
const run = (...args) => spawnSync(process.execPath, [fileURLToPath(lib), ...args, '--root', root], { encoding: 'utf8' });
const keys = (obj, names) => assert.deepEqual(Object.keys(obj).sort(), names.split(' ').sort());
const rulesOf = result => new Set(result.findings.map(f => f.rule));
const read = file => readFileSync(path.join(root, base, file), 'utf8');

function workspace(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fiction-storyboard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(root, dir, { recursive: true });
  const file = name => path.join(dir, base, name);
  return { dir, file, edit: (name, make) => writeFileSync(file(name), make(readFileSync(file(name), 'utf8'))) };
}

test('SB §6.1: heading delimiters, exact fences, and named fences in comments/examples', () => {
  assert.deepEqual(splitHeading(' SEG01｜ 场景1 |  '), ['SEG01', '场景1', '']);
  const lines = ['<!--', '```prompt', '-->', '````markdown', '```prompt', 'ex', '```', '````',
    '```prompt', '', '  甲', '乙  ', '```', '```negative', '丙'];
  const parsed = parseFences(lines);
  assert.deepEqual(parsed.map(({ kind, line, end, content }) => [kind, line, end, content]), [
    ['prompt', 9, 13, '甲\n乙'], ['negative', 14, null, ''],
  ]);
});

test('§11 JSON and SB §9.6 derivation; strict suggestions fail without changing ok', () => {
  const process = run('paper-lantern', '--json');
  assert.equal(process.status, 0, process.stderr);
  const data = JSON.parse(process.stdout);
  keys(data, 'tool spec_version root ok series assets episodes findings summary');
  keys(data.assets, 'file exists characters locations props variants');
  keys(data.episodes[0], 'episode file status segments shots seconds range dialogue actions');
  keys(data.summary, 'episodes block suggest');
  keys(data.findings[0], 'rule id level file line column excerpt message hint');
  const [episode] = data.episodes;
  assert.deepEqual(episode, { episode: 3, file: `${base}/${sb}`, status: 'draft', segments: 2, shots: 5, seconds: 14,
    range: [77, 104], dialogue: { script: 2, matched: 2 }, actions: { script: 3, quoted: 3 } });
  assert.deepEqual(data.findings.map(f => f.rule), ['sb-duration']);
  const strict = run('paper-lantern', '--fail-on', 'suggest', '--json');
  assert.equal(strict.status, 1);
  assert.equal(JSON.parse(strict.stdout).ok, true);
  assert.equal(run('bad-cut').status, 1);
  assert.equal(run('not-a-series').status, 2);
  assert.equal(run('paper-lantern', '--ep', '4-3').status, 2);
  assert.equal(run('--help').status, 0);
  assert.match(run('--help').stdout, /^用法：/);
});

test('series/episode rules hit broken fixtures and spare the valid fixture', t => {
  const good = rulesOf(checkStoryboards(root, 'paper-lantern'));
  const bad = rulesOf(checkStoryboards(root, 'bad-cut'));
  for (const rule of ['va-structure', 'va-duplicate', 'va-variant', 'va-look', 'va-character', 'va-item', 'va-reveal', 'va-lock',
    'vc-row', 'vc-asset', 'sb-title', 'sb-episode', 'sb-meta', 'sb-heading', 'sb-id', 'sb-scene', 'sb-scene-order', 'sb-bad-line',
    'sb-field', 'sb-vocab', 'sb-shot-seconds', 'sb-segment-seconds', 'sb-speech-fit', 'sb-dialogue', 'sb-dialogue-missing',
    'sb-basis', 'sb-people', 'sb-character', 'sb-asset', 'sb-spoiler', 'sb-continuity']) {
    assert.ok(bad.has(rule), rule);
    assert.ok(!good.has(rule), rule);
  }
  assert.ok(good.has('sb-duration'));
  assert.ok(!bad.has('sb-duration'));
  assert.ok(!rulesOf(checkStoryboards(root, 'stopped-clock')).has('va-missing'));
  const scoped = checkStoryboards(root, 'bad-cut', { ep: '4' });
  assert.deepEqual(scoped.episodes.map(item => item.episode), [4]);
  assert.ok(rulesOf(scoped).has('va-variant'));
  assert.ok(rulesOf(scoped).has('vc-row'));
  assert.ok(!rulesOf(scoped).has('sb-title'));
  const { dir, file, edit } = workspace(t);
  rmSync(file('visual/assets.md'));
  rmSync(file('visual/continuity.md'));
  edit(sb, text => text.replace('林砚@围裙', '无档案'));
  const missing = rulesOf(checkStoryboards(dir, 'paper-lantern'));
  assert.ok(missing.has('va-missing'));
  assert.ok(missing.has('sb-character'));
  for (const rule of ['sb-asset', 'sb-spoiler', 'sb-continuity']) assert.ok(!missing.has(rule));
});

test('§11 pointer skips only with empty buffer; mismatch does not consume, and coverage uses script locations', t => {
  const { dir, edit } = workspace(t);
  edit(ep, text => text.replace('唐七：（侧耳）你别松手。\n小林：我扶着呢。', [
    '唐七：先擦桌。', '唐七：（侧耳）你别急着松手。', '阿七：放回灯架上。', '小林：我扶着呢。',
  ].join('\n')));
  edit(sb, text => text.replace('唐七：你别松手。', '阿七：你别\n小林：我扶着呢。')
    .replace('林砚：（低头）我 扶着呢。', '唐七：（低头）急着松手。\n唐七：放回')
    .replace('- 依据：灯罩边压着一张船票', '').split('## SEG02')[0]);
  const draft = checkStoryboards(dir, 'paper-lantern');
  assert.deepEqual(draft.episodes[0].dialogue, { script: 4, matched: 1 });
  assert.deepEqual(draft.episodes[0].actions, { script: 3, quoted: 1 });
  const by = (report, rule) => report.findings.filter(f => f.rule === rule);
  assert.deepEqual(by(draft, 'sb-dialogue').map(f => [f.excerpt, f.level]), [['小林：我扶着呢。', 'block']]);
  assert.deepEqual(by(draft, 'sb-dialogue-missing').map(f => [f.file, f.line, f.level, f.message.includes('一部分')]), [
    [`${base}/${ep}`, 9, 'suggest', false], [`${base}/${ep}`, 11, 'suggest', true], [`${base}/${ep}`, 12, 'suggest', false],
  ]);
  assert.deepEqual(by(draft, 'sb-scene-uncovered').map(f => [f.file, f.line, f.level]), [[`${base}/${ep}`, 15, 'suggest']]);
  assert.equal(by(draft, 'sb-action-uncovered').length, 2);
  edit(sb, text => text.replace('初稿', 'final'));
  const final = checkStoryboards(dir, 'paper-lantern');
  for (const rule of ['sb-dialogue-missing', 'sb-scene-uncovered']) assert.ok(by(final, rule).every(f => f.level === 'block'));
  assert.ok(by(final, 'sb-action-uncovered').every(f => f.level === 'suggest'));
});

test('continuity and reveal boundaries: earlier/tied/same episode, reset, retirement and inherited gates', t => {
  const assets = parseVisualAssets(read('visual/assets.md')).items;
  const rows = parseContinuity(`${read('visual/continuity.md')}| 3 | 木尺 | 又包好 | 封纸 | |\n`).items;
  const map = parseAdaptationMap(read('adaptation-map.md')).items;
  const resolve = (key, episode) => resolveAsset(key, episode, assets, rows);
  assert.equal(resolve('林砚', 1).current, '围裙');
  assert.equal(resolve('木尺', 1).current, null);
  assert.deepEqual([...resolve('木尺', 1).allowed], ['封纸']);
  assert.deepEqual([...resolve('木尺', 3).allowed], ['封纸', '本体']);
  assert.equal(resolve('木尺', 4).current, '封纸');
  assert.equal(resolve('灯罩', 4).current, null);
  assert.equal(resolve('灯罩', 5).current, '退场');
  assert.equal(resolve('灯罩', 5).key, '灯罩');
  const from = key => usableFrom(assets.find(asset => asset.key === key), map);
  assert.equal(from('木尺'), 1);
  assert.equal(from('簧轮@反齿'), 3);
  assert.equal(from('木尺@刻纹'), null);
  assert.equal(from('木尺@封纸'), 1);
  assert.equal(resolve('木尺@封纸', 3).entry.fields.item, 'I001');
  assert.equal(usableFrom({ fields: { reveals: ['F001', 'F003'] } }, [...map,
    { episode: 4, foreshadow_actions: [{ id: 'F003', action: 'resolve' }] }]), 4);
  const { dir, file, edit } = workspace(t);
  edit(sb, text => text.replace('道具：灯罩', '道具：簧轮@反齿、木尺@刻纹').replace('林砚@围裙', '林砚@围裙、唐七、林砚、林砚'));
  const atReveal = checkStoryboards(dir, 'paper-lantern');
  assert.deepEqual(atReveal.findings.filter(f => f.rule === 'sb-spoiler').map(f => f.excerpt), ['木尺@刻纹']);
  assert.ok(rulesOf(atReveal).has('sb-people'));
  edit(sb, text => text.replace('道具：簧轮@反齿、木尺@刻纹', '道具：簧轮@反齿、木尺@封纸')
    .replace('林砚@围裙、唐七、林砚、林砚', '林砚@围裙、唐七、林砚、林砚\n- 备注：短暂交叉剪辑'));
  writeFileSync(file('storyboards/ep002.md'), readFileSync(file(sb), 'utf8').replace('第3集', '第2集'));
  writeFileSync(file('episodes/ep002.md'), read(ep).replace('第3集', '第2集'));
  const beforeReveal = checkStoryboards(dir, 'paper-lantern', { ep: '2' });
  assert.deepEqual(beforeReveal.findings.filter(f => f.rule === 'sb-spoiler').map(f => f.excerpt), ['簧轮@反齿']);
  assert.ok(!rulesOf(beforeReveal).has('sb-people'));
});

test('brief JSON shape, hidden and continuity boundaries, Markdown headings, empty sections and CLI errors', () => {
  const proc = run('paper-lantern', '--ep', '3', '--brief', '--json');
  assert.equal(proc.status, 0, proc.stderr);
  const data = JSON.parse(proc.stdout);
  keys(data, 'tool spec_version root ok series brief');
  const brief = data.brief;
  keys(brief, 'episode map hidden character_secrets gated_assets continuity');
  keys(brief.map, 'source_chapters characters foreshadow_actions');
  keys(brief.map.foreshadow_actions[0], 'action id');
  keys(brief.hidden[0], 'id name reader_view author_truth planted_episode resolved_episode resolves_here');
  keys(brief.character_secrets[0], 'name reader_view author_truth');
  keys(brief.gated_assets[0], 'key group from_episode reveals');
  const ruler = brief.continuity.find(item => item.object === '木尺');
  keys(ruler, 'object state variant since item');
  keys(ruler.item, 'id holder status changed_chapter');
  assert.deepEqual([ruler.state, ruler.variant, ruler.since], ['摆在工作台右角', '封纸', 2]);
  assert.equal(brief.map.source_chapters, '2-3');
  assert.deepEqual(brief.hidden.map(item => [item.id, item.planted_episode, item.resolved_episode, item.resolves_here]),
    [['F001', 1, 3, true], ['F003', null, null, false]]);
  assert.deepEqual(brief.gated_assets.map(item => [item.key, item.from_episode]), [['木尺@刻纹', null]]);
  assert.deepEqual(buildStoryboardBrief(root, 'paper-lantern', 4).hidden.map(item => item.id), ['F003']);
  assert.equal(buildStoryboardBrief(root, 'paper-lantern', 5).map, null);
  const text = run('paper-lantern', '--ep', '3', '--brief').stdout;
  assert.deepEqual(text.match(/^#+ .*$/gm), ['# 第3集分镜简报（paper-lantern）', '## 来源', '## 本集不得画出的真相',
    '## 人物秘密', '## 尚不可用的资产', '## 连戏现状']);
  assert.match(run('paper-lantern', '--ep', '5', '--brief').stdout, /## 来源\n\n（无）/);
  for (const args of [[], ['--ep', '1-3'], ['--ep', '0'], ['--ep', '1', '--fail-on', 'suggest']]) {
    assert.equal(run('paper-lantern', '--brief', ...args).status, 2);
  }
});
