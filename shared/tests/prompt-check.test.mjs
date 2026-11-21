import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const lib = new URL('../lib/prompt-check.mjs', import.meta.url);
const { checkPrompts } = await import(lib);
const { loadConfig } = await import('../lib/config.mjs');
const root = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));
const base = 'drama/paper-lantern';
const img = 'prompts/ep003-image.md';
const vid = 'prompts/ep003-video.md';
const sb = 'storyboards/ep003.md';
const run = (...args) => spawnSync(process.execPath, [fileURLToPath(lib), ...args, '--root', root], { encoding: 'utf8' });
const keys = (obj, names) => assert.deepEqual(Object.keys(obj).sort(), names.split(' ').sort());
const by = (report, rule) => report.findings.filter(f => f.rule === rule);

function workspace(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fiction-prompts-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(root, dir, { recursive: true });
  const file = name => path.join(dir, base, name);
  return { dir, file, edit: (name, make) => writeFileSync(file(name), make(readFileSync(file(name), 'utf8'))) };
}

test('§12 JSON shapes, lock exemptions, two frames, external REF, and void text exclusion', () => {
  const proc = run('paper-lantern', '--json');
  assert.equal(proc.status, 0, proc.stderr);
  const data = JSON.parse(proc.stdout);
  keys(data, 'tool spec_version root ok series refs episodes blocks findings summary');
  keys(data.refs, 'file exists by_status');
  keys(data.refs.by_status, 'draft approved done void');
  keys(data.episodes[0], 'episode image video');
  keys(data.episodes[0].image, 'file blocks by_status');
  keys(data.episodes[0].video, 'file blocks by_status segments segments_covered');
  keys(data.blocks[0], 'kind episode key frame dialect status seconds chars refs output file line');
  keys(data.summary, 'blocks block suggest');
  assert.deepEqual(data.summary, { blocks: 6, block: 0, suggest: 0 });
  assert.deepEqual(data.findings, []);
  assert.deepEqual(data.blocks.map(block => [block.kind, block.frame, block.status]), [
    ['ref', null, 'done'], ['ref', null, 'done'], ['image', 'first', 'done'], ['image', 'last', 'approved'],
    ['image', 'first', 'void'], ['video', null, 'approved'],
  ]);
  assert.deepEqual(data.refs.by_status, { draft: 0, approved: 0, done: 2, void: 0 });
  const video = data.episodes[0].video;
  assert.deepEqual([video.segments, video.segments_covered], [2, 1]);
  assert.equal(data.blocks[0].chars, Array.from('竖屏半身，MOSS linen apron，淡光落在横缝上。').length);
  assert.equal(data.blocks.at(-1).seconds, 11);
  assert.equal(run('bad-cut').status, 1);
  assert.equal(run('paper-lantern', '--ep', '1,3').status, 2);
  assert.equal(run('unknown', '--json').status, 2);
  assert.equal(run('--help').status, 0);
  assert.match(run('--help').stdout, /^用法：/);
});

test('§12 invalid fixture rules, location of negative text, and REF files unaffected by selection', () => {
  const bad = checkPrompts(root, 'bad-cut');
  const good = checkPrompts(root, 'paper-lantern');
  for (const rule of ['pr-title', 'pr-block', 'pr-prompt-missing', 'pr-target', 'pr-asset', 'pr-ref', 'pr-file',
    'pr-internal-ref', 'pr-desensitize', 'pr-spoiler', 'pr-dialect-unknown']) {
    assert.ok(by(bad, rule).length, rule);
    assert.equal(by(good, rule).length, 0, rule);
  }
  keys(bad.findings[0], 'rule id level file line column excerpt message hint');
  assert.deepEqual(by(bad, 'pr-internal-ref').map(f => f.excerpt), ['ep003.md', 'drama/', 'F001', 'SEG01', 'SH009', 'REF012']);
  assert.deepEqual(by(bad, 'pr-desensitize').map(f => [f.excerpt, f.line, f.column]), [
    ['ACME-7', 27, 1], ['铜湾市', 27, 8], ['门牌原稿', 27, 12], ['2024年', 27, 17],
  ]);
  assert.equal(by(bad, 'pr-dialect-unknown').length, 1);
  assert.ok(bad.findings.every(finding => finding.rule.startsWith('pr-')));
  const filtered = checkPrompts(root, 'bad-cut', { ep: '4-5' });
  assert.deepEqual(filtered.episodes, []);
  assert.ok(filtered.findings.length > 0 && filtered.findings.every(f => f.file.endsWith('/assets-image.md')));
});

test('§12 ready refs, dialogue, literal locks, and dialect hints hit then clear at exact limits', t => {
  const { dir, file, edit } = workspace(t);
  const { config } = loadConfig(dir);
  const settings = config.prompts;
  settings.video.dialect = 'unused';
  settings.dialects.template = { max_chars: 3, max_seconds: 10, max_refs: 1, forbid: ['不应用', 're:^竖屏'] };
  edit('visual/assets.md', text => text.replace('视频方言：generic', '视频方言：template'));
  edit(vid, text => text.replace('SH001、REF001', 'REF001、REF002').replace('你别松手。', '不应用').replace('近拍', '竖屏近拍'));
  edit('prompts/assets-image.md', text => text.replace('状态：已出\n- 文件：visual/refs/steps.png', '状态：草稿'));
  const bad = checkPrompts(dir, 'paper-lantern', { config });
  const videoRules = rule => by(bad, rule).filter(f => f.file.endsWith(vid));
  for (const rule of ['pr-ref-not-ready', 'pr-lock', 'pr-dialogue', 'pr-length', 'pr-seconds', 'pr-refs-max', 'pr-forbid']) {
    assert.ok(videoRules(rule).length, rule);
  }
  assert.deepEqual(videoRules('pr-forbid').map(f => f.id), ['FB2', 'FB1']);
  assert.deepEqual(videoRules('pr-lock').map(f => f.excerpt), ['直筒麻纸灯罩=straight paper shade']);
  assert.equal(bad.blocks.at(-1).dialect, 'template');
  assert.ok(!by(bad, 'pr-dialect-unknown').length);
  const modified = readFileSync(file(vid), 'utf8').replace('REF001、REF002', 'SH001、REF001').replace('竖屏', '')
    .replace('不应用', '新台词。');
  writeFileSync(file(vid), modified);
  edit(sb, text => text.replace('唐七：你别松手。', '唐七（VO）：此句不查。\n字幕：也不查。\n旁白：仍不查。\n唐七：新 台词。'));
  const known = settings.dialects.template;
  known.max_seconds = 11;
  known.max_refs = 2;
  const measured = checkPrompts(dir, 'paper-lantern', { config }).blocks.at(-1).chars;
  known.max_chars = measured;
  const good = checkPrompts(dir, 'paper-lantern', { config });
  assert.deepEqual(good.findings, []);
  edit(vid, text => text.replace('新台词。', '另一个声音').replace('- 状态：已确认', '- 状态：已确认\n- 方言：generic'));
  settings.dialogue_check = false;
  assert.deepEqual(checkPrompts(dir, 'paper-lantern', { config }).findings, []);
});

test('§12 exact reveal/transcript boundaries, alternate case/spacing, and non-text ignored', t => {
  const { dir, file, edit } = workspace(t);
  edit(img, text => text.replace('直筒麻纸灯罩即将滚离掌心。', '直筒麻纸灯罩即将滚离掌心。ReVeRsEd  brass teeth。')
    .replace('- 状态：已出', '- 状态：已出\n- 模型：SH999 铜湾市'));
  assert.equal(by(checkPrompts(dir, 'paper-lantern'), 'pr-spoiler').length, 0);
  writeFileSync(file('prompts/ep002-image.md'), readFileSync(file(img), 'utf8').replace('第3集', '第2集'));
  writeFileSync(file('storyboards/ep002.md'), readFileSync(file(sb), 'utf8').replace('第3集', '第2集'));
  const before = checkPrompts(dir, 'paper-lantern', { ep: '2' });
  assert.deepEqual(by(before, 'pr-spoiler').map(f => f.excerpt), ['reversed brass teeth']);
  assert.equal(before.episodes[0].video, null);
  edit(img, text => `${text}\n## SH002\n\n\`\`\`prompt\n河边一立灯\n\`\`\`\n\n\`\`\`negative\nHALF-RING\n etching\n\`\`\`\n`);
  const gated = checkPrompts(dir, 'paper-lantern', { ep: '3' });
  assert.deepEqual(by(gated, 'pr-spoiler').map(f => f.excerpt), ['half-ring etching']);
  assert.equal(by(gated, 'pr-internal-ref').length, 0);
  assert.equal(by(gated, 'pr-desensitize').length, 0);
});

test('§12 regex/CLI failures, tail refs, traversal rejection, and unknown dialect selects no vendor defaults', t => {
  const { dir, edit } = workspace(t);
  const cli = (...args) => spawnSync(process.execPath, [fileURLToPath(lib), ...args, '--root', dir, '--json'], { encoding: 'utf8' });
  edit(vid, text => text.replace('SH001、REF001', 'SH001尾、REF001').replace('- 状态：已确认', '- 状态：已确认\n- 方言：unknown'));
  let report = cli('paper-lantern');
  assert.equal(report.status, 0);
  assert.deepEqual(JSON.parse(report.stdout).findings.map(f => f.rule).sort(), ['pr-dialect-unknown', 'pr-ref-not-ready']);
  report = cli('paper-lantern', '--fail-on', 'suggest');
  assert.equal(report.status, 1);
  assert.equal(JSON.parse(report.stdout).ok, false);
  edit(img, text => text.replace('visual/refs/shade.png', '../paper-lantern/visual/refs/shade.png'));
  assert.equal(by(checkPrompts(dir, 'paper-lantern'), 'pr-file').length, 1);
  const file = path.join(dir, '.fiction/config.json');
  writeFileSync(file, JSON.stringify({ prompts: { dialects: { example: { forbid: ['re:['] } } } }));
  report = cli('paper-lantern');
  assert.equal(report.status, 2);
  assert.match(JSON.parse(report.stdout).error, /forbid/);
});
