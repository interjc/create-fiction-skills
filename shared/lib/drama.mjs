import path from 'node:path';
import { finding, sortFindings } from './cli.mjs';
import { parseAction, singleChapter, tableRows } from './bible.mjs';
import { cell, HOOK_ORDER, linesOf, maskComments, parseChapterList, parseFields, parseMarkers, splitList } from './md.mjs';

function report(file) {
  const items = [];
  const errors = [];
  return {
    add: (item, line) => items.push({ ...item, file, line }),
    error: (line, message, options) => errors.push(finding('parse', file, message, { line, ...options })),
    rule: (rule, line, message, options) => errors.push(finding(rule, file, message, { line, ...options })),
    finish: () => ({ items, errors: sortFindings(errors) }),
  };
}

function positive(value) {
  return /^\d+$/.test(value ?? '') && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
}

function fieldsOf(lines, output, keys) {
  const fields = new Map();
  for (const entry of parseFields(lines)) {
    if (!keys.includes(entry.key)) continue;
    if (fields.has(entry.key)) output.error(entry.line, `字段重复：${entry.key}`);
    else fields.set(entry.key, entry);
  }
  return fields;
}

/** 解析短剧总设定；允许创作中的总集数、时长、免费集数尚未填写。 */
export function parseSeries(text, file = 'series.md') {
  const output = report(file);
  const lines = linesOf(maskComments(text));
  const title = /^# (\S.*)$/.exec(lines[0].trimEnd());
  if (!title) output.error(1, '短剧总设定首行须为「# 剧名」');
  const nextSection = lines.findIndex((line, i) => i > 0 && /^#{1,6}\s/.test(line));
  const keys = ['来源', '总集数', '单集时长', '免费集数', '目标平台', '题材', '一句话梗概', '主要人物'];
  const fields = fieldsOf(nextSection === -1 ? lines : lines.slice(0, nextSection), output, keys);
  const get = key => cell(fields.get(key)?.value);
  const count = key => {
    const value = get(key);
    const n = positive(value);
    if (value !== null && n === null) output.error(fields.get(key).line, `${key}须为正整数`);
    return n;
  };
  const source = get('来源');
  if (source !== null && !['原创', '改编'].includes(source)) output.error(fields.get('来源').line, '来源须为原创或改编');
  let duration = null;
  const durationText = get('单集时长');
  if (durationText !== null) {
    const match = /^(\d+)\s*[-–—~～]\s*(\d+)$/.exec(durationText);
    const start = positive(match?.[1]);
    const end = positive(match?.[2]);
    if (start === null || end === null || start > end) output.error(fields.get('单集时长').line, '单集时长须为正整数秒数范围');
    else duration = [start, end];
  }
  output.add({
    title: title?.[1] ?? null, source, total: count('总集数'), duration, free: count('免费集数'),
    platform: get('目标平台'), genre: get('题材'), logline: get('一句话梗概'), characters: splitList(get('主要人物')),
  }, 1);
  return output.finish();
}

/** 解析章→集映射；保留每项动作及来源位置。 */
export function parseAdaptationMap(text, file = 'adaptation-map.md') {
  const output = report(file);
  const seen = new Set();
  tableRows(text, ['集', '来源章', '剧情点', '人物', '伏笔', '改动'], output, (row, line) => {
    const episode = singleChapter(row.集, '集');
    if (episode === 0) throw new Error('集号须为正整数');
    if (seen.has(episode)) throw new Error(`映射集号重复：${episode}`);
    seen.add(episode);
    const original = row.来源章 === '原创';
    const source_chapters = original ? [] : parseChapterList(row.来源章);
    if (!original && !source_chapters.length) throw new Error('来源章须为章号、范围、列表或「原创」');
    output.add({
      episode, original, source_chapters, plot: cell(row.剧情点), characters: splitList(row.人物),
      foreshadow_actions: splitList(row.伏笔).map(parseAction), changes: cell(row.改动),
    }, line);
  });
  return output.finish();
}

const sceneHeader = /^## 场景(\d+)：(.+)·(内|外|内外)·(日|夜|晨|昏)$/;
const dialogue = /^([^\s：:△【<（(#]{1,16})(（[^）]{1,20}）)?：(.+)$/u;
const countChars = text => Array.from(text.replace(/\s/gu, '')).length;

function lineDetails(line, lineNo, scene, output) {
  if (!line.trim()) return;
  if (line.startsWith('人物：')) {
    const people = splitList(line.slice(3));
    if (lineNo !== scene.line + 1 || !people.length) {
      output.rule('bad-line', lineNo, '人物行须紧跟场景头，且填写名单', { excerpt: line, column: 1 });
    } else scene.people = people;
    return;
  }
  if (line.startsWith('△')) {
    const text = line.slice(1).trim();
    if (!text) output.rule('bad-line', lineNo, '动作行须填写动作描述', { excerpt: line, column: 1 });
    else {
      scene.actions++;
      scene.chars += countChars(text);
    }
    return;
  }
  if (/^【[^】]+】/.test(line)) return;
  const speech = dialogue.exec(line);
  if (speech) {
    const text = speech[3].trimStart().replace(/^（[^）]*）/, '');
    scene.chars += countChars(text);
    return;
  }
  output.rule('bad-line', lineNo, '场景内行格式非法', { excerpt: line, column: 1 });
}

/** 解析单集，保留结构、计数、标记及可按集过滤的格式问题。 */
export function parseEpisode(text, file = 'ep001.md', { hookRequired = true } = {}) {
  const output = report(file);
  const visible = linesOf(maskComments(text));
  const original = linesOf(text);
  const name = path.posix.basename(file);
  const episode = positive(/^ep(\d+)\.md$/.exec(name)?.[1]);
  const title = /^# 第(\d+)集：(\S.*)$/.exec(visible[0]);
  if (!title || episode === null || name !== `ep${String(episode).padStart(3, '0')}.md` || Number(title[1]) !== episode) {
    output.rule('ep-title', 1, '分集首行标题格式非法或集号与文件名不符', { excerpt: visible[0], column: 1 });
  }
  const firstScene = visible.findIndex(line => /^ {0,3}##(?:[ \t]|$)/.test(line));
  const before = firstScene < 0 ? visible : visible.slice(0, firstScene);
  const metadata = parseFields(before).filter(field => field.key === '目标时长');
  let target_seconds = null;
  for (const [i, field] of metadata.entries()) {
    const value = positive(field.value);
    if (value === null || i > 0) {
      output.rule('ep-meta', field.line, i > 0 ? '目标时长重复' : '目标时长须为正整数', { excerpt: visible[field.line - 1] });
    } else target_seconds = value;
  }

  const scenes = [];
  let current = null;
  for (let index = firstScene; index >= 0 && index < visible.length; index++) {
    const line = visible[index];
    const number = index + 1;
    if (/^ {0,3}##(?:[ \t]|$)/.test(line)) {
      const header = sceneHeader.exec(line);
      const sceneNumber = header && Number.isSafeInteger(Number(header[1])) ? Number(header[1]) : null;
      current = { number: sceneNumber, line: number, chars: 0, people: [], actions: 0 };
      if (!header) output.rule('scene-header', number, '场景头格式非法', { excerpt: line, column: 1 });
      scenes.push(current);
    } else if (current) lineDetails(line.trimEnd(), number, current, output);
  }
  if (!scenes.some(scene => scene.number !== null)) {
    output.rule('scene-header', null, '本集没有有效场景');
  }
  for (const [i, scene] of scenes.entries()) {
    const excerpt = visible[scene.line - 1];
    if (scene.number !== null && scene.number !== i + 1) {
      output.rule('scene-number', scene.line, '场景号须从 1 连续', { excerpt, level: 'suggest' });
    }
    if (!scene.actions) output.rule('action-missing', scene.line, '场景内没有动作行', { excerpt, level: 'suggest' });
  }

  const markers = parseMarkers(text);
  const hooks = markers.filter(marker => marker.kind === 'hook');
  const paywalls = markers.filter(marker => marker.kind === 'paywall');
  if (hookRequired && !hooks.length) output.rule('hook', null, '缺少钩子标记');
  const lastContent = visible.findLastIndex(line => line.trim()) + 1;
  for (const [i, { line, column, value }] of hooks.entries()) {
    const loc = { column, excerpt: original[line - 1].trim() };
    if (!HOOK_ORDER.includes(value)) output.rule('hook', line, '钩子级别须为大写 S/A/B/C', loc);
    if (i > 0) output.rule('hook', line, '钩子标记多于一个', loc);
    if (lastContent > line) output.rule('hook', line, '钩子之后仍有剧本内容', loc);
  }
  for (const { line, column } of paywalls) {
    if (!hooks.length || line < hooks.at(-1).line || lastContent > line) {
      output.rule('paywall-placement', line, '卡点须在钩子之后，且之后无剧本内容', { column, excerpt: original[line - 1].trim() });
    }
  }
  output.add({
    episode, title: title?.[2] ?? null, scenes, chars: scenes.reduce((count, scene) => count + scene.chars, 0),
    target_seconds, hook: hooks[0]?.value ?? null, hooks, paywalls,
  }, 1);
  return output.finish();
}
