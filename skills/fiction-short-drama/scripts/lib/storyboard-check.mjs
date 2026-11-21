import { parseForeshadows, parseInventory } from './bible.mjs';
import { directMain, failLevel, finding, integer, lexical, runCli } from './cli.mjs';
import { requireConfig } from './config.mjs';
import { countChars, selectedEpisodeRange, withoutWhitespace } from './drama.mjs';
import { ASSET_GROUPS, assetKey, parseStoryboard, priorContinuity, resolveAsset, usableFrom } from './visual.mjs';
import { checkExit, checkSummary, filesIn, findingLines, loadEpisode, numberInRange, readParsed, seriesBase, snapshot } from './visual-project.mjs';

function load(root, slug) {
  const base = seriesBase(root, slug);
  return { base, ...snapshot(root, base),
    foreshadows: readParsed(root, 'bible/foreshadows.md', parseForeshadows),
    inventory: readParsed(root, 'bible/inventory.md', parseInventory) };
}

function checkAssets(data, paths, findings) {
  const { assets, aliases, inventory, foreshadows, continuity } = data;
  const names = new Set(foreshadows.items.map(item => item.id));
  const itemIds = new Set(inventory.items.map(item => item.id));
  if (!assets.exists && paths.length) {
    findings.push(finding('va-missing', assets.file, '有分镜但没有视觉资产库', { level: 'suggest', hint: '建立 visual/assets.md' }));
  }
  for (const item of assets.items) {
    const add = (rule, message, options) => findings.push(finding(rule, item.file, message,
      { line: item.line, excerpt: item.key, ...options }));
    if (item.group === '人物') {
      const name = aliases.get(item.name);
      if (name !== item.name) add('va-character', name ? '视觉资产使用了人物别名' : '人物不在人物档案中',
        { level: 'suggest', hint: name ? `改用规范名：${name}` : '核对人物档案' });
    }
    const id = item.fields.item;
    if (item.own.has('item') && item.group === '道具' && /^I\d{3,}$/.test(id ?? '') && !itemIds.has(id)) {
      add('va-item', '物品不在物品表中', { line: item.own.get('item').line, excerpt: id });
    }
    if (item.own.has('reveals')) {
      for (const id of item.fields.reveals.filter(id => /^F\d{3,}$/.test(id) && !names.has(id))) {
        add('va-reveal', '揭示伏笔不在伏笔表中', { line: item.own.get('reveals').line, excerpt: id });
      }
    }
  }
  for (const row of continuity.items) {
    const { object, variant, file, line } = row;
    const base = assets.items.filter(item => item.key === object && item.variant === null);
    if (base.length === 0 || (variant !== null && variant !== '本体' && variant !== '退场'
      && !assets.items.some(item => item.name === object && item.variant === variant))) {
      findings.push(finding('vc-asset', file, '连戏对象或变体不在视觉资产库中',
        { line, excerpt: variant ? `${object}@${variant}` : object }));
    }
  }
}

function checkReference(key, group, scene, shot, sb, data, findings) {
  const line = shot?.fields.get(group)?.line ?? shot?.line ?? scene.fields.get('地点')?.line ?? scene.line;
  const add = (rule, message, options) => findings.push(finding(rule, sb.file, message, { line, excerpt: key, ...options }));
  const parts = assetKey(key);
  if (group === '人物' && !data.aliases.has(parts?.name)) {
    add('sb-character', '入画人物不在人物档案中', { level: 'suggest', hint: '核对人物规范名或别名' });
  }
  if (!data.assets.exists) return;
  const { entry, current, allowed, explicit, key: resolved } = resolveAsset(key, sb.episode, data.assets.items, data.continuity.items);
  // 地点在段里只登记一次；连戏例外的备注则属于单镜。
  if (group !== '地点' || !shot) {
    if (!entry || entry.group !== group) {
      add('sb-asset', `「${resolved}」不在资产组「${group}」中`, { hint: '检查资产键和当前变体' });
    } else {
      const available = usableFrom(entry, data.map.items);
      if (available === null || available > sb.episode) {
        add('sb-spoiler', available === null ? `「${resolved}」尚不可入画` : `「${resolved}」最早第${available}集可入画`,
          { hint: '改用未揭示真相的资产' });
      }
    }
  }
  if (shot && !shot.note && allowed.size && (explicit ? !allowed.has(parts.variant) : current === '退场' && allowed.size === 1)) {
    add('sb-continuity', `资产与本集连戏状态不符：${[...allowed].join('、')}`,
      { level: 'suggest', hint: '改用本集允许的变体；有意打破连戏时写备注' });
  }
}

/** §11.2：错行不消耗指针或缓冲；仅空缓冲时可跳过未认领的剧本行。 */
function matchDialogue(expected, drawn, aliases) {
  const role = row => ['旁白', '字幕'].includes(row.role) ? row.role : aliases.get(row.role) ?? row.role;
  const normalize = row => ({ ...row, role: role(row), text: withoutWhitespace(row.text) });
  const E = expected.map(normalize);
  const D = drawn.map(normalize);
  const issues = [];
  let i = 0;
  let buf = '';
  let matched = 0;
  for (const d of D) {
    if (!(i < E.length && d.role === E[i].role && E[i].text.startsWith(buf + d.text))) {
      const j = buf === '' ? E.findIndex((e, index) => index > i && e.role === d.role && e.text.startsWith(d.text)) : -1;
      if (j === -1) {
        issues.push({ kind: 'mismatch', row: d });
        continue;
      }
      while (i < j) issues.push({ kind: 'missing', row: E[i++] });
    }
    buf += d.text;
    if (buf === E[i].text) {
      i++;
      matched++;
      buf = '';
    }
  }
  if (buf !== '') issues.push({ kind: 'partial', row: E[i++] });
  while (i < E.length) issues.push({ kind: 'missing', row: E[i++] });
  return { matched, issues };
}

function checkCoverage(scene, segments, script, sb, aliases, findings, totals) {
  const cover = sb.status === 'final' ? 'block' : 'suggest';
  const add = (rule, file, row, message, options) => findings.push(finding(rule, file, message,
    { line: row.line, excerpt: row.excerpt, ...options }));
  if (!segments.length) add('sb-scene-uncovered', script.file, scene, `场景 ${scene.number} 没有对应分镜段`, { level: cover });
  const shots = segments.flatMap(segment => segment.shots);
  const E = scene.content.filter(row => row.kind === 'dialogue');
  const D = shots.flatMap(shot => shot.dialogue);
  const { matched, issues } = matchDialogue(E, D, aliases);
  totals.dialogue.script += E.length;
  totals.dialogue.matched += matched;
  for (const { kind, row } of issues) {
    if (kind === 'mismatch') add('sb-dialogue', sb.file, row, '镜头台词与剧本对不上', { hint: '按剧本顺序逐字引用台词' });
    else add('sb-dialogue-missing', script.file, row, kind === 'partial' ? '剧本台词只认领了一部分' : '剧本台词未被分镜认领',
      { level: cover, hint: '在镜头中补全对应台词' });
  }
  const actions = scene.content.filter(row => row.kind !== 'dialogue' && row.text);
  const quoted = new Set();
  for (const shot of shots) for (const fragment of shot.basis) {
    const text = withoutWhitespace(fragment);
    const hits = Array.from(text).length >= 4 ? actions.filter(row => withoutWhitespace(row.text).includes(text)) : [];
    if (!hits.length) add('sb-basis', sb.file, { line: shot.fields.get('依据')?.line ?? shot.line, excerpt: fragment },
      '依据不足 4 个码点或不在本场景动作／镜头行中', { hint: '从该场景逐字摘录' });
    else for (const hit of hits) quoted.add(hit);
  }
  totals.actions.script += actions.length;
  totals.actions.quoted += quoted.size;
  if (quoted.size < actions.length) add('sb-action-uncovered', script.file, scene,
    `场景 ${scene.number} 有 ${actions.length - quoted.size} 条动作或镜头行未被依据引用`,
    { level: 'suggest', hint: '核对动作覆盖并补引文' });
}

function checkStoryboard(sb, script, data, config, findings) {
  const totals = { dialogue: { script: 0, matched: 0 }, actions: { script: 0, quoted: 0 } };
  const add = (rule, line, message, options) => findings.push(finding(rule, sb.file, message, { line, ...options }));
  const scenes = new Map();
  const duplicateScenes = new Set();
  for (const scene of script?.scenes ?? []) {
    if (scene.number === null) continue;
    if (scenes.has(scene.number)) duplicateScenes.add(scene.number);
    scenes.set(scene.number, scene);
  }
  if (!scenes.size || duplicateScenes.size) add('sb-episode', 1, !scenes.size
    ? '缺少同集剧本或剧本没有有效场景' : '剧本场景号重复，无法确定对应关系', { hint: '先修正同集剧本' });
  for (const number of duplicateScenes) scenes.delete(number);
  const tolerance = config.storyboard.duration_tolerance;
  const target = script?.target_seconds;
  const range = target == null ? data.series.items[0]?.duration ?? null
    : [Math.round(target - tolerance * target), Math.round(target + tolerance * target)];
  if (range && (sb.seconds < range[0] || sb.seconds > range[1])) add('sb-duration', 1,
    `全集镜头合计 ${sb.seconds} 秒，目标区间 ${range.join('–')} 秒`,
    { level: 'suggest', excerpt: String(sb.seconds), hint: '补镜头或调整时长' });
  const [min, max] = config.storyboard.shot.seconds;
  let previous = null;
  for (const segment of sb.segments) {
    const { scene, shots, location } = segment;
    if (scenes.size && !scenes.has(scene) && !duplicateScenes.has(scene)) add('sb-scene', segment.line, '段引用了不存在的场景', { excerpt: segment.key });
    if (previous !== null && scene < previous) add('sb-scene-order', segment.line, '段的场景号回退',
      { excerpt: segment.key, level: 'suggest', hint: '核对剪辑顺序' });
    previous = scene;
    if (segment.seconds > config.storyboard.segment.max_seconds) add('sb-segment-seconds', segment.line,
      `段时长 ${segment.seconds} 秒超过上限 ${config.storyboard.segment.max_seconds} 秒`, { excerpt: segment.key, hint: '拆段或缩短时长' });
    if (location) checkReference(location, '地点', segment, null, sb, data, findings);
    for (const shot of shots) {
      if (shot.seconds > 0 && (shot.seconds < min || shot.seconds > max)) add('sb-shot-seconds', shot.line,
        `镜时长 ${shot.seconds} 秒不在 ${min}–${max} 秒内`, { excerpt: shot.key, level: 'suggest', hint: '核对镜头节奏' });
      const speech = shot.dialogue.reduce((sum, row) => sum + countChars(row.text), 0) * 60 / config.drama.chars_per_minute;
      if (speech > shot.seconds) add('sb-speech-fit', shot.line, '按设定语速估算，台词超过镜头时长',
        { excerpt: shot.key, level: 'suggest', hint: '拆分台词或增加时长' });
      if (shot.people.length > config.storyboard.max_people && !shot.note) add('sb-people', shot.line,
        `入画人物 ${shot.people.length} 人，超过 ${config.storyboard.max_people} 人`,
        { excerpt: shot.key, level: 'suggest', hint: '拆镜或写明备注' });
      if (location) checkReference(location, '地点', segment, shot, sb, data, findings);
      for (const key of shot.people) checkReference(key, '人物', segment, shot, sb, data, findings);
      for (const key of shot.props) checkReference(key, '道具', segment, shot, sb, data, findings);
      if (!scenes.has(scene) && scenes.size && !duplicateScenes.has(scene)) {
        for (const row of shot.dialogue) add('sb-dialogue', row.line, '该段没有对应剧本场景，无法匹配台词', { excerpt: row.excerpt });
        for (const excerpt of shot.basis) add('sb-basis', shot.fields.get('依据').line, '该段没有对应剧本场景，无法核对依据', { excerpt });
      }
    }
  }
  for (const scene of scenes.values()) {
    checkCoverage(scene, sb.segments.filter(segment => segment.scene === scene.number), script, sb, data.aliases, findings, totals);
  }
  return { episode: sb.episode, file: sb.file, status: sb.status, segments: sb.segments.length,
    shots: sb.segments.reduce((sum, segment) => sum + segment.shots.length, 0), seconds: sb.seconds, range, ...totals };
}

/** 系列级资产检查始终全量；仅过滤分镜文件。 */
export function checkStoryboards(root, slug, opts = {}) {
  failLevel(opts.failOn);
  const range = selectedEpisodeRange(opts.ep);
  const config = opts.config ?? requireConfig(root).config;
  const data = load(root, slug);
  const paths = filesIn(root, `${data.base}/storyboards`, /^ep.*\.md$/);
  const findings = Object.values(data).flatMap(value => value.errors ?? []);
  checkAssets(data, paths, findings);
  const episodes = [];
  for (const file of paths.filter(file => numberInRange(file, range))) {
    const { items: [sb], errors } = readParsed(root, file, parseStoryboard);
    findings.push(...errors);
    if (sb.episode === null) continue;
    const { items: [script] } = loadEpisode(root, data.base, sb.episode, config.drama);
    episodes.push(checkStoryboard(sb, script, data, config, findings));
  }
  episodes.sort((a, b) => a.episode - b.episode || lexical(a.file, b.file));
  const assets = { file: data.assets.file, exists: data.assets.exists };
  [assets.characters, assets.locations, assets.props] = ASSET_GROUPS.map(group =>
    data.assets.items.filter(item => item.variant === null && item.group === group).length);
  assets.variants = data.assets.items.filter(item => item.variant !== null).length;
  return { series: slug, assets, episodes, ...checkSummary({ episodes: episodes.length }, findings) };
}

function briefHidden(map, assets, foreshadows, episode) {
  const events = new Map();
  const event = id => {
    if (!events.has(id)) events.set(id, { plant: null, resolve: null, drop: null });
    return events.get(id);
  };
  for (const row of map.toSorted((a, b) => a.episode - b.episode)) for (const { id, action } of row.foreshadow_actions) {
    const item = event(id);
    if (action !== 'touch') item[action] ??= row.episode;
  }
  for (const asset of assets) for (const id of asset.fields.reveals ?? []) event(id);
  const known = new Map(foreshadows.map(item => [item.id, item]));
  return [...events.keys()].sort(lexical).flatMap(id => {
    const { plant, resolve, drop } = events.get(id);
    if ((resolve !== null && resolve < episode) || (drop !== null && drop < episode)) return [];
    const { name = null, reader_view = null, author_truth = null } = known.get(id) ?? {};
    return [{ id, name, reader_view, author_truth, planted_episode: plant, resolved_episode: resolve, resolves_here: resolve === episode }];
  });
}

/** 简报只汇总可解析记录；不运行资产交叉检查或分镜规则。 */
export function buildStoryboardBrief(root, slug, episode) {
  episode = integer(episode, '集号', 1);
  const data = load(root, slug);
  const { map, assets, continuity, foreshadows, inventory, characters, aliases, series } = data;
  const row = map.items.find(item => item.episode === episode);
  const names = new Set([...(row?.characters ?? []), ...(series.items[0]?.characters ?? [])].map(name => aliases.get(name) ?? name));
  return {
    episode,
    map: row ? { source_chapters: row.source_text, characters: row.characters,
      foreshadow_actions: row.foreshadow_actions.map(({ action, id }) => ({ action, id })) } : null,
    hidden: briefHidden(map.items, assets.items, foreshadows.items, episode),
    character_secrets: characters.items.filter(person => names.has(person.name) && person.author_truth)
      .map(({ name, reader_view, author_truth }) => ({ name, reader_view, author_truth })),
    gated_assets: assets.items.flatMap(entry => {
      const from_episode = usableFrom(entry, map.items);
      return from_episode === null || from_episode > episode
        ? [{ key: entry.key, group: entry.group, from_episode, reveals: entry.fields.reveals ?? [] }] : [];
    }),
    continuity: [...new Set(continuity.items.map(row => row.object))].map(object => {
      const prior = priorContinuity(continuity.items, episode, object);
      const { entry, current } = resolveAsset(object, episode, assets.items, continuity.items);
      const base = assets.items.find(asset => asset.key === object);
      const result = { object, state: prior?.state ?? null, variant: current, since: prior?.episode ?? null };
      const id = (entry ?? base)?.fields.item;
      const item = inventory.items.find(item => item.id === id);
      if (item) result.item = { id, holder: item.holder, status: item.status, changed_chapter: item.changed_chapter };
      return result;
    }),
  };
}

function renderBrief(brief, slug) {
  const map = brief.map;
  const people = list => list.join('、') || '（无）';
  const sections = [
    ['来源', map ? [`来源章：${map.source_chapters}`, `人物：${people(map.characters)}`,
      `伏笔：${people(map.foreshadow_actions.map(({ action, id }) => `${({ plant: '埋', touch: '触', resolve: '收', drop: '弃' })[action]}${id}`))}`] : []],
    ['本集不得画出的真相', brief.hidden.map(item => `${item.id} ${item.name ?? '（无有效伏笔记录）'}：读者已知 ${item.reader_view ?? '未知'}；作者真相 ${item.author_truth ?? '未知'}`
      + `（埋设集 ${item.planted_episode ?? '未埋'}；回收集 ${item.resolved_episode ?? '未收'}${item.resolves_here ? '；本集揭示，揭示前仍需隐藏' : ''}）`)],
    ['人物秘密', brief.character_secrets.map(item => `${item.name}：读者已知 ${item.reader_view ?? '（无）'}；作者真相 ${item.author_truth}`)],
    ['尚不可用的资产', brief.gated_assets.map(item => `${item.group}「${item.key}」：${item.from_episode === null ? '尚不可用' : `第${item.from_episode}集起`}`)],
    ['连戏现状', brief.continuity.map(item => `${item.object}：${item.state ?? '（无）'}（${item.variant ?? '无约束'}，起始集 ${item.since ?? '未记'}）`
      + (item.item ? `；小说物品 ${item.item.id}：持有 ${item.item.holder ?? '未知'}，状态 ${item.item.status}，变动章 ${item.item.changed_chapter ?? '未记'}` : ''))],
  ];
  return [`# 第${brief.episode}集分镜简报（${slug}）`, ...sections.map(([heading, lines]) =>
    `## ${heading}\n\n${lines.length ? lines.map(line => `- ${line}`).join('\n') : '（无）'}`)].join('\n\n');
}

const usage = '用法：node scripts/storyboard-check.mjs <短剧名> [--ep N|N-M] [--fail-on block|suggest] [--root DIR] [--json]\n'
  + '      node scripts/storyboard-check.mjs <短剧名> --ep N --brief [--root DIR] [--json]';

export async function main(argv) {
  return runCli('storyboard-check', argv, { ep: { type: 'string' }, 'fail-on': { type: 'string' }, brief: { type: 'boolean' } },
    usage, (root, values, args) => {
      if (args.length !== 1 || (values.brief && values['fail-on'] !== undefined)) throw new Error(usage);
      const { config, found } = requireConfig(root);
      const [series] = args;
      if (values.brief) {
        const brief = buildStoryboardBrief(root, series, values.ep);
        return { fields: { series, brief }, text: renderBrief(brief, series), found };
      }
      const fields = checkStoryboards(root, series, { config, ep: values.ep, failOn: values['fail-on'] });
      const text = [`# 分镜检查：${series}`, ...fields.episodes.map(item =>
        `第${item.episode}集：${item.segments} 段，${item.shots} 镜，${item.seconds} 秒；台词 ${item.dialogue.matched}/${item.dialogue.script}，动作 ${item.actions.quoted}/${item.actions.script}`),
      `检查 ${fields.summary.episodes} 集。`, ...findingLines(fields)].join('\n');
      return { fields, text, code: checkExit(fields, values['fail-on']), found };
    });
}

await directMain(import.meta.url, main);
