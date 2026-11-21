import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { directMain, EXIT, failLevel, finding, lexical, runCli } from './cli.mjs';
import { DIALECT_ID, requireConfig } from './config.mjs';
import { selectedEpisodeRange, withoutWhitespace } from './drama.mjs';
import { linesOf } from './md.mjs';
import { compilePattern, DEFAULT_PATTERNS, literalPattern } from './patterns.mjs';
import { assetKey, episodeFileNumber, parsePromptFile, promptFileKind, PROMPT_STATUS, REF_ID, resolveAsset, usableFrom } from './visual.mjs';
import { checkExit, checkSummary, filesIn, findingLines, loadStoryboard, numberInRange, readParsed, seriesBase, snapshot } from './visual-project.mjs';

const internal = DEFAULT_PATTERNS.filter(item => ['IR01', 'IR02', 'IR04'].includes(item.id))
  .map(({ id, source }) => ({ id, regex: compilePattern(source) }));
internal.push({ id: null, regex: /(?<![A-Za-z0-9])(SEG\d{2,}|SH\d{3,}|REF\d{3,})/gu });
const shotRef = /^(SH\d{3,}[a-z]?)(尾)?$/u;
const active = block => block.status !== 'void';
const normalizeSpaces = text => text.replace(/\s+/gu, ' ');
const normalizeLock = text => normalizeSpaces(text).toLowerCase();

function desensitizePatterns({ banned_terms, desensitize }) {
  const terms = [banned_terms, ...['places', 'schools', 'companies', 'people', 'other'].map(key => desensitize[key])].flat();
  const patterns = terms.map(value => typeof value === 'string' ? { term: value } : value)
    .map(({ term, hint }) => ({ regex: literalPattern(term), hint }));
  if (desensitize.exact_years) patterns.push(...DEFAULT_PATTERNS.filter(item => item.rule === 'exact-year')
    .map(({ id, source, hint }) => ({ id, regex: compilePattern(source), hint })));
  return patterns;
}

function forbidPatterns(config) {
  return new Map(Object.entries(config.dialects).map(([id, settings]) => [id, (settings.forbid ?? []).map((source, i) => {
    try { return { regex: compilePattern(source), id: `FB${i + 1}` }; }
    catch (error) { throw new Error(`.fiction/config.json：方言 ${id} 的 forbid 第 ${i + 1} 项非法：${error.message}`); }
  })]));
}

function producedFile(root, base, output) {
  if (!output || path.isAbsolute(output) || /[\\\0]/u.test(output) || /^[A-Za-z]:/.test(output)
    || output.split('/').includes('..')) return false;
  const dir = path.join(root, base);
  const target = path.join(dir, output);
  if (!statSync(target, { throwIfNoEntry: false })?.isFile()) return false;
  const relative = path.relative(realpathSync(dir), realpathSync(target));
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function referencedAssets(segment, shots, episode, data) {
  const refs = [];
  if (shots.length) refs.push(['地点', segment.location]);
  for (const shot of shots) {
    refs.push(...shot.people.map(key => ['人物', key]), ...shot.props.map(key => ['道具', key]));
  }
  return [...new Set(refs.filter(([, key]) => key).flatMap(([group, key]) => {
    const { entry } = resolveAsset(key, episode, data.assets.items, data.continuity.items);
    return entry?.group === group ? [entry] : [];
  }))];
}

function targetIndex(storyboard) {
  const shots = new Map();
  const segments = new Map();
  for (const segment of storyboard?.segments ?? []) {
    segments.set(segment.key, segments.has(segment.key) ? null : segment);
    for (const shot of segment.shots) shots.set(shot.key, shots.has(shot.key) ? null : { shot, segment });
  }
  return { shots, segments };
}

function referenceCandidates(ref, block, indexes) {
  if (REF_ID.test(ref)) return indexes.refs.get(ref) ?? [];
  if (block.kind === 'ref') return [];
  const [, key, tail] = shotRef.exec(ref) ?? [];
  return indexes.frames.get(block.episode)?.get(`${key}:${tail ? 'last' : 'first'}`) ?? [];
}

function matchText(fence, patterns, add, rule, message, defaultHint) {
  if (!fence?.end) return;
  const lines = linesOf(fence.raw, { mask: rule !== 'pr-internal-ref' });
  for (const [offset, line] of lines.entries()) for (const { id, regex, hint } of patterns) {
    for (const match of line.matchAll(regex)) add(rule, message, { id, line: fence.line + offset + 1,
      column: Array.from(line.slice(0, match.index)).length + 1, excerpt: match[0], hint: hint ?? defaultHint });
  }
}

function checkBlock(root, base, block, index, data, settings, indexes, findings) {
  const { kind, episode, key, frame, dialect, status, file, line, refs, output, negative, prompt } = block;
  const text = prompt?.content ?? '';
  const chars = Array.from(normalizeSpaces(text)).length;
  const frameTarget = kind === 'image' ? index.shots.get(key) : null;
  const segment = kind === 'video' ? index.segments.get(key) : frameTarget?.segment;
  const seconds = kind === 'video' ? segment?.seconds ?? null : null;
  const result = { kind, episode, key, frame, dialect, status, seconds, chars, refs, output, file, line };
  if (!active(block)) return result;

  const add = (rule, message, options) => findings.push(finding(rule, file, message, { line, excerpt: key, ...options }));
  const suggest = (rule, message, options) => add(rule, message, { level: 'suggest', ...options });
  const fieldLine = field => block.fields.get(field)?.line ?? line;
  if (!text && !(kind === 'ref' && block.source === '外部')) {
    add('pr-prompt-missing', '缺少非空 prompt 围栏', { line: prompt?.line ?? line });
  }
  let involved = [];
  if (kind === 'ref') {
    const matches = data.assets.items.filter(asset => asset.key === block.object);
    if (matches.length === 1) involved = matches;
    else add('pr-asset', '参考图对象缺失或不在视觉资产库中', { line: fieldLine('对象'), excerpt: block.object });
  } else if (!segment) {
    add('pr-target', '提示词目标在本集分镜中不存在或不唯一', { hint: '核对本集分镜 ID' });
  } else {
    involved = referencedAssets(segment, kind === 'image' ? [frameTarget.shot] : segment.shots, episode, data);
  }
  const refNames = new Set();
  const frameAssets = new Set();
  for (const ref of refs) {
    const candidates = referenceCandidates(ref, block, indexes);
    const loc = { line: fieldLine('参考图'), excerpt: ref };
    if (!candidates.length || (REF_ID.test(ref) && candidates.length > 1)) {
      add('pr-ref', '参考图引用非法、缺失、已作废或不唯一', { ...loc, hint: '引用有效的参考图或本集对应帧图' });
      continue;
    }
    if (['approved', 'done'].includes(status) && !candidates.some(item => item.status === 'done')) {
      suggest('pr-ref-not-ready', '引用的参考图还没有产出', loc);
    }
    if (REF_ID.test(ref)) {
      const object = candidates[0].object;
      const name = assetKey(object)?.name;
      if (name && data.assets.items.some(item => item.key === object)) refNames.add(name);
    } else if (kind === 'video') {
      const target = index.shots.get(candidates[0].key);
      if (target) for (const item of referencedAssets(target.segment, [target.shot], episode, data)) frameAssets.add(item);
    }
  }
  if (status === 'done' && !producedFile(root, base, output)) {
    add('pr-file', '已出块缺少有效的短剧目录内产物文件', { line: fieldLine('文件'), excerpt: output });
  }

  for (const fence of [prompt, negative]) {
    matchText(fence, internal, add, 'pr-internal-ref', '提示词出现内部编号、文件名或项目路径', '改用画面中的事物描述');
    matchText(fence, settings.desensitize, add, 'pr-desensitize', '提示词出现禁用词或需脱敏文字', '删去该词或改用虚构称呼');
  }
  const normalized = normalizeLock(text);
  for (const asset of involved) {
    if (refNames.has(asset.name) || frameAssets.has(asset)) continue;
    for (const lock of asset.fields.locks ?? []) if (!lock.some(word => normalized.includes(normalizeLock(word)))) {
      suggest('pr-lock', `缺少「${asset.key}」的锁定词`, { line: prompt?.line ?? line, excerpt: lock.join('='),
        hint: '原字写入任一种写法，或引用该资产的参考图' });
    }
  }
  for (const fence of [prompt, negative]) {
    if (!fence?.end) continue;
    const normalized = normalizeLock(fence.content);
    for (const { asset, from } of settings.gated.get(episode) ?? []) for (const lock of asset.fields.locks ?? []) {
      const word = lock.find(word => normalized.includes(normalizeLock(word)));
      if (word) add('pr-spoiler', `「${asset.key}」${from === null ? '尚不可用' : `最早第${from}集可用`}`,
        { line: fence.line, excerpt: word, hint: '删去会提前揭示真相的锁定词' });
    }
  }
  if (kind === 'video' && segment && settings.config.dialogue_check) {
    const normalized = withoutWhitespace(text);
    for (const shot of segment.shots) for (const row of shot.dialogue) {
      const speech = withoutWhitespace(row.text);
      if (!row.os && !row.vo && row.role !== '旁白' && row.role !== '字幕' && !normalized.includes(speech)) {
        add('pr-dialogue', '视频提示词缺少本段的逐字台词片段', { line: prompt?.line ?? line, excerpt: speech,
          hint: '从分镜复制台词，或为后期配音关闭检查' });
      }
    }
  }
  const known = Object.hasOwn(settings.config.dialects, dialect);
  if (DIALECT_ID.test(dialect ?? '') && dialect !== 'generic' && !known) {
    const unknown = `${file}:${dialect}`;
    if (!settings.unknown.has(unknown)) suggest('pr-dialect-unknown', '未登记的方言：只按通用规则检查', { excerpt: dialect });
    settings.unknown.add(unknown);
  }
  const rules = known ? settings.config.dialects[dialect] : {};
  const type = kind === 'video' ? 'video' : 'image';
  const maxChars = Object.hasOwn(rules, 'max_chars') ? rules.max_chars : settings.config[type].max_chars;
  if (maxChars !== null && chars > maxChars) suggest('pr-length', `提示词 ${chars} 字，超过提示线 ${maxChars} 字`);
  if (seconds !== null && rules.max_seconds != null && seconds > rules.max_seconds) {
    suggest('pr-seconds', `段时长 ${seconds} 秒超过方言上限 ${rules.max_seconds} 秒`);
  }
  if (rules.max_refs != null && refs.length > rules.max_refs) suggest('pr-refs-max', `参考图 ${refs.length} 张，超过方言上限 ${rules.max_refs} 张`);
  matchText(prompt, settings.forbid.get(dialect) ?? [], suggest, 'pr-forbid', '提示词命中该方言的禁用写法', '改用该方言容许的写法');
  return result;
}

function counts(items) {
  return Object.fromEntries(Object.keys(PROMPT_STATUS).map(status => [status, items.filter(item => item.status === status).length]));
}

function indexRefs(files) {
  const refs = new Map();
  const frames = new Map();
  const push = (map, key, item) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  };
  for (const doc of files) for (const item of doc.items.filter(active)) {
    if (item.kind === 'ref') push(refs, item.key, item);
    else if (item.kind === 'image') {
      if (!frames.has(item.episode)) frames.set(item.episode, new Map());
      push(frames.get(item.episode), `${item.key}:${item.frame}`, item);
    }
  }
  return { refs, frames };
}

/** 只检查提示词，不复报分镜及资产自身的结构问题。 */
export function checkPrompts(root, slug, opts = {}) {
  failLevel(opts.failOn);
  const range = selectedEpisodeRange(opts.ep);
  const config = opts.config ?? requireConfig(root).config;
  const base = seriesBase(root, slug);
  const data = snapshot(root, base);
  const dir = `${base}/prompts`;
  const read = file => readParsed(root, file, parsePromptFile, { config: config.prompts, metadata: data.assets.metadata });
  const refsDoc = read(`${dir}/assets-image.md`);
  const episodes = new Map();
  const files = [refsDoc];
  for (const file of filesIn(root, dir, /^ep.*-(image|video)\.md$/)) {
    const kind = promptFileKind(file);
    if (!numberInRange(file, range, `-${kind}`)) continue;
    const doc = read(file);
    files.push(doc);
    const ep = episodeFileNumber(file, `-${kind}`);
    if (ep === null) continue;
    if (!episodes.has(ep)) episodes.set(ep, { episode: ep, image: null, video: null,
      storyboard: loadStoryboard(root, base, ep).items[0] });
    const slot = episodes.get(ep);
    const summary = { file, blocks: doc.items.length, by_status: counts(doc.items) };
    if (kind === 'video') {
      const segments = new Set(slot.storyboard?.segments.map(item => item.key) ?? []);
      summary.segments = segments.size;
      summary.segments_covered = new Set(doc.items.filter(item => active(item) && segments.has(item.key)).map(item => item.key)).size;
    }
    // 规范名优先用于汇总；格式错误的其他文件仍会逐个报告。
    if (!slot[kind] || file === `${dir}/ep${String(ep).padStart(3, '0')}-${kind}.md`) slot[kind] = summary;
  }
  const settings = { config: config.prompts, desensitize: desensitizePatterns(config.lint),
    forbid: forbidPatterns(config.prompts), unknown: new Set(), gated: new Map() };
  const gates = data.assets.items.map(asset => ({ asset, from: usableFrom(asset, data.map.items) }));
  const targets = new Map();
  for (const [ep, row] of episodes) {
    settings.gated.set(ep, gates.filter(({ from }) => from === null || from > ep));
    targets.set(ep, targetIndex(row.storyboard));
  }
  const indexes = indexRefs(files);
  const findings = files.flatMap(doc => doc.errors);
  const blocks = files.flatMap(doc => doc.items.map(block => checkBlock(root, base, block,
    targets.get(block.episode) ?? targetIndex(), data, settings, indexes, findings)))
    .sort((a, b) => lexical(a.file, b.file) || a.line - b.line);
  const refs = { file: refsDoc.file, exists: refsDoc.exists, by_status: counts(refsDoc.items) };
  const report = checkSummary({ blocks: blocks.length }, findings);
  return { series: slug, refs, episodes: [...episodes.values()].sort((a, b) => a.episode - b.episode)
    .map(({ episode, image, video }) => ({ episode, image, video })), blocks, ...report, ok: checkExit(report, opts.failOn) === EXIT.OK };
}

const usage = '用法：node scripts/prompt-check.mjs <短剧名> [--ep N|N-M] [--fail-on block|suggest] [--root DIR] [--json]';

export async function main(argv) {
  return runCli('prompt-check', argv, { ep: { type: 'string' }, 'fail-on': { type: 'string' } },
    usage, (root, values, args) => {
      if (args.length !== 1) throw new Error(usage);
      const { config, found } = requireConfig(root);
      const fields = checkPrompts(root, args[0], { config, ep: values.ep, failOn: values['fail-on'] });
      const text = [`# 提示词检查：${fields.series}`, ...fields.episodes.map(({ episode, image, video }) =>
        `第${episode}集：图片 ${image?.blocks ?? 0} 块，视频 ${video?.blocks ?? 0} 块（段覆盖 ${video?.segments_covered ?? 0}/${video?.segments ?? 0}）`),
      `检查 ${fields.summary.blocks} 块，其中参考图 ${Object.values(fields.refs.by_status).reduce((sum, n) => sum + n, 0)} 块。`,
      ...findingLines(fields)].join('\n');
      return { fields, text, code: checkExit(fields, values['fail-on']), found };
    });
}

await directMain(import.meta.url, main);
