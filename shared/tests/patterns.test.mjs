import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const { DEFAULT_PATTERNS, compilePattern, literalPattern, loadPatterns } =
  await import(new URL('../lib/patterns.mjs', import.meta.url));
const { DEFAULT_CONFIG } = await import(new URL('../lib/config.mjs', import.meta.url));
const book = new URL('./fixtures-shared/watch-shop/', import.meta.url);

const samples = {
  EY01: ['1998 年冬', '21998年冬'],
  EY02: ['2024/09', '2024/19'],
  EY03: ['二〇二四 年冬', '三〇二四年冬'],
  IR01: ['tickets.md', 'tickets.mdx'],
  IR02: ['去 chapters/翻', 'notchapters/'],
  IR03: ['拿 CH 13', 'loCH13'],
  IR04: ['拿 F011', 'zF011'],
  IR05: ['[灯](#柜边)', '[灯]'],
  IR06: ['paywall :', 'paywall。'],
  IR07: ['拿 B2', '先装ZB2X'],
  SUM01: ['这就是铜壳', '这是铜壳'],
  SUM02: ['问题不在盒底', '盒底是空的'],
  SUM03: ['值钱的是铁盒', '铁盒并不值钱'],
  SUM04: ['这就够了', '盖子已经够紧'],
  SUM05: ['真正麻烦的是潮水', '真正麻烦，的是潮水'],
  SUM06: ['显然不是', '他答不上来'],
  SUM07: ['这非常关键', '他把钥匙插进柜门'],
  SUM08: ['真正的意义在于', '柜里夹着收据'],
  SUM09: ['归根结底', '根须缠在门轴上'],
  SUM10: ['看看值不值', '看看这笔值多少'],
  SUM11: ['她终于明白了', '她换了只手去扳门'],
  SUM12: ['这说明了地址', '那张纸写着地址'],
  SUM13: ['某种程度上', '某种木料'],
  AT01: ['一丝不易察觉的', '一丝黏在袖口的'],
  AT02: ['时间仿佛静止', '座钟停了'],
  AT03: ['命运的馈赠', '葛婶的礼物'],
  AT04: ['值得一提的是', '他没有提到船'],
  AT05: ['这不仅是钥匙，更是', '这是钥匙，不是铃铛'],
  AT06: ['一股无法言说的', '一股海盐味'],
  AT07: ['心中百感交集', '他握紧木尺'],
  AT08: ['仿佛在低语', '葛婶朝墙边喊'],
  AT09: ['嘴角泛起一抹', '他咬住线头'],
  AT21: ['不是铜的， 而是', '铜的在柜角'],
  AT22: ['眼底闪过一丝', '灯火晃了一下'],
  AT23: ['深吸一口气', '咳了两声'],
  AT24: [' 这一刻，风停了', '记下这一刻，风停了'],
  AT25: ['心里升起一股', '柜里冒起一股烟'],
  AT26: ['四周弥漫着', '水沿着门渗进来'],
  AT27: ['不禁心头一震', '他把手缩回去'],
  AT28: ['某种莫名的', '那扇新装的'],
  AT29: ['轻轻颔首', '轻轻扣上盒盖'],
};

test('every built-in pattern has a hit and near miss', async t => {
  assert.deepEqual(DEFAULT_PATTERNS.map(item => item.id).sort(), Object.keys(samples).sort());
  for (const item of DEFAULT_PATTERNS) {
    await t.test(item.id, () => {
      const regex = item.id === 'IR07' ? literalPattern('B2', { word: true, sensitive: true }) : compilePattern(item.source);
      const [hit, miss] = samples[item.id];
      assert.equal([...hit.matchAll(regex)].length, 1);
      assert.equal([...miss.matchAll(regex)].length, 0);
    });
  }
});

test('literal ASCII terms and author mode file', t => {
  assert.equal([...'甲aCME-7， ACME-71'.matchAll(literalPattern('ACME-7'))].length, 1);
  assert.equal([...'A.B aXb'.matchAll(literalPattern('a.b'))].length, 1);
  const { patterns, errors } = loadPatterns(fileURLToPath(book), DEFAULT_CONFIG);
  assert.deepEqual(errors, []);
  assert.equal(patterns.some(item => item.id === 'AT23'), false);
  assert.deepEqual(patterns.filter(item => item.id.startsWith('U')).map(({ id, scope, level }) => [id, scope, level]), [
    ['U3', 'all', 'block'], ['U5', 'narration', 'suggest'], ['U7', 'all', 'block'],
  ]);

  const root = mkdtempSync(path.join(tmpdir(), 'fiction-patterns-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(fileURLToPath(new URL('invalid/patterns.txt', book)), path.join(root, 'patterns.txt'));
  const config = { lint: { patterns_file: 'patterns.txt' } };
  assert.deepEqual(loadPatterns(root, config).errors.map(item => [item.file, item.line]), [
    ['patterns.txt', 1], ['patterns.txt', 2], ['patterns.txt', 3], ['patterns.txt', 5], ['patterns.txt', 7],
  ]);
});
