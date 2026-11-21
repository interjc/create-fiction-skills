import { createHash, randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SUBPLOT_ID } from './bible.mjs';
import {
  choices, directMain, EXIT, failLevel, finding, formatFinding, lexical, runCli, sortFindings,
} from './cli.mjs';
import { DEFAULT_CONFIG, requireConfig } from './config.mjs';
import { HOOK_ORDER, linesOf, maskComments, parseMarkers, sections, splitList } from './md.mjs';
import { compilePattern, DEFAULT_PATTERNS, literalPattern, loadPatterns } from './patterns.mjs';
import {
  entries, explicitFile, isFrozen, listChapters, missingChapters, readOptional, resolveSelector, seriesEpisodeFiles,
} from './project.mjs';

const RULES = [
  'banned-term', 'desensitize', 'exact-year', 'internal-ref', 'internal-term', 'summary', 'ai-tone', 'custom',
  'title-format', 'hook', 'hook-discouraged', 'markdown-format', 'separator-format', 'frozen-modified', 'frozen-unsealed',
];
const preview = /^[ \t]*\*?下章预告[：:]/;
const separatorVariants = [
  /^\s*(?:\*\s*){3,}$/, /^\s*(?:_\s*){3,}$/, /^\s*-{4,}\s*$/,
  /^\s*[—～~]{3,}\s*$/, /^\s+---\s*$|^---\s+$/,
];
const ruleTitles = { 'ai-tone': 'AI 腔', summary: '总结句', 'exact-year': '精确日期', 'internal-ref': '内部引用', custom: '自定义模式' };

function selectedRule(rule, rules) {
  return rules == null || rules.includes(rule);
}

function effectiveLevel(config, rule, id, level) {
  const overrides = config.lint.rules;
  if (id && Object.hasOwn(overrides, id)) return overrides[id];
  return Object.hasOwn(overrides, rule) ? overrides[rule] : level;
}

function makeIgnore(markers, lines) {
  const file = new Set();
  const byLine = new Map();
  for (const marker of markers) {
    if (marker.kind === 'lint-ignore-file') {
      for (const item of splitList(marker.value)) file.add(item);
    } else if (marker.kind === 'lint-ignore') {
      let next = marker.line + 1;
      while (next <= lines.length && !lines[next - 1].trim()) next++;
      const items = byLine.get(next) ?? new Set();
      for (const item of splitList(marker.value)) items.add(item);
      byLine.set(next, items);
    }
  }
  return f => [f.rule, f.id].some(key => key && (file.has(key) || byLine.get(f.line)?.has(key)));
}

function narrationLine(line, kind) {
  if (kind === 'episode' && !line.startsWith('△')) return null;
  let text = line.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/gu,
    quote => quote.replace(/[\s\S]/gu, ' '));
  if (kind === 'episode') text = text.slice(1);
  return text;
}

function termPatterns(config) {
  const make = (items, rule, level, message) => items.map(item => {
    const { term, hint = null } = typeof item === 'string' ? { term: item } : item;
    return { rule, level, scope: 'all', message, hint, regex: literalPattern(term) };
  });
  const { lint } = config;
  const words = ['places', 'schools', 'companies', 'people', 'other'].flatMap(key => lint.desensitize[key]);
  return [
    ...make(lint.banned_terms, 'banned-term', 'block', '出现禁用词'),
    ...make(words, 'desensitize', 'block', '出现需脱敏词'),
    ...make(lint.internal_terms, 'internal-term', 'suggest', '出现写作术语'),
  ];
}

function filePatterns(config, patterns, subplotIds) {
  const compiled = termPatterns(config);
  for (const item of patterns) {
    if (item.rule === 'exact-year' && !config.lint.desensitize.exact_years) continue;
    const title = ruleTitles[item.rule];
    const message = item.hint && ['ai-tone', 'summary', 'internal-ref'].includes(item.rule)
      ? `${title}：${item.hint}` : title;
    if (item.id === 'IR07') {
      for (const id of subplotIds) {
        compiled.push({ ...item, message, regex: literalPattern(id, { word: true, sensitive: true }) });
      }
    } else {
      compiled.push({ ...item, message, regex: compilePattern(item.source) });
    }
  }
  return compiled;
}

function chapterFormat(visible, original, markers, chapter, config, add) {
  const title = /^# 第(\d+)章：(\S.*)$/.exec(visible[0].trimEnd());
  if (!title || (chapter !== null && Number(title[1]) !== chapter)) {
    add('title-format', '章节首行标题格式非法或章号与目录不符', { line: 1, column: 1, excerpt: visible[0].trimEnd() });
  }
  const hooks = markers.filter(marker => marker.kind === 'hook' && /^[A-Za-z]$/.test(marker.value));
  if (config.hook.required && !hooks.length) add('hook', '缺少钩子标记');
  const last = original.findLastIndex(line => line.trim()) + 1;
  for (const [i, marker] of hooks.entries()) {
    const { value, line, column } = marker;
    const location = { line, column, excerpt: original[line - 1].trim() };
    if (!HOOK_ORDER.includes(value)) add('hook', '钩子级别须为大写 S/A/B/C', location);
    if (i > 0) add('hook', '钩子标记多于一个', location);
    if (line !== last) add('hook', '钩子标记不是最后一个非空行', location);
    if (config.hook.discouraged.includes(value)) {
      add('hook-discouraged', `不建议使用 ${value} 级钩子`, { ...location, level: 'suggest' });
    }
  }
  for (const [i, text] of visible.entries()) {
    if (i === 0) continue;
    // 场景分隔的空行要求不在 §4.2；这里只检查明确列出的变体。
    if (separatorVariants.some(regex => regex.test(text))) {
      add('separator-format', '场景分隔须恰好为 ---', { line: i + 1, column: 1, excerpt: text, level: 'suggest' });
    }
    const markdown = /^(?:#|>|[-*+] |\d+\. )|\*\*|__/.exec(text);
    if (markdown) {
      add('markdown-format', '正文出现 Markdown 格式标识', {
        line: i + 1, column: Array.from(text.slice(0, markdown.index)).length + 1, excerpt: markdown[0], level: 'suggest',
      });
    }
  }
}

/** 在不读文件、不写输出的情况下扫描一份正文；返回 findings 和 suppressed。 */
export function lintFile(text, {
  file = '', kind = 'extra', chapter = null, config = DEFAULT_CONFIG, patterns = DEFAULT_PATTERNS,
  subplotIds = [], rules = null,
} = {}) {
  const original = linesOf(text);
  const visible = linesOf(maskComments(text));
  const markers = parseMarkers(text);
  const ignored = makeIgnore(markers, original);
  const findings = [];
  let suppressed = 0;
  const add = (rule, message, options = {}) => {
    if (!selectedRule(rule, rules)) return;
    const level = effectiveLevel(config, rule, options.id, options.level ?? 'block');
    if (level === 'off') return;
    const result = finding(rule, file, message, { ...options, level });
    if (ignored(result)) suppressed++;
    else findings.push(result);
  };
  const compiled = filePatterns(config, patterns, subplotIds).filter(item => selectedRule(item.rule, rules));
  for (const [i, line] of visible.entries()) {
    const narration = narrationLine(line, kind);
    for (const item of compiled) {
      if (item.rule === 'internal-term' && preview.test(line)) continue;
      const source = item.scope === 'narration' ? narration : line;
      if (source === null || (!source.trim() && original[i].trim())) continue;
      const offset = item.scope === 'narration' && kind === 'episode' ? 1 : 0;
      for (const match of source.matchAll(item.regex)) {
        add(item.rule, item.message, {
          id: item.id, level: item.level, hint: item.hint, line: i + 1,
          column: Array.from(source.slice(0, match.index)).length + 1 + offset, excerpt: match[0],
        });
      }
    }
  }
  if (kind === 'chapter') chapterFormat(visible, original, markers, chapter, config, add);
  return { findings: sortFindings(findings), suppressed };
}

const manifestPath = '.fiction/frozen.json';
const chapterDraft = /^chapters\/[1-9]\d*\/(0|[1-9]\d*)\/v[1-9]\d*\.md$/;
const sealedDraft = /^chapters\/[1-9]\d*\/(?:0|[1-9]\d*)\/v[^/]*\.md$/;
const hash = data => createHash('sha256').update(data).digest('hex');

function readSeal(root) {
  const raw = readOptional(root, manifestPath);
  if (raw === null) return null;
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error(`${manifestPath}：不是合法 JSON`); }
  if (value?.spec_version !== 1 || typeof value.created !== 'string' || Number.isNaN(Date.parse(value.created))
    || !Array.isArray(value.ranges) || !value.ranges.every(x => typeof x === 'string')
    || !value.files || typeof value.files !== 'object' || Array.isArray(value.files)
    || Object.entries(value.files).some(([file, digest]) => !sealedDraft.test(file)
      || typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest))) {
    throw new Error(`${manifestPath}：冻结清单格式非法或版本不支持`);
  }
  return value;
}

function frozenDrafts(root, config) {
  if (!config.frozen.ranges.length) return [];
  return listChapters(root, { resolveCanonical: false }).filter(entry => isFrozen(entry.chapter, config))
    .map(({ dir }) => ({
      dir, files: entries(path.join(root, dir)).filter(entry => entry.isFile() && /^v.*\.md$/.test(entry.name))
        .map(entry => `${dir}/${entry.name}`),
    }));
}

function modifiedFiles(root, seal) {
  return Object.entries(seal?.files ?? {}).filter(([file, prior]) => {
    try {
      return hash(readFileSync(path.join(root, explicitFile(root, path.join(root, file))))) !== prior;
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR' || error.message.startsWith('未找到书根内文件')) return true;
      throw error;
    }
  }).map(([file]) => file).sort(lexical);
}

function freezeCheck(root, config, rules) {
  if (!['frozen-modified', 'frozen-unsealed'].some(rule => selectedRule(rule, rules))) return [];
  const seal = readSeal(root);
  const findings = [];
  const add = (rule, file, message, level, hint) => {
    if (!selectedRule(rule, rules)) return;
    const effective = effectiveLevel(config, rule, null, level);
    if (effective !== 'off') findings.push(finding(rule, file, message, { level: effective, hint }));
  };
  const unsealed = (file, message) => add('frozen-unsealed', file, message, 'suggest', '运行 --freeze');
  if (!seal) {
    if (config.frozen.ranges.length) unsealed(manifestPath, '冻结范围已配置但没有清单');
    return findings;
  }
  for (const file of modifiedFiles(root, seal)) {
    add('frozen-modified', file, '已冻结稿件已更改或删除', 'block', null);
  }
  const sealedDirs = new Set(Object.keys(seal.files).map(file => path.posix.dirname(file)));
  for (const { dir, files } of frozenDrafts(root, config)) {
    if (!sealedDirs.has(dir)) {
      if (files.length) unsealed(dir, '冻结章未登记');
    } else {
      for (const file of files.filter(name => !Object.hasOwn(seal.files, name))) {
        add('frozen-modified', file, '冻结章出现未登记稿件', 'block', null);
      }
    }
  }
  return findings;
}

function summaryOf(files, findings, suppressed) {
  return {
    files: files.length, block: findings.filter(f => f.level === 'block').length,
    suggest: findings.filter(f => f.level === 'suggest').length, suppressed,
  };
}

function writeSeal(root, data) {
  const target = path.join(root, manifestPath);
  mkdirSync(path.dirname(target), { recursive: true });
  const tempFile = `${target}.${randomUUID()}.tmp`;
  const fd = openSync(tempFile, 'wx');
  try {
    try {
      writeFileSync(fd, `${JSON.stringify(data, null, 2)}\n`);
    } finally {
      closeSync(fd);
    }
    renameSync(tempFile, target);
  } catch (error) {
    unlinkSync(tempFile);
    throw error;
  }
}

function freeze(root, config, force, found) {
  const seal = readSeal(root);
  const modified = modifiedFiles(root, seal);
  if (modified.length && !force) {
    const findings = modified.map(file => finding('frozen-modified', file, '已冻结稿件已更改或删除', { hint: '确认后用 --force 覆盖' }));
    const summary = summaryOf([], findings, 0);
    return { fields: { files: [], findings, summary }, text: renderLint(findings, summary), code: EXIT.FAIL, found };
  }
  const newPaths = frozenDrafts(root, config).flatMap(item => item.files).sort(lexical);
  const files = Object.fromEntries(newPaths.map(file => [file, hash(readFileSync(path.join(root, file)))]));
  const old = seal?.files ?? {};
  const added = newPaths.filter(file => !Object.hasOwn(old, file)).length;
  const removed = Object.keys(old).filter(file => !Object.hasOwn(files, file)).length;
  const kept = newPaths.length - added;
  const data = { spec_version: 1, created: new Date().toISOString(), ranges: config.frozen.ranges, files };
  writeSeal(root, data);
  const report = newPaths.map(file => classify(file));
  return {
    fields: { files: report, findings: [], summary: summaryOf(report, [], 0) },
    text: `新增 ${added}，移除 ${removed}，保持 ${kept}`, found,
  };
}

function classify(file, extraKind) {
  const chapter = chapterDraft.exec(file);
  if (chapter) return { file, kind: 'chapter', chapter: Number(chapter[1]) };
  const kind = extraKind ?? (/^drama\/[^/]+\/episodes\/[^/]+\.md$/.test(file) ? 'episode' : 'extra');
  return { file, kind, chapter: null };
}

function matchSegment(pattern, name) {
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = Array.from(pattern, char => char === '*' ? '.*' : char === '?' ? '.' : escape(char)).join('');
  return new RegExp(`^${source}$`, 'u').test(name);
}

function expandGlob(root, pattern) {
  const results = new Set();
  const segments = pattern.replace(/^\.\//, '').split('/');
  function walk(dir, i) {
    const segment = segments[i];
    if (!segment) return;
    const last = i === segments.length - 1;
    if (segment === '**' && !last) walk(dir, i + 1);
    for (const entry of entries(path.join(root, dir))) {
      const file = dir ? `${dir}/${entry.name}` : entry.name;
      if (segment === '**') {
        if (last && entry.isFile()) results.add(file);
        if (entry.isDirectory()) walk(file, i);
      } else if (matchSegment(segment, entry.name)) {
        if (last && entry.isFile()) results.add(file);
        if (!last && entry.isDirectory()) walk(file, i + 1);
      }
    }
  }
  walk('', 0);
  return [...results].sort(lexical);
}

function selectFiles(root, values, args, config) {
  if (values.series !== undefined) return { files: seriesEpisodeFiles(root, values.series).map(file => classify(file)), missing: [] };
  if (args.length && args.every(arg => arg.endsWith('.md'))) {
    const files = [...new Set(args.map(file => explicitFile(root, file)))].map(file => classify(file));
    files.sort((a, b) => (a.chapter ?? Infinity) - (b.chapter ?? Infinity) || lexical(a.file, b.file));
    return { files, missing: [] };
  }
  const { items, missing } = resolveSelector(root, values.all ? '--all' : args[0]);
  const files = items.map(item => ({ ...item, kind: 'chapter' }));
  if (values.all) {
    const seen = new Set(files.map(item => item.file));
    for (const file of [...new Set(config.lint.extra_files.flatMap(glob => expandGlob(root, glob)))].sort(lexical)) {
      if (!seen.has(file)) files.push({ file, kind: 'extra', chapter: null });
    }
  }
  return { files, missing };
}

function renderLint(findings, summary, missing = []) {
  return [
    ...findings.map(formatFinding), ...(missing.length ? [missingChapters(missing)] : []),
    `检查 ${summary.files} 个文件：阻断 ${summary.block}，建议 ${summary.suggest}，豁免 ${summary.suppressed}。`,
  ].join('\n');
}

const usage = '用法：node scripts/lint.mjs <章节选择> | --all | --series SLUG | <file.md>... '
  + '[--fail-on block|suggest] [--rules r1,r2] [--root DIR] [--json]\n'
  + '      node scripts/lint.mjs --freeze [--force] [--root DIR] [--json]';

/** 命令行入口：硬规则检查或生成冻结清单。 */
export async function main(argv) {
  const options = {
    all: { type: 'boolean' }, series: { type: 'string' }, freeze: { type: 'boolean' }, force: { type: 'boolean' },
    'fail-on': { type: 'string' }, rules: { type: 'string' },
  };
  return runCli('lint', argv, options, usage, (root, values, args) => {
    const modes = [values.all, values.series !== undefined, values.freeze, args.length > 0].filter(Boolean).length;
    if (modes !== 1 || (values.force && !values.freeze)
      || (values.freeze && (values.rules !== undefined || values['fail-on'] !== undefined))
      || (args.length > 1 && !args.every(arg => arg.endsWith('.md')))) throw new Error(usage);
    const { config, found } = requireConfig(root);
    if (values.freeze) return freeze(root, config, values.force, found);
    const { patterns, errors } = loadPatterns(root, config);
    if (errors.length) throw new Error(errors.map(error => `${error.file}:${error.line}：${error.message}`).join('\n'));
    const rules = values.rules === undefined ? null : choices(values.rules, RULES, '--rules');
    const threshold = failLevel(values['fail-on']);
    const { files, missing } = selectFiles(root, values, args, config);
    const findings = freezeCheck(root, config, rules);
    let suppressed = 0;
    let subplotIds = [];
    if (selectedRule('internal-ref', rules) && patterns.some(item => item.id === 'IR07')
      && effectiveLevel(config, 'internal-ref', 'IR07', 'suggest') !== 'off') {
      const subplots = readOptional(root, 'bible/subplots.md');
      if (subplots !== null) {
        // IR07 匹配已定义的标题 ID，不依赖生命周期数据是否完整。
        subplotIds = [...new Set(sections(subplots, 3).flatMap(block => {
          const name = /^(.+?)：\S/.exec(block.name)?.[1];
          return SUBPLOT_ID.test(name ?? '') ? [name] : [];
        }))];
      }
    }
    for (const item of files) {
      const text = readFileSync(path.join(root, item.file), 'utf8');
      const report = lintFile(text, { ...item, config, patterns, subplotIds, rules });
      findings.push(...report.findings);
      suppressed += report.suppressed;
    }
    sortFindings(findings);
    const summary = summaryOf(files, findings, suppressed);
    const code = summary.block || (threshold === 'suggest' && summary.suggest) ? EXIT.FAIL : EXIT.OK;
    return { fields: { files, findings, summary }, text: renderLint(findings, summary, missing), code, found };
  });
}

await directMain(import.meta.url, main);
