import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const lib = new URL('../lib/lint.mjs', import.meta.url);
const { lintFile } = await import(lib);
const { loadConfig } = await import(new URL('../lib/config.mjs', import.meta.url));
const { loadPatterns } = await import(new URL('../lib/patterns.mjs', import.meta.url));
const root = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));
const { config } = loadConfig(root);
const { patterns } = loadPatterns(root, config);
const runAt = (book, ...args) => spawnSync(process.execPath, [fileURLToPath(lib), ...args, '--root', book], { encoding: 'utf8' });
const run = (...args) => runAt(root, ...args);
const keys = (obj, names) => assert.deepEqual(Object.keys(obj).sort(), names.split(' ').sort());

const good = '# 第3章：回摆\n\n林砚拿起木尺。\n\n---\n\n门里没有光。\n\n<!-- hook: A -->';
const chapter = { kind: 'chapter', chapter: 3 };
const cases = [
  ['banned-term', '它叫 aCME-7。', '它叫 ACME-71。'],
  ['desensitize', '在铜湾市修表。', '在铜湾边修表。'],
  ['exact-year', '他在2024年留下字据。', '他在前些年留过字据。'],
  ['internal-ref', '外壳标着 B2。', '外壳标着 ZB2。'],
  ['internal-term', '“这是支线。”', '*下章预告：支线*'],
  ['summary', '这就是铁盒。', '“这就是铁盒。”'],
  ['ai-tone', '一丝不易察觉的痕迹。', '「一丝不易察觉的」的纸条。'],
  ['custom', '“准时报喜。”', '“报喜得趁早。”'],
  ['title-format', good.replace('第3章', '第2章'), good, chapter],
  ['hook', good.replace('hook: A', 'hook: c'), good, chapter],
  ['hook-discouraged', good.replace('hook: A', 'hook: C'), good, chapter],
  ['markdown-format', good.replace('林砚', '**林砚**'), good, chapter],
  ['separator-format', good.replace('---', '----'), good, chapter],
];

for (const [rule, match, miss, ctx = {}] of cases) {
  test(`${rule} hits and does not overmatch`, () => {
    const options = { ...ctx, config, patterns, subplotIds: ['B2'], rules: [rule] };
    assert.ok(lintFile(match, options).findings.length);
    assert.deepEqual(lintFile(miss, options).findings, []);
  });
}

test('scope, comments, exemptions, IDs, levels and Unicode code-point columns', () => {
  const opts = { config, patterns, file: 'publish/blurb.md' };
  const sample = '𠮷<!--𠮷 一丝不易察觉的-->一丝不易察觉的。\n'
    + '<!-- lint-ignore: AT01 -->\n\n一丝不易察觉的。\n'
    + '<!-- lint-ignore-file: internal-term -->\n支线';
  const report = lintFile(sample, opts);
  assert.equal(report.suppressed, 2);
  assert.equal(report.findings.length, 1);
  const [f] = report.findings;
  assert.equal(f.column, Array.from('𠮷<!--𠮷 一丝不易察觉的-->').length + 1);
  assert.equal(f.line, 1);
  assert.equal(f.id, 'AT01');
  assert.equal(f.excerpt, '一丝不易察觉的');
  keys(f, 'rule id level file line column excerpt message hint');
  const episode = lintFile('△𠮷一丝不易察觉的\n林砚：一丝不易察觉的\n林砚：满屋都是赞叹', { ...opts, kind: 'episode' });
  assert.deepEqual(episode.findings.map(item => [item.line, item.column, item.id]), [[1, 3, 'AT01'], [3, 4, 'U7']]);
  const overridden = structuredClone(config);
  overridden.lint.rules = { 'ai-tone': 'off', AT01: 'suggest' };
  assert.deepEqual(lintFile('一丝难以察觉的。不可否认。', { ...opts, config: overridden }).findings.map(item => item.level), ['suggest']);
  assert.match(lintFile('铜湾市', opts).findings[0].hint, /河对岸/);
  const middleHook = good.replace('<!-- hook: A -->', '<!-- hook: B -->\n<!-- hook: A -->\n还在响。');
  assert.equal(lintFile(middleHook, { ...opts, ...chapter, rules: ['hook'] }).findings.length, 3);
  assert.equal(lintFile(good.replace('<!-- hook: A -->', ''), { ...opts, ...chapter }).findings[0].rule, 'hook');
});

test('lint JSON shape, series/path modes, fail-on, help and invalid options', () => {
  const all = run('--all', '--json');
  assert.equal(all.status, 0);
  const data = JSON.parse(all.stdout);
  keys(data, 'tool spec_version root ok files findings summary');
  keys(data.files[0], 'file kind chapter');
  keys(data.summary, 'files block suggest suppressed');
  assert.equal(data.files.length, 4);
  assert.equal(data.findings[0].rule, 'frozen-unsealed');
  assert.equal(run('--all', '--fail-on', 'suggest').status, 1);
  assert.equal(run('--series', 'stopped-clock', '--rules', 'ai-tone').status, 0);
  assert.equal(JSON.parse(run('chapters/1/1/v1.md', 'publish/blurb.md', '--json').stdout).files.length, 2);
  assert.equal(run('--rules', 'unknown', '--all').status, 2);
  assert.match(run('--help').stdout, /^用法：/);
  assert.equal(run('--help').status, 0);
});

test('seal all drafts, detect changed/deleted and newly added drafts, force reseal, append and remove', t => {
  const book = mkdtempSync(path.join(tmpdir(), 'fiction-lint-'));
  t.after(() => rmSync(book, { recursive: true, force: true }));
  cpSync(root, book, { recursive: true });
  const sealFile = path.join(book, '.fiction/frozen.json');
  const configFile = path.join(book, '.fiction/config.json');
  const run = (...args) => runAt(book, ...args);
  const read = () => JSON.parse(readFileSync(sealFile, 'utf8'));
  assert.match(run('--freeze').stdout, /新增 2，移除 0，保持 0/);
  const initial = read();
  keys(initial, 'spec_version created ranges files');
  assert.deepEqual(Object.keys(initial.files), ['chapters/1/2/v1.md', 'chapters/1/2/v2.md']);
  assert.ok(Object.values(initial.files).every(hash => /^[a-f0-9]{64}$/.test(hash)));
  assert.deepEqual(JSON.parse(run('1', '--json').stdout).findings, []);
  writeFileSync(path.join(book, 'chapters/1/2/v1.md'), '改过。');
  rmSync(path.join(book, 'chapters/1/2/v2.md'));
  writeFileSync(path.join(book, 'chapters/1/2/v3.md'), '新稿。');
  const checked = run('1', '--json');
  assert.equal(checked.status, 1);
  assert.deepEqual(JSON.parse(checked.stdout).findings.map(f => f.file), [
    'chapters/1/2/v1.md', 'chapters/1/2/v2.md', 'chapters/1/2/v3.md',
  ]);
  assert.equal(run('--freeze').status, 1);
  assert.deepEqual(read(), initial);
  assert.equal(run('--freeze', '--force', '--json').status, 0);
  const cfg = JSON.parse(readFileSync(configFile, 'utf8'));
  cfg.frozen.ranges = ['1', '3'];
  writeFileSync(configFile, JSON.stringify(cfg));
  const unsealed = JSON.parse(run('1', '--json').stdout);
  assert.deepEqual(unsealed.findings.map(f => f.rule), ['frozen-unsealed', 'frozen-unsealed']);
  assert.match(run('--freeze').stdout, /新增 2，移除 2，保持 0/);
  assert.deepEqual(Object.keys(read().files), ['chapters/1/1/v1.md', 'chapters/1/3/v1.md']);
  cpSync(path.join(book, 'invalid/frozen.json'), sealFile);
  assert.equal(run('1').status, 2);
  cpSync(path.join(book, 'invalid/patterns.txt'), path.join(book, '.fiction/lint-patterns.txt'));
  const invalidPattern = run('1', '--json');
  assert.equal(invalidPattern.status, 2);
  assert.match(JSON.parse(invalidPattern.stdout).error, /lint-patterns.txt:5/);
});
