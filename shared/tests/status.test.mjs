import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const lib = new URL('../lib/status.mjs', import.meta.url);
const { pipelineStatus } = await import(lib);
const root = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));
const command = (...args) => spawnSync(process.execPath, [fileURLToPath(lib), ...args], { encoding: 'utf8' });
const keys = (obj, names) => assert.deepEqual(Object.keys(obj).sort(), names.split(' ').sort());

test('§13 exact JSON fields and human stage/table; malformed files warn and exit zero', () => {
  const proc = command('--root', root, '--json');
  assert.equal(proc.status, 0, proc.stderr);
  const data = JSON.parse(proc.stdout);
  keys(data, 'tool spec_version root ok target stage novel series warnings');
  keys(data.novel, 'bible chapters last_chapter frozen');
  assert.deepEqual(data.novel, { bible: true, chapters: 3, last_chapter: 3, frozen: 1 });
  assert.equal(data.stage, 'prompts');
  assert.equal(data.target, null);
  const series = data.series.find(item => item.series === 'paper-lantern');
  keys(series, 'series title total stage assets refs episodes');
  keys(series.refs, 'total done');
  keys(series.episodes[0], 'episode script storyboard image video');
  keys(series.episodes[0].image, 'blocks approved done');
  assert.deepEqual(series.refs, { total: 2, done: 2 });
  assert.deepEqual(series.episodes[0], { episode: 3, script: 'revised', storyboard: 'draft',
    image: { blocks: 2, approved: 1, done: 1 }, video: { blocks: 1, approved: 1, done: 0 } });
  assert.ok(data.warnings.some(line => line.includes('bad-cut/storyboards/ep004.md')));
  const plain = command('--root', root);
  assert.match(plain.stdout, /^阶段：prompts（目标：未设定）/);
  assert.match(plain.stdout, /\| 集 \| 剧本 \| 分镜 \| 图片提示词 \| 视频提示词 \|/);
  assert.equal(command('--help').status, 0);
  assert.match(command('--help').stdout, /scripts\/status.mjs/);
  assert.equal(command('--ep', '3').status, 2);
  assert.equal(command('--root', path.join(root, 'no-such-book')).status, 2);
});

test('§13 each stage, stage order by existence, frozen/target, and parse warnings', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'fiction-status-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const put = (relative, contents) => {
    const file = path.join(dir, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  };
  const status = () => pipelineStatus(dir);
  put('drama/paper-lantern/series.md', '# 薄纸灯\n');
  put('drama/paper-lantern/prompts/assets-image.md', '# 资产参考图\n\n## REF001\n- 状态：作废\n');
  assert.equal(status().stage, 'empty');
  assert.equal(status().series[0].stage, null);
  assert.equal(status().series[0].refs.total, 0);
  put('bible/indexes/notes.md', '# 索引\n');
  assert.equal(status().stage, 'bible');
  put('chapters/1/2/v1.md', '# 第2章：旧灯\n');
  put('chapters/1/2/outline.md', '# 提纲\n\n## 定稿\n\nv9\n');
  assert.equal(status().stage, 'bible');
  assert.match(status().warnings[0], /outline.md.*定稿不存在/);
  put('chapters/1/2/outline.md', '# 提纲\n\n## 定稿\n\nv1\n');
  put('.fiction/config.json', '{"frozen":{"ranges":["2-4"]},"workflow":{"target":"storyboard"}}');
  assert.equal(status().stage, 'novel');
  assert.equal(status().novel.frozen, 1);
  assert.equal(status().target, 'storyboard');
  put('drama/paper-lantern/episodes/ep002.md', '# 第2集：始\n- 状态：定稿\n## 场景1：纸窗·内·晨\n△ 风吹动纸角。\n');
  assert.equal(status().stage, 'script');
  put('drama/paper-lantern/storyboards/ep005.md', '# 标题写坏了\n- 状态：修改\n');
  assert.equal(status().stage, 'storyboard');
  assert.equal(status().series[0].episodes[1].storyboard, 'revised');
  put('drama/paper-lantern/prompts/ep003-video.md', '# 第3集视频提示词\n\n## SEG01\n- 状态：已出\n');
  assert.equal(status().stage, 'prompts');
  assert.deepEqual(status().series[0].episodes.map(row => [row.episode, row.script, row.storyboard, row.video?.done ?? null]),
    [[2, 'final', null, null], [3, null, null, 1], [5, null, 'revised', null]]);
  assert.equal(command('--root', dir).status, 0);
  put('.fiction/config.json', '{"workflow":{"target":"bad"}}');
  assert.equal(command('--root', dir, '--json').status, 2);
});
