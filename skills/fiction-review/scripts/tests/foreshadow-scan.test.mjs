import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const lib = new URL('../lib/foreshadow-scan.mjs', import.meta.url);
const { scan } = await import(lib);
const root = fileURLToPath(new URL('./fixtures-shared/watch-shop/', import.meta.url));
const runAt = (book, ...args) => spawnSync(process.execPath, [fileURLToPath(lib), ...args, '--root', book], { encoding: 'utf8' });
const run = (...args) => runAt(root, ...args);
const keys = (obj, names) => assert.deepEqual(Object.keys(obj).sort(), names.split(' ').sort());
const fsKeys = 'id name status planted target resolved touched last_touch future reader_view author_truth subplots characters file line';

test('scan exact JSON shapes, categories, ordering, at cutoff, writeback and alerts', () => {
  const proc = run('--dormant', '1', '--json');
  assert.equal(proc.status, 1, proc.stderr);
  const data = JSON.parse(proc.stdout);
  keys(data, 'tool spec_version root ok at params counts plant_due due overdue dormant writeback subplot_alerts invalid');
  keys(data.params, 'due_window overdue_grace dormant_after stall_after max_span remind_gap');
  keys(data.counts, 'open plant_due due overdue dormant writeback subplot_alerts invalid');
  keys(data.plant_due[0], fsKeys);
  keys(data.due[0], fsKeys);
  keys(data.overdue[0], `${fsKeys} overdue_by`);
  keys(data.dormant[0], `${fsKeys} silent_for`);
  keys(data.due[0].target, 'start end');
  keys(data.writeback[0], 'chapter kind id action expected actual file line');
  keys(data.subplot_alerts[0], 'type id name level current_step current_chapter value');
  assert.equal(data.at, 3);
  assert.equal(data.due[0].last_touch, 2);
  assert.deepEqual(data.dormant.map(item => [item.id, item.silent_for]), [['F001', 1], ['F002', 2], ['F004', 1]]);
  assert.equal(data.overdue[0].overdue_by, 1);
  assert.deepEqual(data.writeback.map(item => item.expected), ['chain@3', 'touched@3', 'planted@3']);
  assert.deepEqual(scan(root, 5).subplot_alerts.map(item => item.type), ['stalled', 'span', 'remind_gap']);
  assert.equal(scan(root, 5).overdue[0].last_touch, 5);
  assert.match(run().stdout, /第3章 outline：埋 F003，但伏笔表仍是 planned/);
});

test('scan filtering, independent fail-on, invalid records and exit codes', t => {
  const filtered = run('--only', 'due', '--json');
  assert.equal(filtered.status, 1);
  keys(JSON.parse(filtered.stdout), 'tool spec_version root ok at params counts due');
  assert.equal(run('--at', '2', '--json').status, 0);
  assert.equal(run('--at', '0', '--fail-on', 'plant_due').status, 0);
  assert.equal(run('--only', 'unknown').status, 2);
  assert.equal(run('--help').status, 0);
  assert.match(run('--help').stdout, /^用法：/);
  const book = mkdtempSync(path.join(tmpdir(), 'fiction-scan-'));
  t.after(() => rmSync(book, { recursive: true, force: true }));
  cpSync(root, book, { recursive: true });
  cpSync(path.join(book, 'invalid/foreshadows.md'), path.join(book, 'bible/foreshadows.md'));
  const result = runAt(book, '--only', 'invalid', '--json');
  assert.equal(result.status, 1);
  const { invalid } = JSON.parse(result.stdout);
  keys(invalid[0], 'rule id level file line column excerpt message hint');
  assert.deepEqual(invalid.map(f => f.level), ['suggest', 'block', 'block', 'block', 'block']);
});
