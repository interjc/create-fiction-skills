import {
  directMain, EXIT, failLevel, finding, formatFinding, integer, lexical, runCli, sortFindings,
} from './cli.mjs';
import { aliasesOf, parseCharacters, parseForeshadows } from './bible.mjs';
import { requireConfig } from './config.mjs';
import { parseAdaptationMap, parseEpisode, parseSeries } from './drama.mjs';
import { HOOK_ORDER } from './md.mjs';
import { listChapters, readOptional, seriesEpisodeFiles } from './project.mjs';

function read(root, file, parser, options) {
  const text = readOptional(root, file);
  if (text === null) throw new Error(`未找到文件：${file}`);
  return parser(text, file, options);
}

function selectedEpisodeRange(value) {
  if (value === undefined) return null;
  const match = /^(\d+)(?:-(\d+))?$/.exec(value);
  if (!match) throw new Error(`--ep 值非法：${value}`);
  const start = integer(match[1], '集号', 1);
  const end = integer(match[2] ?? match[1], '集号', 1);
  if (start > end) throw new Error(`--ep 范围倒序：${value}`);
  return [start, end];
}

function checkEpisode(item, series, config, findings) {
  const { episode, file, title, chars, target_seconds } = item;
  const scenes = item.scenes.length;
  const est_seconds = Math.round(chars * 60 / config.chars_per_minute);
  const tier = config.tiers.find(t => t.max_seconds === null || t.max_seconds >= est_seconds)?.id ?? null;
  const range = target_seconds === null ? series.duration
    : [Math.round(0.8 * target_seconds), Math.round(1.2 * target_seconds)];
  if (scenes > config.max_scenes) findings.push(finding('max-scenes', file, `场景数 ${scenes} 超过 ${config.max_scenes}`, { level: 'suggest' }));
  if (range && (est_seconds < range[0] || est_seconds > range[1])) {
    findings.push(finding('length', file, `估算时长 ${est_seconds} 秒不在 ${range[0]}-${range[1]} 秒内`, { level: config.length_level }));
  }
  return { episode, file, title, scenes, chars, est_seconds, tier, range, hook: item.hook, paywall: item.paywalls.length > 0 };
}

function checkSeriesSize(episodes, series, findings) {
  let previous = 0;
  for (const { episode } of episodes) {
    if (episode > previous + 1) {
      const range = previous + 1 === episode - 1 ? String(previous + 1) : `${previous + 1}-${episode - 1}`;
      findings.push(finding('episode-gap', series.file, `缺少第${range}集`, { level: 'suggest' }));
    }
    previous = episode;
  }
  if (series.total !== null && episodes.length > series.total) {
    findings.push(finding('episode-total', series.file, `已写 ${episodes.length} 集，超过计划的 ${series.total} 集`, { level: 'suggest' }));
  }
}

function checkPaywall(episodes, series, config, findings) {
  const walls = episodes.filter(item => item.paywalls.length);
  const first = walls[0]?.episode ?? null;
  const total = series.total;
  const ratio = first !== null && total !== null ? first / total : null;
  const add = (rule, message, { file = series.file, level = 'block', line = null } = {}) => {
    findings.push(finding(rule, file, message, { level, line }));
  };
  const [min, max] = config.first_at;
  if (first === null && (episodes.at(-1)?.episode ?? 0) >= max) {
    add('paywall-missing', `已写至第${max}集或之后，但缺少卡点`);
  }
  if (first !== null && (first < min || first > max)) {
    add('paywall-position', `首个卡点第${first}集不在 ${min}-${max} 集内`, {
      file: walls[0].file, line: walls[0].paywalls[0].line,
    });
  }
  const [ratioMin, ratioMax] = config.free_ratio;
  if (ratio !== null && (ratio < ratioMin || ratio > ratioMax)) {
    add('paywall-ratio', `免费集数比例不在 ${ratioMin}-${ratioMax} 内`, { level: 'suggest' });
  }
  for (const item of walls) {
    const hook = HOOK_ORDER.indexOf(item.hook);
    if (hook === -1 || hook > HOOK_ORDER.indexOf(config.hook_min)) {
      add('paywall-hook', `卡点集钩子不得低于 ${config.hook_min}`, { file: item.file, line: item.paywalls[0].line });
    }
  }
  if (first !== null && series.free !== null && series.free !== first) {
    add('paywall-plan', `计划免费 ${series.free} 集，首个卡点在第${first}集`, { level: 'suggest' });
  }
  return { first, all: walls.map(item => item.episode), total, ratio: ratio === null ? null : Number(ratio.toFixed(3)) };
}

function checkMap(root, series, episodes, rows, findings, file) {
  const characters = read(root, 'bible/characters.md', parseCharacters);
  const foreshadows = read(root, 'bible/foreshadows.md', parseForeshadows);
  findings.push(...characters.errors, ...foreshadows.errors);
  const aliases = aliasesOf(characters.items);
  const fs = new Set(foreshadows.items.map(item => item.id));
  const sourceRefs = new Set(rows.flatMap(item => item.source_chapters));
  const chapters = new Set(listChapters(root, { resolveCanonical: ch => sourceRefs.has(ch) })
    .filter(item => item.canonical).map(item => item.chapter));
  const mapped = new Set(rows.map(item => item.episode));
  for (const item of episodes) {
    if (!mapped.has(item.episode)) {
      findings.push(finding('map-missing', item.file, `改编映射缺少第${item.episode}集`, { level: 'suggest' }));
    }
  }
  const fsEvents = new Map();
  const add = (rule, message, level, line, id = null) => findings.push(finding(rule, file, message, { level, line, id }));
  for (const row of rows.toSorted((a, b) => a.episode - b.episode)) {
    for (const name of new Set(row.characters)) {
      if (!aliases.has(name)) add('map-character', `改编映射引用未知人物：${name}`, 'suggest', row.line);
    }
    for (const ch of row.source_chapters) {
      if (!chapters.has(ch)) add('map-source', `来源第${ch}章没有定稿`, 'suggest', row.line);
    }
    for (const { action, id } of row.foreshadow_actions) {
      if (!fs.has(id)) {
        add('map-foreshadow', `改编映射引用未知伏笔：${id}`, 'block', row.line, id);
        continue;
      }
      if (!fsEvents.has(id)) fsEvents.set(id, { plant: [], resolve: [], drop: [] });
      if (action !== 'touch') fsEvents.get(id)[action].push(row);
    }
  }
  for (const [id, { plant, resolve, drop }] of [...fsEvents].sort(([a], [b]) => lexical(a, b))) {
    for (const item of resolve) {
      if (!plant.length) add('map-order', `${id} 只收未埋`, 'suggest', item.line, id);
      else if (item.episode < plant[0].episode) add('map-order', `${id} 回收集早于埋设集`, 'block', item.line, id);
    }
    if (episodes.length === series.total && plant.length && !resolve.length && !drop.length) {
      add('map-unresolved', `已完成全部剧集，但 ${id} 未收也未弃`, 'suggest', plant[0].line, id);
    }
  }
}

/** 从 Markdown 快照检查短剧；不写入项目或输出。 */
export function checkSeries(root, slug, opts = {}) {
  const config = opts.config ?? requireConfig(root).config;
  const threshold = failLevel(opts.failOn);
  const range = selectedEpisodeRange(opts.ep);
  const paths = seriesEpisodeFiles(root, slug).filter(file => /\/ep[^/]*\.md$/.test(file));
  const base = `drama/${slug}`;
  const seriesData = read(root, `${base}/series.md`, parseSeries);
  const mapFile = `${base}/adaptation-map.md`;
  const map = read(root, mapFile, parseAdaptationMap);
  const series = seriesData.items[0];
  const findings = [...seriesData.errors, ...map.errors];
  const seen = new Set();
  const all = [];
  const selected = [];
  for (const file of paths) {
    const { items: [item], errors } = read(root, file, parseEpisode, { hookRequired: config.drama.hook.required });
    if (item.episode === null) {
      if (!range) findings.push(...errors);
      else findings.push(...errors.filter(error => error.rule === 'paywall-placement'));
      continue;
    }
    if (seen.has(item.episode)) throw new Error(`短剧 ${slug} 的第${item.episode}集存在多个文件`);
    seen.add(item.episode);
    all.push(item);
    const within = !range || (item.episode >= range[0] && item.episode <= range[1]);
    findings.push(...errors.filter(error => within || error.rule === 'paywall-placement'));
    if (within) selected.push(item);
  }
  all.sort((a, b) => a.episode - b.episode);
  selected.sort((a, b) => a.episode - b.episode);
  if (range && !selected.length) throw new Error(`所选范围没有分集剧本：${opts.ep}`);
  const episodes = selected.map(item => checkEpisode(item, series, config.drama, findings));
  checkSeriesSize(all, series, findings);
  const paywall = checkPaywall(all, series, config.drama.paywall, findings);
  checkMap(root, series, all, map.items, findings, mapFile);
  const summary = {
    episodes: episodes.length,
    block: findings.filter(f => f.level === 'block').length,
    suggest: findings.filter(f => f.level === 'suggest').length,
  };
  return { series: slug, episodes, paywall, findings: sortFindings(findings), summary,
    ok: !(summary.block || (threshold === 'suggest' && summary.suggest)) };
}

function render(result) {
  const { series, episodes, paywall, findings, summary } = result;
  return [
    `# 短剧检查：${series}`,
    ...episodes.map(item => `第${item.episode}集 ${item.title ?? ''}：${item.scenes} 场，${item.chars} 字，`
      + `估算 ${item.est_seconds} 秒（${item.tier ?? '无档位'}）`),
    `首个卡点：${paywall.first === null ? '（无）' : `第${paywall.first}集`}`,
    ...findings.map(formatFinding),
    `检查 ${summary.episodes} 集：阻断 ${summary.block}，建议 ${summary.suggest}。`,
  ].join('\n');
}

const usage = '用法：node scripts/drama-check.mjs <短剧名> [--ep N|N-M] [--fail-on block|suggest] [--root DIR] [--json]';

/** 命令行入口：检查分集剧本及全剧映射、付费卡点。 */
export async function main(argv) {
  const options = { ep: { type: 'string' }, 'fail-on': { type: 'string' } };
  return runCli('drama-check', argv, options, usage, (root, values, args) => {
    if (args.length !== 1) throw new Error(usage);
    const { config, found } = requireConfig(root);
    const { ok, ...fields } = checkSeries(root, args[0], { ep: values.ep, failOn: values['fail-on'], config });
    return { fields, text: render(fields), code: ok ? EXIT.OK : EXIT.FAIL, found };
  });
}

await directMain(import.meta.url, main);
