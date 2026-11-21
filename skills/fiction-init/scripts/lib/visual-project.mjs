import path from 'node:path';
import { aliasesOf, parseCharacters } from './bible.mjs';
import { EXIT, failLevel, formatFinding, sortFindings } from './cli.mjs';
import { parseAdaptationMap, parseEpisode, parseSeries } from './drama.mjs';
import { entries, readOptional } from './project.mjs';
import { episodeFileNumber, episodeFilename, parseContinuity, parseStoryboard, parseVisualAssets } from './visual.mjs';

/** 检查短剧入口并定位其主设定；未建任何后续目录也可以检查。 */
export function seriesBase(root, slug) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug ?? '')) throw new Error(`短剧名非法：${slug ?? ''}`);
  const base = `drama/${slug}`;
  if (readOptional(root, `${base}/series.md`) === null) throw new Error(`未找到短剧：${slug}`);
  return base;
}

export function filesIn(root, dir, pattern) {
  return entries(path.join(root, dir)).filter(entry => entry.isFile() && pattern.test(entry.name))
    .map(entry => `${dir}/${entry.name}`);
}

export function readParsed(root, file, parser, opts) {
  const text = readOptional(root, file);
  return text === null ? { file, exists: false, items: [], errors: [] }
    : { file, exists: true, ...parser(text, file, opts) };
}

export function snapshot(root, base) {
  const series = readParsed(root, `${base}/series.md`, parseSeries);
  const map = readParsed(root, `${base}/adaptation-map.md`, parseAdaptationMap);
  const assets = readParsed(root, `${base}/visual/assets.md`, parseVisualAssets);
  const continuity = readParsed(root, `${base}/visual/continuity.md`, parseContinuity);
  const characters = readParsed(root, 'bible/characters.md', parseCharacters);
  return { series, map, assets, continuity, characters, aliases: aliasesOf(characters.items) };
}

export function inEpisodeRange(episode, range) {
  return !range || (episode !== null && episode >= range[0] && episode <= range[1]);
}

export function numberInRange(file, range, suffix) {
  return inEpisodeRange(episodeFileNumber(file, suffix), range);
}

export function loadEpisode(root, base, episode, drama) {
  return readParsed(root, `${base}/episodes/${episodeFilename(episode)}`, parseEpisode, { hookRequired: drama.hook.required });
}

export function loadStoryboard(root, base, episode) {
  return readParsed(root, `${base}/storyboards/${episodeFilename(episode)}`, parseStoryboard);
}

export function checkSummary(counts, findings) {
  const summary = { ...counts, block: findings.filter(f => f.level === 'block').length,
    suggest: findings.filter(f => f.level === 'suggest').length };
  return { ok: summary.block === 0, summary, findings: sortFindings(findings) };
}

export function checkExit({ ok, summary }, failOn) {
  return !ok || (failLevel(failOn) === 'suggest' && summary.suggest) ? EXIT.FAIL : EXIT.OK;
}

export function findingLines({ findings, summary }) {
  return [...findings.map(formatFinding), `阻断 ${summary.block}，建议 ${summary.suggest}。`];
}
