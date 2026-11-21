import { aliasesOf, STEPS, SUBPLOT_ID } from './lib/bible.mjs';
import { choices, integer } from './lib/cli.mjs';
import { dbRows } from './story-db-schema.mjs';

const foreshadowStatuses = ['planned', 'planted', 'partial', 'resolved', 'dropped'];
const subplotStatuses = ['active', 'dormant', 'resolved', 'dropped'];
const kinds = {
  character: [1], chapter: [1], settings: [1], episodes: [1],
  foreshadows: [0, 'status', 'due', 'character', 'subplot'],
  subplots: [0, 'status', 'level'],
  appearances: [0, 'from', 'to', 'character'], absent: [1, 'since'],
  inventory: [0, 'holder'], timeline: [0, 'from', 'to'],
};
const common = ['help', 'json', 'root'];
export const queryOptions = Object.fromEntries([...new Set(Object.values(kinds).flatMap(([, ...flags]) => flags))]
  .map(flag => [flag, { type: 'string' }]));

export function checkFlags(values, allowed = []) {
  for (const flag of Object.keys(values)) {
    if (!common.includes(flag) && !allowed.includes(flag)) throw new Error(`此命令不接受 --${flag}`);
  }
}

export function queryArgs([kind, ...args], values) {
  if (!Object.hasOwn(kinds, kind)) throw new Error(`未知查询类型：${kind ?? '（未提供）'}；请查看 --help`);
  const [n, ...flags] = kinds[kind];
  if (args.length !== n || args.some(arg => !arg.trim())) throw new Error(`${kind} 的位置参数有误；请查看 --help`);
  checkFlags(values, flags);
  const params = { arg: args[0]?.trim() };
  for (const flag of flags) {
    if (values[flag] === undefined) {
      if ((kind === 'appearances' && ['from', 'to'].includes(flag)) || flag === 'since') {
        throw new Error(`${kind} 缺少 --${flag}`);
      }
      continue;
    }
    const value = values[flag].trim();
    if (!value) throw new Error(`--${flag} 不能为空`);
    if (['from', 'to', 'since', 'due'].includes(flag)) params[flag] = integer(value, `--${flag}`);
    else if (flag === 'status') {
      params.status = choices(value, kind === 'subplots' ? subplotStatuses : foreshadowStatuses, '--status');
    } else if (flag === 'level' && !['A', 'B', 'C'].includes(value)) throw new Error('--level 须为 A、B 或 C');
    else if (flag === 'subplot' && !SUBPLOT_ID.test(value)) throw new Error(`--subplot 的支线 ID 非法：${value}`);
    else params[flag] = value;
  }
  if (params.from > params.to) throw new Error('--from 不得大于 --to');
  if (kind === 'chapter') params.arg = integer(params.arg, '章号');
  if (kind === 'episodes' && !/^[a-z0-9][a-z0-9-]*$/.test(params.arg)) throw new Error(`短剧目录名非法：${params.arg}`);
  return { kind, params };
}

export function querySources(db, filter) {
  return filter === undefined ? dbRows(db, 'source_registry', 'ORDER BY key')
    : dbRows(db, 'source_registry', 'WHERE key = ? OR instr(purpose, ?) > 0 ORDER BY key', [filter, filter]);
}

const statusCondition = 'status IN (SELECT value FROM json_each(?))';

export function query(db, { kind, params: p }, policy) {
  const needsNames = !['settings', 'timeline'].includes(kind);
  const records = needsNames ? dbRows(db, 'characters', 'ORDER BY name') : [];
  const people = new Map(records.map(row => [row.name, row]));
  const aliases = aliasesOf([...people.values()]);
  const nameOf = name => aliases.get(name) ?? name;
  const namesFor = name => JSON.stringify([name, ...(people.get(name)?.aliases ?? [])]);
  const listNames = values => [...new Set(values.map(nameOf))];
  const rows = (table, conditions, order) => dbRows(db, table,
    `${conditions.length ? `WHERE ${conditions.map(([sql]) => `(${sql})`).join(' AND ')}` : ''} ORDER BY ${order}`,
    conditions.flatMap(([, ...values]) => values));
  const flag = (value, sql) => value === undefined ? [] : [[sql, value]];
  const range = (from, to) => [...flag(from, 'chapter >= ?'), ...flag(to, 'chapter <= ?')];
  const member = (column, name) => [`${column} IN (SELECT value FROM json_each(?))`, namesFor(name)];

  function foreshadows({ status, due, character, subplot }) {
    const conditions = [...flag(status && JSON.stringify(status), statusCondition)];
    if (due !== undefined) {
      // 改写比较式并限制边界，避免超出 JS 安全整数。
      conditions.push(["status IN ('planted','partial') AND target_start <= ? AND target_end >= ?",
        Math.min(Number.MAX_SAFE_INTEGER, due + policy.dueWindow), due - policy.overdueGrace]);
    }
    if (character !== undefined) conditions.push([
      'EXISTS (SELECT 1 FROM json_each(foreshadows.characters) WHERE value IN (SELECT value FROM json_each(?)))',
      namesFor(nameOf(character)),
    ]);
    if (subplot !== undefined) conditions.push([
      'EXISTS (SELECT 1 FROM json_each(foreshadows.subplot_ids) WHERE value = ?)', subplot,
    ]);
    return rows('foreshadows', conditions, 'id').map(row => ({ ...row, characters: listNames(row.characters) }));
  }

  function subplots({ status, level, character }) {
    const conditions = [...flag(status && JSON.stringify(status), statusCondition), ...flag(level, 'level = ?')];
    if (character !== undefined) conditions.push([
      'EXISTS (SELECT 1 FROM json_each(subplots.characters) WHERE value IN (SELECT value FROM json_each(?)))',
      namesFor(nameOf(character)),
    ]);
    const sub = rows('subplots', conditions, 'id');
    if (!sub.length) return [];
    const steps = new Map(sub.map(row => [row.id, []]));
    for (const step of rows('subplot_steps', [
      ['subplot_id IN (SELECT value FROM json_each(?))', JSON.stringify([...steps.keys()])],
    ], 'subplot_id, source_line')) steps.get(step.subplot_id).push(step);
    return sub.map(row => ({ ...row, characters: listNames(row.characters),
      steps: steps.get(row.id).sort((a, b) => STEPS.indexOf(a.step) - STEPS.indexOf(b.step)) }));
  }

  function appearances(from, to, name) {
    const conditions = range(from, to);
    const names = flag(name, 'character = ?');
    const found = rows('character_appearances', [...conditions, ...names], 'chapter, appearance_type DESC, character');
    const present = new Set(found.filter(row => row.appearance_type === 'present')
      .map(row => JSON.stringify([row.chapter, row.character])));
    const constant = records.filter(person =>
      person.always_present && !person.scope.startsWith('短剧:') && (name === undefined || name === person.name));
    if (constant.length) {
      for (const chapter of rows('chapters', conditions, 'chapter')) {
        for (const person of constant) {
          if (person.first_chapter !== null && chapter.chapter < person.first_chapter) continue;
          if (!present.has(JSON.stringify([chapter.chapter, person.name]))) found.push({
            character: person.name, chapter: chapter.chapter, appearance_type: 'present', note: null,
            source_file: person.source_file, source_line: person.source_line,
          });
        }
      }
    }
    return found.sort((a, b) => a.chapter - b.chapter);
  }

  switch (kind) {
    case 'character': {
      const name = nameOf(p.arg);
      const character = people.get(name) ?? null;
      const ap = appearances(undefined, undefined, name);
      const changes = new Map();
      const sourceNames = namesFor(name);
      for (const row of rows('relationship_changes', [[
        'character IN (SELECT value FROM json_each(?)) OR target IN (SELECT value FROM json_each(?))',
        sourceNames, sourceNames,
      ]], 'chapter DESC, source_line DESC')) {
        const change = { ...row, character: nameOf(row.character), target: nameOf(row.target) };
        // 空对象是自身弧线；人物和对象对调也属于同一段关系。
        const counterpart = change.target === null ? null : change.character === name ? change.target : change.character;
        if (!changes.has(counterpart)) changes.set(counterpart, change);
      }
      return { character, first_chapter: character?.first_chapter ?? ap.find(row => row.appearance_type === 'present')?.chapter ?? null,
        appearances: ap, latest_relationship_changes: [...changes.values()],
        foreshadows: foreshadows({ character: name }), subplots: subplots({ character: name }) };
    }
    case 'chapter': {
      const [plan = null] = rows('chapter_plans', [['chapter = ?', p.arg]], 'chapter');
      const [chapter = null] = rows('chapters', [['chapter = ?', p.arg]], 'chapter');
      if (plan) plan.required_characters = listNames(plan.required_characters);
      return { plan, chapter };
    }
    case 'foreshadows': return foreshadows(p);
    case 'subplots': return subplots(p);
    case 'appearances': return appearances(p.from, p.to, p.character === undefined ? undefined : nameOf(p.character));
    case 'absent': {
      const name = nameOf(p.arg);
      const history = appearances(undefined, p.since, name);
      const ap = history.findLast(row => row.appearance_type === 'present');
      const origin = ap ?? history.at(-1) ?? people.get(name);
      if (!origin) return [];
      return [{ character: name, since: p.since, last_present: ap?.chapter ?? null,
        gap: ap ? p.since - ap.chapter : null, source_file: origin.source_file, source_line: origin.source_line }];
    }
    case 'settings': return rows('settings', [[
      'EXISTS (SELECT 1 FROM json_each(settings.tags) WHERE value = ?)', p.arg,
    ]], 'source_file, source_line');
    case 'inventory': return rows('inventory', p.holder === undefined ? [] : [member('holder', nameOf(p.holder))], 'id')
      .map(row => ({ ...row, holder: nameOf(row.holder) }));
    case 'timeline': return rows('timeline_anchors', range(p.from, p.to), 'chapter, id');
    case 'episodes': return {
      episodes: rows('episodes', [['series = ?', p.arg]], 'episode'),
      adaptation_map: rows('adaptation_map', [['series = ?', p.arg]], 'episode')
        .map(row => ({ ...row, characters: listNames(row.characters) })),
    };
    default: throw new Error('不支持的查询类型');
  }
}
