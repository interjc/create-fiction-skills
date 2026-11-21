import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { escapeRegExp, splitLines } from './repo.mjs';

export const termsFile = 'docs/spec/debook-terms.txt';
const sections = new Set(['names', 'orgs', 'terms', 'book', 'params', 'allow-paths']);

function glob(source) {
  const parts = (source.endsWith('/') ? `${source}**/*` : source).split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.includes('\0') ||
      (part.includes('**') && part !== '**'))) throw new Error(`无效的仓库相对 glob：${source}`);
  const segments = parts.map(part => part === '**' ? null : new RegExp(
    `^${[...part].map(char => char === '*' ? '[^/]*' : char === '?' ? '[^/]' : escapeRegExp(char)).join('')}(?![\\s\\S])`,
    'u',
  ));
  return file => {
    const names = file.split('/');
    let states = new Set([0]);
    for (const segment of segments) {
      const next = new Set();
      for (const index of states) {
        if (segment === null) for (let i = index; i <= names.length; i++) next.add(i);
        else if (index < names.length && segment.test(names[index])) next.add(index + 1);
      }
      states = next;
    }
    return states.has(names.length);
  };
}

export function loadDebook(root) {
  const bytes = readFileSync(path.join(root, termsFile));
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${termsFile}：词表必须是 UTF-8`);
  }
  const rules = [];
  const allowed = [];
  let section;
  for (const [i, line] of splitLines(text).entries()) {
    const term = line.trim().split(' #', 1)[0].trim();
    if (!term || term.startsWith('#')) continue;
    try {
      if (/^\[.*\]$/u.test(term)) {
        section = term.slice(1, -1);
        if (!sections.has(section)) throw new Error(`未知段头：${term}`);
      } else if (!section) throw new Error('词条必须位于段内');
      else if (section === 'allow-paths') allowed.push(glob(term));
      else {
        let regex;
        if (term.startsWith('re:')) {
          if (term === 're:') throw new Error('空正则词条');
          regex = new RegExp(term.slice(3), 'gu');
        } else if (/^[A-Za-z0-9 ._-]+$/.test(term)) {
          regex = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, 'giu');
        } else {
          regex = new RegExp(escapeRegExp(term), 'gu');
        }
        rules.push({ regex, message: `命中 [${section}] 词条：${term}` });
      }
    } catch (error) {
      throw new Error(`${termsFile}:${i + 1}：${error.message}`);
    }
  }

  return {
    skips: file => file === termsFile || allowed.some(matches => matches(file)),
    *find(text) {
      for (const [i, line] of splitLines(text).entries()) {
        for (const { regex, message } of rules) {
          for (const match of line.matchAll(regex)) yield {
            line: i + 1, column: match.index + 1, message,
          };
        }
      }
    },
  };
}
