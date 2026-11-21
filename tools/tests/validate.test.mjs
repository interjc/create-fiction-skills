import assert from 'node:assert/strict';
import { mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { exactKeys, fixture, get, git, json, notes, put, run, scripts, termFile } from './fixture.mjs';

const skill = `${notes}/SKILL.md`;
const reference = `${notes}/references/nested/cards.md`;
const market = '.claude-plugin/marketplace.json';
const baseDescription = '中文。Sort loose writing notes.';
const skillText = (description = baseDescription, more = '') =>
  `---\nname: fiction-notes\ndescription: ${description}\n${more}---\n`;

function only(root, check, status = 0) {
  const result = json(root, 'validate', ['--only', check], status);
  exactKeys(result, 'tool spec_version root ok skills findings summary');
  exactKeys(result.summary, 'files errors');
  assert.equal(result.summary.errors, result.findings.length);
  for (const entry of result.skills) exactKeys(entry, 'name lines description_chars');
  for (const finding of result.findings) exactKeys(finding, 'check file line message');
  return result;
}

test('validate accepts the entire clean mini-repository and discovers root from below', t => {
  const root = fixture(t);
  json(root, 'sync-shared', [], 0);
  const cwd = path.join(root, notes, 'references');
  const full = json(root, 'validate', [], 0, { cwd });
  assert.equal(full.root, root);
  assert.deepEqual(full.skills.map(entry => entry.name), ['fiction-margin', 'fiction-notes']);
  assert.equal(full.summary.errors, 0);
  assert.match(run(root, 'validate', []).stdout, /0 个错误。\n$/);
  const explicit = json(root, 'validate', ['--root', root], 0, { cwd });
  assert.deepEqual(explicit, full);
  json(root, 'validate', ['--root', cwd], 2);
});

test('skill-md requires a file for each immediate directory and --only filters findings', t => {
  const root = fixture(t);
  only(root, 'skill-md');
  unlinkSync(path.join(root, skill));
  mkdirSync(path.join(root, skill));
  const result = only(root, 'skill-md,frontmatter', 1);
  assert.deepEqual(result.findings.map(f => [f.check, f.file, f.line]), [['skill-md', skill, null]]);
  assert.deepEqual(result.skills.at(-1), { name: 'fiction-notes', lines: null, description_chars: null });
  only(root, 'compatibility');
});

test('frontmatter accepts its scalar subset and rejects malformed or unknown fields and names', t => {
  const root = fixture(t);
  only(root, 'frontmatter');
  for (const [text, line] of [
    [`\n${skillText()}`, 1],
    [skillText().slice(0, -4), 1],
    [skillText(baseDescription, 'revision: 2\n'), 4],
    [skillText(baseDescription, 'license: "unterminated\n'), 4],
    [skillText(baseDescription, 'license: "bad\\q"\n'), 4],
    [skillText(baseDescription, 'allowed-tools: [Read, Write]\n'), 4],
    [skillText(baseDescription, 'name: fiction-notes\n'), 4],
    [skillText(baseDescription, 'metadata:\n  sub:\n    key: value\n'), 6],
    [skillText().replace('fiction-notes', 'fiction-other'), 2],
    [skillText().replace('fiction-notes', 'fiction-Notes'), 2],
    [skillText().replace('fiction-notes', `fiction-${'a'.repeat(57)}`), 2],
  ]) {
    put(root, skill, text);
    assert.equal(only(root, 'frontmatter', 1).findings[0].line, line);
  }
  put(root, skill, skillText(`"中文\\u3002Sort loose writing notes." # comment`,
    "license: 'O''Brien'\nmetadata: # comment\n  版本: >-\n    first\n    second\n")
    .replaceAll('\n', '\r\n'));
  const result = only(root, 'frontmatter,description');
  assert.equal(result.skills.at(-1).description_chars, [...baseDescription].length);
});

test('description observes Chinese-first, the specified English phrase, brackets and code points', t => {
  const root = fixture(t);
  const length = [...baseDescription].length;
  put(root, skill, skillText(`${baseDescription}${'😀'.repeat(1024 - length)}`));
  assert.equal(only(root, 'description').skills.at(-1).description_chars, 1024);
  for (const [description, reason] of [
    ['', /不能为空/],
    ['Work with scenes.', /缺少中文/],
    ['中文。Only two.', /缺少至少 3/],
    ['Work with scenes. 中文。', /中文在前/],
    [`"${baseDescription} <x>"`, /尖括号/],
    [`${baseDescription}${'😀'.repeat(1025 - length)}`, /1025/],
  ]) {
    put(root, skill, skillText(description));
    assert.ok(only(root, 'description', 1).findings.some(finding => reason.test(finding.message)));
  }
});

test('frontmatter folds YAML paragraphs but preserves literal and more-indented breaks', t => {
  const root = fixture(t);
  const rows = '\n  中文。\n  Sort loose\n  writing notes.\n\n  Another paragraph.\n    Indented line.\n  Last line.\n\n';
  const folded = '中文。 Sort loose writing notes.\nAnother paragraph.\n  Indented line.\nLast line.';
  const literal = '中文。\nSort loose\nwriting notes.\n\nAnother paragraph.\n  Indented line.\nLast line.';
  for (const [indicator, expected] of [['>', folded], ['>-', folded], ['|', literal], ['|-', literal]]) {
    put(root, skill, skillText(indicator + rows));
    assert.equal(only(root, 'frontmatter,description').skills.at(-1).description_chars, [...expected].length);
  }
});

test('compatibility is optional and applies the exact character limit', t => {
  const root = fixture(t);
  put(root, skill, skillText());
  only(root, 'compatibility');
  put(root, skill, skillText(baseDescription, `compatibility: '${'😀'.repeat(500)}'\n`));
  only(root, 'compatibility');
  put(root, skill, skillText(baseDescription, `compatibility: |-\n  ${'😀'.repeat(500)}\n`));
  only(root, 'compatibility');
  put(root, skill, skillText(baseDescription, `compatibility: |\n  ${'😀'.repeat(500)}\n`));
  assert.equal(only(root, 'compatibility', 1).findings[0].line, 4);
  put(root, skill, skillText(baseDescription, `compatibility: '${'😀'.repeat(501)}'\n`));
  assert.equal(only(root, 'compatibility', 1).findings[0].line, 4);
});

test('skill-lines and reference-lines enforce limits, including unterminated last lines', t => {
  const root = fixture(t);
  put(root, skill, skillText() + '行\r\n'.repeat(495) + '末行');
  put(root, reference, '行\n'.repeat(399) + '末行');
  put(root, 'docs/references/elsewhere.md', '行\n'.repeat(401));
  assert.equal(only(root, 'skill-lines,reference-lines').skills.at(-1).lines, 500);
  put(root, skill, `${get(root, skill)}\n再添一行`);
  put(root, reference, `${get(root, reference)}\n再添一行`);
  assert.deepEqual(only(root, 'skill-lines,reference-lines', 1).findings.map(f => f.check),
    ['skill-lines', 'reference-lines']);
});

test('links check definitions, images and inline links but ignore fenced/inline code and external URLs', t => {
  const root = fixture(t);
  put(root, 'docs/links/page with space.md', '# 标题\n');
  put(root, 'docs/links/note(a).md', '# 夹页\n');
  const doc = 'docs/links/guide.md';
  put(root, doc, [
    '[页](page%20with%20space.md?mode=1#section "提示")',
    '![索引](<page with space.md> \'提示\')',
    '[夹页](note(a).md)',
    '[定位]: <page with space.md> (提示)',
    '[目录](../links/)',
    '[协议](mailto:test@example.invalid) [边栏](#id) [远端](//example.invalid/x) [当前](?mode=1)',
    '`` `[不检查](missing.md)` `` 和 [用 `]` 作标签](note(a).md)',
    '`跨行的 [例子](missing.md)',
    '仍在代码内`',
    '````js',
    '[代码](missing.md)',
    '```',
    '[仍在代码内](missing.md)',
    '````',
    '~~~',
    '[引用]: missing.md',
    '~~~',
    '- ```',
    '  [列表中的代码](missing.md)',
    '  ```',
    '> ~~~',
    '> [引用中的代码](missing.md)',
    '> ~~~',
    '[标题中的反引号](note(a).md "含 `示例` 的标题")',
    '',
  ].join('\n'));
  only(root, 'links');
  put(root, doc, get(root, doc) + [
    '[缺少](no.md?mode=1#section)',
    '![绝对](/usr)',
    '[坏掉]: missing.md "提示"',
    '[坏转义](bad%ZZ.md)',
    '[非法编码绝对路径](%2fusr)',
    '[标题中的反引号](no.md "含 `示例` 的标题")',
    '',
  ].join('\n'));
  const result = only(root, 'links', 1);
  assert.deepEqual(result.findings.map(f => [f.file, f.line]), [25, 26, 27, 28, 29, 30].map(line => [doc, line]));
  assert.match(result.findings[0].message, /链接目标不存在/);
  assert.match(result.findings[1].message, /相对路径/);
});

test('imports covers each literal form, does not execute code, and enforces empty dependency maps', t => {
  const root = fixture(t);
  put(root, 'tools/item one.mjs', 'export const item = 1;\n');
  put(root, 'tools/dep.mjs', 'export default 1;\nexport const item = 1;\n');
  const file = 'tools/probe.mjs';
  const allowed = [
    '#!/usr/bin/env node',
    'import',
    "  value, { item } from /* spacer */ './dep.mjs';",
    'export * as dep from "./dep.mjs";',
    "export { item as next } from './dep.mjs';",
    "import 'node:fs';",
    "import('./item%20one.mjs?opt=1#id');",
    "require('./dep.mjs');",
    "import('./' + value);",
    '// import("comment-decoy");',
    `const text = "export * from 'string-decoy'";`,
    "const code = `import('template-decoy')`;",
    "const reg = /require('regex-decoy')/;",
    "if (text) /import('regex-after-if')/.test(text);",
    "obj.require('method-decoy');",
    "throw new Error('This file must not execute');",
    '',
  ].join('\n');
  put(root, file, allowed);
  put(root, 'elsewhere/ignored.mjs', "import 'not-in-scope';\n");
  const pkg = 'elsewhere/package.json';
  put(root, pkg, JSON.stringify({ dependencies: {}, devDependencies: {}, peerDependencies: {}, optionalDependencies: {} }));
  only(root, 'imports');
  put(root, file, allowed + [
    "import item from 'bare-package';",
    "export * from './missing.mjs';",
    "import './';",
    'await import("https://example.invalid/code.js");',
    `require("n\\x6ft-local");`,
    "const templ = `${import('template-expression')}`;",
    "obj.if(2) / require('in-division') / 2;",
    "require('./dep.mjs?not-a-commonjs-query');",
    '',
  ].join('\n'));
  put(root, pkg, JSON.stringify({ dependencies: { unsafe: '*' }, devDependencies: [], peerDependencies: null, optionalDependencies: '' }));
  const result = only(root, 'imports', 1);
  assert.equal(result.findings.filter(f => f.file === pkg).length, 4);
  assert.deepEqual(result.findings.filter(f => f.file === file).map(f => f.line), [17, 18, 19, 20, 21, 22, 23, 24]);
  put(root, pkg, '{');
  assert.ok(only(root, 'imports', 1).findings.some(f => f.file === pkg && /JSON/.test(f.message)));
});

test('debook follows sections, comments, ASCII boundaries, case-sensitive regex and all supported globs', t => {
  const root = fixture(t);
  put(root, termFile, `\ufeff${get(root, termFile)}`);
  const text = 'murmurRIVET-73 瓷雾铃钮 fixture-sigil-32';
  for (const file of ['exempt/itemA.txt', 'exempt/deep/more/item😀.txt', 'notes/safe-.txt', 'decoys/a/b.md']) {
    put(root, file, text);
  }
  put(root, 'notes/ordinary.txt', 'an invented label\nmurmurRivet-731 aMurmurRivet-73\nFixture-sigil-32');
  put(root, 'bytes.md', Buffer.concat([Buffer.alloc(8191, 32), Buffer.from(`\0${text}`)]));
  only(root, 'debook');
  put(root, 'exempt/itemAB.txt', text);
  put(root, 'unexpected.extension', `首行\n${text} murmurRIVET-73`);
  put(root, 'after.bin', Buffer.concat([Buffer.alloc(8192, 32), Buffer.from(`\0${text}`)]));
  const result = only(root, 'debook', 1);
  assert.deepEqual(result.findings.map(f => [f.file, f.line]), [
    ...Array.from({ length: 3 }, () => ['after.bin', 1]),
    ...Array.from({ length: 3 }, () => ['exempt/itemAB.txt', 1]),
    ...Array.from({ length: 4 }, () => ['unexpected.extension', 2]),
  ]);
  assert.match(result.findings[0].message, /命中 \[names\] 词条：MurmurRivet-73/);
});

test('invalid debook terms and arguments exit 2 without breaking JSON shape', t => {
  const root = fixture(t);
  for (const content of ['unsectioned', '[invalid]\nterm', '[terms]\nre:(', '[allow-paths]\n/escape/', Buffer.from([255])]) {
    put(root, termFile, content);
    json(root, 'validate', ['--only', 'debook'], 2);
  }
  only(root, 'frontmatter');
  for (const args of [['--only', 'bad'], ['--only', 'links,'], ['--unknown'], ['--root', '']]) {
    const result = json(root, 'validate', args, 2);
    exactKeys(result, 'tool spec_version root ok skills findings summary');
  }
  for (const tool of ['validate', 'sync-shared']) {
    const result = run(root, tool, ['--help', '--root', path.join(root, 'missing')]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /用法/);
    assert.equal(result.stderr, '');
  }
  const wrongRoot = json(root, 'validate', ['--root', path.join(root, 'missing')], 2);
  assert.deepEqual(wrongRoot.summary, { files: 0, errors: 0 });
});

test('git enumeration honors ignored untracked files, preserves tracked ones and handles missing cache paths', t => {
  const root = fixture(t);
  git(root, 'init', '-q');
  put(root, 'tracked.md', '[坏链接](missing.md)\n');
  put(root, 'removed.md', '[坏链接](missing.md)\n');
  git(root, 'add', '--', 'tracked.md', 'removed.md');
  unlinkSync(path.join(root, 'removed.md'));
  put(root, '.gitignore', 'tracked.md\nignored.md\n');
  put(root, 'ignored.md', '[坏链接](missing.md)\n');
  put(root, 'with\nnewline.md', '[坏链接](missing.md)\n');
  const result = only(root, 'links', 1);
  assert.deepEqual(result.findings.map(f => f.file), ['tracked.md', 'with\nnewline.md']);
  const fallback = json(root, 'validate', ['--only', 'links'], 1, { env: { ...process.env, PATH: '' } });
  assert.deepEqual(fallback.findings.map(f => f.file), ['ignored.md', 'tracked.md', 'with\nnewline.md']);
});

test('fallback walk excludes only the named directories and still scans arbitrary extensions', t => {
  const root = fixture(t);
  for (const parent of ['.git', '.agent-team', 'node_modules']) {
    put(root, `nested/${parent}/hidden.data`, '瓷雾铃钮');
  }
  only(root, 'debook');
  put(root, 'nested/visible.data', '瓷雾铃钮');
  assert.deepEqual(only(root, 'debook', 1).findings.map(f => f.file), ['nested/visible.data']);
});

test('shared-drift reports the exact same missing, drift and stale paths as sync --check', t => {
  const root = fixture(t);
  json(root, 'sync-shared', [], 0);
  only(root, 'shared-drift');
  put(root, `${scripts}/lib/stale.mjs`, 'export const draft = 1;');
  put(root, `${scripts}/lib/paper.mjs`, 'export const paper = "改稿";');
  unlinkSync(path.join(root, `${scripts}/record.mjs`));
  const expected = json(root, 'sync-shared', ['--check'], 1).changes;
  const result = only(root, 'shared-drift', 1).findings;
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(f => f.file), expected.map(f => f.file));
  expected.forEach((change, i) => assert.ok(result[i].message.endsWith(change.action)));
});

test('marketplace permits missing file, checks nested paths and requires directories and valid JSON', t => {
  const root = fixture(t);
  only(root, 'marketplace');
  put(root, market, JSON.stringify({ nested: [{ source: `./${skill}` }, './skills/missing', './docs/spec'] }));
  assert.equal(only(root, 'marketplace', 1).findings.length, 2);
  put(root, market, '{');
  assert.match(only(root, 'marketplace', 1).findings[0].message, /JSON/);
  unlinkSync(path.join(root, market));
  only(root, 'marketplace');
});
