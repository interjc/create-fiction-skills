#!/usr/bin/env node
// 对比评测运行后的书根与 prepare.mjs 记下的基线，列出新增、修改、删除的文件。
// 用法：node evals/diff.mjs <run-dir> [--only <路径前缀>]...
// 输出 JSON；退出码恒为 0（是否算失败由断言决定），参数或文件错误时为 2。
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function walk(root, dir = root, out = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(root, full, out);
    else if (entry.isFile()) {
      const rel = path.relative(root, full).split(path.sep).join('/');
      out[rel] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  }
  return out;
}

const args = process.argv.slice(2);
const runDir = args.find(arg => !arg.startsWith('--') && args[args.indexOf(arg) - 1] !== '--only');
const prefixes = args.flatMap((arg, index) => (args[index - 1] === '--only' ? [arg] : []));
if (!runDir) {
  console.error('用法：node evals/diff.mjs <run-dir> [--only <路径前缀>]...');
  process.exit(2);
}
const run = path.resolve(runDir);
const baselineFile = path.join(run, 'baseline.json');
const book = path.join(run, 'book');
if (!existsSync(baselineFile) || !existsSync(book)) {
  console.error(`diff: ${run} 下缺少 baseline.json 或 book/，请先运行 prepare.mjs`);
  process.exit(2);
}

const before = JSON.parse(readFileSync(baselineFile, 'utf8')).files;
const after = walk(book);
const keep = file => prefixes.length === 0 || prefixes.some(prefix => file.startsWith(prefix));
const added = Object.keys(after).filter(file => !(file in before) && keep(file)).sort();
const deleted = Object.keys(before).filter(file => !(file in after) && keep(file)).sort();
const modified = Object.keys(after).filter(file => file in before && before[file] !== after[file] && keep(file)).sort();
console.log(JSON.stringify({ book, only: prefixes, added, modified, deleted, unchanged: added.length + modified.length + deleted.length === 0 }, null, 2));
