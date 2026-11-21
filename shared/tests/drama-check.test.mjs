import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const lib = new URL('../lib/drama-check.mjs', import.meta.url);
const { checkSeries } = await import(lib);
const { loadConfig } = await import(new URL('../lib/config.mjs', import.meta.url));
const root = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [fileURLToPath(lib), ...args, '--root', root], { encoding: 'utf8' });
const keys = (obj, names) => assert.deepEqual(Object.keys(obj).sort(), names.split(' ').sort());

test('drama exact JSON key sets, count, duration and paywall', () => {
  const proc = run('stopped-clock', '--ep', '1', '--json');
  assert.equal(proc.status, 0, proc.stderr);
  const data = JSON.parse(proc.stdout);
  keys(data, 'tool spec_version root ok series episodes paywall findings summary');
  keys(data.episodes[0], 'episode file title scenes chars est_seconds tier range hook paywall');
  keys(data.paywall, 'first all total ratio');
  keys(data.summary, 'episodes block suggest');
  assert.deepEqual(data.paywall, { first: 1, all: [1], total: 2, ratio: 0.5 });
  assert.equal(data.episodes[0].chars, 17);
  assert.equal(data.episodes[0].est_seconds, 4);
  assert.equal(data.episodes[0].tier, 'micro');
  assert.deepEqual(data.episodes[0].range, [4, 6]);
  assert.deepEqual(data.findings, []);
});

test('drama issues, single-episode range and exit codes', () => {
  const bad = run('bad-cut', '--json');
  assert.equal(bad.status, 1);
  const { findings } = JSON.parse(bad.stdout);
  keys(findings[0], 'rule id level file line column excerpt message hint');
  for (const rule of ['parse', 'ep-title', 'ep-meta', 'scene-header', 'scene-number', 'bad-line', 'action-missing', 'hook',
    'episode-gap', 'paywall-placement', 'paywall-position', 'paywall-ratio', 'paywall-hook', 'paywall-plan', 'map-missing',
    'map-foreshadow', 'map-character', 'map-order', 'map-source']) {
    assert.ok(findings.some(item => item.rule === rule), rule);
  }
  assert.deepEqual(findings.filter(item => item.rule === 'map-order').map(item => item.level), ['block', 'suggest']);
  const { config } = loadConfig(root);
  config.drama.max_scenes = 0;
  config.drama.chars_per_minute = 1;
  const suggest = checkSeries(root, 'stopped-clock', { config, ep: '1-2', failOn: 'suggest' });
  assert.deepEqual(suggest.findings.map(item => item.rule), ['length', 'max-scenes']);
  assert.equal(suggest.ok, false);
  assert.equal(checkSeries(root, 'stopped-clock', { config }).ok, true);
  assert.equal(run('stopped-clock', '--ep', '2-1').status, 2);
  assert.equal(run('../not-a-series').status, 2);
  assert.equal(run('--help').status, 0);
  assert.match(run('--help').stdout, /^用法：/);
});

test('series rules still use all episodes when --ep limits episode rules', t => {
  const book = mkdtempSync(path.join(tmpdir(), 'fiction-drama-'));
  t.after(() => rmSync(book, { recursive: true, force: true }));
  cpSync(root, book, { recursive: true });
  const base = path.join(book, 'drama/stopped-clock');
  const first = path.join(base, 'episodes/ep001.md');
  writeFileSync(first, readFileSync(first, 'utf8').replace('<!-- paywall -->', ''));
  writeFileSync(path.join(base, 'episodes/ep002.md'), '# 第2集：灯影\n\n## 场景1：闸房·内·夜\n挂着一盏灯。\n<!-- hook: A -->');
  const map = path.join(base, 'adaptation-map.md');
  writeFileSync(map, readFileSync(map, 'utf8').replace('收F001', '埋F004'));
  const selected = checkSeries(book, 'stopped-clock', { ep: '1' });
  assert.deepEqual(selected.episodes.map(item => item.episode), [1]);
  assert.deepEqual(selected.findings.map(item => item.rule), ['map-unresolved', 'map-unresolved', 'paywall-missing']);
  const series = path.join(base, 'series.md');
  writeFileSync(series, readFileSync(series, 'utf8').replace('总集数：2', '总集数：1'));
  const all = checkSeries(book, 'stopped-clock');
  for (const rule of ['episode-total', 'bad-line', 'paywall-missing']) assert.ok(all.findings.some(item => item.rule === rule), rule);
  assert.equal(all.findings.some(item => item.rule === 'map-unresolved'), false);
});
