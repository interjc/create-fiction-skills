import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripLocalLinks } from './markdown.mjs';
import { countLines, isObject, splitLines, stat } from './repo.mjs';

const manifest = 'shared/formats.json';
const source = 'docs/spec/story-bible.md';
const skillName = /^fiction-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const topicName = /^[a-z0-9][a-z0-9-]*$/;
const sectionNumber = /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))?$/;
const decoder = new TextDecoder('utf-8', { fatal: true });
const sectionList = sections => sections.map(number => `§${number}`).join('、');

function read(root, file, optional = false) {
  const target = path.join(root, file);
  const info = stat(target);
  if (!info && optional) return undefined;
  if (!info?.isFile()) throw new Error(`需要普通文件：${file}`);
  try {
    return decoder.decode(readFileSync(target));
  } catch (error) {
    throw new Error(`${file}：${error.message}`);
  }
}

function hasKeys(value, keys) {
  return isObject(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key));
}

export function loadFormats(root) {
  const text = read(root, manifest, true);
  if (text === undefined) return;
  const fail = message => { throw new Error(`${manifest}：${message}`); };
  let config;
  try {
    config = JSON.parse(text);
  } catch (error) {
    fail(error.message);
  }
  if (!hasKeys(config, ['source', 'topics', 'skills']) || config.source !== source ||
      !isObject(config.topics) || !isObject(config.skills)) {
    fail(`需要 source（${source}）、topics 和 skills`);
  }
  for (const [name, topic] of Object.entries(config.topics)) {
    if (!topicName.test(name)) fail(`无效的主题名：${name}`);
    if (!hasKeys(topic, ['title', 'sections']) || typeof topic.title !== 'string' ||
        !topic.title.trim() || /[\r\n]/.test(topic.title) || !Array.isArray(topic.sections) ||
        !topic.sections.length ||
        topic.sections.some(number => typeof number !== 'string' || !sectionNumber.test(number)) ||
        new Set(topic.sections).size !== topic.sections.length) {
      fail(`无效的主题：${name}`);
    }
  }
  for (const [name, topics] of Object.entries(config.skills)) {
    if (!skillName.test(name) || name.length > 64 || !Array.isArray(topics) ||
        new Set(topics).size !== topics.length) fail(`无效的 skill 或主题列表：${name}`);
    for (const topic of topics) {
      if (typeof topic !== 'string' || !Object.hasOwn(config.topics, topic)) {
        fail(`${name} 引用了不存在的主题：${topic}`);
      }
    }
  }
  return config;
}

export function coversSection(sections, number) {
  const [chapter, subsection] = number.split('.');
  return sections.has(chapter) ||
    (subsection === undefined ? sections.has(`${chapter}.0`) : subsection !== '0' && sections.has(number));
}

function sourceSections(root, config) {
  if (!['docs', 'docs/spec'].every(dir => stat(path.join(root, dir))?.isDirectory())) {
    throw new Error('需要普通目录：docs/spec');
  }
  const rows = splitLines(read(root, config.source));
  const headings = [];
  const fenced = new Set();
  let width = 0;
  for (const [index, line] of rows.entries()) {
    const ticks = /^`{3,}/.exec(line)?.[0].length ?? 0;
    if (width) {
      fenced.add(index);
      if (ticks >= width && ticks === line.length) width = 0;
    } else if (ticks) {
      fenced.add(index);
      width = ticks;
    } else {
      const heading = /^(#{2,3}) /.exec(line);
      if (!heading) continue;
      const level = heading[1].length;
      const number = (level === 2 ? /^## (\d+)\. / : /^### (\d+\.[1-9]\d*) /).exec(line)?.[1];
      headings.push({ index, level, number });
    }
  }
  if (width) throw new Error(`${config.source}：代码围栏未闭合`);

  const sections = new Map();
  const numbers = new Set(Object.values(config.topics).flatMap(topic => topic.sections));
  for (const number of numbers) {
    const lead = number.endsWith('.0');
    const id = lead ? number.slice(0, -2) : number;
    const starts = headings.filter(heading => heading.number === id);
    if (starts.length !== 1) {
      throw new Error(`${config.source}：${starts.length ? '章节号重复' : '找不到章节号'} §${number}`);
    }
    const [{ index, level }] = starts;
    const throughSubsections = level === 2 && !lead;
    const next = headings.find(h => h.index > index && (!throughSubsections || h.level === 2));
    if (lead && next?.level !== 3) {
      throw new Error(`${config.source}：§${number} 所在章节没有三级标题，无法确定前言边界`);
    }
    const end = next?.index ?? rows.length;
    const body = rows.slice(index, end);
    while (body.at(-1) === '') body.pop();
    const mask = new Set();
    for (let i = 0; i < body.length; i++) if (fenced.has(i + index)) mask.add(i);
    const contents = headings.filter(h => h.index >= index && h.index < end).map(h =>
      `- ${stripLocalLinks([rows[h.index].slice(h.level + 1)])}`);
    sections.set(number, { text: stripLocalLinks(body, mask), contents });
  }
  return sections;
}

export function formatTrees(root, config, names) {
  const sections = sourceSections(root, config);
  const trees = new Map();
  for (const name of names) {
    if (!Object.hasOwn(config.skills, name) || !config.skills[name].length) continue;
    const topics = config.skills[name];
    const tree = new Map();
    for (const topic of topics) {
      const { title, sections: numbers } = config.topics[topic];
      const other = topics.filter(id => id !== topic)
        .map(id => `${id}.md（${sectionList(config.topics[id].sections)}）`).join('；') || '无';
      const parts = numbers.map(number => sections.get(number));
      const text = [
        `# 格式参考：${title}`,
        '<!-- GENERATED by tools/sync-shared.mjs from docs/spec/story-bible.md. Edit the spec instead. -->',
        [
          '> 以下是本套件契约 story-bible.md 的原文摘录，章节号与契约一致；SKILL.md 和脚本报错里的 “SB §x” 就是这里的章节号。',
          `> 本文件收录：${sectionList(numbers)}。同目录其他文件：${other}。`,
          '> 文中提到 scripts.md 的地方，指仓库里的脚本契约；在装好的 skill 里以脚本的 `--help` 和输出为准。',
        ].join('\n'),
        '## 目录',
        parts.flatMap(part => part.contents).join('\n'),
        ...parts.map(part => part.text),
      ].join('\n\n') + '\n';
      if (countLines(text) > 400) {
        throw new Error(`skills/${name}/references/formats/${topic}.md：生成结果超过 400 行`);
      }
      tree.set(`${topic}.md`, Buffer.from(text));
    }
    trees.set(name, tree);
  }
  return trees;
}
