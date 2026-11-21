import path from 'node:path';
import {
  aliasesOf, isOpenForeshadow, parseAppearances, parseCharacters, parseDynamics, parseForeshadows, parseOutline,
  parseSettingTags, parseSources, parseSubplots, parseTimeline, parseVolumePlan,
} from './bible.mjs';
import { directMain, integer, lexical, runCli } from './cli.mjs';
import { requireConfig } from './config.mjs';
import { foreshadowAt, formatForeshadow, overdueBy } from './foreshadow-scan.mjs';
import { linesOf } from './md.mjs';
import { entries, listChapters, readOptional, selectCanonical, volumeOf } from './project.mjs';

function warning(type, message, { name = null, gap = null, file = null, line = null } = {}) {
  return { type, name, gap, file, line, message };
}

function loader(root, warnings) {
  return {
    read(file, optional = false) {
      const text = readOptional(root, file);
      if (text === null && !optional) warnings.push(warning('missing_file', `未找到文件：${file}`, { file }));
      return text;
    },
    parse(parser, text, file) {
      if (text === null) return [];
      const { items, errors } = parser(text, file);
      for (const { line, message } of errors) warnings.push(warning('parse', message, { file, line }));
      return items;
    },
    table(file, parser, optional = false) {
      return this.parse(parser, this.read(file, optional), file);
    },
  };
}

function planAt(io, ch, vol, dir, warnings) {
  const volumePlan = io.table(`bible/volumes/${vol}.md`, parseVolumePlan).find(row => row.chapter === ch);
  const file = `${dir}/outline.md`;
  const raw = io.read(file, true);
  let [outline] = io.parse(parseOutline, raw, file);
  if (outline && outline.chapter !== ch) {
    if (outline.chapter !== null) warnings.push(warning('parse', '提纲章号与目录不符', { file, line: 1 }));
    outline = undefined;
  }
  const merged = { ...volumePlan, ...outline };
  return {
    plan: {
      source: outline ? 'outline' : volumePlan ? 'volume_plan' : null,
      title: merged.title ?? null, core_event: merged.core_event ?? null, beat: merged.beat ?? null,
      hook: merged.hook ?? null, weight: merged.weight ?? 'normal',
      subplots: (merged.subplots ?? []).map(({ id, step }) => ({ id, step })),
      foreshadow_actions: (merged.foreshadow_actions ?? []).map(({ action, id }) => ({ action, id })),
      characters: {
        present: outline?.characters?.present ?? volumePlan?.characters.present ?? [],
        mentioned: outline?.characters?.mentioned ?? volumePlan?.characters.mentioned ?? [],
      },
    },
    text: [merged.core_event, ...(volumePlan?.cells ?? []), raw].filter(Boolean).join('\n'),
  };
}

function tailOf(text) {
  const lines = linesOf(text.replace(/<!--[\s\S]*?-->/g, ''));
  if (/^# 第\d+章：/.test(lines[0])) lines.shift();
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (/^[ \t]*\*?下章预告[：:]/.test(line)) continue;
    if (!line.trim() || line.trim() === '---') {
      if (current.length) paragraphs.push(current.join('\n'));
      current = [];
    } else current.push(line);
  }
  if (current.length) paragraphs.push(current.join('\n'));
  const points = Array.from(paragraphs.slice(-3).join('\n'));
  return points.length <= 600 ? points.join('') : `……${points.slice(-600).join('')}`;
}

function previousAt(root, io, chapters, ch, warnings) {
  if (ch === 0) return null;
  const chapter = ch - 1;
  const entry = chapters.find(item => item.chapter === chapter);
  let canonical = null;
  if (entry) {
    try {
      canonical = selectCanonical(root, entry.dir, entry.drafts);
    } catch (error) {
      if (!error.file) throw error;
      warnings.push(warning('parse', error.message, { file: error.file, line: error.line }));
    }
  }
  if (!canonical) {
    warnings.push(warning('missing_file', `第${chapter}章没有定稿`, { file: entry?.dir ?? null }));
    return null;
  }
  const text = io.read(canonical);
  return text === null ? null : { chapter, file: canonical, tail: tailOf(text) };
}

function plannedForeshadows(items, plan, config, ch) {
  const sorted = items.toSorted((a, b) => lexical(a.id, b.id));
  const planned = Object.fromEntries(['resolve', 'plant', 'touch'].map(action => [action,
    new Set(plan.foreshadow_actions.filter(item => item.action === action).map(item => item.id))]));
  const used = new Set();
  const select = predicate => sorted.filter(item => {
    if (used.has(item.id) || !predicate(item)) return false;
    used.add(item.id);
    return true;
  }).map(item => foreshadowAt(item, ch));
  const upcoming = item => item.target && item.target.start > ch && item.target.start <= ch + config.foreshadow.due_window;
  return {
    resolve: select(item => planned.resolve.has(item.id) || (isOpenForeshadow(item) && item.target
      && item.target.start <= ch && item.target.end >= ch)),
    plant: select(item => planned.plant.has(item.id) || (item.status === 'planned' && item.planted === ch)),
    touch: select(item => planned.touch.has(item.id)),
    overdue: select(item => overdueBy(item, ch, config.foreshadow.overdue_grace) > 0),
    nearby: select(item => isOpenForeshadow(item) && ((item.planted !== null && item.planted >= ch - 5
      && item.planted < ch) || upcoming(item))),
  };
}

function activeSubplots(items, plan, ch, warnings) {
  const ids = new Set(plan.subplots.map(item => item.id));
  return items.filter(item => item.status === 'active').map(item => {
    const { id, name, level, status, current_step, current_chapter, steps } = item;
    const planned = steps.filter(step => step.planned_chapter === ch);
    if (planned.length > 1) {
      warnings.push(warning('parse', `${id} 在同一章规划了多个步骤，无法给出单一 planned_step`, item));
    }
    return {
      id, name, level, status, current_step, current_chapter, advance_here: ids.has(id),
      planned_step: planned.length === 1 ? planned[0].step : null,
    };
  });
}

function peopleAt(io, plan, ch, vol, config, warnings) {
  const people = io.table('bible/characters.md', parseCharacters).filter(person => !person.scope.startsWith('短剧:'));
  const aliases = aliasesOf(people);
  const normalize = name => aliases.get(name) ?? name;
  for (const key of ['present', 'mentioned']) {
    plan.characters[key] = [...new Set(plan.characters[key].map(normalize))];
  }
  const byName = new Map(people.map(person => [person.name, person]));
  const history = io.table('bible/appearances.md', parseAppearances).filter(row => row.chapter < ch)
    .sort((a, b) => b.chapter - a.chapter || b.line - a.line);
  const dynamics = io.table('bible/character-dynamics.md', parseDynamics).filter(row => row.chapter < ch)
    .sort((a, b) => b.chapter - a.chapter || b.line - a.line);

  function character(name) {
    const person = byName.get(name);
    const present = history.find(row => row.present.some(alias => normalize(alias) === name));
    const mentioned = history.find(row => row.mentioned.some(alias => normalize(alias) === name));
    const recent = (present?.chapter ?? -1) >= (mentioned?.chapter ?? -1) ? present : mentioned;
    const note = recent && Object.entries(recent.notes).find(([alias]) => normalize(alias) === name)?.[1];
    const relation = dynamics.find(row => normalize(row.character) === name || normalize(row.target) === name);
    const last_present = person?.always_present ? ch - 1 : present?.chapter ?? null;
    return {
      name, tier: person?.tier ?? null, last_present, last_mentioned: mentioned?.chapter ?? null,
      gap: last_present === null ? null : ch - last_present, note: note ?? null,
      relationship: relation?.state ?? null, dormant: person?.dormant_volumes.includes(vol) ?? false, unknown: !person,
    };
  }

  const cached = new Map();
  const get = name => {
    if (!cached.has(name)) cached.set(name, character(name));
    return cached.get(name);
  };
  const selected = [...new Set([...plan.characters.present, ...plan.characters.mentioned])].map(get);
  for (const item of selected) {
    if (item.unknown) warnings.push(warning('unknown_character', `未找到人物档案：${item.name}`, { name: item.name }));
  }
  for (const person of people.filter(person => person.tier === 'core' && !person.always_present)) {
    const item = get(person.name);
    if (!item.dormant && item.gap !== null && item.gap > config.appearance.gap_warn) {
      warnings.push(warning('absent', `${item.name} 已 ${item.gap} 章未在场`, item));
    }
  }
  return selected;
}

function timelineAt(items, ch) {
  const relevant = items.filter(item => item.chapter !== null)
    .sort((a, b) => a.chapter - b.chapter || a.line - b.line)
    .map(({ id, time, chapter, event, kind, prose_form }) => ({ id, time, chapter, event, kind, prose_form }));
  return {
    now: relevant.findLast(item => item.kind === 'hard' && item.chapter <= ch) ?? null,
    near: relevant.filter(item => item.chapter >= ch - 2 && item.chapter <= ch + 2),
    upcoming: relevant.filter(item => ['window', 'deadline'].includes(item.kind) && item.chapter >= ch && item.chapter <= ch + 10),
  };
}

function ownersAt(items, plan, text, ch, vol, warnings) {
  const hasPeople = plan.characters.present.length + plan.characters.mentioned.length > 0;
  return items.filter(item => item.brief_rule === 'always' || (item.brief_rule === 'characters' && hasPeople)
    || item.keywords.some(word => text.includes(word))).flatMap(item => {
    if (item.owner_file.includes('{series}')) {
      warnings.push(warning('parse', '章节简报无法替换主写入口的 {series}', { file: item.file, line: item.line }));
      return [];
    }
    const subst = value => value?.replaceAll('{vol}', String(vol)).replaceAll('{ch}', String(ch)) ?? null;
    return [{
      key: item.key, file: subst(item.owner_file), anchor: subst(item.owner_anchor), purpose: item.purpose,
      read_when: item.read_when, write_when: item.write_when, mode: item.mode,
    }];
  });
}

function settingsAt(root, io, ch, text) {
  const files = ['bible/canon.md', 'bible/world-rules.md', ...entries(path.join(root, 'bible/indexes'))
    .filter(entry => entry.isFile() && entry.name.endsWith('.md')).map(entry => `bible/indexes/${entry.name}`)];
  return files.flatMap(file => io.table(file, parseSettingTags))
    .filter(item => item.chapters.includes(ch) || item.tags.some(tag => text.includes(tag)))
    .map(({ name, tags, file, line }) => ({ name, tags, file, line }));
}

/** 从 Markdown 快照生成章节简报，不写入项目或输出。 */
export function buildBrief(root, ch, opts = {}) {
  const chapter = integer(ch, '章号');
  const config = opts.config ?? requireConfig(root).config;
  const volume = opts.vol === undefined ? volumeOf(root, chapter) : integer(opts.vol, '--vol', 1);
  if (volume === null) throw new Error(`无法确定第${chapter}章的卷号，请指定 --vol`);
  const warnings = [];
  const io = loader(root, warnings);
  const chapters = listChapters(root, { resolveCanonical: false });
  const { plan, text } = planAt(io, chapter, volume, `chapters/${volume}/${chapter}`, warnings);
  const previous = previousAt(root, io, chapters, chapter, warnings);
  const foreshadows = plannedForeshadows(io.table('bible/foreshadows.md', parseForeshadows), plan, config, chapter);
  const subplots = activeSubplots(io.table('bible/subplots.md', parseSubplots), plan, chapter, warnings);
  const characters = peopleAt(io, plan, chapter, volume, config, warnings);
  const timeline = timelineAt(io.table('bible/timeline.md', parseTimeline), chapter);
  const owners = ownersAt(io.table('bible/sources.md', parseSources), plan, text, chapter, volume, warnings);
  const settings = settingsAt(root, io, chapter, text);
  return { chapter, volume, plan, previous, foreshadows, subplots, characters, warnings, timeline, owners, settings };
}

function render(result) {
  const { chapter, volume, plan, previous, foreshadows, subplots, characters, warnings, timeline, owners, settings } = result;
  const tier = { core: '核心', major: '重要', minor: '次要', extra: '龙套' };
  const planText = plan.source ? [
    ['标题', plan.title], ['核心事件', plan.core_event], ['爽点', plan.beat], ['钩子', plan.hook], ['权重', plan.weight],
    ['支线', plan.subplots.map(item => item.id).join('、')],
    ['在场', plan.characters.present.join('、')], ['提及', plan.characters.mentioned.join('、')],
  ].filter(([, text]) => text).map(([label, text]) => `- ${label}：${text}`) : [];
  const time = (label, item) => `- ${label}：第${item.chapter}章 ${item.time}｜${item.event}`
    + (item.prose_form ? `｜正文：${item.prose_form}` : '');
  const sections = [
    ['主写入口', owners.map(item => `- ${item.file}${item.anchor ? `#${item.anchor}` : ''}｜${item.purpose}`)],
    ['本章规划', planText],
    ['上一章结尾', previous?.tail ? [previous.tail] : []],
    ['本章要回收的伏笔', foreshadows.resolve.map(formatForeshadow)],
    ['本章要埋设的伏笔', foreshadows.plant.map(formatForeshadow)],
    ['本章触及的伏笔', foreshadows.touch.map(formatForeshadow)],
    ['逾期与附近伏笔', [...foreshadows.overdue, ...foreshadows.nearby].map(formatForeshadow)],
    ['活跃支线', subplots.map(item => `- ${item.id} ${item.name}${item.advance_here ? '｜本章推进' : ''}`
      + (item.planned_step ? `｜计划：${item.planned_step}` : ''))],
    ['出场人物', characters.map(item => `- ${item.name}（${tier[item.tier] ?? '未知'}）`
      + (item.last_present === null ? '暂无在场记录' : `上次在场 第${item.last_present}章（${item.gap} 章前）`)
      + (item.note ? `：${item.note}` : '') + (item.relationship ? `｜关系：${item.relationship}` : ''))],
    ['提醒', warnings.map(item => `- ${item.file ? `${item.file}${item.line === null ? '' : `:${item.line}`}：` : ''}${item.message}`)],
    ['时间锚点', [...(timeline.now ? [time('当前', timeline.now)] : []),
      ...timeline.near.map(item => time('附近', item)), ...timeline.upcoming.map(item => time('将至', item))]],
    ['关联设定', settings.map(item => `- ${item.name}｜${item.tags.join('、')}｜${item.file}:${item.line}`)],
  ];
  return [`# 第${chapter}章写作简报（卷${volume}）`,
    ...sections.flatMap(([heading, content]) => ['', `## ${heading}`, ...(content.length ? content : ['（无）'])])].join('\n');
}

const usage = '用法：node scripts/brief.mjs <章号> [--vol N] [--root DIR] [--json]';

/** 命令行入口：生成章节简报。 */
export async function main(argv) {
  return runCli('brief', argv, { vol: { type: 'string' } }, usage, (root, values, args) => {
    if (args.length !== 1) throw new Error(usage);
    const { config, found } = requireConfig(root);
    const fields = buildBrief(root, args[0], { vol: values.vol, config });
    return { fields, text: render(fields), found };
  });
}

await directMain(import.meta.url, main);
