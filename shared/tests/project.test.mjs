import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const { listChapters, resolveSelector, volumeOf, isFrozen, parseRanges } =
  await import(new URL('../lib/project.mjs', import.meta.url));
const book = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));

test('canonical draft and volume precedence, selectors and frozen ranges', () => {
  const chapters = listChapters(book);
  assert.deepEqual(chapters[1], {
    chapter: 2, volume: 1, dir: 'chapters/1/2',
    drafts: ['chapters/1/2/v1.md', 'chapters/1/2/v2.md'], canonical: 'chapters/1/2/v1.md',
  });
  assert.deepEqual(resolveSelector(book, '2,3-4,6'), {
    items: [{ chapter: 2, file: chapters[1].canonical }, { chapter: 3, file: chapters[2].canonical }], missing: [4, 6],
  });
  assert.equal(resolveSelector(book, 'publish/blurb.md').items[0].chapter, null);
  assert.throws(() => resolveSelector(book, '4-5'), /没有定稿/);
  assert.throws(() => resolveSelector(book, '1,foo'), /选择非法/);
  assert.equal(volumeOf(book, 3), 1);
  assert.equal(volumeOf(book, 8), 1);
  assert.equal(volumeOf(book, 10), 2);
  assert.equal(volumeOf(book, 99), null);
  assert.ok(isFrozen(0, { frozen: { ranges: ['0–3'] } }));
  assert.equal(isFrozen(null, { frozen: { ranges: ['0–3'] } }), false);
  assert.deepEqual(parseRanges(['1', '3-4']), [{ start: 1, end: 1 }, { start: 3, end: 4 }]);
});

test('numeric latest draft, non-canonical folder names, missing explicit draft and duplicate chapters', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'fiction-project-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'chapters/1/0');
  mkdirSync(dir, { recursive: true });
  for (const name of ['v2.md', 'v10.md', 'v011.md']) writeFileSync(path.join(dir, name), '钟');
  assert.equal(listChapters(root)[0].canonical, 'chapters/1/0/v10.md');
  writeFileSync(path.join(dir, 'outline.md'), '## 定稿\nv3\n');
  assert.throws(() => listChapters(root), /定稿不存在/);
  mkdirSync(path.join(root, 'chapters/1/2'));
  writeFileSync(path.join(root, 'chapters/1/2/v1.md'), '盘簧');
  assert.equal(resolveSelector(root, '2').items[0].file, 'chapters/1/2/v1.md');
  writeFileSync(path.join(dir, 'outline.md'), '## 定稿\nv2\n');
  mkdirSync(path.join(root, 'chapters/2/0'), { recursive: true });
  assert.throws(() => listChapters(root), /多个目录/);
});
