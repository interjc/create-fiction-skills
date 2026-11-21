#!/usr/bin/env node
// 为一个评测用例准备草稿目录：复制示例书（或建空目录）→ 按用例施加前置改动 → 记录基线哈希。
// 用法：node evals/prepare.mjs <skill> <eval-id> <run-dir>
// 产物：<run-dir>/book（评测时的书根，也是 agent 的工作目录）与 <run-dir>/baseline.json。
// 只读 examples/ 与 evals/fixtures/，绝不写回仓库。
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..');
const demo = path.join(repo, 'examples', 'demo-book');
const flawed = path.join(repo, 'evals', 'fixtures', 'flawed-chapter', 'chapters', '1', '4');
const series = 'drama/stopped-clock';

// 每个用例的前置改动。base: demo = 复制示例书；empty = 空书根。
const setups = {
  'fiction-init/1': { base: 'empty', ops: [] },
  'fiction-init/2': { base: 'demo', ops: [] },
  'fiction-init/3': { base: 'empty', ops: [{ manuscript: true }] },
  'fiction-planner/1': { base: 'empty', ops: [] },
  'fiction-planner/2': { base: 'demo', ops: [] },
  'fiction-planner/3': { base: 'demo', ops: [{ remove: ['publish/blurb.md'] }] },
  'fiction-chapter/1': { base: 'demo', ops: [] },
  'fiction-chapter/2': { base: 'demo', ops: [] },
  'fiction-chapter/3': { base: 'demo', ops: [{ freeze: ['1-3'] }] },
  'fiction-review/1': { base: 'demo', ops: [{ overlay: [flawed, 'chapters/1/4'] }] },
  'fiction-review/2': { base: 'demo', ops: [{ overlay: [flawed, 'chapters/1/4'] }] },
  'fiction-review/3': {
    base: 'demo',
    ops: [
      { replace: ['publish/blurb.md', '推开了渡口老街十七号', '推开了安洲市渡口老街十七号'] },
      { replace: ['publish/blurb.md', '那年霜降刚过三天', '2011 年霜降刚过三天'] },
      { replace: ['publish/blurb.md', '而林砚只想修好那台停了十五年的钟。',
        '而林砚只想修好那台停了十五年的钟。这不仅仅是一台停摆的钟，更是一段被河水掩埋的旧账。'] },
    ],
  },
  'fiction-continuity/1': { base: 'demo', ops: [] },
  'fiction-continuity/2': { base: 'demo', ops: [{ overlay: [flawed, 'chapters/1/4'] }] },
  'fiction-continuity/3': { base: 'demo', ops: [{ overlay: [flawed, 'chapters/1/4'] }] },
  'fiction-craft/1': { base: 'demo', ops: [] },
  'fiction-craft/2': { base: 'demo', ops: [] },
  'fiction-craft/3': { base: 'demo', ops: [] },
  'fiction-workflow/1': { base: 'demo', ops: [] },
  'fiction-workflow/2': { base: 'demo', ops: [] },
  'fiction-workflow/3': { base: 'demo', ops: [{ replace: [`${series}/episodes/ep003.md`, '- 状态：定稿', '- 状态：修改'] }] },
  'fiction-short-drama/1': { base: 'demo', ops: [] },
  'fiction-short-drama/2': { base: 'demo', ops: [] },
  'fiction-short-drama/3': {
    base: 'demo',
    ops: [
      { replace: [`${series}/episodes/ep002.md`, '- 状态：定稿', '- 状态：初稿'] },
      { replace: [`${series}/episodes/ep002.md`, '人物：林砚\n【特写】',
        '人物：林砚\n林砚（OS）：蔡伯走得急，这铺子里怕是藏着事。\n【特写】'] },
      { replace: [`${series}/episodes/ep002.md`, '△ 吴老栓摔上值班棚木门。',
        '△ 林砚心里一沉，意识到事情没那么简单。\n△ 吴老栓摔上值班棚木门。'] },
      { replace: [`${series}/episodes/ep002.md`, '\n<!-- hook: B -->\n', '\n'] },
      { replace: [`${series}/episodes/ep002.md`, '吴老栓（冷喝）：', '<!-- hook: B -->\n吴老栓（冷喝）：'] },
    ],
  },
  'fiction-storyboard/1': {
    base: 'demo',
    ops: [
      { remove: [`${series}/storyboards/ep003.md`, `${series}/prompts/ep003-image.md`, `${series}/prompts/ep003-video.md`] },
      { dropLine: [`${series}/visual/continuity.md`, '| 3 | 旧钥匙'] },
    ],
  },
  'fiction-storyboard/2': {
    base: 'demo',
    ops: [{ replace: [`${series}/episodes/ep002.md`, '不介意我看看背号吧？', '介意我看一眼背号吗？'] }],
  },
  'fiction-storyboard/3': {
    base: 'demo',
    ops: [
      { replace: [`${series}/episodes/ep003.md`, '- 状态：定稿', '- 状态：初稿'] },
      { remove: [`${series}/storyboards/ep003.md`, `${series}/prompts/ep003-image.md`, `${series}/prompts/ep003-video.md`] },
      { dropLine: [`${series}/visual/continuity.md`, '| 3 | 旧钥匙'] },
    ],
  },
  'fiction-visual-prompts/1': {
    base: 'demo',
    ops: [{ remove: [`${series}/prompts/ep003-image.md`, `${series}/prompts/ep003-video.md`] }],
  },
  'fiction-visual-prompts/2': { base: 'demo', ops: [] },
  'fiction-visual-prompts/3': {
    base: 'demo',
    ops: [{ replace: [`${series}/storyboards/ep002.md`, '江澜：不介意我看看背号吧？', '江澜：不介意我翻过来看看背号吧？'] }],
  },
};

function fail(message) {
  console.error(`prepare: ${message}`);
  process.exit(2);
}

function walk(root, dir = root, out = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue; // 执行者（如 Codex）可能要求书根是 git 仓库
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(root, full, out);
    else if (entry.isFile()) {
      const rel = path.relative(root, full).split(path.sep).join('/');
      out[rel] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  }
  return out;
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function apply(book, op, log) {
  if (op.overlay) {
    const [from, to] = op.overlay;
    cpSync(from, path.join(book, to), { recursive: true });
    log.push(`复制 ${path.relative(repo, from)} → ${to}`);
  } else if (op.remove) {
    for (const file of op.remove) {
      const target = path.join(book, file);
      if (!existsSync(target)) fail(`要删除的文件不存在：${file}`);
      rmSync(target);
      log.push(`删除 ${file}`);
    }
  } else if (op.replace) {
    const [file, from, to] = op.replace;
    const target = path.join(book, file);
    const text = readFileSync(target, 'utf8');
    if (!text.includes(from)) fail(`${file} 中找不到要替换的片段：${JSON.stringify(from)}`);
    writeFileSync(target, text.replace(from, to));
    log.push(`改写 ${file}：${JSON.stringify(from)} → ${JSON.stringify(to)}`);
  } else if (op.dropLine) {
    const [file, prefix] = op.dropLine;
    const target = path.join(book, file);
    const lines = readFileSync(target, 'utf8').split('\n');
    const kept = lines.filter(line => !line.startsWith(prefix));
    if (kept.length === lines.length) fail(`${file} 中没有以 ${prefix} 开头的行`);
    writeFileSync(target, kept.join('\n'));
    log.push(`删去 ${file} 中以「${prefix}」开头的行`);
  } else if (op.freeze) {
    const file = path.join(book, '.fiction', 'config.json');
    const config = JSON.parse(readFileSync(file, 'utf8'));
    config.frozen = { ...(config.frozen ?? {}), ranges: op.freeze };
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
    execFileSync(process.execPath, [path.join(repo, 'skills', 'fiction-init', 'scripts', 'lint.mjs'), '--freeze', '--root', book],
      { stdio: 'pipe' });
    log.push(`frozen.ranges = ${JSON.stringify(op.freeze)}，已运行 lint.mjs --freeze`);
  } else if (op.manuscript) {
    const names = ['第一章 停在三点十分.md', '第二章 墙缝里的钥匙.md', '第三章 半夜来借电话的人.md'];
    mkdirSync(path.join(book, 'manuscript'), { recursive: true });
    names.forEach((name, index) => {
      cpSync(path.join(demo, 'chapters', '1', String(index + 1), 'v1.md'), path.join(book, 'manuscript', name));
    });
    log.push('在 manuscript/ 放入 3 份旧稿（取自示例书第 1–3 章正文），无 bible、无配置');
  } else fail(`未知的前置操作：${JSON.stringify(op)}`);
}

const [skill, id, runDir] = process.argv.slice(2);
if (!skill || !id || !runDir) {
  console.error('用法：node evals/prepare.mjs <skill> <eval-id> <run-dir>');
  console.error(`已登记用例：${Object.keys(setups).join(' ')}`);
  process.exit(2);
}
const setup = setups[`${skill}/${id}`];
if (!setup) fail(`未登记的用例：${skill}/${id}`);

const run = path.resolve(runDir);
for (const guarded of ['examples', 'skills', 'shared', 'docs', path.join('evals', 'fixtures')]) {
  if (inside(run, path.join(repo, guarded))) fail(`草稿目录不能放在仓库的 ${guarded}/ 里`);
}
const book = path.join(run, 'book');
if (existsSync(book)) fail(`${book} 已存在；换一个空目录或先手动删除`);
mkdirSync(run, { recursive: true });

const log = [];
if (setup.base === 'demo') {
  cpSync(demo, book, { recursive: true });
  log.push('复制 examples/demo-book → book');
} else {
  mkdirSync(book);
  log.push('新建空书根 book');
}
for (const op of setup.ops) apply(book, op, log);

const baseline = { case: `${skill}/${id}`, created: new Date().toISOString(), files: walk(book) };
writeFileSync(path.join(run, 'baseline.json'), `${JSON.stringify(baseline, null, 2)}\n`);
console.log(JSON.stringify({ case: baseline.case, book, files: Object.keys(baseline.files).length, setup: log }, null, 2));
