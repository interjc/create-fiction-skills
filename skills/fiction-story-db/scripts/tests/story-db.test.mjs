import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, existsSync, linkSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const entry = new URL('../story-db.mjs', import.meta.url);
const mirror = new URL('./fixtures-shared/watch-shop/', import.meta.url);
// 当前同步脚本不为入口清单为空的 skill 复制 fixtures。
const fixture = existsSync(mirror) ? mirror : new URL('../../../../shared/tests/fixtures-shared/watch-shop/', import.meta.url);
const dbPath = root => path.join(root, '.fiction/story.db');
const read = (root, file) => readFileSync(path.join(root, file), 'utf8');
const write = (root, file, text) => writeFileSync(path.join(root, file), text);
const append = (root, file, text) => appendFileSync(path.join(root, file), text);

function book(t, { badCut = false } = {}) {
  const root = mkdtempSync(path.join(realpathSync(tmpdir()), 'fiction-story-db-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(fixture, root, { recursive: true });
  if (!badCut) rmSync(path.join(root, 'drama/bad-cut'), { recursive: true });
  return root;
}

function node(args, options) {
  const proc = spawnSync(process.execPath, args, { encoding: 'utf8', ...options });
  assert.ifError(proc.error);
  assert.equal(proc.signal, null);
  return proc;
}

function run(root, args, { code = 0, json = true, cwd = root } = {}) {
  const { status, stdout, stderr } = node([
    fileURLToPath(entry), ...args, ...(json ? ['--json'] : []),
  ], { cwd });
  assert.equal(status, code, `${args.join(' ')}\n${stdout}${stderr}`);
  if (code !== 2) assert.equal(stderr, '');
  if (!json) return { stdout, stderr };
  const result = JSON.parse(stdout);
  assert.equal(stdout, `${JSON.stringify(result, null, 2)}\n`);
  assert.equal(result.tool, 'story-db');
  assert.equal(result.spec_version, 1);
  assert.equal(result.root, root);
  assert.equal(result.ok, code === 0);
  return result;
}

const common = ['tool', 'spec_version', 'root', 'ok'];
const provenance = ['source_file', 'source_line'];
const findingKeys = ['rule', 'id', 'level', 'file', 'line', 'column', 'excerpt', 'message', 'hint'];
const columns = {
  meta: 'key value',
  source_registry: 'key purpose owner_file owner_anchor read_when write_when mode brief_rule',
  characters: 'name aliases role tier first_chapter always_present dormant_volumes scope',
  character_appearances: 'character chapter appearance_type note',
  relationship_changes: 'chapter character target change state',
  foreshadows: 'id name reader_view author_truth planted_chapter target_start target_end resolved_chapter touched_chapters status future subplot_ids characters note source_anchor',
  subplots: 'id name level status main_link current_step current_chapter active_volumes characters foreshadow_ids',
  subplot_steps: 'subplot_id step planned_chapter actual_chapter skipped content',
  timeline_anchors: 'id time_text chapter event kind prose_form',
  inventory: 'id name holder status acquired_chapter changed_chapter note',
  storylines: 'id name kind start_chapter status latest updated_chapter',
  settings: 'name tags relevant_chapters source_anchor',
  chapter_plans: 'chapter volume title core_event beat hook_planned weight foreshadow_actions subplot_ids required_characters status',
  chapters: 'chapter volume draft_file title length hook_actual frozen sha256',
  episodes: 'series episode title scenes est_seconds hook paywall',
  adaptation_map: 'series episode source_chapters characters foreshadow_actions',
};

function keys(object, expected) {
  assert.deepEqual(Object.keys(object).sort(), [...expected].sort());
}

function sourceRow(root, row, table, extra = []) {
  keys(row, [...columns[table].split(' '), ...provenance, ...extra]);
  assert.ok(!path.isAbsolute(row.source_file) && !row.source_file.includes('\\'));
  assert.ok(Number.isInteger(row.source_line) && row.source_line > 0);
  const line = read(root, row.source_file).split(/\r\n?|\n/)[row.source_line - 1];
  assert.ok(line?.trim(), JSON.stringify(row));
  return line;
}

function query(root, kind, ...args) {
  const result = run(root, ['query', kind, ...args]);
  keys(result, [...common, 'command', 'kind', 'stale', 'results']);
  assert.equal(result.kind, kind);
  assert.equal(result.command, 'query');
  assert.equal(result.stale, false);
  return result.results;
}

async function inspectDatabase(root, inspect) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath(root));
  try {
    inspect(db);
  } finally {
    db.close();
  }
}

test('full index uses the SB schema, hashes sources, and commits valid portions with findings', async t => {
  const root = book(t, { badCut: true });
  const result = run(root, ['--root', root, 'index', '--full'], { code: 1 });
  keys(result, [...common, 'command', 'mode', 'indexed_at', 'rebuilt_tables', 'files_read', 'files_reparsed', 'rows', 'findings']);
  assert.equal(result.mode, 'full');
  assert.deepEqual(result.rows, {
    meta: 34, source_registry: 4, characters: 3, character_appearances: 5, relationship_changes: 3,
    foreshadows: 5, subplots: 2, subplot_steps: 8, timeline_anchors: 6, inventory: 2, storylines: 2,
    settings: 3, chapter_plans: 3, chapters: 3, episodes: 3, adaptation_map: 8,
  });
  assert.deepEqual(result.rebuilt_tables, Object.keys(columns).slice(1));
  assert.ok(!result.files_read.some(file => /\/visual\/|\/storyboards\/|\/prompts\/|\/series\.md$|\/2\/v2\.md$/.test(file)));
  assert.deepEqual(result.files_reparsed, result.files_read.filter(file => file !== '.fiction/config.json'));
  assert.equal(result.findings.length, 10);
  for (const item of result.findings) keys(item, findingKeys);
  assert.deepEqual(result.findings.map(item => item.file), [...result.findings.map(item => item.file)].sort());
  await inspectDatabase(root, db => {
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map(row => row.name);
    assert.deepEqual(tables.sort(), Object.keys(columns).sort());
    for (const [table, names] of Object.entries(columns)) {
      assert.deepEqual(db.prepare(`PRAGMA table_info(${table})`).all().map(field => field.name), [...names.split(' '), ...provenance]);
      assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, result.rows[table]);
    }
    const meta = new Map(db.prepare('SELECT key, value FROM meta').all().map(row => [row.key, row.value]));
    assert.equal(meta.get('spec_version'), '1');
    assert.equal(meta.get('indexed_at'), result.indexed_at);
    for (const file of result.files_read) {
      assert.equal(meta.get(`sha256:${file}`), createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex'));
    }
  });
  const { episodes } = query(root, 'episodes', 'bad-cut');
  assert.equal(episodes[0].title, null);
  assert.equal(episodes[0].scenes, 1);
  assert.equal(episodes[0].hook, null);
  assert.equal(episodes[0].paywall, null);
  assert.equal(run(root, ['index'], { code: 1 }).findings.length, result.findings.length);
  rmSync(path.join(root, 'drama/bad-cut'), { recursive: true });
  const fixed = run(root, ['index']);
  assert.deepEqual(fixed.findings, []);
  assert.deepEqual(fixed.rebuilt_tables, ['episodes', 'adaptation_map']);
});

test('incremental indexing reparses only the affected tables and leaves Markdown untouched', t => {
  const root = book(t);
  const initial = run(root, ['index']);
  assert.equal(initial.mode, 'build');
  const file = 'bible/inventory.md';
  const text = `${read(root, file)}| I003 | 秒针 | 唐七 | 持有 | 3 | | |\n`;
  write(root, file, text);
  const edited = run(root, ['index']);
  assert.equal(edited.mode, 'incremental');
  assert.deepEqual(edited.rebuilt_tables, ['inventory']);
  assert.deepEqual(edited.files_reparsed, [file]);
  assert.deepEqual(edited.rows, { ...initial.rows, inventory: 3 });
  assert.equal(read(root, file), text);
  assert.deepEqual(query(root, 'inventory', '--holder', '阿七').map(row => row.id), ['I002', 'I003']);
  const noop = run(root, ['index']);
  assert.deepEqual(noop.rebuilt_tables, []);
  assert.deepEqual(noop.files_reparsed, []);
  assert.equal(noop.indexed_at, edited.indexed_at);

  append(root, 'bible/characters.md', '\n### 店主\n- 身份：铺主\n- 级别：次要\n');
  assert.deepEqual(run(root, ['index']).rebuilt_tables, ['characters']);
  const people = read(root, 'bible/characters.md').replace('别名：阿七', '别名：阿七、验货人');
  write(root, 'bible/characters.md', people);
  assert.deepEqual(run(root, ['index']).rebuilt_tables, ['characters', 'character_appearances']);
  write(root, 'bible/appearances.md', read(root, 'bible/appearances.md').replace('阿七：把收据', '验货人：把收据'));
  assert.deepEqual(run(root, ['index']).rebuilt_tables, ['character_appearances']);
  assert.equal(query(root, 'character', '验货人').appearances[0].note, '把收据塞进袖口');
});

test('status reports missing, fresh and every kind of drift; stale queries still return the saved rows', t => {
  const root = book(t);
  const status = ['status'];
  const statusKeys = [...common, 'command', 'state', 'indexed_at', 'changed', 'added', 'removed', 'layout_changed', 'findings'];
  const missing = run(root, status, { code: 1 });
  keys(missing, statusKeys);
  assert.equal(missing.state, 'missing');
  assert.equal(missing.indexed_at, null);
  for (const args of [['sources'], ['query', 'character', '唐七']]) {
    const err = run(root, args, { code: 2 });
    keys(err, [...common, 'error']);
    assert.match(err.error, /先运行 index/);
  }
  assert.equal(existsSync(dbPath(root)), false);
  run(root, ['index']);
  const fresh = run(root, status);
  keys(fresh, statusKeys);
  assert.equal(fresh.state, 'fresh');

  append(root, 'bible/characters.md', '\n');
  const indexedSetting = 'bible/indexes/river.md';
  const newSetting = 'bible/indexes/alternate.md';
  write(root, newSetting, read(root, indexedSetting));
  rmSync(path.join(root, indexedSetting));
  append(root, 'chapters/1/2/v2.md', '\n未采用的修改。');
  append(root, 'drama/paper-lantern/storyboards/ep003.md', '\n分镜修改。');
  const stale = run(root, status, { code: 1 });
  assert.deepEqual(stale.changed, ['bible/characters.md']);
  assert.deepEqual(stale.added, [newSetting]);
  assert.deepEqual(stale.removed, [indexedSetting]);
  assert.equal(stale.state, 'stale');
  const cached = run(root, ['query', 'character', '唐七']);
  assert.equal(cached.stale, true);
  assert.equal(cached.results.character.name, '唐七');
  const human = run(root, ['query', 'character', '唐七'], { json: false }).stdout;
  assert.match(human, /^警告：.*过期.*\n/u);
  assert.equal(human.match(/^警告：/gmu)?.length, 1);
  assert.match(human, /bible\/characters\.md:13/);
  assert.deepEqual(run(root, ['index']).rebuilt_tables, ['characters', 'settings']);
  assert.equal(run(root, status).state, 'fresh');
});

test('chapter query respects outline precedence, frozen policy, and changes to the canonical draft', t => {
  const root = book(t);
  run(root, ['index']);
  const { plan, chapter } = query(root, 'chapter', '2');
  sourceRow(root, plan, 'chapter_plans');
  sourceRow(root, chapter, 'chapters');
  assert.equal(plan.core_event, '铁盒底部的盐渍指向河路。');
  assert.equal(plan.beat, '拆底盖');
  assert.equal(plan.hook_planned, 'B');
  assert.equal(plan.status, 'frozen');
  assert.deepEqual(plan.foreshadow_actions.map(({ action, id }) => [action, id]), [['touch', 'F001'], ['plant', 'F004']]);
  assert.deepEqual(plan.subplot_ids, ['B2']);
  assert.deepEqual(plan.required_characters, ['唐七']);
  assert.equal(chapter.draft_file, 'chapters/1/2/v1.md');
  assert.equal(chapter.length, 54);
  assert.equal(chapter.hook_actual, 'A');
  assert.equal(chapter.frozen, true);
  assert.equal(query(root, 'chapter', '4').plan.status, 'planned');
  assert.equal(query(root, 'chapter', '4').chapter, null);
  assert.deepEqual(query(root, 'chapter', '99'), { plan: null, chapter: null });
  const { stdout } = run(root, ['query', 'chapter', '2'], { json: false });
  assert.match(stdout, /^- 章：2｜[^\n]*伏笔动作：触 F001（试着将铁盒与簧轮合在一起。）、埋 F004（盒中夹着另一块表盖。）/mu);
  assert.match(stdout, /^## 章节定稿信息$/mu);

  const file = 'chapters/1/2/outline.md';
  write(root, file, read(root, file).replace(/(## 定稿\s+)v1/u, '$1v2'));
  const diff = run(root, ['status'], { code: 1 });
  assert.equal(diff.layout_changed, true);
  assert.deepEqual(diff.changed, [file]);
  assert.deepEqual(diff.added, ['chapters/1/2/v2.md']);
  assert.deepEqual(diff.removed, ['chapters/1/2/v1.md']);
  assert.deepEqual(run(root, ['index']).rebuilt_tables, ['chapter_plans', 'chapters']);
  assert.equal(query(root, 'chapter', '2').chapter.draft_file, 'chapters/1/2/v2.md');

  const configFile = '.fiction/config.json';
  const config = JSON.parse(read(root, configFile));
  config.frozen.ranges = [];
  write(root, configFile, JSON.stringify(config));
  assert.deepEqual(run(root, ['index']).rebuilt_tables, ['chapter_plans', 'chapters']);
  const thawed = query(root, 'chapter', '2');
  assert.equal(thawed.chapter.frozen, false);
  assert.equal(thawed.plan.status, 'final');
  write(root, file, read(root, file).replace(/(## 定稿\s+)v2/u, '$1v9'));
  const partial = run(root, ['index'], { code: 1 });
  assert.ok(partial.findings.some(item => item.file === file && item.rule === 'canonical'));
  assert.equal(query(root, 'chapter', '2').chapter, null);
});

test('sources, character, appearances and absent include their Markdown provenance', t => {
  const root = book(t);
  run(root, ['index']);
  const sources = run(root, ['sources']);
  keys(sources, [...common, 'command', 'stale', 'results']);
  assert.equal(sources.results.length, 4);
  for (const row of sources.results) sourceRow(root, row, 'source_registry');
  assert.equal(run(root, ['sources', 'world_rules']).results[0].owner_file, 'bible/world-rules.md');
  assert.equal(run(root, ['sources', '值班']).results[0].key, 'world_rules');
  assert.deepEqual(run(root, ['sources', 'world_']).results, []);

  const person = query(root, 'character', '阿七');
  keys(person, ['character', 'first_chapter', 'appearances', 'latest_relationship_changes', 'foreshadows', 'subplots']);
  sourceRow(root, person.character, 'characters');
  assert.equal(person.character.name, '唐七');
  assert.equal(person.first_chapter, 1);
  assert.deepEqual(person.appearances.map(row => row.chapter), [1, 2, 3]);
  assert.deepEqual(person.foreshadows.map(row => row.id), ['F001', 'F003']);
  assert.deepEqual(person.subplots.map(row => row.id), ['B2']);
  assert.equal(person.latest_relationship_changes.length, 1);
  const [change] = person.latest_relationship_changes;
  sourceRow(root, change, 'relationship_changes');
  assert.equal(change.target, '唐七');
  assert.equal(change.chapter, 2);

  const appearances = query(root, 'appearances', '--from', '1', '--to', '2', '--character', '葛姨');
  for (const row of appearances) sourceRow(root, row, 'character_appearances');
  assert.deepEqual(appearances.map(row => [row.chapter, row.appearance_type]), [[1, 'present'], [2, 'mentioned']]);
  const [constant] = query(root, 'appearances', '--from', '2', '--to', '2', '--character', '小林');
  assert.equal(constant.source_file, 'bible/characters.md');
  assert.equal(constant.appearance_type, 'present');
  const [absence] = query(root, 'absent', '葛姨', '--since', '4');
  keys(absence, ['character', 'since', 'last_present', 'gap', ...provenance]);
  assert.deepEqual(absence, {
    character: '葛婶', since: 4, last_present: 1, gap: 3, source_file: appearances[0].source_file, source_line: appearances[0].source_line,
  });
  assert.equal(query(root, 'absent', '唐七', '--since', '2')[0].gap, 0);
  assert.equal(query(root, 'absent', '唐七', '--since', '0')[0].gap, null);
  assert.deepEqual(query(root, 'absent', '未登记的人', '--since', '4'), []);
});

test('foreshadow, subplot, setting, inventory, timeline and episode filters', t => {
  const root = book(t);
  run(root, ['index']);
  const fs = query(root, 'foreshadows', '--status', 'planted,partial', '--due', '3', '--character', '阿七', '--subplot', 'B2');
  assert.deepEqual(fs.map(row => row.id), ['F001']);
  sourceRow(root, fs[0], 'foreshadows');
  assert.deepEqual(query(root, 'foreshadows', '--due', '2').map(row => row.id), ['F001', 'F002']);
  assert.deepEqual(query(root, 'foreshadows', '--status', 'resolved').map(row => row.id), ['F005']);
  const [subplot] = query(root, 'subplots', '--status', 'active,dormant', '--level', 'B');
  sourceRow(root, subplot, 'subplots', ['steps']);
  assert.equal(subplot.id, 'B2');
  assert.equal(subplot.steps[0].step, 'seed');
  for (const step of subplot.steps) sourceRow(root, step, 'subplot_steps');
  assert.deepEqual(query(root, 'subplots', '--level', 'A'), []);

  const settings = query(root, 'settings', '闸房');
  assert.ok(settings.length > 0);
  for (const row of settings) {
    assert.match(sourceRow(root, row, 'settings'), /tags:/);
    assert.ok(row.tags.includes('闸房'));
  }
  assert.deepEqual(query(root, 'settings', '不存在的标签'), []);
  const inventory = query(root, 'inventory', '--holder', '阿七');
  assert.deepEqual(inventory.map(row => row.id), ['I002']);
  sourceRow(root, inventory[0], 'inventory');
  assert.deepEqual(query(root, 'inventory', '--holder', "' OR 1=1 --"), []);
  const anchors = query(root, 'timeline', '--from', '2', '--to', '4');
  assert.deepEqual(anchors.map(row => row.id), ['T003', 'T004', 'T005']);
  for (const row of anchors) sourceRow(root, row, 'timeline_anchors');
  assert.equal(query(root, 'timeline')[0].chapter, null);

  const show = query(root, 'episodes', 'paper-lantern');
  keys(show, ['episodes', 'adaptation_map']);
  assert.equal(show.episodes[0].episode, 3);
  assert.equal(show.episodes[0].scenes, 2);
  assert.equal(show.episodes[0].est_seconds, 8);
  assert.equal(show.episodes[0].hook, 'S');
  sourceRow(root, show.episodes[0], 'episodes');
  const mapped = show.adaptation_map.find(row => row.episode === 3);
  assert.deepEqual(mapped.source_chapters, [2, 3]);
  assert.deepEqual(mapped.foreshadow_actions.map(({ action, id }) => [action, id]), [['resolve', 'F001']]);
  for (const row of show.adaptation_map) sourceRow(root, row, 'adaptation_map');
});

test('parse suggestions survive a successful index; a wrong-volume plan is reported, not copied', t => {
  const root = book(t);
  const chapterPlan = 'bible/volumes/1.md';
  write(root, 'bible/volumes/2.md', read(root, chapterPlan).replace('0-8', '9-12'));
  const partial = run(root, ['index'], { code: 1 });
  assert.equal(partial.findings.filter(item => item.file === 'bible/volumes/2.md').length, 3);
  assert.equal(query(root, 'chapter', '4').plan.source_file, chapterPlan);
  rmSync(path.join(root, 'bible/volumes/2.md'));

  const file = 'bible/foreshadows.md';
  write(root, file, read(root, file).replace('闸房里的另一枚簧轮也少同一齿', '-'));
  const suggestions = run(root, ['index']);
  assert.deepEqual(suggestions.findings.map(item => [item.file, item.level]), [[file, 'suggest']]);
  assert.equal(query(root, 'foreshadows')[0].id, 'F001');
});

test('full rebuild replaces an incompatible index; ordinary index asks for an explicit rebuild', async t => {
  const root = book(t);
  run(root, ['index']);
  await inspectDatabase(root, db => db.exec("UPDATE meta SET value = '999' WHERE key = 'schema_version'"));
  assert.match(run(root, ['index'], { code: 2 }).error, /index --full/);
  assert.equal(run(root, ['index', '--full']).rows.chapters, 3);
  assert.equal(run(root, ['status']).state, 'fresh');
});

test('help, root discovery, defaults and invalid arguments honor the common CLI', t => {
  const root = book(t);
  const help = run(root, ['--help']);
  keys(help, [...common, 'help']);
  for (const kind of ['character', 'chapter', 'foreshadows', 'subplots', 'appearances', 'absent',
    'settings', 'inventory', 'timeline', 'episodes']) assert.ok(help.help.includes(`query ${kind}`));
  const unconfigured = path.join(root, 'chapters/1/2');
  assert.match(run(unconfigured, ['--help'], { json: false }).stdout, /^故事索引/u);
  run(root, ['index'], { cwd: unconfigured });
  assert.equal(run(root, ['status'], { cwd: unconfigured }).state, 'fresh');
  for (const args of [
    [], ['query'], ['query', 'wrong'], ['query', 'chapter', '2-3'], ['query', 'appearances', '--from', '1'],
    ['query', 'timeline', '--from', '4', '--to', '2'], ['query', 'foreshadows', '--status', 'wrong'],
    ['query', 'subplots', '--level', 'X'], ['query', 'episodes', '../x'], ['query', 'absent', '葛婶'],
    ['sources', 'A', 'B'], ['status', '--full'], ['index', '--nope'], ['index', '--root', ''],
    ['query', 'inventory', '--holder', '唐七', '--holder', '唐七'],
  ]) keys(run(root, args, { code: 2 }), [...common, 'error']);

  const config = '.fiction/config.json';
  rmSync(path.join(root, config));
  assert.match(run(root, ['index'], { cwd: unconfigured, json: false }).stdout, /^未找到 config，使用默认值\n/u);
  write(root, config, '{"version":2}');
  assert.match(run(root, ['index'], { code: 2 }).error, /不支持 version/);
  write(root, config, '{"frozen":false}');
  assert.match(run(root, ['status'], { code: 2 }).error, /frozen/);
});

test('read-only commands reject writes even if SQLite ignores the readOnly option', t => {
  const root = book(t);
  run(root, ['index']);
  const proc = node(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    const { main } = await import(process.argv[1]);
    const importer = async specifier => {
      const { DatabaseSync } = await import(specifier);
      return { DatabaseSync: class extends DatabaseSync {
        constructor(file, options) {
          assert.equal(options.readOnly, true);
          super(file);
        }

        close() {
          try {
            assert.throws(() => this.exec('CREATE TABLE write_probe (value TEXT)'), /attempt to write a readonly database/);
          } finally {
            super.close();
          }
        }
      } };
    };
    for (const args of [['query', 'chapter', '2'], ['status'], ['sources']]) {
      assert.equal(await main([...args, '--json'], { importer }), 0);
    }
  `, entry.href], { cwd: root });
  assert.equal(proc.status, 0, proc.stderr);
  assert.equal(proc.stderr, '');
});

test('a missing SQLite importer gives code 2 and unrelated experimental warnings are preserved', t => {
  const root = book(t);
  const proc = node(['--input-type=module', '-e', `
    const { main } = await import(process.argv[1]);
    process.exitCode = await main(['index', '--json'], {
      importer: async specifier => {
        if (specifier !== 'node:sqlite') throw new Error('wrong specifier');
        process.emitWarning('SQLite is an experimental feature and might change at any time', 'ExperimentalWarning');
        process.emitWarning('another experimental feature', 'ExperimentalWarning');
        throw new Error('not available');
      },
    });
  `, entry.href], { cwd: root });
  assert.equal(proc.status, 2);
  const err = JSON.parse(proc.stdout);
  keys(err, [...common, 'error']);
  assert.equal(err.ok, false);
  assert.match(err.error, /Node\.js 22\.5.*--experimental-sqlite/);
  assert.match(proc.stderr, /ExperimentalWarning: another experimental feature/);
  assert.doesNotMatch(proc.stderr, /ExperimentalWarning: SQLite/);
  assert.equal(existsSync(dbPath(root)), false);
});

test('a hard link at the index path cannot overwrite a different file', t => {
  const root = book(t);
  const file = 'bible/canon.md';
  const original = read(root, file);
  linkSync(path.join(root, file), dbPath(root));
  assert.match(run(root, ['index', '--full'], { code: 2 }).error, /story\.db/);
  assert.equal(read(root, file), original);
});
