import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

export function stat(file, follow = false) {
  try {
    return (follow ? statSync : lstatSync)(file);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    return undefined;
  }
}

export function findRepo(start, searchParents) {
  if (!stat(start, true)?.isDirectory()) throw new Error(`不是目录：${start}`);
  for (let dir = start;; dir = path.dirname(dir)) {
    if (stat(path.join(dir, 'skills'))?.isDirectory() &&
        stat(path.join(dir, 'docs/spec'))?.isDirectory()) return dir;
    if (!searchParents || dir === path.dirname(dir)) {
      throw new Error(`找不到同时含 skills/ 和 docs/spec/ 的仓库根：${start}`);
    }
  }
}

export const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const codePoints = text => [...text].length;
export const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const splitLines = text => text.split(/\r\n|\n|\r/);
export const countLines = text => (text.match(/\n/g)?.length ?? 0) + Number(text.length > 0 && !text.endsWith('\n'));
export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const excludedDirs = new Set(['.git', '.agent-team', 'node_modules']);

function* walk(root, parent = '') {
  for (const entry of readdirSync(path.join(root, parent), { withFileTypes: true })) {
    const file = parent ? `${parent}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) yield* walk(root, file);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      yield file;
    }
  }
}

export function repoFiles(root) {
  if (stat(path.join(root, '.git'))) {
    const result = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error?.code !== 'ENOENT') {
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`git ls-files 失败：${result.stderr.trim()}`);
      return [...new Set(result.stdout.split('\0').filter(Boolean))].sort(compare);
    }
  }
  return [...walk(root)].sort(compare);
}

export function runCli({ tool, usage, options, empty, run, print }, argv) {
  let root = process.cwd();
  let values;
  const emit = body => console.log(JSON.stringify({ tool, spec_version: 1, root, ...body }, null, 2));
  try {
    const parsed = parseArgs({
      args: argv, tokens: true,
      options: { help: { type: 'boolean' }, json: { type: 'boolean' }, root: { type: 'string' }, ...options },
    });
    values = parsed.values;
    if (values.help) {
      console.log(usage);
      return 0;
    }
    const seen = new Set();
    for (const { name } of parsed.tokens) {
      if (seen.has(name)) throw new Error(`重复参数：--${name}`);
      seen.add(name);
    }
    if (values.root === '') throw new Error('--root 不能为空');
    root = path.resolve(values.root ?? root);
    root = findRepo(root, values.root === undefined);
    const body = run(root, values);
    if (values.json) emit(body);
    else print(body);
    return body.ok ? 0 : 1;
  } catch (error) {
    if (values?.json ?? argv.includes('--json')) emit(empty(values ?? {}));
    console.error(`${tool}：${error.message}`);
    return 2;
  }
}
