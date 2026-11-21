import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { integer, lexical, relativeFile } from './cli.mjs';
import { parseChapterList, parseChapterRef, sections, structuralLines } from './md.mjs';
import { parseVolInfo, parseVolumePlan } from './bible.mjs';

const natural = /^(?:0|[1-9]\d*)$/;
const positive = /^[1-9]\d*$/;
const draftName = /^v([1-9]\d*)\.md$/;

/** 可选目录；不存在返回空列表，其他错误不隐瞒。 */
export function entries(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).sort((a, b) => lexical(a.name, b.name));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** 读取可选文本文件；不存在返回 null。 */
export function readOptional(root, file) {
  try {
    return readFileSync(path.join(root, file), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function invalidCanonical(file, line, message) {
  return Object.assign(new Error(`${file}:${line}：${message}`), { file, line });
}

/** 读取定稿节；没有指定时返回最大稿次，非法指定不回退。 */
export function selectCanonical(root, dir, drafts) {
  const file = `${dir}/outline.md`;
  const outline = readOptional(root, file);
  if (outline !== null) {
    const specified = sections(outline, 2).filter(section => section.name === '定稿');
    if (specified.length > 1) throw invalidCanonical(file, specified[1].line, '重复的定稿节');
    if (specified.length === 1) {
      const section = specified[0];
      const value = structuralLines(section.lines.join('\n')).map(s => s.trim()).filter(Boolean);
      if (value.length !== 1 || !/^v[1-9]\d*$/.test(value[0])) {
        throw invalidCanonical(file, section.line, '定稿节须指定一个稿次');
      }
      const selected = `${dir}/${value[0]}.md`;
      if (!drafts.includes(selected)) throw invalidCanonical(file, section.line, `定稿不存在：${selected}`);
      return selected;
    }
  }
  return drafts.at(-1) ?? null;
}

/** 列出章节目录与数字稿次（路径均相对书根）。 */
export function listChapters(root, { resolveCanonical = true } = {}) {
  const chapters = new Map();
  for (const volumeEntry of entries(path.join(root, 'chapters'))) {
    if (!volumeEntry.isDirectory() || !positive.test(volumeEntry.name)) continue;
    const volume = integer(volumeEntry.name, '卷号', 1);
    for (const item of entries(path.join(root, 'chapters', volumeEntry.name))) {
      if (!item.isDirectory() || !natural.test(item.name)) continue;
      const chapter = integer(item.name, '章号');
      if (chapters.has(chapter)) throw new Error(`第${chapter}章存在多个目录`);
      const dir = `chapters/${volume}/${chapter}`;
      const drafts = entries(path.join(root, dir)).flatMap(entry => {
        const match = draftName.exec(entry.name);
        return entry.isFile() && match ? [{ name: entry.name, n: integer(match[1], '稿次', 1) }] : [];
      }).sort((a, b) => a.n - b.n).map(entry => `${dir}/${entry.name}`);
      const resolve = typeof resolveCanonical === 'function' ? resolveCanonical(chapter) : resolveCanonical;
      const canonical = resolve ? selectCanonical(root, dir, drafts) : null;
      chapters.set(chapter, { chapter, volume, dir, drafts, canonical });
    }
  }
  return [...chapters.values()].sort((a, b) => a.chapter - b.chapter);
}

function inside(root, file) {
  const rel = relativeFile(root, file);
  return rel !== '..' && !rel.startsWith('../') && !path.isAbsolute(rel);
}

/** 解析书根内 Markdown 路径；相对路径可基于书根或工作目录，不猜冲突。 */
export function explicitFile(root, selector) {
  const absoluteRoot = path.resolve(root);
  if (!selector.endsWith('.md')) throw new Error(`不是 Markdown 文件：${selector}`);
  const candidates = new Set([path.resolve(absoluteRoot, selector), path.resolve(selector)]);
  const actualRoot = realpathSync(absoluteRoot);
  const matches = [...candidates].filter(file => inside(absoluteRoot, file)
    && statSync(file, { throwIfNoEntry: false })?.isFile() && inside(actualRoot, realpathSync(file)));
  if (matches.length !== 1) {
    throw new Error(matches.length ? `路径指向多个文件：${selector}` : `未找到书根内文件：${selector}`);
  }
  return relativeFile(absoluteRoot, matches[0]);
}

/** 解析选择器，返回 {items: [{chapter,file}], missing: 章号[]}。 */
export function resolveSelector(root, sel) {
  if (sel?.endsWith('.md')) {
    const file = explicitFile(root, sel);
    const parent = path.posix.basename(path.posix.dirname(file));
    const chapter = /^\d+$/.test(parent) ? integer(parent, '章号') : null;
    return { items: [{ chapter, file }], missing: [] };
  }
  const all = sel === '--all';
  if (!all && !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(sel ?? '')) {
    throw new Error(`章节选择非法：${sel ?? ''}`);
  }
  const requested = all ? null : new Set(parseChapterList(sel));
  const chapters = listChapters(root, { resolveCanonical: ch => all || requested.has(ch) }).filter(item => item.canonical);
  const available = new Map(chapters.map(item => [item.chapter, item.canonical]));
  const selected = all ? [...available.keys()] : [...requested];
  const missing = selected.filter(ch => !available.has(ch));
  const items = selected.filter(ch => available.has(ch)).map(ch => ({ chapter: ch, file: available.get(ch) }));
  if (!all && !items.length) throw new Error(`所选章节没有定稿：${sel}`);
  return { items, missing };
}

function volumeMatches(root, files, parser, chapter) {
  const matches = [];
  const covered = new Set();
  for (const { volume, file } of files) {
    const text = readOptional(root, file);
    if (text === null) continue;
    const { items, errors } = parser(text, file);
    // 规划行的错误由调用者报告；卷范围本身却不能猜。
    const invalidRange = errors.find(error => error.id === 'range');
    if (invalidRange) throw new Error(`${file}:${invalidRange.line ?? '?'}：${invalidRange.message}`);
    const range = items.find(item => item.range)?.range;
    if (range) covered.add(volume);
    if (range && chapter >= range.start && chapter <= range.end) matches.push(volume);
  }
  if (matches.length > 1) throw new Error(`第${chapter}章落入多个卷的章节范围`);
  return { volume: matches[0] ?? null, covered };
}

/** 依章节目录、卷规划、卷摘要定位卷号；未覆盖时返回 null。 */
export function volumeOf(root, ch) {
  const chaptersDir = path.join(root, 'chapters');
  const volumes = entries(chaptersDir).filter(e => e.isDirectory() && positive.test(e.name))
    .map(e => integer(e.name, '卷号', 1));
  const existing = volumes.filter(vol => statSync(path.join(chaptersDir, String(vol), String(ch)), {
    throwIfNoEntry: false,
  })?.isDirectory());
  if (existing.length > 1) throw new Error(`第${ch}章存在多个目录`);
  if (existing.length) return existing[0];
  const plans = entries(path.join(root, 'bible/volumes')).flatMap(entry => {
    const match = /^([1-9]\d*)\.md$/.exec(entry.name);
    return entry.isFile() && match ? [{ volume: integer(match[1], '卷号', 1), file: `bible/volumes/${entry.name}` }] : [];
  });
  const planned = volumeMatches(root, plans, parseVolumePlan, ch);
  if (planned.volume !== null) return planned.volume;
  const summaries = volumes.filter(volume => !planned.covered.has(volume))
    .map(volume => ({ volume, file: `chapters/${volume}/vol-info.md` }));
  return volumeMatches(root, summaries, parseVolInfo, ch).volume;
}

/** 将已配置的冻结范围转为闭区间。 */
export function parseRanges(strings) {
  return strings.map(value => {
    const range = parseChapterRef(value);
    if (!range) throw new Error(`冻结范围不能待定：${value}`);
    return range;
  });
}

/** 章号是否处于冻结区间内。 */
export function isFrozen(ch, config) {
  return ch !== null && parseRanges(config.frozen.ranges).some(range => ch >= range.start && ch <= range.end);
}

/** 章节选择中缺少的稿件提示。 */
export function missingChapters(missing) {
  return missing.length ? `跳过无定稿章节：${missing.join('、')}` : '';
}

/** 检查短剧 slug 和目录；列出短剧剧本 Markdown 文件。 */
export function seriesEpisodeFiles(root, slug) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug ?? '')) throw new Error(`短剧名非法：${slug ?? ''}`);
  const base = `drama/${slug}/episodes`;
  if (!statSync(path.join(root, base), { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`未找到剧本目录：${base}`);
  }
  return entries(path.join(root, base)).filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => `${base}/${entry.name}`);
}
