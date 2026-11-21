import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url));
const tools = fileURLToPath(new URL('../', import.meta.url));
export const notes = 'skills/fiction-notes';
export const scripts = `${notes}/scripts`;
export const termFile = 'docs/spec/debook-terms.txt';
export const formatFile = 'shared/formats.json';
export const formatSource = 'docs/spec/story-bible.md';

export function fixture(t) {
  const root = mkdtempSync(path.join(fixtures, '.case-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(path.join(fixtures, 'mini-repo'), root, { recursive: true });
  return root;
}

export function put(root, file, contents) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

export function fixtureFormats(root) {
  const formats = {
    source: formatSource,
    topics: {
      whole: { title: '完整夹页', sections: ['1'] },
      lead: { title: '开场', sections: ['1.0'] },
      note: { title: '手记与存档', sections: ['2', '1.1'] },
    },
    skills: {
      'fiction-notes': ['note', 'whole', 'lead'],
      'fiction-card': ['lead'],
      'fiction-archive': ['note'],
    },
  };
  put(root, formatFile, JSON.stringify(formats));
  return formats;
}

export const get = (root, file) => readFileSync(path.join(root, file), 'utf8');

export function run(root, tool, args, { env, cwd = root } = {}) {
  const result = spawnSync(process.execPath, [path.join(tools, `${tool}.mjs`), ...args], {
    cwd, encoding: 'utf8', env,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

export function json(root, tool, args, status, options) {
  const result = run(root, tool, [...args, '--json'], options);
  assert.equal(result.status, status, `${result.stdout}\n${result.stderr}`);
  if (status === 2) assert.ok(result.stderr);
  else assert.equal(result.stderr, '');
  const value = JSON.parse(result.stdout);
  assert.equal(result.stdout, `${JSON.stringify(value, null, 2)}\n`);
  assert.equal(value.spec_version, 1);
  assert.equal(value.tool, tool);
  assert.ok(path.isAbsolute(value.root));
  assert.equal(value.ok, status === 0);
  return value;
}

export function exactKeys(object, keys) {
  assert.deepEqual(Object.keys(object).sort(), keys.split(' ').sort());
}

export function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
}
