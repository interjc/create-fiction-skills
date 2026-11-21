#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadDebook } from './lib/debook.mjs';
import { loadFormats } from './lib/formats.mjs';
import { parseFrontmatter } from './lib/frontmatter.mjs';
import { importSpecifiers } from './lib/javascript.mjs';
import { markdownLinks } from './lib/markdown.mjs';
import { codePoints, compare, countLines, isObject, repoFiles, runCli, stat } from './lib/repo.mjs';
import { syncShared } from './lib/shared-sync.mjs';
import { checkDialectCard, checkSpecRefs } from './lib/skill-references.mjs';

const checks = new Set([
  'skill-md', 'frontmatter', 'description', 'compatibility', 'skill-lines',
  'reference-lines', 'links', 'imports', 'debook', 'shared-drift', 'marketplace',
  'dialect-card', 'spec-ref',
]);
const keys = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const marketplace = '.claude-plugin/marketplace.json';
const dependencies = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const chinese = /[㐀-鿿]/u;
const english = /[A-Za-z]{2,}(?:[\s,'-]+[A-Za-z]{2,}){2,}/u;

function readText(absolute) {
  const buffer = readFileSync(absolute);
  return buffer.subarray(0, 8192).includes(0) ? undefined : buffer.toString('utf8');
}

function checkSkill(file, name, text, add) {
  const lines = countLines(text);
  if (lines > 500) add('skill-lines', file, null, `SKILL.md 有 ${lines} 行，超过 500 行`);
  const { fields, error } = parseFrontmatter(text);
  if (error) {
    add('frontmatter', file, error.line, error.message);
    return { lines, description_chars: null };
  }
  for (const [key, { line }] of fields) {
    if (!keys.has(key)) add('frontmatter', file, line, `不允许的 frontmatter 键：${key}`);
  }
  const entry = fields.get('name');
  if (!entry || !/^fiction-[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.value) ||
      entry.value.length > 64 || entry.value !== name) {
    add('frontmatter', file, entry?.line ?? null, 'name 必须符合 fiction-kebab-case、不超过 64 字符且等于目录名');
  }
  const description = fields.get('description');
  const value = description?.blockScalar ? description.value.replace(/\n+$/u, '') : description?.value ?? '';
  const chars = codePoints(value);
  const zh = value.search(chinese);
  const en = value.search(english);
  const desc = message => add('description', file, description?.line ?? null, message);
  if (!value.trim()) desc('description 不能为空');
  if (chars > 1024) desc(`description 有 ${chars} 个码点，超过 1024`);
  if (zh === -1) desc('description 缺少中文');
  if (en === -1) desc('description 缺少至少 3 个连续英文词');
  if (zh !== -1 && en !== -1 && zh >= en) desc('description 必须中文在前');
  if (/[<>]/.test(value)) desc('description 不得包含尖括号');
  const compatibility = fields.get('compatibility');
  if (compatibility && codePoints(compatibility.value) > 500) {
    add('compatibility', file, compatibility.line, 'compatibility 超过 500 个码点');
  }
  return { lines, description_chars: chars };
}

function linkIssue(root, file, target) {
  if (/^[A-Za-z][A-Za-z0-9+.-]*:|^#|^\/\//.test(target)) return;
  if (target.startsWith('/')) return `链接必须使用相对路径：${target}`;
  let local;
  try {
    local = decodeURIComponent(target.split(/[?#]/u, 1)[0]);
  } catch {
    return `链接目标的百分号转义无效：${target}`;
  }
  if (local.includes('\0') || path.isAbsolute(local)) return `链接不是有效的相对路径：${target}`;
  const resolved = local ? path.resolve(root, path.posix.dirname(file), local) : path.join(root, file);
  const info = stat(resolved, true);
  if (!info?.isFile() && !info?.isDirectory()) return `链接目标不存在：${target}`;
}

function imports(root, file, text, add) {
  for (const { value, line, column, commonJS } of importSpecifiers(text)) {
    if (value.startsWith('node:')) continue;
    const relative = value.startsWith('./') || value.startsWith('../');
    // Node's ESM file specifiers use URL escaping, queries and fragments.
    let local;
    if (commonJS) local = value;
    else {
      try {
        const pathname = value.split(/[?#]/u, 1)[0];
        if (!/%(?:2f|5c)/i.test(pathname)) local = decodeURIComponent(pathname);
      } catch {
        // The specifier is still reported as a finding, not an internal error.
      }
    }
    if (!relative || !local || local.includes('\0') ||
        !stat(path.resolve(root, path.posix.dirname(file), local), true)?.isFile()) {
      add('imports', file, line, `模块说明符必须为 node: 或指向现有文件的相对路径：${value}`, column);
    }
  }
}

function readJson(text, file, check, add) {
  try {
    return { value: JSON.parse(text) };
  } catch {
    add(check, file, null, '不是合法的 JSON');
  }
}

function checkPackage(file, text, add) {
  const parsed = readJson(text, file, 'imports', add);
  if (!parsed) return;
  if (!isObject(parsed.value)) {
    add('imports', file, null, 'package.json 必须为对象');
    return;
  }
  for (const key of dependencies) {
    if (!Object.hasOwn(parsed.value, key)) continue;
    const value = parsed.value[key];
    if (!isObject(value) || Object.keys(value).length) {
      add('imports', file, null, `${key} 必须不存在或为空对象`);
    }
  }
}

function checkMarketplace(root, text, add) {
  const parsed = readJson(text, marketplace, 'marketplace', add);
  if (!parsed) return;
  const values = [parsed.value];
  while (values.length) {
    const value = values.pop();
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) values.push(child);
    } else if (typeof value === 'string' && value.startsWith('./skills/')) {
      if (value.includes('\0') || !stat(path.resolve(root, value), true)?.isDirectory()) {
        add('marketplace', marketplace, null, `skill 目录不存在：${value}`);
      }
    }
  }
}

function validate(root, { only }) {
  const selected = only === undefined ? checks : new Set(only.split(','));
  for (const check of selected) if (!checks.has(check)) throw new Error(`未知检查：${check || '（空）'}`);
  const includes = check => selected.has(check);
  const debook = includes('debook') ? loadDebook(root) : undefined;
  const formats = includes('spec-ref') ? loadFormats(root) : undefined;
  const sections = new Map(Object.entries(formats?.skills ?? {}).map(([name, topics]) =>
    [name, new Set(topics.flatMap(topic => formats.topics[topic].sections))]));
  const noSections = new Set();
  const findings = [];
  const add = (check, file, line, message, column = null) => {
    if (includes(check)) findings.push({ check, file, line, message, column });
  };
  const files = new Set(repoFiles(root).filter(file => {
    const info = stat(path.join(root, file));
    return info?.isFile() || info?.isSymbolicLink();
  }));
  const skills = [];
  for (const entry of readdirSync(path.join(root, 'skills'), { withFileTypes: true }).sort((a, b) => compare(a.name, b.name))) {
    if (!entry.isDirectory()) continue;
    const { name } = entry;
    const file = `skills/${name}/SKILL.md`;
    const absolute = path.join(root, file);
    const exists = stat(absolute)?.isFile();
    const text = exists && files.has(file) ? readText(absolute) : undefined;
    if (!exists) add('skill-md', file, null, '缺少 SKILL.md');
    skills.push({
      name,
      ...(text === undefined ? { lines: null, description_chars: null } : checkSkill(file, name, text, add)),
    });
  }

  for (const file of files) {
    const md = file.endsWith('.md');
    const refs = includes('reference-lines') && /^skills\/[^/]+\/references\//.test(file) && md;
    const links = includes('links') && md;
    const js = includes('imports') && /^(?:skills|shared|tools)\/.*\.(?:mjs|js)$/s.test(file);
    const pkg = includes('imports') && path.posix.basename(file) === 'package.json';
    const scan = debook && !debook.skips(file);
    const market = includes('marketplace') && file === marketplace;
    const dialect = includes('dialect-card') && /^skills\/[^/]+\/references\/dialects\/([^/]+)\.md$/.exec(file);
    const spec = includes('spec-ref') && md && /^skills\/([^/]+)\/(?!references\/formats\/)/.exec(file);
    if (!(refs || links || js || pkg || scan || market || dialect || spec)) continue;
    const absolute = path.join(root, file);
    if (!stat(absolute)?.isFile()) continue;
    const text = readText(absolute);
    if (text === undefined) continue;
    if (refs) {
      const lines = countLines(text);
      if (lines > 400) add('reference-lines', file, null, `参考文档有 ${lines} 行，超过 400 行`);
    }
    if (links) for (const { target, line, column } of markdownLinks(text)) {
      const issue = linkIssue(root, file, target);
      if (issue) add('links', file, line, issue, column);
    }
    if (js) imports(root, file, text, add);
    if (pkg) checkPackage(file, text, add);
    if (market) checkMarketplace(root, text, add);
    if (dialect) checkDialectCard(text, dialect[1], (line, message) => add('dialect-card', file, line, message));
    if (spec) checkSpecRefs(text, formats && (sections.get(spec[1]) ?? noSections),
      (line, message, column) => add('spec-ref', file, line, message, column));
    if (scan) for (const { line, message, column } of debook.find(text)) add('debook', file, line, message, column);
  }
  if (includes('shared-drift')) for (const { file, action } of syncShared(root, { check: true }).changes) {
    add('shared-drift', file, null, `共用代码不同步：${action}`);
  }
  findings.sort((a, b) => compare(a.file, b.file) || (a.line ?? 0) - (b.line ?? 0) ||
    (a.column ?? 0) - (b.column ?? 0) || compare(a.check, b.check));
  return {
    ok: findings.length === 0, skills,
    findings: findings.map(({ check, file, line, message }) => ({ check, file, line, message })),
    summary: { files: files.size, errors: findings.length },
  };
}

process.exitCode = runCli({
  tool: 'validate',
  usage: '用法：node tools/validate.mjs [--only c1,c2] [--root DIR] [--json] [--help]',
  options: { only: { type: 'string' } },
  empty: () => ({ ok: false, skills: [], findings: [], summary: { files: 0, errors: 0 } }),
  run: validate,
  print({ skills, findings, summary }) {
    for (const { file, line, check, message } of findings) {
      console.log(`ERROR ${file}${line === null ? '' : `:${line}`} ${check}：${message}`);
    }
    console.log(`校验 ${summary.files} 个文件、${skills.length} 个 skill：${summary.errors} 个错误。`);
  },
}, process.argv.slice(2));
