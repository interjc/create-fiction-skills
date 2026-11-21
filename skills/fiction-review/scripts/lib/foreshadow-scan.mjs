import {
  choices, directMain, EXIT, finding, formatFinding, integer, lexical, runCli, sortFindings,
} from './cli.mjs';
import { isOpenForeshadow, parseForeshadows, parseOutline, parseSubplots } from './bible.mjs';
import { requireConfig } from './config.mjs';
import { listChapters, readOptional } from './project.mjs';

const categories = ['plant_due', 'due', 'overdue', 'dormant', 'writeback', 'subplot_alerts', 'invalid'];
const headings = {
  plant_due: '待埋', due: '到期', overdue: '逾期', dormant: '沉睡', writeback: '待回写',
  subplot_alerts: '支线提醒', invalid: '无效记录',
};
const actionLabel = { plant: '埋', touch: '触', resolve: '收', drop: '弃' };

/** 投影为 §6 的 FS 对象，最后一次触及以 at 为界。 */
export function foreshadowAt(item, at) {
  const { id, name, status, planted, target, resolved, touched, future,
    reader_view, author_truth, subplots, characters, file, line } = item;
  let last_touch = planted;
  for (const ch of touched) {
    if (ch <= at && (last_touch === null || ch > last_touch)) last_touch = ch;
  }
  return {
    id, name, status, planted, target, resolved, touched, last_touch, future,
    reader_view, author_truth, subplots, characters, file, line,
  };
}

/** 未结伏笔逾期章数，未逾期返回 0。 */
export function overdueBy(item, at, grace) {
  return isOpenForeshadow(item) && item.target ? Math.max(0, at - (item.target.end + grace)) : 0;
}

/** brief 与 scan 共用的伏笔人读格式。 */
export function formatForeshadow(fs) {
  const { target } = fs;
  const planned = target ? (target.start === target.end ? target.start : `${target.start}-${target.end}`) : '?';
  return `- ${fs.id} ${fs.name} [${fs.status}] 埋${fs.planted ?? '?'} → 收${planned}`
    + `｜读者已知：${fs.reader_view}｜真相：${fs.author_truth}｜未来：${fs.future ?? '（无）'}`;
}

function fsCategories(items, params, at) {
  const output = { plant_due: [], due: [], overdue: [], dormant: [] };
  for (const item of items) {
    const fs = foreshadowAt(item, at);
    if (fs.status === 'planned' && fs.planted !== null && fs.planted <= at) output.plant_due.push(fs);
    if (!isOpenForeshadow(fs)) continue;
    const { target, last_touch } = fs;
    if (target && at >= target.start - params.due_window && at <= target.end + params.overdue_grace) output.due.push(fs);
    const late = overdueBy(fs, at, params.overdue_grace);
    if (late) output.overdue.push({ ...fs, overdue_by: late });
    if (last_touch !== null && at - last_touch >= params.dormant_after) {
      output.dormant.push({ ...fs, silent_for: at - last_touch });
    }
  }
  return output;
}

function checkForeshadow(action, fs, chapter) {
  if (!fs) return 'exists';
  switch (action) {
    case 'plant': return fs.status !== 'planned' && fs.planted === chapter ? null : `planted@${chapter}`;
    case 'touch': return fs.touched.includes(chapter) || fs.resolved === chapter ? null : `touched@${chapter}`;
    case 'resolve': return fs.status === 'resolved' && fs.resolved === chapter ? null : `resolved@${chapter}`;
    case 'drop': return fs.status === 'dropped' ? null : 'dropped';
    default: throw new Error(`未知伏笔动作：${action}`);
  }
}

function writebacks(root, chapters, foreshadows, subplots, invalid) {
  const result = [];
  const fsByID = new Map(foreshadows.map(item => [item.id, item]));
  const subplotByID = new Map(subplots.map(item => [item.id, item]));
  for (const { chapter, dir } of chapters) {
    const file = `${dir}/outline.md`;
    const text = readOptional(root, file);
    if (text === null) continue;
    const { items: [outline], errors } = parseOutline(text, file);
    invalid.push(...errors);
    if (outline.chapter !== chapter) {
      if (outline.chapter !== null) {
        invalid.push(finding('parse', file, '提纲章号与目录不符', { line: 1 }));
      }
      continue;
    }
    for (const { action, id, line } of outline.foreshadow_actions ?? []) {
      const fs = fsByID.get(id);
      const expected = checkForeshadow(action, fs, chapter);
      if (expected) result.push({ chapter, kind: 'foreshadow', id, action, expected, actual: fs?.status ?? null, file, line });
    }
    for (const { id, step, line } of outline.subplots ?? []) {
      const subplot = subplotByID.get(id);
      const actualChapter = subplot?.steps.find(item => item.step === step)?.actual_chapter ?? null;
      const expected = !subplot ? 'exists' : step && actualChapter !== chapter ? `${step}@${chapter}` : null;
      const actual = actualChapter === null ? null : `${step}@${actualChapter}`;
      if (expected) result.push({ chapter, kind: 'subplot', id, action: step, expected, actual, file, line });
    }
  }
  return result.sort((a, b) => a.chapter - b.chapter || lexical(a.id, b.id) || a.line - b.line);
}

function subplotAlerts(subplots, params, at) {
  const result = [];
  for (const { id, name, level, status, current_step, current_chapter, steps } of subplots) {
    const add = (type, value) => result.push({ type, id, name, level, current_step, current_chapter, value });
    const done = step => steps.find(item => item.step === step)?.actual_chapter ?? null;
    const seed = done('seed');
    const remind = done('remind');
    if (done('big_reveal') === null) {
      if (status === 'active' && current_chapter !== null && at - current_chapter >= params.stall_after) {
        add('stalled', at - current_chapter);
      }
      if (level !== 'C' && seed !== null && at - seed >= params.max_span) add('span', at - seed);
    }
    if (seed !== null && remind !== null) {
      const gap = remind - seed;
      const [min, max] = params.remind_gap;
      if (gap < min || gap > max) add('remind_gap', gap);
    }
  }
  return result;
}

function readTable(root, file, parse) {
  const text = readOptional(root, file);
  if (text === null) throw new Error(`未找到文件：${file}`);
  return parse(text, file);
}

/** 从 Markdown 快照计算扫描内容；不写入项目或输出。 */
export function scan(root, at, opts = {}) {
  const config = opts.config ?? requireConfig(root).config;
  const cutoff = at === undefined ? Infinity : integer(at, '当前章');
  const chapters = listChapters(root, { resolveCanonical: ch => ch <= cutoff }).filter(item => item.canonical);
  const current = at === undefined ? chapters.at(-1)?.chapter ?? 0 : cutoff;
  const params = {
    ...Object.fromEntries(['due_window', 'overdue_grace', 'dormant_after'].map(key => [key, config.foreshadow[key]])),
    stall_after: config.subplot.stall_after, max_span: config.subplot.max_span, remind_gap: config.subplot.remind_gap,
  };
  if (opts.dormant !== undefined) params.dormant_after = integer(opts.dormant, '沉睡章数');
  const fs = readTable(root, 'bible/foreshadows.md', parseForeshadows);
  const subplots = readTable(root, 'bible/subplots.md', parseSubplots);
  for (const table of [fs, subplots]) table.items.sort((a, b) => lexical(a.id, b.id));
  const invalid = [...fs.errors, ...subplots.errors];
  const results = {
    ...fsCategories(fs.items, params, current),
    writeback: writebacks(root, chapters.filter(item => item.chapter <= current), fs.items, subplots.items, invalid),
    subplot_alerts: subplotAlerts(subplots.items, params, current),
    invalid: sortFindings(invalid),
  };
  const counts = { open: fs.items.filter(isOpenForeshadow).length };
  for (const name of categories) counts[name] = results[name].length;
  const only = opts.only ?? categories;
  return { at: current, params, counts, ...Object.fromEntries(categories.filter(name => only.includes(name))
    .map(name => [name, results[name]])) };
}

function renderRow(category, item) {
  if (category === 'invalid') return formatFinding(item);
  if (category === 'subplot_alerts') {
    const label = { stalled: '停滞', span: '跨度过长', remind_gap: '提醒间隔超出范围' };
    return `- ${item.id} ${item.name}：${label[item.type]}（${item.value} 章）`;
  }
  if (category === 'writeback') {
    const action = actionLabel[item.action] ?? item.action ?? '引用';
    const table = item.kind === 'foreshadow' ? '伏笔表' : '支线表';
    return `- 第${item.chapter}章 outline：${action} ${item.id}，但${table}仍是 ${item.actual ?? '无记录'}`;
  }
  return formatForeshadow(item);
}

function render(result) {
  return [`# 伏笔与支线扫描（第${result.at}章）`, ...categories.filter(name => Object.hasOwn(result, name)).flatMap(name => [
    '', `## ${headings[name]}（${result.counts[name]}）`, ...result[name].map(item => renderRow(name, item)),
  ])].join('\n');
}

const usage = '用法：node scripts/foreshadow-scan.mjs [--at N] [--only c1,c2] [--dormant N] [--fail-on c1,c2] [--root DIR] [--json]';

/** 命令行入口：扫描伏笔及支线。 */
export async function main(argv) {
  const options = { at: { type: 'string' }, only: { type: 'string' }, dormant: { type: 'string' }, 'fail-on': { type: 'string' } };
  return runCli('foreshadow-scan', argv, options, usage, (root, values, args) => {
    if (args.length) throw new Error(usage);
    const { config, found } = requireConfig(root);
    const only = values.only === undefined ? undefined : choices(values.only, categories, '--only');
    const failOn = values['fail-on'] === undefined ? ['overdue', 'invalid'] : choices(values['fail-on'], categories, '--fail-on');
    const fields = scan(root, values.at, { config, only, dormant: values.dormant });
    return { fields, text: render(fields), code: failOn.some(name => fields.counts[name]) ? EXIT.FAIL : EXIT.OK, found };
  });
}

await directMain(import.meta.url, main);
