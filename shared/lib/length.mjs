import { readFileSync } from 'node:fs';
import path from 'node:path';
import { directMain, EXIT, integer, runCli } from './cli.mjs';
import { requireConfig } from './config.mjs';
import { stripBom } from './md.mjs';
import { isFrozen, missingChapters, resolveSelector } from './project.mjs';

/** 按脚本契约的固定顺序去除不计字数的 Markdown。 */
export function stripMarkdownForLength(markdown) {
  let text = stripBom(markdown).replace(/\r\n?/g, '\n');
  text = text.replace(/^---\n[\s\S]*?\n---(?:\n|$)/, '');
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  const lines = text.split('\n');
  let start = 0;
  while (start < lines.length && (!lines[start].trim()
    || /^[ \t]{0,3}#{1,6}\s+/.test(lines[start])
    || /^[ \t]{0,3}(?:[-*_][ \t]*){3,}$/.test(lines[start]))) start++;
  text = lines.slice(start).join('\n');
  text = text.replace(/^[ \t]*\*?下章预告[：:][^\n]*\*?[ \t]*$/gm, '');
  text = text.replace(/^[ \t]*(?:```+|~~~+).*$/gm, '');
  text = text.replace(/!\[[^\]]*]\([^)]*\)/g, '');
  text = text.replace(/\[([^\]]+)]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)]\[[^\]]*]/g, '$1');
  text = text.replace(/^\s*\[[^\]]+]:\s+\S+.*$/gm, '');
  text = text.replace(/^\s{0,3}(?:[-*_]\s*){3,}$/gm, '');
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  text = text.replace(/^\s{0,3}>\s?/gm, '');
  text = text.replace(/^\s{0,3}(?:[-+*]|\d+[.)])\s+/gm, '');
  text = text.replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm, '');
  text = text.replace(/[|*_~`]/g, '');
  text = text.replace(/\\([\\`*{}[\]()#+\-.!_>~|])/g, '$1');
  return text.replace(/\s/g, '');
}

/** 计正文中的 Unicode 码点（含标点）。 */
export function countChapterCharacters(markdown) {
  return Array.from(stripMarkdownForLength(markdown)).length;
}

const usage = '用法：node scripts/length.mjs <章节选择> | --all [--min N] [--root DIR] [--json]';

function render(results, summary, min, missing) {
  const words = { pass: 'PASS', long: 'LONG', short: 'SHORT', skipped: 'SKIP' };
  const text = results.map(({ chapter, file, count, status }) => {
    const label = chapter === null ? '' : ` 第${chapter}章`;
    return status === 'skipped' ? `SKIP${label} 已冻结 ${file}`
      : `${words[status]}${label} ${count} 字（要求 ≥ ${min}）${file}`;
  });
  if (missing.length) text.push(missingChapters(missing));
  text.push(`检查 ${summary.checked} 章：通过 ${summary.pass}，偏长 ${summary.long}，偏短 ${summary.short}，跳过 ${summary.skipped}。`);
  return text.join('\n');
}

/** 命令行入口：检查定稿字数。 */
export async function main(argv) {
  return runCli('length', argv, { all: { type: 'boolean' }, min: { type: 'string' } }, usage, (root, values, args) => {
    if (args.length !== (values.all ? 0 : 1)) throw new Error(usage);
    const { config, found } = requireConfig(root);
    const min = values.min === undefined ? config.length.min : integer(values.min, '--min');
    const { soft_max, skip_frozen } = config.length;
    const { items, missing } = resolveSelector(root, values.all ? '--all' : args[0]);
    const summary = { checked: 0, pass: 0, long: 0, short: 0, skipped: 0 };
    const results = items.map(({ chapter, file }) => {
      const frozen = isFrozen(chapter, config);
      let count = null;
      let status = 'skipped';
      if (!(frozen && values.all && skip_frozen)) {
        count = countChapterCharacters(readFileSync(path.join(root, file), 'utf8'));
        status = count < min ? 'short' : soft_max !== null && count > soft_max ? 'long' : 'pass';
        summary.checked++;
      }
      summary[status]++;
      return { chapter, file, count, status, frozen };
    });
    const fails = results.some(result => result.status === 'short' && (values.all || !result.frozen));
    return {
      fields: { min, soft_max, results, summary }, text: render(results, summary, min, missing),
      code: fails ? EXIT.FAIL : EXIT.OK, found,
    };
  });
}

await directMain(import.meta.url, main);
