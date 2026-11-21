import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** 公共退出码。 */
export const EXIT = Object.freeze({ OK: 0, FAIL: 1, ERROR: 2 });

/** 解析参数；未知选项、重复选项均报错。 */
export function parseCli(argv, options = {}) {
  let result;
  try {
    result = parseArgs({
      args: argv, allowPositionals: true, tokens: true,
      options: { root: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean' }, ...options },
    });
  } catch (error) {
    throw new Error(`参数错误：${error.message}`, { cause: error });
  }
  const seen = new Set();
  for (const token of result.tokens) {
    if (token.kind !== 'option') continue;
    if (seen.has(token.name) && !options[token.name]?.multiple) throw new Error(`重复参数：--${token.name}`);
    seen.add(token.name);
  }
  return { values: result.values, positionals: result.positionals };
}

/** 从起点向上搜索，优先找配置，再找 bible 目录。 */
export function findBookRoot(start = process.cwd()) {
  let fallback = null;
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    if (statSync(path.join(dir, '.fiction/config.json'), { throwIfNoEntry: false })?.isFile()) return dir;
    if (!fallback && statSync(path.join(dir, 'bible'), { throwIfNoEntry: false })?.isDirectory()) fallback = dir;
    if (path.dirname(dir) === dir) return fallback;
  }
}

/** 输出单个 JSON 对象或中文人读文本。 */
export function emit(result, { json = false, text } = {}) {
  console.log(json ? JSON.stringify(result, null, 2) : (text ?? result));
}

/** 生成公共 JSON 信封。 */
export function envelope(tool, root, ok, fields) {
  return { tool, spec_version: 1, root: path.resolve(root), ok, ...fields };
}

/** 统一入口的参数、帮助、异常与输出；run 返回 { fields, text, code, found }。 */
export async function runCli(tool, argv, options, usage, run) {
  let root = process.cwd();
  // 解析失败时也尽量遵守 --json；-- 后的值不属于选项。
  const end = argv.indexOf('--');
  let json = argv.slice(0, end < 0 ? argv.length : end).includes('--json');
  try {
    const { values, positionals } = parseCli(argv, options);
    json = Boolean(values.json);
    if (values.help) {
      if (values.root) root = path.resolve(values.root);
      emit(envelope(tool, root, true, { help: usage }), { json, text: usage });
      return EXIT.OK;
    }
    if (values.root === '') throw new Error('--root 不能为空');
    const selected = values.root === undefined ? findBookRoot(root) : path.resolve(values.root);
    if (selected) root = selected;
    if (!selected || !statSync(root, { throwIfNoEntry: false })?.isDirectory()) throw new Error('找不到书根');
    const { fields, text, code = EXIT.OK, found = true } = await run(root, values, positionals);
    const human = found ? text : `未找到 config，使用默认值\n${text}`;
    emit(envelope(tool, root, code === EXIT.OK, fields), { json, text: human });
    return code;
  } catch (error) {
    console.error(error.message);
    if (json) emit(envelope(tool, root, false, { error: error.message }), { json });
    return EXIT.ERROR;
  }
}

/** Windows 上盘符和路径的大小写不影响入口识别。 */
export function sameEntryPath(invoked, moduleFile, platform = process.platform) {
  if (platform === 'win32') return path.win32.resolve(invoked).toLowerCase() === path.win32.resolve(moduleFile).toLowerCase();
  return path.posix.resolve(invoked) === moduleFile;
}

/** 只在直接执行模块时调用入口；被包装脚本导入时不执行。 */
export async function directMain(url, main) {
  if (process.argv[1] && sameEntryPath(process.argv[1], fileURLToPath(url))) {
    process.exitCode = await main(process.argv.slice(2));
  }
}

/** 严格读取安全整数（默认非负）。 */
export function integer(value, label, min = 0) {
  const n = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(n) || n < min) {
    throw new Error(`${label}必须是${min === 0 ? '非负' : '正'}整数：${value}`);
  }
  return n;
}

/** 验证枚举及逗号分隔的枚举列表。 */
export function choices(value, allowed, label) {
  const parts = value.split(',').map(part => part.trim());
  for (const part of parts) if (!allowed.includes(part)) throw new Error(`${label}值非法：${part}`);
  return [...new Set(parts)];
}

/** 验证检查失败级别。 */
export function failLevel(value = 'block') {
  if (value !== 'block' && value !== 'suggest') throw new Error(`--fail-on 值非法：${value}`);
  return value;
}

/** 书根相对路径，统一使用 /。 */
export function relativeFile(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

/** 字典序比较，不依赖环境 locale。 */
export function lexical(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 构造指定形状的 Finding。 */
export function finding(rule, file, message, { id = null, level = 'block', line = null,
  column = null, excerpt = null, hint = null } = {}) {
  return { rule, id, level, file, line, column, excerpt, message, hint };
}

/** Findings 原地排序，未知行列置于已知位置之前。 */
export function sortFindings(items) {
  return items.sort((a, b) => lexical(a.file, b.file) || (a.line ?? 0) - (b.line ?? 0)
    || (a.column ?? 0) - (b.column ?? 0) || lexical(a.rule, b.rule));
}

/** 单行人读 Finding。 */
export function formatFinding(f) {
  return `${f.level.toUpperCase()} ${f.file}:${f.line ?? '?'}:${f.column ?? '?'} ${f.rule}`
    + `${f.id ? `/${f.id}` : ''}「${(f.excerpt ?? '').replace(/\r?\n/g, ' ')}」${f.message}`
    + (f.hint ? ` → ${f.hint}` : '');
}
