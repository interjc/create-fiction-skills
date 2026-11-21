import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const { EXIT, findBookRoot, finding, formatFinding, parseCli, sameEntryPath, sortFindings } =
  await import(new URL('../lib/cli.mjs', import.meta.url));
const book = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));

test('CLI strict options, exit constants and root discovery', t => {
  assert.deepEqual(EXIT, { OK: 0, FAIL: 1, ERROR: 2 });
  const parsed = parseCli(['--root', book, '--json', '1', '--', '--literal']);
  assert.deepEqual({ ...parsed.values }, { root: book, json: true });
  assert.deepEqual(parsed.positionals, ['1', '--literal']);
  assert.throws(() => parseCli(['--json', '--json']), /重复参数/);
  assert.throws(() => parseCli(['--unknown']), /参数错误/);
  assert.equal(findBookRoot(path.join(book, 'chapters/1/2')), path.resolve(book));

  const root = mkdtempSync(path.join(tmpdir(), 'fiction-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'nested/bible'), { recursive: true });
  assert.equal(findBookRoot(path.join(root, 'nested')), path.join(root, 'nested'));
  mkdirSync(path.join(root, '.fiction'));
  writeFileSync(path.join(root, '.fiction/config.json'), '{}');
  assert.equal(findBookRoot(path.join(root, 'nested')), root);
});

test('Finding shape, order and Chinese rendering', () => {
  const f = finding('ai-tone', 'chapters/1/3/v1.md', 'AI 腔：陈词套话', {
    id: 'AT01', line: 34, column: 5, excerpt: '一丝不易察觉的', hint: '换成具体动作或物件',
  });
  assert.deepEqual(Object.keys(f).sort(), ['column', 'excerpt', 'file', 'hint', 'id', 'level', 'line', 'message', 'rule']);
  assert.equal(formatFinding(f), 'BLOCK chapters/1/3/v1.md:34:5 ai-tone/AT01「一丝不易察觉的」AI 腔：陈词套话 → 换成具体动作或物件');
  const earlier = { ...f, column: 1 };
  const before = { ...f, rule: 'aaa' };
  assert.deepEqual(sortFindings([f, before, earlier]), [earlier, before, f]);
});

test('direct entry path comparison is case-insensitive only on Windows', () => {
  assert.equal(sameEntryPath('c:\\BOOK\\scripts\\..\\Lib\\STATUS.MJS', 'C:\\book\\lib\\status.mjs', 'win32'), true);
  assert.equal(sameEntryPath('D:\\book\\lib\\status.mjs', 'C:\\book\\lib\\status.mjs', 'win32'), false);
  assert.equal(sameEntryPath('C:\\book\\status.mjs', 'C:\\book\\lib\\status.mjs', 'win32'), false);
  assert.equal(sameEntryPath('/book/lib/STATUS.MJS', '/book/lib/status.mjs', 'darwin'), false);
  assert.equal(sameEntryPath('/book/scripts/../lib/status.mjs', '/book/lib/status.mjs', 'linux'), true);
});
