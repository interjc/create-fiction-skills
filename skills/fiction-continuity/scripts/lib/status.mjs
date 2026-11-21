import { statSync } from 'node:fs';
import path from 'node:path';
import { directMain, finding, runCli, sortFindings } from './cli.mjs';
import { requireConfig } from './config.mjs';
import { parseEpisode, parseSeries } from './drama.mjs';
import { entries, listChapters, parseRanges, selectCanonical } from './project.mjs';
import { episodeFileNumber, episodeFilename, parsePromptFile, parseStoryboard, parseVisualAssets } from './visual.mjs';
import { filesIn, readParsed } from './visual-project.mjs';

const STAGES = ['empty', 'bible', 'novel', 'script', 'storyboard', 'prompts'];
const episodeRule = new Set(['ep-title', 'ep-meta', 'scene-header', 'bad-line']);

function hasBible(root, dir = 'bible') {
  return entries(path.join(root, dir)).some(entry => (entry.isFile() && entry.name.endsWith('.md'))
    || (entry.isDirectory() && hasBible(root, `${dir}/${entry.name}`)));
}

function fileExists(root, file) {
  return Boolean(statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile());
}

function watch(warnings, file, operation, fallback, { rules, line = null } = {}) {
  try {
    const value = operation();
    warnings.push(...(value?.errors ?? []).filter(error => error.level === 'block' && (!rules || rules.has(error.rule))));
    return value;
  } catch (error) {
    warnings.push(finding('status-parse', error.file ?? file, error.code ? `无法读取：${error.code}` : error.message,
      { line: error.line ?? line }));
    return fallback;
  }
}

function novelStatus(root, config, warnings) {
  const bible = watch(warnings, 'bible', () => hasBible(root), false);
  const entries = watch(warnings, 'chapters', () => listChapters(root, { resolveCanonical: false }), []);
  const chapters = entries.filter(({ dir, drafts }) => watch(warnings, `${dir}/outline.md`,
    () => selectCanonical(root, dir, drafts), null));
  const ranges = parseRanges(config.frozen.ranges);
  const frozen = chapters.filter(({ chapter }) => ranges.some(({ start, end }) => chapter >= start && chapter <= end)).length;
  return { bible, chapters: chapters.length, last_chapter: chapters.at(-1)?.chapter ?? null, frozen };
}

function promptStatus(items) {
  return { blocks: items.filter(item => item.status !== 'void').length,
    approved: items.filter(item => item.status === 'approved').length, done: items.filter(item => item.status === 'done').length };
}

function seriesStatus(root, series, config, warnings) {
  const base = `drama/${series}`;
  const read = (file, parser, options, rules) =>
    watch(warnings, file, () => readParsed(root, file, parser, options), { items: [] }, { rules });
  const { items: [meta] } = read(`${base}/series.md`, parseSeries);
  const assetsPath = `${base}/visual/assets.md`;
  const assets = watch(warnings, assetsPath, () => fileExists(root, assetsPath), false);
  const assetMetadata = assets ? watch(warnings, assetsPath,
    () => readParsed(root, assetsPath, parseVisualAssets).metadata, undefined) : undefined;
  const promptOpts = { config: config.prompts, metadata: assetMetadata };
  const refs = promptStatus(read(`${base}/prompts/assets-image.md`, parsePromptFile, promptOpts).items);
  const definitions = [
    ['episodes', 'script', '', 'script', parseEpisode, { hookRequired: false }, episodeRule],
    ['storyboards', 'storyboard', '', 'storyboard', parseStoryboard],
    ['prompts', 'image', '-image', 'prompts', parsePromptFile, promptOpts],
    ['prompts', 'video', '-video', 'prompts', parsePromptFile, promptOpts],
  ];
  const episodes = new Map();
  let stage = null;
  for (const [folder, key, suffix, stageName, parser, options, rules] of definitions) {
    const dir = `${base}/${folder}`;
    const paths = watch(warnings, dir, () => filesIn(root, dir, new RegExp(`^ep.*${suffix}\\.md$`)), []);
    if (paths.length) stage = stageName;
    for (const file of paths) {
      const episode = episodeFileNumber(file, suffix);
      const doc = read(file, parser, options, rules);
      if (episode === null) continue;
      if (!episodes.has(episode)) episodes.set(episode, { episode, script: null, storyboard: null, image: null, video: null });
      if (file !== `${dir}/${episodeFilename(episode, suffix)}`) continue;
      const item = doc.items[0];
      if (key === 'script' && item?.status === null) {
        warnings.push(finding('status-parse', file, '剧本状态非法或重复'));
      }
      episodes.get(episode)[key] = suffix ? promptStatus(doc.items) : item?.status ?? null;
    }
  }
  return { series, title: meta?.title ?? null, total: meta?.total ?? null, stage, assets,
    refs: { total: refs.blocks, done: refs.done }, episodes: [...episodes.values()].sort((a, b) => a.episode - b.episode) };
}

/** 以文件存在判定阶段，不将解析告警升级为内容验收失败。 */
export function pipelineStatus(root, opts = {}) {
  const config = opts.config ?? requireConfig(root).config;
  const warnings = [];
  const novel = novelStatus(root, config, warnings);
  const series = watch(warnings, 'drama', () => entries(path.join(root, 'drama')), [])
    .filter(entry => entry.isDirectory() && /^[a-z0-9][a-z0-9-]*$/.test(entry.name))
    .map(entry => seriesStatus(root, entry.name, config, warnings));
  const initial = novel.chapters ? 'novel' : novel.bible ? 'bible' : 'empty';
  const stage = series.reduce((stage, item) => STAGES.indexOf(item.stage) > STAGES.indexOf(stage) ? item.stage : stage, initial);
  return { target: config.workflow.target, stage, novel, series, warnings: sortFindings(warnings)
    .map(item => `${item.file}${item.line ? `:${item.line}` : ''}：${item.message}`) };
}

function render({ target, stage, novel, series, warnings }) {
  const status = value => ({ draft: '初稿', revised: '修改', final: '定稿' })[value] ?? '—';
  const prompt = value => value === null ? '—' : `${value.blocks} 块（已确认 ${value.approved}，已出 ${value.done}）`;
  const lines = [`阶段：${stage}（目标：${target ?? '未设定'}）`,
    `小说：故事档案${novel.bible ? '已建' : '未建'}，定稿 ${novel.chapters} 章，末章 ${novel.last_chapter ?? '—'}，冻结 ${novel.frozen} 章。`];
  for (const item of series) {
    lines.push('', `### ${item.title ?? item.series}（${item.stage ?? '未开始'}；总集数 ${item.total ?? '未设定'}）`,
      `视觉资产：${item.assets ? '已建' : '未建'}；参考图：已出 ${item.refs.done}/${item.refs.total}。`, '',
      '| 集 | 剧本 | 分镜 | 图片提示词 | 视频提示词 |', '|---|---|---|---|---|');
    for (const row of item.episodes) {
      lines.push(`| ${row.episode} | ${status(row.script)} | ${status(row.storyboard)} | ${prompt(row.image)} | ${prompt(row.video)} |`);
    }
  }
  if (warnings.length) lines.push('', '解析提醒：', ...warnings.map(warning => `- ${warning}`));
  return lines.join('\n');
}

const usage = '用法：node scripts/status.mjs [--root DIR] [--json]';

export async function main(argv) {
  return runCli('status', argv, {}, usage, (root, values, args) => {
    if (args.length) throw new Error(usage);
    const { config, found } = requireConfig(root);
    const fields = pipelineStatus(root, { config });
    return { fields, text: render(fields), found };
  });
}

await directMain(import.meta.url, main);
