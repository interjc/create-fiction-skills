import path from 'node:path';
import { FORESHADOW_ID, tableRows } from './bible.mjs';
import { finding, sortFindings } from './cli.mjs';
import { DIALECT_ID } from './config.mjs';
import { episodeStatus, parseDialogue } from './drama.mjs';
import { cell, linesOf, maskComments, parseFences, parseFields, splitHeading, splitList, structuralLines } from './md.mjs';

export const SHOT_SIZES = Object.freeze({ LS: '远景', FS: '全景', MS: '中景', MCU: '近景', CU: '特写', ECU: '大特写' });
export const CAMERA_MOVES = Object.freeze({ static: '固定', push: '推', pull: '拉', pan: '摇',
  truck: '移', follow: '跟', orbit: '环绕', handheld: '手持' });
export const TRANSITIONS = Object.freeze({ cut: '切', dissolve: '叠化', fade: '淡入', flash: '闪白' });
export const PROMPT_STATUS = Object.freeze({ draft: '草稿', approved: '已确认', done: '已出', void: '作废' });
const frames = Object.freeze({ first: '首帧', last: '尾帧' });
export const ASSET_GROUPS = Object.freeze(['人物', '地点', '道具']);
export const REF_ID = /^REF\d{3,}$/;
export const SHOT_ID = /^SH\d{3,}[a-z]?$/;
export const SEGMENT_ID = /^SEG\d{2,}[a-z]?$/;
const fieldsByAsset = new Map([['外观', 'look'], ['锁定词', 'locks'], ['物品', 'item'],
  ['揭示伏笔', 'reveals'], ['揭示集', 'reveal_episode']].flatMap(([cn, en]) => [[cn, en], [en, en]]));
const assetMeta = new Map([['画幅', 'aspect_ratio'], ['画风', 'style'], ['图片方言', 'image_dialect'], ['视频方言', 'video_dialect']]);
const sbFields = new Set(['地点', '站位', '环境声', '配乐', '景别', '运镜', '转场', '画面', '人物', '道具', '依据', '声音', '备注']);
const promptFields = new Set(['对象', '视图', '来源', '帧', '方言', '状态', '参考图', '文件', '模型']);

function report(file) {
  const errors = [];
  return {
    file, errors,
    add: (rule, line, message, options) => errors.push(finding(rule, file, message, { line, ...options })),
    finish: (items, extra) => ({ items, errors: sortFindings(errors), ...extra }),
  };
}

function records(lines, offset, keyOf, output, rule) {
  const fields = new Map();
  for (const entry of parseFields(lines)) {
    const key = keyOf(entry.key);
    if (key === undefined) continue;
    const line = offset + entry.line;
    if (fields.has(key)) output.add(rule, line, `字段重复：${entry.key}`);
    else fields.set(key, { value: entry.value, line });
  }
  return fields;
}

function uint(value, min = 0) {
  const n = Number(value);
  return /^\d+$/.test(value ?? '') && Number.isSafeInteger(n) && n >= min ? n : null;
}

/** 文件名可定位集号，但只有规范补零的文件名才可作分集引用。 */
export function episodeFileNumber(file, suffix = '') {
  return uint(new RegExp(`^ep(\\d+)${suffix}\\.md$`).exec(path.posix.basename(file))?.[1], 1);
}

export function episodeFilename(episode, suffix = '') {
  return `ep${String(episode).padStart(3, '0')}${suffix}.md`;
}

/** 按 §6.1 验证并拆出资产键；禁止把无效键修剪成另一个资产。 */
export function assetKey(key) {
  const parts = (key ?? '').split('@');
  if (parts.length > 2 || parts.some(part => part !== part.trim() || !part
    || Array.from(part).length > 24 || /[｜|#、，,]/u.test(part))) return null;
  return { name: parts[0], variant: parts[1] ?? null };
}

/** 保留条目自己的字段，再在同组内合成本体与变体的有效字段。 */
export function parseVisualAssets(text, file = 'visual/assets.md') {
  const output = report(file);
  const lines = structuralLines(text);
  const raw = linesOf(text);
  const firstHeading = lines.findIndex((line, i) => i > 0 && /^ {0,3}#{1,6}(?:[ \t]|$)/.test(line));
  const end = firstHeading < 0 ? lines.length : firstHeading;
  const meta = records(lines.slice(1, end), 1, key => assetMeta.get(key), output, 'va-structure');
  const metadata = Object.fromEntries([...meta].map(([key, { value }]) => [key, cell(value)]));
  if (!/^# \S/.test(raw[0])) output.add('va-structure', 1, '视觉资产首行须为「# 标题」', { excerpt: raw[0] });
  if (meta.has('aspect_ratio') && !/^\d+:\d+$/.test(metadata.aspect_ratio ?? '')) {
    output.add('va-structure', meta.get('aspect_ratio').line, '画幅须为数字:数字');
  }
  const items = [];
  const groups = new Set();
  const keys = new Set();
  const names = new Map();
  let group = null;
  for (let i = 1; i < lines.length; i++) {
    const heading = /^ {0,3}(#{1,3})(?:[ \t](.*)|$)/.exec(lines[i]);
    if (!heading) continue;
    const [, level, title = ''] = heading;
    const key = title.trimEnd();
    const loc = { excerpt: raw[i] };
    if (level === '#') {
      group = null;
    } else if (level === '##') {
      group = ASSET_GROUPS.includes(key) && lines[i].startsWith('## ') ? key : null;
      if (!group || groups.has(group)) output.add('va-structure', i + 1, '资产分组非法或重复', loc);
      if (group) groups.add(group);
    } else {
      const parts = assetKey(key);
      if (!parts || !group || !lines[i].startsWith('### ')) {
        output.add('va-structure', i + 1, '资产键非法或条目不在有效分组下', loc);
        continue;
      }
      const pair = `${group}:${key}`;
      if (keys.has(pair) || (names.has(parts.name) && names.get(parts.name) !== group)) {
        output.add('va-duplicate', i + 1, '资产键重复或同一名称跨组出现', loc);
      }
      keys.add(pair);
      names.set(parts.name, group);
      let j = i + 1;
      while (j < lines.length && !/^ {0,3}#{1,3}(?:[ \t]|$)/.test(lines[j])) j++;
      const own = records(lines.slice(i + 1, j), i + 1, k => fieldsByAsset.get(k), output, 'va-structure');
      const get = field => cell(own.get(field)?.value);
      const fields = {};
      if (own.has('look')) fields.look = get('look');
      if (!fields.look) output.add('va-look', own.get('look')?.line ?? i + 1, '资产条目缺少非空外观', { excerpt: key });
      if (own.has('item')) fields.item = get('item');
      if (fields.item && (group !== '道具' || !/^I\d{3,}$/.test(fields.item))) {
        output.add('va-item', own.get('item').line, '物品字段仅用于道具且须为 I-ID', { excerpt: fields.item });
      }
      if (own.has('reveals')) {
        fields.reveals = splitList(get('reveals'));
        for (const id of fields.reveals.filter(id => !FORESHADOW_ID.test(id))) {
          output.add('va-reveal', own.get('reveals').line, '揭示伏笔须为 F-ID', { excerpt: id });
        }
      }
      if (own.has('reveal_episode')) {
        const value = get('reveal_episode');
        fields.reveal_episode = uint(value, 1);
        if (value !== null && fields.reveal_episode === null) {
          // 不让非法显式值回退到一个可能提前放行的集号。
          fields.reveal_episode = Infinity;
          output.add('va-reveal', own.get('reveal_episode').line, '揭示集须为正整数', { excerpt: value });
        }
      }
      if (own.has('locks')) {
        const value = get('locks');
        fields.locks = value === null ? [] : value.split(/[、，,]/u).map(lock => lock.split('=').map(s => s.trim()));
        if (fields.locks.some(lock => lock.some(s => !s))) {
          output.add('va-lock', own.get('locks').line, '锁定词含空项或空写法', { excerpt: value });
          fields.locks = fields.locks.filter(lock => lock.every(Boolean));
        }
      }
      items.push({ key, ...parts, group, file, line: i + 1, own, fields });
      i = j - 1;
    }
  }
  const base = new Map();
  for (const item of items.filter(item => item.variant === null)) {
    const key = `${item.group}:${item.name}`;
    if (!base.has(key)) base.set(key, item);
  }
  for (const item of items) {
    if (item.variant === null) continue;
    const parent = base.get(`${item.group}:${item.name}`);
    if (!parent) output.add('va-variant', item.line, '变体缺少同组本体', { excerpt: item.key });
    else item.fields = { ...parent.fields, ...item.fields };
  }
  return output.finish(items, { metadata });
}

/** 连戏表只解析并验证行格式，引用由分镜检查核对。 */
export function parseContinuity(text, file = 'visual/continuity.md') {
  const output = report(file);
  const items = [];
  const error = (line, message) => output.add('vc-row', line, message);
  tableRows(text, ['集', '对象', '现状', '变体', '依据'], { error }, (row, line) => {
    const episode = uint(cell(row.集));
    const object = cell(row.对象);
    const state = cell(row.现状);
    if (episode === null || !state || !object || object.includes('@')) {
      error(line, '连戏行须有非负集号、无 @ 的对象与非空现状');
      return;
    }
    items.push({ episode, object, state, variant: cell(row.变体), basis: cell(row.依据), file, line });
  });
  return output.finish(items);
}

/** 某对象此前最近的行：先按集号比较，同集取表中最后一行。 */
export function priorContinuity(rows, episode, object, withVariant = false) {
  let prior = null;
  for (const row of rows) {
    if (row.object === object && row.episode < episode && (!withVariant || row.variant !== null)
      && (prior === null || row.episode >= prior.episode)) prior = row;
  }
  return prior;
}

/** 解析有效键，同时公开本集的 current / allowed 供检查与简报复用。 */
export function resolveAsset(key, episode, assets, continuity) {
  const parts = assetKey(key);
  if (!parts) return { key, entry: null, current: null, allowed: new Set(), explicit: false };
  const { name, variant } = parts;
  const current = priorContinuity(continuity, episode, name, true)?.variant ?? null;
  const allowed = new Set([current, ...continuity.filter(row => row.object === name && row.episode === episode)
    .map(row => row.variant)].filter(value => value !== null));
  const automatic = current !== '本体' && current !== '退场' ? current : null;
  const resolved = variant !== null ? key : automatic ? `${name}@${automatic}` : name;
  const matches = assets.filter(item => item.key === resolved);
  return { key: resolved, entry: matches.length === 1 ? matches[0] : null, current, allowed, explicit: variant !== null };
}

/** null 表示尚不可用；收过多次时取最晚的一次，不会提前放行。 */
export function usableFrom(entry, map) {
  const { reveal_episode, reveals = [] } = entry.fields;
  if (reveal_episode != null) return Number.isFinite(reveal_episode) ? reveal_episode : null;
  let episode = 1;
  for (const id of reveals) {
    let resolved = 0;
    for (const row of map) {
      if (row.foreshadow_actions.some(action => action.id === id && action.action === 'resolve')) {
        resolved = Math.max(resolved, row.episode);
      }
    }
    if (!resolved) return null;
    episode = Math.max(episode, resolved);
  }
  return episode;
}

function vocab(value, table) {
  const clean = value?.replace(/（[^（）]*）$/u, '').trim();
  return Object.entries(table).find(([en, cn]) => clean === cn || clean?.toLowerCase() === en.toLowerCase())?.[0] ?? null;
}

function enumValue(value, table) {
  return Object.entries(table).find(([en, cn]) => value === cn || value === en)?.[0] ?? null;
}

/** 分镜结构、字段、词表；剧本、时长阈值与资产引用由检查入口处理。 */
export function parseStoryboard(text, file = 'ep001.md') {
  const output = report(file);
  const original = linesOf(text);
  const lines = linesOf(maskComments(text)).map(line => line.trim() ? line : '');
  const episode = episodeFileNumber(file);
  const title = /^# 第(\d+)集分镜(：.*)?$/.exec(original[0]);
  if (!title || episode === null || episodeFilename(episode) !== path.posix.basename(file)
    || Number(title[1]) !== episode) output.add('sb-title', 1, '分镜标题非法或集号与文件名不符', { excerpt: original[0] });
  const chunks = [{ level: 0, line: 1, header: '', lines: [] }];
  for (let i = 1; i < lines.length; i++) {
    const heading = /^ {0,3}(#{2,3})(?:[ \t]|$)/.exec(lines[i]);
    if (heading) chunks.push({ level: heading[1].length, line: i + 1, header: lines[i], lines: [] });
    else chunks.at(-1).lines.push(lines[i]);
  }
  const meta = records(chunks[0].lines, 1, key => key === '状态' ? key : undefined, output, 'sb-meta').get('状态');
  const status = meta ? episodeStatus(meta.value) : 'draft';
  if (status === null) output.add('sb-meta', meta.line, '分镜状态不在词表内', { excerpt: meta.value });
  const segments = [];
  const ids = new Set();
  let segment = null;
  for (const { level, header, line, lines: body } of chunks.slice(1)) {
    const add = (rule, message, options) => output.add(rule, line, message, { excerpt: header, ...options });
    const [key, second, extra] = splitHeading(header.slice(level + 1));
    const shape = header.startsWith(`${'#'.repeat(level)} `) && extra === undefined;
    let item;
    if (level === 2) {
      segment = null;
      const scene = uint(/^场景(\d+)$/.exec(second ?? '')?.[1]);
      if (shape && SEGMENT_ID.test(key) && scene !== null) {
        segment = item = { key, scene, shots: [], file, line };
        segments.push(item);
      }
    } else {
      const value = /^\d+(?:\.\d)?s$/.test(second ?? '') ? Number(second.slice(0, -1)) : NaN;
      if (shape && SHOT_ID.test(key) && Number.isSafeInteger(Math.round(value * 10)) && segment) {
        item = { key, seconds: value, dialogue: [], file, line };
        segment.shots.push(item);
      }
    }
    if (!item) {
      add('sb-heading', level === 2 ? '段头格式非法' : '镜头格式非法或没有有效上级段');
      continue;
    }
    if (ids.has(key)) add('sb-id', `分镜 ID 重复：${key}`);
    ids.add(key);
    const fields = records(body, line, name => sbFields.has(name) ? name : undefined, output, 'sb-bad-line');
    item.fields = fields;
    const get = name => cell(fields.get(name)?.value);
    let continuation = false;
    for (const [i, row] of body.entries()) {
      if (/^- (?:\*\*)?([^*：:]+?)(?:\*\*)?[：:]/.test(row)) {
        continuation = true;
        continue;
      }
      if (continuation && /^ {2,}/.test(row)) continue;
      continuation = false;
      if (!row.trim()) continue;
      const speech = level === 3 ? parseDialogue(row.trimEnd(), line + i + 1) : null;
      if (speech) item.dialogue.push(speech);
      else output.add('sb-bad-line', line + i + 1, '分镜块内出现非法行', { excerpt: row });
    }
    for (const field of level === 2 ? ['地点'] : ['景别', '画面']) {
      if (!get(field)) add('sb-field', `缺少非空${field}`, { line: fields.get(field)?.line ?? line });
    }
    if (level === 2) {
      item.location = get('地点');
    } else {
      item.people = splitList(get('人物'));
      item.props = splitList(get('道具'));
      item.note = get('备注');
      const basis = get('依据');
      item.basis = basis === null ? [] : basis.split('；').map(s => s.trim());
      for (const [field, name, table, fallback] of [['景别', 'size', SHOT_SIZES, null],
        ['运镜', 'move', CAMERA_MOVES, 'static'], ['转场', 'transition', TRANSITIONS, 'cut']]) {
        const entry = fields.get(field);
        item[name] = entry ? vocab(get(field), table) : fallback;
        if (entry && item[name] === null) add('sb-vocab', `${field}不在词表内`, { line: entry.line, excerpt: entry.value });
      }
      if (item.seconds === 0) add('sb-shot-seconds', '镜时长不能为 0 秒', { excerpt: second });
    }
  }
  if (!segments.some(item => item.shots.length)) output.add('sb-heading', null, '分镜没有任何有效镜头');
  for (const item of segments) item.seconds = sumShotSeconds(item.shots);
  const seconds = sumShotSeconds(segments.flatMap(item => item.shots));
  return output.finish([{ episode, status, segments, seconds, file, line: 1 }]);
}

export function sumShotSeconds(shots) {
  return shots.reduce((total, shot) => total + Math.round(shot.seconds * 10), 0) / 10;
}

/** 分类仅依文件名；不能从正文猜测一个无法定位的分集文件。 */
export function promptFileKind(file) {
  const name = path.posix.basename(file);
  if (name === 'assets-image.md') return 'ref';
  return /^ep[^/]*-(image|video)\.md$/.exec(name)?.[1] ?? null;
}

/** 解析提示词块和有效方言，保留围栏原文以供独立的文本检查。 */
export function parsePromptFile(text, file = 'assets-image.md', { metadata = {}, config = {} } = {}) {
  const output = report(file);
  const original = linesOf(text);
  const kind = promptFileKind(file);
  const episode = kind === 'image' || kind === 'video' ? episodeFileNumber(file, `-${kind}`) : null;
  const title = kind === 'ref' ? original[0] === '# 资产参考图'
    : ((kind === 'image' ? /^# 第(\d+)集图片提示词$/ : /^# 第(\d+)集视频提示词$/).exec(original[0])?.[1]);
  if (kind === null || (kind === 'ref' ? !title : (!title || episode === null || Number(title) !== episode
    || episodeFilename(episode, `-${kind}`) !== path.posix.basename(file)))) {
    output.add('pr-title', 1, '提示词首行标题非法或集号与文件名不符', { excerpt: original[0] });
  }
  if (!kind) return output.finish([]);
  const fences = parseFences(original);
  const outside = [...original];
  for (const fence of fences) outside.fill('', fence.line - 1, fence.end ?? outside.length);
  const visible = structuralLines(outside.join('\n')).map(line => line.trim() ? line : '');
  const headings = visible.flatMap((line, i) => /^ {0,3}#{1,2}(?:[ \t]|$)/.test(line) ? [i] : []);
  const blocks = [];
  const seen = new Set();
  let cursor = 0;
  const fileDialect = kind === 'video' ? 'video' : 'image';
  const defaultDialect = metadata[`${fileDialect}_dialect`] ?? config[fileDialect]?.dialect ?? 'generic';
  const keyPattern = { ref: REF_ID, image: SHOT_ID, video: SEGMENT_ID }[kind];
  for (const [i, start] of headings.entries()) {
    if (!/^ {0,3}##(?:[ \t]|$)/.test(visible[start])) continue;
    const end = headings[i + 1] ?? visible.length;
    while (fences[cursor]?.line <= start + 1) {
      output.add('pr-block', fences[cursor++].line, '命名围栏不在提示词块内');
    }
    const own = [];
    while (fences[cursor]?.line <= end) own.push(fences[cursor++]);
    const key = visible[start].slice(3);
    const line = start + 1;
    const add = (message, options) => output.add('pr-block', line, message, options);
    if (!visible[start].startsWith('## ') || !keyPattern.test(key)) {
      add('提示词块标题非法', { excerpt: original[start] });
      continue;
    }
    const fields = records(visible.slice(start + 1, end), line,
      name => promptFields.has(name) ? name : undefined, output, 'pr-block');
    const get = key => cell(fields.get(key)?.value);
    const status = fields.has('状态') ? enumValue(get('状态'), PROMPT_STATUS) : 'draft';
    const frame = kind === 'image' ? (fields.has('帧') ? enumValue(get('帧'), frames) : 'first') : null;
    const dialect = fields.has('方言') ? get('方言') : defaultDialect;
    if (status === null) add('提示词状态不在词表内', { line: fields.get('状态').line });
    if (fields.has('帧') && (kind !== 'image' || frame === null)) add('帧字段非法', { line: fields.get('帧').line });
    if (!DIALECT_ID.test(dialect ?? '')) add('方言 ID 非法', { line: fields.get('方言')?.line ?? line, excerpt: dialect });
    const unique = JSON.stringify(kind === 'ref' ? [key] : [key, frame, dialect]);
    if (status !== 'void') {
      if (seen.has(unique)) add('未作废提示词块重复', { excerpt: key });
      seen.add(unique);
    }
    for (const name of ['prompt', 'negative']) {
      const named = own.filter(fence => fence.kind === name);
      for (const fence of named.slice(1)) add(`${name} 围栏重复`, { line: fence.line });
    }
    for (const fence of own) if (fence.end === null) add(`${fence.kind} 围栏未闭合`, { line: fence.line });
    blocks.push({ kind, episode, key, frame, dialect, status, fields, file, line,
      prompt: own.find(fence => fence.kind === 'prompt') ?? null,
      negative: own.find(fence => fence.kind === 'negative') ?? null,
      refs: splitList(get('参考图')), object: get('对象'), source: get('来源'), output: get('文件') });
  }
  for (const fence of fences.slice(cursor)) output.add('pr-block', fence.line, '命名围栏不在提示词块内');
  return output.finish(blocks);
}
