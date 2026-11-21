// SB §10：只在 meta 增加索引内部状态，不扩展业务表。
const definitions = {
  meta: 'key TEXT PRIMARY KEY, value TEXT NOT NULL',
  source_registry: `key TEXT PRIMARY KEY, purpose TEXT, owner_file TEXT, owner_anchor TEXT,
    read_when TEXT, write_when TEXT, mode TEXT, brief_rule TEXT`,
  characters: `name TEXT PRIMARY KEY, aliases TEXT, role TEXT, tier TEXT, first_chapter INTEGER,
    always_present INTEGER, dormant_volumes TEXT, scope TEXT`,
  character_appearances: 'character TEXT, chapter INTEGER, appearance_type TEXT, note TEXT',
  relationship_changes: 'chapter INTEGER, character TEXT, target TEXT, change TEXT, state TEXT',
  foreshadows: `id TEXT PRIMARY KEY, name TEXT, reader_view TEXT, author_truth TEXT,
    planted_chapter INTEGER, target_start INTEGER, target_end INTEGER, resolved_chapter INTEGER,
    touched_chapters TEXT, status TEXT, future TEXT, subplot_ids TEXT, characters TEXT, note TEXT, source_anchor TEXT`,
  subplots: `id TEXT PRIMARY KEY, name TEXT, level TEXT, status TEXT, main_link TEXT,
    current_step TEXT, current_chapter INTEGER, active_volumes TEXT, characters TEXT, foreshadow_ids TEXT`,
  subplot_steps: 'subplot_id TEXT, step TEXT, planned_chapter INTEGER, actual_chapter INTEGER, skipped INTEGER, content TEXT',
  timeline_anchors: 'id TEXT PRIMARY KEY, time_text TEXT, chapter INTEGER, event TEXT, kind TEXT, prose_form TEXT',
  inventory: 'id TEXT PRIMARY KEY, name TEXT, holder TEXT, status TEXT, acquired_chapter INTEGER, changed_chapter INTEGER, note TEXT',
  storylines: 'id TEXT PRIMARY KEY, name TEXT, kind TEXT, start_chapter INTEGER, status TEXT, latest TEXT, updated_chapter INTEGER',
  settings: 'name TEXT, tags TEXT, relevant_chapters TEXT, source_anchor TEXT',
  chapter_plans: `chapter INTEGER NOT NULL UNIQUE, volume INTEGER, title TEXT, core_event TEXT, beat TEXT,
    hook_planned TEXT, weight TEXT, foreshadow_actions TEXT, subplot_ids TEXT, required_characters TEXT, status TEXT`,
  chapters: `chapter INTEGER PRIMARY KEY, volume INTEGER, draft_file TEXT, title TEXT, length INTEGER,
    hook_actual TEXT, frozen INTEGER, sha256 TEXT`,
  episodes: 'series TEXT, episode INTEGER, title TEXT, scenes INTEGER, est_seconds INTEGER, hook TEXT, paywall INTEGER',
  adaptation_map: 'series TEXT, episode INTEGER, source_chapters TEXT, characters TEXT, foreshadow_actions TEXT',
};

export const TABLES = Object.keys(definitions);
export const SCHEMA_VERSION = '1';
export const SPEC_VERSION = '1';
const provenance = ['source_file', 'source_line'];
const columns = Object.fromEntries(Object.entries(definitions).map(([name, definition]) =>
  [name, [...definition.split(',').map(column => column.trim().split(' ')[0]), ...provenance]]));
const jsonColumns = new Set([
  'aliases', 'dormant_volumes', 'touched_chapters', 'subplot_ids', 'characters', 'active_volumes',
  'foreshadow_ids', 'tags', 'relevant_chapters', 'foreshadow_actions', 'required_characters', 'source_chapters',
]);
const booleanColumns = new Set(['always_present', 'skipped', 'frozen', 'paywall']);

export function createSchema(db) {
  for (const [table, definition] of Object.entries(definitions)) {
    const required = table === 'meta' ? '' : ' NOT NULL';
    db.exec(`DROP TABLE IF EXISTS ${table};
      CREATE TABLE ${table} (${definition}, source_file TEXT${required}, source_line INTEGER${required}) STRICT`);
  }
  db.exec(`CREATE INDEX appearance_by_chapter ON character_appearances(chapter);
    CREATE INDEX appearance_by_character ON character_appearances(character, chapter);
    CREATE INDEX dynamics_by_character ON relationship_changes(character, chapter);
    CREATE INDEX dynamics_by_target ON relationship_changes(target, chapter);
    CREATE INDEX steps_by_subplot ON subplot_steps(subplot_id);
    CREATE INDEX anchors_by_chapter ON timeline_anchors(chapter);
    CREATE UNIQUE INDEX episodes_by_series ON episodes(series, episode);
    CREATE UNIQUE INDEX map_by_series ON adaptation_map(series, episode)`);
}

export function dbRows(db, table, suffix = '', args = []) {
  return db.prepare(`SELECT * FROM ${table} ${suffix}`).all(...args).map(row =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [
      key, value === null ? null : jsonColumns.has(key) ? JSON.parse(value)
        : booleanColumns.has(key) ? Boolean(value) : value,
    ])));
}

export function insertRows(db, table, rows, { replace = false } = {}) {
  const keys = columns[table];
  const insert = db.prepare(`INSERT ${replace ? 'OR REPLACE ' : ''}INTO ${table}
    (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`);
  for (const row of rows) {
    insert.run(...keys.map(key => {
      const value = row[key] ?? null;
      if (value === null) return null;
      if (jsonColumns.has(key)) return JSON.stringify(value);
      return booleanColumns.has(key) ? Number(value) : value;
    }));
  }
}

export function metadata(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'meta'").get()) {
    if (!db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get()) return null;
    throw new Error('索引没有版本信息；请运行 index --full');
  }
  const meta = new Map(dbRows(db, 'meta').map(({ key, value }) => [key, value]));
  if (meta.get('spec_version') !== SPEC_VERSION || meta.get('schema_version') !== SCHEMA_VERSION) {
    throw new Error('索引版本不匹配；请运行 index --full');
  }
  return meta;
}

export function transaction(db, write, run) {
  db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
  try {
    const result = run();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
