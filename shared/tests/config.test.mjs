import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const { DEFAULT_CONFIG, loadConfig } = await import(new URL('../lib/config.mjs', import.meta.url));
const book = new URL('./fixtures-shared/watch-shop/', import.meta.url);

test('every SB §8 key and default exactly matches', () => {
  assert.deepEqual(DEFAULT_CONFIG, {
    version: 1,
    book: { title: null, genres: [] },
    length: { min: 2000, soft_max: 5000, skip_frozen: true },
    hook: { required: true, discouraged: ['C'] },
    frozen: { ranges: [] },
    lint: {
      banned_terms: [],
      desensitize: { places: [], schools: [], companies: [], people: [], other: [], exact_years: true },
      internal_terms: ['伏笔', '钩子', '爽点', '支线', '暗线', '大纲', '章纲', '细纲', '主写入口', '本章', '上一章', '下一章', 'outline', 'resources'],
      extra_files: ['publish/blurb.md'], rules: {}, patterns_file: '.fiction/lint-patterns.txt',
    },
    foreshadow: { due_window: 3, overdue_grace: 0, dormant_after: 30 },
    subplot: { stall_after: 20, remind_gap: [5, 15], max_span: 100 },
    appearance: { gap_warn: 10 },
    rhythm: { beat_every: [3, 5], external_event_max_gap: 2 },
    daily: { chapters_per_day: 2, last_hook_min: 'A', burst: { chapters_per_day: [3, 5], last_hook_min: 'S' } },
    publish: {
      platform: null, daily_word_threshold: null, default_time: null, ai_disclosure: null,
      detection_mode: null, typo_prompt: null, scheduled: null, preview_keyword: null,
      log_file: 'publish/log.csv', confirmed_at: null,
    },
    drama: {
      chars_per_minute: 250, length_level: 'suggest',
      tiers: [{ id: 'micro', max_seconds: 60 }, { id: 'short', max_seconds: 120 },
        { id: 'standard', max_seconds: 180 }, { id: 'long', max_seconds: null }],
      max_scenes: 5, hook: { required: true },
      paywall: { first_at: [8, 15], free_ratio: [0.05, 0.25], hook_min: 'A' },
    },
  });
});

test('deep merge, explicit null, array replacement, unknown keys and malformed config', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'fiction-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(loadConfig(root), { config: DEFAULT_CONFIG, found: false, errors: [] });
  assert.equal(loadConfig(fileURLToPath(book)).config.length.min, 12);
  mkdirSync(path.join(root, '.fiction'));
  const file = path.join(root, '.fiction/config.json');
  writeFileSync(file, '{"length":{"soft_max":null},"hook":{"discouraged":[]},"unknown":{"key":7},"__proto__":{"polluted":true}}');
  const merged = loadConfig(root);
  assert.deepEqual(merged.errors, []);
  assert.deepEqual(merged.config.length, { min: 2000, soft_max: null, skip_frozen: true });
  assert.deepEqual(merged.config.hook, { required: true, discouraged: [] });
  assert.deepEqual(merged.config.unknown, { key: 7 });
  assert.equal(Object.hasOwn(merged.config, '__proto__'), true);
  assert.equal({}.polluted, undefined);
  cpSync(fileURLToPath(new URL('invalid/config.json', book)), file);
  assert.match(loadConfig(root).errors.join('\n'), /length.min[\s\S]*hook[\s\S]*frozen.ranges[\s\S]*chars_per_minute[\s\S]*不支持 version 2/);
  writeFileSync(file, '{');
  assert.match(loadConfig(root).errors[0], /不是合法 JSON/);
});
