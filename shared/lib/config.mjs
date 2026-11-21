import { readFileSync } from 'node:fs';
import path from 'node:path';
import { HOOK_ORDER, parseChapterRef } from './md.mjs';

/** SB §8 的默认配置。 */
export const DEFAULT_CONFIG = {
  version: 1,
  book: { title: null, genres: [] },
  length: { min: 2000, soft_max: 5000, skip_frozen: true },
  hook: { required: true, discouraged: ['C'] },
  frozen: { ranges: [] },
  lint: {
    banned_terms: [],
    desensitize: { places: [], schools: [], companies: [], people: [], other: [], exact_years: true },
    internal_terms: ['伏笔', '钩子', '爽点', '支线', '暗线', '大纲', '章纲', '细纲', '主写入口', '本章', '上一章', '下一章', 'outline', 'resources'],
    extra_files: ['publish/blurb.md'],
    rules: {},
    patterns_file: '.fiction/lint-patterns.txt',
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
    tiers: [
      { id: 'micro', max_seconds: 60 }, { id: 'short', max_seconds: 120 },
      { id: 'standard', max_seconds: 180 }, { id: 'long', max_seconds: null },
    ],
    max_scenes: 5, hook: { required: true },
    paywall: { first_at: [8, 15], free_ratio: [0.05, 0.25], hook_min: 'A' },
  },
};

const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const string = x => typeof x === 'string';
const nonempty = x => string(x) && x.trim().length > 0;
const int = Number.isSafeInteger;
const number = Number.isFinite;
const nonnegative = x => int(x) && x >= 0;
const positive = x => int(x) && x > 0;
const bool = x => typeof x === 'boolean';
const oneOf = (...values) => x => values.includes(x);
const nullable = check => x => x === null || check(x);
const array = check => x => Array.isArray(x) && x.every(check);
const pair = check => x => array(check)(x) && x.length === 2 && x[0] <= x[1];
const hook = oneOf(...HOOK_ORDER);
const level = oneOf('block', 'suggest');
const term = x => nonempty(x) || (object(x) && nonempty(x.term) && string(x.hint));
const projectPath = x => nonempty(x) && !path.isAbsolute(x) && !x.includes('\\')
  && !x.split('/').includes('..') && !x.includes('\0');
const range = x => {
  if (!string(x)) return false;
  try { return parseChapterRef(x) !== null; } catch { return false; }
};

const schema = {
  version: positive,
  book: { title: nullable(string), genres: array(string) },
  length: { min: nonnegative, soft_max: nullable(nonnegative), skip_frozen: bool },
  hook: { required: bool, discouraged: array(string) },
  frozen: { ranges: array(range) },
  lint: {
    banned_terms: array(term),
    desensitize: { places: array(term), schools: array(term), companies: array(term), people: array(term), other: array(term), exact_years: bool },
    internal_terms: array(nonempty), extra_files: array(projectPath),
    rules: x => object(x) && Object.values(x).every(oneOf('block', 'suggest', 'off')),
    patterns_file: projectPath,
  },
  foreshadow: { due_window: nonnegative, overdue_grace: nonnegative, dormant_after: nonnegative },
  subplot: { stall_after: nonnegative, remind_gap: pair(nonnegative), max_span: nonnegative },
  appearance: { gap_warn: nonnegative },
  rhythm: { beat_every: pair(nonnegative), external_event_max_gap: nonnegative },
  daily: { chapters_per_day: positive, last_hook_min: hook, burst: { chapters_per_day: pair(positive), last_hook_min: hook } },
  publish: {
    platform: nullable(string), daily_word_threshold: nullable(nonnegative),
    default_time: nullable(x => string(x) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x)),
    ai_disclosure: nullable(oneOf('yes', 'no')), detection_mode: nullable(oneOf('basic', 'full')),
    typo_prompt: nullable(oneOf('submit', 'stop')), scheduled: nullable(bool),
    preview_keyword: nullable(string), log_file: string,
    confirmed_at: nullable(x => string(x) && /^\d{4}-\d{2}-\d{2}$/.test(x)),
  },
  drama: {
    chars_per_minute: positive, length_level: level,
    tiers: x => array(y => object(y) && nonempty(y.id) && nullable(nonnegative)(y.max_seconds))(x)
      && x.length > 0 && new Set(x.map(y => y.id)).size === x.length
      && x.every((y, i) => i === 0 || (x[i - 1].max_seconds !== null
        && x[i - 1].max_seconds <= (y.max_seconds ?? Infinity))),
    max_scenes: nonnegative, hook: { required: bool },
    paywall: { first_at: pair(positive), free_ratio: pair(x => number(x) && x >= 0 && x <= 1), hook_min: hook },
  },
};

function merge(defaults, overrides) {
  const result = structuredClone(defaults);
  for (const [key, value] of Object.entries(overrides)) {
    const merged = Object.hasOwn(result, key) && object(result[key]) && object(value)
      ? merge(result[key], value) : value;
    Object.defineProperty(result, key, { value: merged, enumerable: true, writable: true, configurable: true });
  }
  return result;
}

function validate(value, rule, key, errors) {
  if (typeof rule === 'function') {
    if (!rule(value)) errors.push(`.fiction/config.json：${key} 类型或取值非法`);
  } else if (!object(value)) {
    errors.push(`.fiction/config.json：${key || '根'}必须是对象`);
  } else {
    for (const [name, check] of Object.entries(rule)) {
      validate(value[name], check, key ? `${key}.${name}` : name, errors);
    }
  }
}

/** 读取、深合并并校验配置；errors 非空时调用方不得使用配置。 */
export function loadConfig(root) {
  const defaults = structuredClone(DEFAULT_CONFIG);
  let raw;
  try {
    raw = readFileSync(path.join(root, '.fiction/config.json'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { config: defaults, found: false, errors: [] };
    return { config: defaults, found: true, errors: [`.fiction/config.json：${error.code ?? '读取失败'}`] };
  }
  let value;
  try {
    value = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    return { config: defaults, found: true, errors: ['.fiction/config.json：不是合法 JSON'] };
  }
  const config = object(value) ? merge(DEFAULT_CONFIG, value) : value;
  const errors = [];
  validate(config, schema, '', errors);
  if (int(config?.version) && config.version > DEFAULT_CONFIG.version) {
    errors.push(`.fiction/config.json：不支持 version ${config.version}，请升级脚本`);
  }
  return { config, found: true, errors };
}

/** 加载配置供入口使用，非法配置转换为用法错误。 */
export function requireConfig(root) {
  const result = loadConfig(root);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  return result;
}
