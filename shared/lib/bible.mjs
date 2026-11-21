import { finding, sortFindings } from './cli.mjs';
import {
  cell, HOOK_ORDER, linesOf, maskComments, parseChapterList, parseChapterRef, parseFields,
  parseTables, sections, splitList, structuralLines,
} from './md.mjs';

/** 伏笔与支线的 ID 格式。 */
export const FORESHADOW_ID = /^F\d{3,}$/;
export const SUBPLOT_ID = /^[ABC]\d+[a-z]?$/;
/** 支线生命周期顺序。 */
export const STEPS = ['seed', 'remind', 'chain', 'mislead', 'small_reveal', 'big_reveal'];
const stepAliases = STEPS.map((step, i) => [
  step, ['种因', '提醒', '连环', '误导', '小收', '大收'][i], '①②③④⑤⑥'[i],
]);
const actionAliases = [['plant', '埋'], ['touch', '触'], ['resolve', '收'], ['drop', '弃']];
const fsStates = [
  ['planned', '计划中', '⚪'], ['planted', '已埋设', '🔵'], ['partial', '部分揭示', '🟡'],
  ['resolved', '已回收', '🟢'], ['dropped', '已放弃', '⚫'],
];
const subplotStates = [['active', '进行'], ['dormant', '休眠'], ['resolved', '完结'], ['dropped', '放弃']];
const tierAliases = [['core', '核心'], ['major', '重要'], ['minor', '次要'], ['extra', '龙套']];

function collector(file, rule = 'parse') {
  const items = [];
  const errors = [];
  return {
    items,
    add: (item, line) => items.push({ ...item, file, line }),
    error: (line, message, options) => errors.push(finding(rule, file, message, { line, ...options })),
    finish: () => ({ items, errors: sortFindings(errors) }),
  };
}

function attempt(target, line, fn, options) {
  try {
    return fn();
  } catch (error) {
    target.error(line, error.message, options);
    return undefined;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function required(value, label) {
  const text = cell(value);
  assert(text !== null, `${label}不能为空`);
  return text;
}

function idOf(value, regex, label = 'ID') {
  const text = required(value, label);
  assert(regex.test(text), `${label}非法：${text}`);
  return text;
}

function unique(seen, key, label = 'ID') {
  assert(!seen.has(key), `${label}重复：${key}`);
  seen.add(key);
}

/** 解析单章引用；根据调用方允许空或待定。 */
export function singleChapter(value, label, { optional = false, unknown = false } = {}) {
  const text = cell(value);
  if ((text === null && optional) || (unknown && (text === '?' || text === '待定'))) return null;
  assert(/^\d+$/.test(text ?? ''), `${label}须为单个章号：${text ?? ''}`);
  return parseChapterRef(text).start;
}

function reference(value, label, { optional = false, unknown = false } = {}) {
  const text = cell(value);
  if ((text === null && optional) || (unknown && (text === '?' || text === '待定'))) return null;
  const range = text === null ? null : parseChapterRef(text);
  assert(range, `${label}须为章号或范围`);
  return range;
}

function variant(value, aliases, label, { contains = false } = {}) {
  const text = required(value, label);
  const normalized = text.replace(/\uFE0F/gu, '');
  const matches = aliases.filter(group => group.some(alias => {
    if (/^[a-z_]+$/.test(alias)) return new RegExp(`(?<![A-Za-z0-9_])${alias}(?![A-Za-z0-9_])`).test(normalized);
    return normalized.includes(alias);
  }));
  assert(matches.length === 1, `${label}须恰好命中一种取值：${text}`);
  if (!contains) {
    let rest = normalized.trim();
    const tokens = matches[0].toSorted((a, b) => b.length - a.length);
    while (rest) {
      const token = tokens.find(alias => rest.startsWith(alias));
      assert(token, `${label}含未知取值：${text}`);
      rest = rest.slice(token.length).trimStart();
    }
  }
  return matches[0][0];
}

/** 读取符合列契约的表，按原始行号逐行回调。 */
export function tableRows(text, headers, target, visit, { offset = 0, optional = false, identify } = {}) {
  let found = false;
  for (const table of parseTables(text)) {
    if (!(identify ? identify(table.headers) : table.headers.some(header => headers.includes(header)))) continue;
    found = true;
    for (const error of table.errors) target.error(offset + error.line, error.message);
    const missing = headers.filter(header => !table.headers.includes(header));
    if (missing.length) {
      target.error(offset + table.line, `表头缺列：${missing.join('、')}`);
      continue;
    }
    if (table.errors.some(error => error.line === table.line)) continue;
    for (const row of table.rows) {
      const line = row.line + offset;
      attempt(target, line, () => visit(row.fields, line, row.cells));
    }
  }
  if (!found && !optional) target.error(offset + 1, `缺少表格：${headers.join('、')}`);
}

function fieldMap(lines, target, offset = 0, keys = {}, known) {
  const fields = new Map();
  for (const entry of parseFields(structuralLines(lines.join('\n')))) {
    const key = Object.hasOwn(keys, entry.key) ? keys[entry.key] : entry.key;
    if (known && !known.includes(key)) continue;
    const line = offset + entry.line;
    if (fields.has(key)) {
      target.error(line, `字段重复：${entry.key}`, { id: key });
      continue;
    }
    fields.set(key, { value: entry.value, line });
  }
  return fields;
}

/** 解析伏笔表，结构错误的行不参与派生，缺未来出现方式仅提示。 */
export function parseForeshadows(text, file = 'bible/foreshadows.md') {
  const result = collector(file, 'foreshadow');
  const ids = new Set();
  const groups = sections(text, 2);
  const headers = ['ID', '伏笔', '读者已知', '作者真相', '埋设章', '计划回收章', '实际回收章', '状态', '未来出现方式'];
  tableRows(text, headers, result, (row, line) => {
    const id = idOf(row.ID, FORESHADOW_ID);
    unique(ids, id);
    const status = variant(row.状态, fsStates, '伏笔状态');
    const planted = singleChapter(row.埋设章, '埋设章', { unknown: status === 'planned' });
    const target = reference(row.计划回收章, '计划回收章', { unknown: true });
    const resolved = singleChapter(row.实际回收章, '实际回收章', { optional: true });
    const note = cell(row.备注);
    if (status === 'resolved') {
      assert(resolved !== null && resolved >= planted, '已回收伏笔必须填写实际回收章，且不得早于埋设章');
    } else {
      assert(resolved === null, '非已回收伏笔不得填写实际回收章');
    }
    assert(!target || planted === null || target.start >= planted, '计划回收不得早于埋设章');
    assert(status !== 'dropped' || note, '已放弃伏笔须填写备注');
    const future = cell(row.未来出现方式);
    // 已回收和已放弃均已结；只有未结状态按 §6.2 报提示。
    if (isOpenForeshadow({ status }) && !future) {
      result.error(line, `${id} 的未来出现方式为空`, { id, level: 'suggest' });
    }
    const touched = parseChapterList(row.触及章);
    const anchor = groups.findLast(section => section.line < line && section.line + section.lines.length >= line)?.name ?? null;
    result.add({
      id, name: required(row.伏笔, '伏笔'), status, planted, target, resolved, touched, future,
      reader_view: required(row.读者已知, '读者已知'), author_truth: required(row.作者真相, '作者真相'),
      subplots: splitList(row.支线).map(value => idOf(value, SUBPLOT_ID, '支线 ID')),
      characters: splitList(row.人物), note, source_anchor: anchor,
    }, line);
  });
  return result.finish();
}

/** 未结特指已埋设或部分揭示。 */
export function isOpenForeshadow(item) {
  return item.status === 'planted' || item.status === 'partial';
}

/** 按生命周期解析支线及当前进度。 */
export function parseSubplots(text, file = 'bible/subplots.md') {
  const result = collector(file, 'subplot');
  const ids = new Set();
  for (const block of sections(text, 3)) {
    attempt(result, block.line, () => {
      const match = /^([ABC]\d+[a-z]?)：(\S.*)$/.exec(block.name);
      assert(match, `支线标题非法：${block.name}`);
      const [, id, name] = match;
      unique(ids, id);
      const fields = fieldMap(block.lines, result, block.line, {}, ['状态', '挂靠主线', '人物', '活跃卷', '伏笔']);
      const get = key => fields.get(key)?.value;
      const read = (key, convert) => attempt(result, fields.get(key)?.line ?? block.line, () => convert(get(key)));
      const status = read('状态', value => variant(value, subplotStates, '支线状态'));
      const mainLink = read('挂靠主线', value => required(value, '挂靠主线'));
      const activeVolumes = read('活跃卷', value => reference(value, '活跃卷', { optional: true }));
      if (activeVolumes !== undefined && activeVolumes !== null && !activeVolumes.start) {
        result.error(fields.get('活跃卷').line, '活跃卷须为正整数');
      }
      const steps = [];
      const seen = new Set();
      tableRows(block.lines.join('\n'), ['步骤', '计划章', '实际章', '内容'], result, (row, line) => {
        const step = variant(row.步骤, stepAliases, '支线步骤', { contains: true });
        unique(seen, step, '步骤');
        const skipped = ['跳过', 'skip'].includes(row.实际章);
        steps.push({
          step, planned_chapter: singleChapter(row.计划章, '计划章', { optional: true, unknown: true }),
          actual_chapter: skipped ? null : singleChapter(row.实际章, '实际章', { optional: true }),
          skipped, content: cell(row.内容), file, line,
        });
      }, { offset: block.line });
      steps.sort((a, b) => STEPS.indexOf(a.step) - STEPS.indexOf(b.step));
      let current = null;
      for (const step of steps.filter(item => item.actual_chapter !== null)) {
        if (current && current.actual_chapter > step.actual_chapter) {
          result.error(step.line, `${id} 的实际章不符合生命周期顺序`, { id });
        }
        current = step;
      }
      if (status !== undefined && mainLink !== undefined) {
        result.add({
          id, name, level: id[0], status, main_link: mainLink, active_volumes: activeVolumes ?? null,
          characters: splitList(get('人物')), foreshadow_ids: splitList(get('伏笔')).map(value => idOf(value, FORESHADOW_ID, '伏笔 ID')),
          steps, current_step: current?.step ?? null, current_chapter: current?.actual_chapter ?? null,
        }, block.line);
      }
    });
  }
  return result.finish();
}

const metaKeys = {
  身份: 'role', 级别: 'tier', 首次出场: 'first_chapter', 别名: 'aliases', 常驻: 'always_present',
  休眠卷: 'dormant_volumes', 范围: 'scope', 读者已知: 'reader_view', 作者真相: 'author_truth',
};

/** 解析人物静态档案；规范名和别名冲突会报错。 */
export function parseCharacters(text, file = 'bible/characters.md') {
  const result = collector(file);
  const blocks = sections(text, 3);
  const names = new Set(blocks.map(block => block.name));
  const claimed = new Set();
  for (const block of blocks) {
    attempt(result, block.line, () => {
      const name = block.name;
      assert(!/[()（）]/.test(name), `人物标题不得带括号注释：${name}`);
      unique(claimed, name, '人物名');
      const fields = fieldMap(block.lines, result, block.line, metaKeys, Object.values(metaKeys));
      const get = key => fields.get(key)?.value;
      const aliases = [...new Set(splitList(get('aliases')))];
      const scope = cell(get('scope')) ?? '全部';
      assert(/^(?:全部|小说|短剧:[a-z0-9][a-z0-9-]*)$/.test(scope), `人物范围非法：${scope}`);
      const always = cell(get('always_present')) ?? '否';
      assert(always === '是' || always === '否', `常驻须为是或否：${always}`);
      const dormant = parseChapterList(get('dormant_volumes'));
      assert(!dormant.includes(0), '休眠卷须为正整数');
      const item = {
        name, role: required(get('role'), '身份'), tier: variant(get('tier'), tierAliases, '人物级别'),
        first_chapter: singleChapter(get('first_chapter'), '首次出场', { optional: true }),
        aliases: [], always_present: always === '是', dormant_volumes: dormant, scope,
        reader_view: cell(get('reader_view')), author_truth: cell(get('author_truth')),
      };
      for (const alias of aliases.filter(value => value !== name)) {
        if (names.has(alias) || claimed.has(alias)) {
          result.error(fields.get('aliases').line, `人物别名有歧义：${alias}`);
          for (const prior of result.items) prior.aliases = prior.aliases.filter(value => value !== alias);
        } else {
          claimed.add(alias);
          item.aliases.push(alias);
        }
      }
      result.add(item, block.line);
    });
  }
  return result.finish();
}

/** 构造别名到规范名的映射。 */
export function aliasesOf(characters) {
  return new Map(characters.flatMap(person => [person.name, ...person.aliases].map(alias => [alias, person.name])));
}

function readNotes(value) {
  const notes = new Map();
  for (const entry of (cell(value) ?? '').split(/[；;]/u).map(part => part.trim()).filter(Boolean)) {
    const match = /^([^:：]+)[:：](.+)$/u.exec(entry);
    assert(match, `出场备注格式非法：${entry}`);
    const name = required(match[1], '备注人名');
    assert(!notes.has(name), `出场备注重复：${name}`);
    notes.set(name, required(match[2], '备注内容'));
  }
  return Object.fromEntries(notes);
}

/** 解析实际在场、提及及备注。 */
export function parseAppearances(text, file = 'bible/appearances.md') {
  const result = collector(file);
  const chapters = new Set();
  tableRows(text, ['章', '在场', '提及', '备注'], result, (row, line) => {
    const chapter = singleChapter(row.章, '章');
    unique(chapters, chapter, '出场记录章号');
    result.add({ chapter, present: splitList(row.在场), mentioned: splitList(row.提及), notes: readNotes(row.备注) }, line);
  });
  return result.finish();
}

/** 解析关系变化日志；不读取人物分级表。 */
export function parseDynamics(text, file = 'bible/character-dynamics.md') {
  const result = collector(file);
  tableRows(text, ['章', '人物', '对象', '变化', '现状'], result, (row, line) => {
    result.add({
      chapter: singleChapter(row.章, '章'), character: required(row.人物, '人物'), target: cell(row.对象),
      change: required(row.变化, '变化'), state: required(row.现状, '现状'),
    }, line);
  }, { identify: headers => headers.includes('章') || headers.includes('变化') });
  return result.finish();
}

/** 解析时间锚点。 */
export function parseTimeline(text, file = 'bible/timeline.md') {
  const result = collector(file);
  const ids = new Set();
  tableRows(text, ['ID', '时间', '章', '事件', '类型', '正文口径'], result, (row, line) => {
    const id = idOf(row.ID, /^T\d{3,}$/);
    unique(ids, id);
    const kinds = [['hard', '硬锚'], ['soft', '软锚'], ['window', '窗口'], ['deadline', '期限']];
    result.add({
      id, time: required(row.时间, '时间'), chapter: singleChapter(row.章, '章', { optional: true }),
      event: required(row.事件, '事件'), kind: variant(row.类型, kinds, '锚点类型'), prose_form: cell(row.正文口径),
    }, line);
  });
  return result.finish();
}

/** 解析物品追踪表；不推断物品状态或核查故事一致性。 */
export function parseInventory(text, file = 'bible/inventory.md') {
  const result = collector(file);
  const ids = new Set();
  tableRows(text, ['ID', '物品', '持有', '状态', '获得章', '变动章', '备注'], result, (row, line) => {
    const id = idOf(row.ID, /^I\d{3,}$/);
    unique(ids, id);
    const states = [['held', '持有'], ['consumed', '消耗'], ['lent', '外借'],
      ['damaged', '损坏'], ['lost', '遗失'], ['transferred', '转手']];
    result.add({
      id, name: required(row.物品, '物品'), holder: cell(row.持有), status: variant(row.状态, states, '物品状态'),
      acquired_chapter: singleChapter(row.获得章, '获得章', { optional: true }),
      changed_chapter: singleChapter(row.变动章, '变动章', { optional: true }), note: cell(row.备注),
    }, line);
  });
  return result.finish();
}

/** 解析明线、暗线实际进展；不核查情节。 */
export function parseStorylines(text, file = 'bible/storylines.md') {
  const result = collector(file);
  const ids = new Set();
  tableRows(text, ['ID', '故事线', '类型', '起始章', '状态', '最新进展', '更新章'], result, (row, line) => {
    const id = idOf(row.ID, /^L\d+$/);
    unique(ids, id);
    const states = [['planned', '未开始', '⚪'], ['active', '进行', '🔵'],
      ['resolved', '完结', '🟢'], ['paused', '搁置', '🔴']];
    const kind = required(row.类型, '类型');
    assert(kind === '明线' || kind === '暗线', `故事线类型非法：${kind}`);
    result.add({
      id, name: required(row.故事线, '故事线'), kind,
      start_chapter: singleChapter(row.起始章, '起始章', { optional: true }),
      status: variant(row.状态, states, '故事线状态'), latest: cell(row.最新进展),
      updated_chapter: singleChapter(row.更新章, '更新章', { optional: true }),
    }, line);
  });
  return result.finish();
}

/** 解析主写入口注册表。 */
export function parseSources(text, file = 'bible/sources.md') {
  const result = collector(file);
  const keys = new Set();
  const headers = ['key', '信息', '主写入口', '锚点', '何时读', '何时写回', '模式', '简报'];
  tableRows(text, headers, result, (row, line) => {
    const key = idOf(row.key, /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/, 'key');
    unique(keys, key, 'key');
    const owner = required(row.主写入口, '主写入口');
    const templated = owner.replace(/\{(?:vol|ch|series)\}/g, 'x');
    assert(!/^[\\/]|[\\:{}?#]/.test(templated) && !templated.split('/').includes('..'), `主写入口不是有效的相对路径：${owner}`);
    const mode = row.模式;
    assert(['owner_only', 'secondary', 'draft_only'].includes(mode), `主写入口模式非法：${mode}`);
    const brief = cell(row.简报);
    const keywords = brief?.startsWith('kw:') ? brief.slice(3).split('|').map(value => value.trim()) : [];
    assert(brief === null || brief === 'always' || brief === 'characters'
      || (keywords.length > 0 && keywords.every(Boolean)), `简报条件非法：${brief}`);
    result.add({
      key, owner_file: owner, owner_anchor: cell(row.锚点), purpose: required(row.信息, '信息'),
      read_when: cell(row.何时读), write_when: cell(row.何时写回), mode, brief_rule: brief, keywords,
    }, line);
  });
  return result.finish();
}

/** 解析伏笔动作（共用于卷规划、章节提纲和短剧改编）。 */
export function parseAction(value) {
  const match = /^(plant|touch|resolve|drop|埋|触|收|弃)\s*(F\d{3,})(?:\s*[：:]\s*(.*))?$/.exec(value);
  assert(match, `伏笔动作非法：${value}`);
  return { action: actionAliases.find(group => group.includes(match[1]))[0], id: match[2], note: cell(match[3]) };
}

function readHook(value) {
  const hook = cell(value);
  assert(hook === null || HOOK_ORDER.includes(hook), `钩子级别非法：${hook}`);
  return hook;
}

function volumeRange(lines, result, offset = 0) {
  const fields = fieldMap(lines, result, offset, { 章节范围: 'range' }, ['range']);
  const field = fields.get('range');
  if (!field) {
    result.error(offset + 1, '缺少章节范围', { id: 'range' });
    return null;
  }
  const range = attempt(result, field.line, () => reference(field.value, '章节范围'), { id: 'range' });
  return range ? { range, line: field.line } : null;
}

/** 返回卷范围记录（chapter 为 null）及各章规划行。 */
export function parseVolumePlan(text, file = 'bible/volumes/1.md') {
  const result = collector(file);
  const lines = linesOf(text);
  const blocks = sections(text, 2).filter(block => block.name === '章节规划');
  const volumeMeta = volumeRange(lines.slice(0, (blocks[0]?.line ?? lines.length + 1) - 1), result);
  if (volumeMeta) result.add({ chapter: null, range: volumeMeta.range }, volumeMeta.line);
  const chapters = new Set();
  const headers = ['章', '核心事件', '爽点', '钩子', '支线', '伏笔', '人物', '权重'];
  for (const block of blocks) {
    tableRows(block.lines.join('\n'), headers, result, (row, line, cells) => {
      const chapter = singleChapter(row.章, '章');
      unique(chapters, chapter, '规划章');
      result.add({
        chapter, core_event: required(row.核心事件, '核心事件'), beat: cell(row.爽点), hook: readHook(row.钩子),
        subplots: splitList(row.支线).map(id => ({ id: idOf(id, SUBPLOT_ID, '支线 ID'), step: null })),
        foreshadow_actions: splitList(row.伏笔).map(parseAction),
        characters: { present: splitList(row.人物), mentioned: [] },
        weight: cell(row.权重) === null ? 'normal'
          : variant(row.权重, [['light', '轻'], ['normal', '中'], ['heavy', '重']], '权重'),
        cells,
      }, line);
    }, { offset: block.line });
  }
  return result.finish();
}

/** 解析卷摘要及其用于卷号定位的范围。 */
export function parseVolInfo(text, file = 'chapters/1/vol-info.md') {
  const result = collector(file);
  const lines = linesOf(text);
  const title = /^# 第([1-9]\d*)卷：(\S.*)$/.exec(lines[0]);
  if (!title) result.error(1, '卷摘要标题格式非法');
  const meta = volumeRange(lines, result);
  if (meta && title) {
    const fields = new Map(parseFields(structuralLines(text)).map(field => [field.key, cell(field.value)]));
    result.add({
      volume: singleChapter(title[1], '卷号'), name: fields.get('卷名') ?? title[2],
      range: meta.range, main_event: fields.get('卷级主线') ?? null,
      plan: fields.get('详细规划') ?? null, status: fields.get('正文状态') ?? null,
    }, meta.line);
  }
  return result.finish();
}

function parseOutlineEntries(block, result, convert) {
  const lines = structuralLines(block.lines.join('\n'));
  return lines.flatMap((raw, i) => {
    const text = raw.trim();
    if (!text) return [];
    const line = block.line + i + 1;
    const entry = attempt(result, line, () => {
      assert(text.startsWith('- '), `「${block.name}」须使用列表条目`);
      return { ...convert(text.slice(2)), line };
    });
    return entry ? [entry] : [];
  });
}

/** 解析章节提纲；只有实际提供的字段才会覆盖卷规划。 */
export function parseOutline(text, file = 'outline.md') {
  const result = collector(file);
  const title = /^# 第(0|[1-9]\d*)章 outline$/.exec(linesOf(text)[0]);
  const chapter = title ? attempt(result, 1, () => singleChapter(title[1], '章号')) : undefined;
  if (!title) result.error(1, '提纲首行须为「# 第N章 outline」');
  const blocks = new Map();
  const recognized = ['标题', '本章职责', '场景', '爽点', '支线推进', '伏笔', '出场人物', '钩子', '定稿'];
  for (const block of sections(text, 2).filter(section => recognized.includes(section.name))) {
    if (blocks.has(block.name)) result.error(block.line, `提纲节重复：${block.name}`);
    else blocks.set(block.name, block);
  }
  const item = { chapter: chapter ?? null };
  for (const [name, key] of [['标题', 'title'], ['本章职责', 'core_event'], ['爽点', 'beat'], ['定稿', 'canonical']]) {
    const block = blocks.get(name);
    if (!block) continue;
    const value = cell(maskComments(block.lines.join('\n')));
    if (name === '定稿' && !/^v[1-9]\d*$/.test(value ?? '')) result.error(block.line, '定稿节须指定一个稿次');
    else if ((name === '标题' || name === '本章职责') && (!value || value.includes('\n'))) {
      result.error(block.line, `「${name}」须为一行非空文本`);
    } else item[key] = value;
  }
  for (const name of ['标题', '本章职责', '场景']) {
    const block = blocks.get(name);
    if (!block || (name === '场景' && !cell(maskComments(block.lines.join('\n'))))) {
      result.error(block?.line ?? 1, `缺少提纲「${name}」`);
    }
  }
  if (blocks.has('支线推进')) {
    item.subplots = parseOutlineEntries(blocks.get('支线推进'), result, text => {
      const match = /^([ABC]\d+[a-z]?)(?:\s+([^：:]+?))?(?:\s*[：:]\s*(.*))?$/.exec(text);
      assert(match, `支线推进格式非法：${text}`);
      return { id: match[1], step: match[2] ? variant(match[2], stepAliases, '支线步骤', { contains: true }) : null, note: cell(match[3]) };
    });
  }
  if (blocks.has('伏笔')) item.foreshadow_actions = parseOutlineEntries(blocks.get('伏笔'), result, parseAction);
  if (blocks.has('出场人物')) {
    const block = blocks.get('出场人物');
    const fields = fieldMap(block.lines, result, block.line);
    item.characters = Object.fromEntries([['在场', 'present'], ['提及', 'mentioned']].flatMap(([key, out]) =>
      fields.has(key) ? [[out, splitList(fields.get(key).value)]] : []));
  }
  if (blocks.has('钩子')) {
    const block = blocks.get('钩子');
    const fields = fieldMap(block.lines, result, block.line);
    const level = fields.get('级别');
    if (level) {
      const hook = attempt(result, level.line, () => readHook(level.value));
      if (hook !== undefined) item.hook = hook;
    }
    if (fields.has('内容')) item.hook_content = cell(fields.get('内容').value);
  }
  result.add(item, 1);
  return result.finish();
}

/** 解析紧随任意标题的设定标签行。 */
export function parseSettingTags(text, file = 'bible/canon.md') {
  const result = collector(file);
  const lines = linesOf(text);
  const markers = [1, 2, 3, 4, 5, 6].flatMap(level => sections(text, level))
    .sort((a, b) => a.line - b.line);
  for (const { name, line } of markers) {
    const raw = lines[line]?.trim();
    if (!raw || !raw.startsWith('<!--') || !/^<!--\s*tags:/.test(raw)) continue;
    attempt(result, line + 1, () => {
      const match = /^<!--\s*tags:\s*([^;]*?)(?:;\s*chapters:\s*([^;]+?))?\s*-->$/.exec(raw);
      assert(match, '设定标签注释格式非法');
      const tags = splitList(match[1]);
      assert(tags.length, '设定标签不能为空');
      result.add({ name, tags, chapters: parseChapterList(match[2]), source_anchor: name }, line + 1);
    });
  }
  return result.finish();
}
