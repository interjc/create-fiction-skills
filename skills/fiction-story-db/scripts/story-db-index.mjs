import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  parseAdaptationMap, parseEpisode,
} from './lib/drama.mjs';
import {
  aliasesOf, parseAppearances, parseCharacters, parseDynamics, parseForeshadows, parseInventory, parseOutline,
  parseSettingTags, parseSources, parseStorylines, parseSubplots, parseTimeline, parseVolInfo, parseVolumePlan,
} from './lib/bible.mjs';
import { finding, integer, relativeFile, sortFindings } from './lib/cli.mjs';
import { DEFAULT_CONFIG, requireConfig } from './lib/config.mjs';
import { countChapterCharacters } from './lib/length.mjs';
import { lintFile } from './lib/lint.mjs';
import { HOOK_ORDER, linesOf, parseMarkers } from './lib/md.mjs';
import { entries, listChapters, parseRanges, selectCanonical } from './lib/project.mjs';
import { createSchema, dbRows, insertRows, SCHEMA_VERSION, SPEC_VERSION, TABLES } from './story-db-schema.mjs';

const CONFIG_FILE = '.fiction/config.json';
const singleFiles = {
  'bible/sources.md': ['source_registry', parseSources],
  'bible/characters.md': ['characters', parseCharacters],
  'bible/appearances.md': ['character_appearances', parseAppearances],
  'bible/character-dynamics.md': ['relationship_changes', parseDynamics],
  'bible/foreshadows.md': ['foreshadows', parseForeshadows],
  'bible/subplots.md': ['subplots', parseSubplots],
  'bible/timeline.md': ['timeline_anchors', parseTimeline],
  'bible/inventory.md': ['inventory', parseInventory],
  'bible/storylines.md': ['storylines', parseStorylines],
};
const chapterPath = /^chapters\/[1-9]\d*\/(?:0|[1-9]\d*)\/(outline|v[1-9]\d*)\.md$/;
const volumePlan = /^bible\/volumes\/([1-9]\d*)\.md$/;
const volumeInfo = /^chapters\/([1-9]\d*)\/vol-info\.md$/;
const episodePath = /^drama\/([a-z0-9][a-z0-9-]*)\/episodes\/[^/]+\.md$/;
const adaptationPath = /^drama\/([a-z0-9][a-z0-9-]*)\/adaptation-map\.md$/;
const settingsPath = /^bible\/(?:canon|world-rules|indexes\/[^/]+)\.md$/;
const hashKey = 'sha256:';
const findingsKey = 'findings:';

function revision(root, file) {
  const stat = statSync(path.join(root, file), { bigint: true, throwIfNoEntry: false });
  return stat ? [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':') : null;
}

function checkRevision(root, file, expected) {
  if (revision(root, file) !== expected) throw new Error(`来源在读取时有变动：${file}；请重试`);
}

/** 共用配置和定稿选择器各自读盘，确保索引哈希和派生字段来自同一版本。 */
export function readProjectConfig(root) {
  const configRevision = revision(root, CONFIG_FILE);
  const result = requireConfig(root);
  checkRevision(root, CONFIG_FILE, configRevision);
  return { ...result, configRevision };
}

function groupOf(file) {
  if (Object.hasOwn(singleFiles, file)) return singleFiles[file][0];
  if (settingsPath.test(file)) return 'settings';
  if (volumePlan.test(file) || volumeInfo.test(file)) return 'chapter_plans';
  const chapter = chapterPath.exec(file);
  if (chapter) return chapter[1] === 'outline' ? 'chapter_plans' : 'chapters';
  if (episodePath.test(file)) return 'episodes';
  if (adaptationPath.test(file)) return 'adaptation_map';
  return null;
}

/** 每次按字节核对哈希，不能靠 mtime 判新鲜。只把被选定的稿件列为正文来源。 */
export function snapshot(root, keepText, configRevision) {
  const sources = new Map();
  const layout = listChapters(root, { resolveCanonical: false });
  const selectionErrors = [];
  const actualRoot = realpathSync(root);
  function add(file) {
    const absolute = path.join(root, file);
    try {
      const relative = relativeFile(actualRoot, realpathSync(absolute));
      if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
        throw new Error(`来源不在书根内：${file}`);
      }
      if (!statSync(absolute).isFile()) throw new Error(`来源不是普通文件：${file}`);
      const data = readFileSync(absolute);
      sources.set(file, { sha256: createHash('sha256').update(data).digest('hex'),
        text: keepText && file !== CONFIG_FILE ? data.toString('utf8') : null });
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }
  function addFrom(dir, filter = () => true) {
    for (const entry of entries(path.join(root, dir))) {
      if (entry.isFile() && filter(entry.name)) add(`${dir}/${entry.name}`);
    }
  }

  add(CONFIG_FILE);
  checkRevision(root, CONFIG_FILE, configRevision);
  for (const file of [...Object.keys(singleFiles), 'bible/canon.md', 'bible/world-rules.md']) add(file);
  addFrom('bible/indexes', name => name.endsWith('.md'));
  addFrom('bible/volumes', name => volumePlan.test(`bible/volumes/${name}`));
  for (const entry of entries(path.join(root, 'chapters'))) {
    if (entry.isDirectory() && volumeInfo.test(`chapters/${entry.name}/vol-info.md`)) {
      add(`chapters/${entry.name}/vol-info.md`);
    }
  }
  for (const ch of layout) {
    const outline = `${ch.dir}/outline.md`;
    const outlineRevision = revision(root, outline);
    const hasOutline = add(outline);
    try {
      ch.canonical = hasOutline ? selectCanonical(root, ch.dir, ch.drafts) : ch.drafts.at(-1) ?? null;
    } catch (error) {
      if (error.file !== outline) throw error;
      selectionErrors.push(finding('canonical', outline, error.message, { line: error.line }));
    }
    checkRevision(root, outline, outlineRevision);
    if (ch.canonical && !add(ch.canonical)) throw new Error(`读取时定稿消失：${ch.canonical}；请重试`);
  }
  for (const entry of entries(path.join(root, 'drama'))) {
    if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]*$/.test(entry.name)) continue;
    const base = `drama/${entry.name}`;
    add(`${base}/adaptation-map.md`);
    addFrom(`${base}/episodes`, name => name.endsWith('.md'));
  }
  return { sources, layout, selectionErrors };
}

export function compareSources(meta, { sources, layout }) {
  const old = new Map([...(meta ?? [])].filter(([key]) => key.startsWith(hashKey))
    .map(([key, value]) => [key.slice(hashKey.length), value]));
  const added = [];
  const changed = [];
  for (const [file, { sha256 }] of sources) {
    if (!old.has(file)) added.push(file);
    else if (old.get(file) !== sha256) changed.push(file);
    old.delete(file);
  }
  const removed = [...old.keys()].sort();
  // 空章目录也会影响卷归属，但它不是源文件，单独报告。
  const layout_changed = Boolean(meta && meta.get('layout') !== layoutValue(layout));
  return { changed: changed.sort(), added: added.sort(), removed, layout_changed };
}

const layoutValue = layout => JSON.stringify(layout.map(ch => [ch.chapter, ch.volume, ch.canonical]));
const origin = ({ file, line }) => ({ source_file: file, source_line: line });

function simpleRows(group, items, tables) {
  for (const item of items) {
    let row = item;
    if (group === 'foreshadows') {
      row = {
        ...item, planted_chapter: item.planted, target_start: item.target?.start, target_end: item.target?.end,
        resolved_chapter: item.resolved, touched_chapters: item.touched, subplot_ids: item.subplots,
      };
    }
    if (group === 'timeline_anchors') row = { ...item, time_text: item.time };
    if (group === 'settings') row = { ...item, relevant_chapters: item.chapters };
    if (group === 'subplots') {
      for (const step of item.steps) tables.subplot_steps.push({ ...step, subplot_id: item.id, ...origin(step) });
    }
    tables[group].push({ ...row, ...origin(item) });
  }
}

function buildAppearances(items, aliases, errors) {
  const canonical = name => aliases.get(name) ?? name;
  return items.flatMap(item => {
    const notes = new Map();
    for (const [name, note] of Object.entries(item.notes)) {
      const key = canonical(name);
      if (!notes.has(key)) notes.set(key, new Set());
      notes.get(key).add(note);
    }
    for (const [name, values] of notes) {
      if (values.size > 1) errors.push(finding('appearance', item.file, `${name} 的在场备注有多种写法`, { line: item.line }));
    }
    return ['present', 'mentioned'].flatMap(appearance_type =>
      [...new Set(item[appearance_type].map(canonical))].map(character => {
        const values = notes.get(character);
        return { character, chapter: item.chapter, appearance_type,
          note: values?.size === 1 ? [...values][0] : null, ...origin(item) };
      }));
  });
}

function buildPlans(files, layout, parse, errors, policy) {
  const plans = new Map();
  const ranges = new Map();
  const summaries = new Map();
  for (const file of files) {
    const match = volumePlan.exec(file) ?? volumeInfo.exec(file);
    if (!match) continue;
    const volume = integer(match[1], '卷号', 1);
    if (volumePlan.test(file)) {
      for (const item of parse(parseVolumePlan, file)) {
        if (item.chapter === null) ranges.set(volume, item.range);
        else {
          if (!plans.has(item.chapter)) plans.set(item.chapter, []);
          plans.get(item.chapter).push({ ...item, volume });
        }
      }
    } else {
      for (const info of parse(parseVolInfo, file)) {
        if (info.volume === volume) summaries.set(volume, info.range);
        else errors.push(finding('volume', file, '卷摘要卷号与目录不符', { line: 1 }));
      }
    }
  }

  const directories = new Map(layout.map(ch => [ch.chapter, ch]));
  const available = new Set(files);
  const outlines = new Map();
  for (const ch of layout) {
    const file = `${ch.dir}/outline.md`;
    if (!available.has(file)) continue;
    const [item] = parse(parseOutline, file);
    if (item?.chapter === ch.chapter) outlines.set(ch.chapter, item);
    else if (item?.chapter != null) errors.push(finding('outline', file, '提纲章号与目录不符', { line: 1 }));
  }

  const rows = [];
  for (const chapter of new Set([...plans.keys(), ...outlines.keys()])) {
    const candidates = plans.get(chapter) ?? [];
    const outline = outlines.get(chapter);
    const dir = directories.get(chapter);
    const matches = values => [...values].filter(([, range]) => chapter >= range.start && chapter <= range.end);
    const planned = dir ? [] : matches(ranges);
    const located = planned.length ? planned : dir ? [] : matches([...summaries].filter(([vol]) => !ranges.has(vol)));
    const volume = dir?.volume ?? (located.length === 1 ? located[0][0] : null);
    if (volume === null) {
      for (const item of candidates) {
        errors.push(finding('volume', item.file, `第${chapter}章无法唯一定位卷号`, { line: item.line }));
      }
      continue;
    }
    const base = candidates.find(item => item.volume === volume);
    for (const item of candidates.filter(item => item !== base)) {
      errors.push(finding('volume', item.file, `第${chapter}章属于第${volume}卷，不能采用此卷规划`, { line: item.line }));
    }
    const source = outline ?? base;
    if (!source) continue;
    const plan = { ...base, ...outline };
    const people = { ...base?.characters, ...outline?.characters };
    const status = dir?.canonical
      ? frozen(chapter, policy) ? 'frozen' : outline?.canonical ? 'final' : 'drafted'
      : outline ? 'outlined' : 'planned';
    rows.push({ chapter, volume, title: plan.title, core_event: plan.core_event, beat: plan.beat,
      hook_planned: plan.hook, weight: plan.weight ?? 'normal', foreshadow_actions: plan.foreshadow_actions ?? [],
      subplot_ids: [...new Set(plan.subplots?.map(item => item.id))],
      required_characters: [...new Set([...(people.present ?? []), ...(people.mentioned ?? [])])],
      status, ...origin(source) });
  }
  return rows;
}

const frozen = (chapter, policy) => policy.ranges.some(({ start, end }) => chapter >= start && chapter <= end);

function buildChapters(layout, sources, policy, errors, read) {
  return layout.flatMap(({ chapter, volume, canonical: file }) => {
    if (!file) return [];
    const text = read(file);
    // 首行校验与字数沿用既有实现；标题和钩子从共用的标题/标记解析结果取值。
    const titleCheck = lintFile(text, {
      file, kind: 'chapter', chapter, config: DEFAULT_CONFIG, rules: ['title-format'], patterns: [],
    });
    errors.push(...titleCheck.findings);
    if (titleCheck.suppressed) errors.push(finding('title-format', file, '章节首行标题格式非法或章号与目录不符', { line: 1 }));
    const heading = linesOf(text, { mask: true })[0].trimEnd();
    const title = titleCheck.findings.length || titleCheck.suppressed ? null : heading.slice(heading.indexOf('：') + 1);
    const hooks = parseMarkers(text).filter(marker => marker.kind === 'hook');
    const last = linesOf(text).findLastIndex(line => line.trim()) + 1;
    const validHook = hooks.length === 1 && HOOK_ORDER.includes(hooks[0].value) && hooks[0].line === last;
    if (!validHook && (hooks.length || policy.chapterHook)) {
      errors.push(finding('hook', file, '章节钩子须为最后一个非空行，且恰有一个 S/A/B/C 标记',
        { line: hooks[0]?.line, column: hooks[0]?.column }));
    }
    return [{ chapter, volume, draft_file: file, title, length: countChapterCharacters(text),
      hook_actual: validHook ? hooks[0].value : null, frozen: frozen(chapter, policy), sha256: sources.get(file).sha256,
      source_file: file, source_line: 1 }];
  });
}

function buildEpisodes(files, read, policy, errors) {
  return files.flatMap(file => {
    const [, series] = episodePath.exec(file);
    const { items: [ep], errors: issues } = parseEpisode(read(file), file, { hookRequired: policy.episodeHook });
    errors.push(...issues);
    if (!ep || ep.episode === null || path.posix.basename(file) !== `ep${String(ep.episode).padStart(3, '0')}.md`) return [];
    const scenes = ep.scenes.filter(scene => scene.number !== null);
    const chars = scenes.reduce((total, scene) => total + scene.chars, 0);
    const valid = rule => !issues.some(problem => problem.rule === rule);
    return [{ series, episode: ep.episode, title: valid('ep-title') ? ep.title : null, scenes: scenes.length,
      est_seconds: Math.round(chars * 60 / policy.charsPerMinute),
      hook: valid('hook') ? ep.hook : null, paywall: valid('paywall-placement') ? ep.paywalls.length > 0 : null,
      ...origin(ep) }];
  });
}

function buildGroup(group, snapshot, policy, reparsed, aliases) {
  const { sources, layout } = snapshot;
  const files = [...sources.keys()].filter(file => groupOf(file) === group).sort();
  const errors = [];
  const tables = { [group]: [] };
  const read = file => {
    reparsed.add(file);
    return sources.get(file).text;
  };
  const parse = (parser, file) => {
    const result = parser(read(file), file);
    errors.push(...result.errors);
    return result.items;
  };
  if (group === 'chapter_plans') tables[group] = buildPlans(files, layout, parse, errors, policy);
  else if (group === 'chapters') tables[group] = buildChapters(layout, sources, policy, errors, read);
  else if (group === 'episodes') tables[group] = buildEpisodes(files, read, policy, errors);
  else if (group === 'character_appearances') {
    tables[group] = buildAppearances(files.flatMap(file => parse(parseAppearances, file)), aliases, errors);
  }
  else if (group === 'adaptation_map') {
    for (const file of files) {
      const [, series] = adaptationPath.exec(file);
      for (const item of parse(parseAdaptationMap, file)) tables[group].push({ ...item, series, ...origin(item) });
    }
  } else {
    if (group === 'subplots') tables.subplot_steps = [];
    for (const file of files) {
      simpleRows(group, parse(singleFiles[file]?.[1] ?? parseSettingTags, file), tables);
    }
  }
  return { tables, errors };
}

export const storedFindings = meta => sortFindings([...(meta ?? [])].filter(([key]) => key.startsWith(findingsKey))
  .flatMap(([, value]) => JSON.parse(value)));

/** 在同一事务替换受影响的整组表，并提交哈希、诊断与快照策略。 */
export function updateIndex(db, meta, snapshot, config, full) {
  const diff = compareSources(meta, snapshot);
  const { sources, layout, selectionErrors } = snapshot;
  const policy = {
    ranges: parseRanges(config.frozen.ranges), chapterHook: config.hook.required, episodeHook: config.drama.hook.required,
    charsPerMinute: config.drama.chars_per_minute, dueWindow: config.foreshadow.due_window,
    overdueGrace: config.foreshadow.overdue_grace,
  };
  const oldPolicy = JSON.parse(meta?.get('policy') ?? '{}');
  const reset = full || !meta;
  const groups = TABLES.filter(table => table !== 'meta' && table !== 'subplot_steps');
  const filesChanged = [...diff.added, ...diff.changed, ...diff.removed];
  const dirty = new Set(filesChanged.map(groupOf).filter(Boolean));
  const rangesChanged = JSON.stringify(policy.ranges) !== JSON.stringify(oldPolicy.ranges);
  if (diff.layout_changed || rangesChanged) dirty.add('chapter_plans');
  if (rangesChanged || policy.chapterHook !== oldPolicy.chapterHook) dirty.add('chapters');
  if (policy.episodeHook !== oldPolicy.episodeHook || policy.charsPerMinute !== oldPolicy.charsPerMinute) dirty.add('episodes');

  const rebuilt_tables = [];
  const reparsed = new Set();
  if (reset) createSchema(db);
  const records = new Map(reset ? [] : meta);
  const updates = [];
  const remove = db.prepare('DELETE FROM meta WHERE key = ?');
  const put = (key, value, file = null) => {
    if (records.get(key) === value) return;
    records.set(key, value);
    updates.push({ key, value, source_file: file });
  };
  function saveFindings(group, items) {
    const key = `${findingsKey}${group}`;
    if (items.length) put(key, JSON.stringify(sortFindings(items)));
    else if (records.delete(key)) remove.run(key);
  }
  const readAliases = () => aliasesOf(dbRows(db, 'characters', 'ORDER BY name'));
  for (const group of groups) {
    if (!reset && !dirty.has(group)) continue;
    const aliases = group === 'character_appearances' ? readAliases() : undefined;
    const { tables, errors } = buildGroup(group, snapshot, policy, reparsed, aliases);
    if (!reset && group === 'characters') {
      const previous = readAliases();
      const next = aliasesOf(tables.characters);
      const secondary = map => [...map].filter(([alias, name]) => alias !== name);
      if (secondary(previous).length !== secondary(next).length
          || secondary(previous).some(([alias, name]) => next.get(alias) !== name)) dirty.add('character_appearances');
    }
    for (const [table, rows] of Object.entries(tables)) {
      db.exec(`DELETE FROM ${table}`);
      insertRows(db, table, rows);
      rebuilt_tables.push(table);
    }
    saveFindings(group, errors);
  }
  saveFindings('selection', selectionErrors);
  for (const file of diff.removed) {
    const key = `${hashKey}${file}`;
    records.delete(key);
    remove.run(key);
  }
  for (const [file, { sha256 }] of sources) put(`${hashKey}${file}`, sha256, file);
  put('spec_version', SPEC_VERSION);
  put('schema_version', SCHEMA_VERSION);
  put('layout', layoutValue(layout));
  put('policy', JSON.stringify(policy));
  if (reset || updates.length || filesChanged.length || rebuilt_tables.length
      || meta?.get(`${findingsKey}selection`) !== records.get(`${findingsKey}selection`)) {
    put('indexed_at', new Date().toISOString());
  }
  insertRows(db, 'meta', updates, { replace: true });
  return {
    mode: full ? 'full' : reset ? 'build' : 'incremental',
    indexed_at: records.get('indexed_at'), rebuilt_tables, files_read: [...sources.keys()].sort(),
    files_reparsed: [...reparsed].sort(),
    rows: Object.fromEntries(TABLES.map(table => [table, db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n])),
    findings: storedFindings(records),
  };
}
