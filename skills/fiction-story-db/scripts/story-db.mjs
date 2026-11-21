#!/usr/bin/env node
import { lstatSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { directMain, EXIT, formatFinding, runCli } from './lib/cli.mjs';
import { compareSources, readProjectConfig, snapshot, storedFindings, updateIndex } from './story-db-index.mjs';
import { checkFlags, query, queryArgs, queryOptions, querySources } from './story-db-query.mjs';
import { metadata, transaction } from './story-db-schema.mjs';

const usage = `故事索引（只读 Markdown；数据库固定为 .fiction/story.db）
用法：node scripts/story-db.mjs <命令> [--root 书根] [--json]
  index [--full]                          建立或更新索引；--full 全量重建
  status                                  检查索引是否缺失或过期
  sources [键或用途子串]                   查主写入口
  query character <人名或别名>
  query chapter <章号>
  query foreshadows [--status planned,planted,partial,resolved,dropped] [--due 章号] [--character 人名] [--subplot ID]
  query subplots [--status active,dormant,resolved,dropped] [--level A|B|C]
  query appearances --from 章号 --to 章号 [--character 人名]
  query absent <人名> --since 章号            截至该章，距最后一次实际在场有几章
  query settings <标签>
  query inventory [--holder 人名]
  query timeline [--from 章号] [--to 章号]
  query episodes <短剧目录名>
  --help                                  显示帮助
退出码：0 成功，1 索引有解析问题或状态为缺失/过期，2 用法、运行环境或读取错误。`;

const defaultImporter = () => import('node:sqlite');

/** Node 22.5 起有内置 SQLite；早期小版本需显式启用。只过滤 SQLite 自己的实验警告。 */
async function sqlite(importer) {
  const emitWarning = process.emitWarning;
  process.emitWarning = function (warning, type, ...args) {
    if ((warning?.name === 'ExperimentalWarning' || type === 'ExperimentalWarning' || type?.type === 'ExperimentalWarning')
        && (typeof warning === 'string' ? warning : warning?.message)
          === 'SQLite is an experimental feature and might change at any time') return;
    return emitWarning.call(this, warning, type, ...args);
  };
  try {
    const { DatabaseSync } = await importer('node:sqlite');
    if (typeof DatabaseSync !== 'function') throw new Error('缺少 DatabaseSync');
    return DatabaseSync;
  } catch (cause) {
    throw new Error('无法加载 node:sqlite：需要 Node.js 22.5 或更高版本；较早的小版本请在脚本路径前加 --experimental-sqlite。', { cause });
  } finally {
    process.emitWarning = emitWarning;
  }
}

function dbLocation(root) {
  const dir = path.join(root, '.fiction');
  const folder = lstatSync(dir, { throwIfNoEntry: false });
  if (folder && !folder.isDirectory()) throw new Error('.fiction 必须是真实目录（不使用符号链接）');
  const file = path.join(dir, 'story.db');
  const info = lstatSync(file, { throwIfNoEntry: false });
  if (info && (!info.isFile() || info.nlink !== 1)) throw new Error('.fiction/story.db 必须是未链接的普通文件');
  for (const suffix of ['-journal', '-wal', '-shm']) {
    const sidecar = lstatSync(`${file}${suffix}`, { throwIfNoEntry: false });
    if (sidecar && (!sidecar.isFile() || sidecar.nlink !== 1)) throw new Error(`索引辅助文件无法安全打开：story.db${suffix}`);
  }
  const config = lstatSync(path.join(dir, 'config.json'), { throwIfNoEntry: false });
  if (config && !config.isFile()) throw new Error('.fiction/config.json 必须是普通文件（不使用符号链接）');
  return { dir, file, exists: Boolean(info) };
}

const diffLabels = { changed: '改动', added: '新增', removed: '移除' };
const changeList = diff => Object.entries(diffLabels).flatMap(([key, label]) =>
  diff[key].map(file => `- ${label}：${file}`)).concat(diff.layout_changed ? ['- 章节目录或定稿选择有变动'] : []);
const statusLabel = { fresh: '索引已同步', stale: '索引已过期，请先运行 index。', missing: '缺少索引，请先运行 index。' };

function status(meta, diff = { changed: [], added: [], removed: [], layout_changed: false }) {
  const stale = Boolean(diff.layout_changed || diff.added.length || diff.changed.length || diff.removed.length);
  const state = !meta ? 'missing' : stale ? 'stale' : 'fresh';
  return { state, indexed_at: meta?.get('indexed_at') ?? null, ...diff };
}

function indexText(result) {
  return [
    ...(result.findings.map(formatFinding)),
    `索引已${result.mode === 'incremental' ? '更新' : '建立'}：${result.indexed_at}；${result.findings.length} 条解析发现。`,
    `重建表：${result.rebuilt_tables.join('、') || '无'}`,
    `各表行数：${Object.entries(result.rows).map(([table, count]) => `${table} ${count}`).join('、')}`,
    `已读取 ${result.files_read.length} 份来源以核对哈希；重新提取数据 ${result.files_reparsed.length} 份。`,
    ...result.files_read.map(file => `- ${file}`),
  ].join('\n');
}

const queryLabels = {
  character: '人物档案', first_chapter: '首次在场章', appearances: '出场', latest_relationship_changes: '最近关系变化',
  foreshadows: '伏笔', subplots: '支线', steps: '生命周期', chapter: '章节定稿信息', plan: '章节规划',
  absent: '缺席章数', settings: '设定标签', inventory: '物品', timeline: '时间锚点',
  episodes: '分集剧本', adaptation_map: '章集映射', sources: '主写入口',
};
const columnLabels = {
  id: '编号', key: '键', name: '名称', character: '人物', chapter: '章', episode: '集', title: '标题',
  aliases: '别名', role: '身份', tier: '级别', first_chapter: '首次出场', always_present: '常驻',
  dormant_volumes: '休眠卷', scope: '范围', status: '状态',
  appearance_type: '出场类型', note: '备注', length: '有效字数', hook_actual: '实际钩子', hook_planned: '计划钩子',
  frozen: '冻结', since: '截至章', last_present: '上次在场章', gap: '间隔章数', purpose: '用途', owner_file: '主写文件',
  owner_anchor: '锚点', read_when: '何时读', write_when: '何时写回', mode: '模式', brief_rule: '简报条件',
  tags: '标签', relevant_chapters: '关联章节', source_anchor: '来源标题',
  event: '事件', kind: '类型', prose_form: '正文口径', state: '现状', target: '对象', change: '变化',
  holder: '持有', time_text: '时间', acquired_chapter: '获得章', changed_chapter: '变动章',
  reader_view: '读者已知', author_truth: '作者真相', planted_chapter: '埋设章', target_start: '计划回收起章',
  target_end: '计划回收止章', resolved_chapter: '实际回收章', touched_chapters: '触及章',
  future: '未来出现方式', subplot_ids: '支线编号', characters: '人物', level: '级别', main_link: '挂靠主线',
  current_step: '当前步骤', current_chapter: '当前章', active_volumes: '活跃卷', foreshadow_ids: '伏笔编号',
  subplot_id: '支线编号', step: '步骤', planned_chapter: '计划章', actual_chapter: '实际章', skipped: '跳过', content: '内容',
  volume: '卷', core_event: '核心事件', beat: '爽点', weight: '权重', foreshadow_actions: '伏笔动作',
  required_characters: '所需人物', draft_file: '定稿文件', series: '短剧目录', scenes: '场景数',
  est_seconds: '估算秒数', hook: '钩子', paywall: '付费卡点', source_chapters: '来源章',
};
const queryTitles = { character: '人物查询', chapter: '章节查询', episodes: '短剧查询' };

const stepLabels = { seed: '种因', remind: '提醒', chain: '连环', mislead: '误导', small_reveal: '小收', big_reveal: '大收' };
const valueLabels = {
  mode: { owner_only: '唯一主写', secondary: '次级参考', draft_only: '讨论稿' },
  tier: { core: '核心', major: '重要', minor: '次要', extra: '龙套' },
  appearance_type: { present: '在场', mentioned: '提及' },
  level: { A: 'A 大支线', B: 'B 中支线', C: 'C 小支线' },
  step: stepLabels,
  current_step: stepLabels,
  kind: { hard: '硬锚', soft: '软锚', window: '窗口', deadline: '期限' },
  weight: { light: '轻', normal: '中', heavy: '重' },
  action: { plant: '埋', touch: '触', resolve: '收', drop: '弃' },
};
const queryStatusLabels = {
  foreshadows: { planned: '计划中', planted: '已埋设', partial: '部分揭示', resolved: '已回收', dropped: '已放弃' },
  subplots: { active: '进行', dormant: '休眠', resolved: '完结', dropped: '放弃' },
  inventory: { held: '持有', consumed: '消耗', lent: '外借', damaged: '损坏', lost: '遗失', transferred: '转手' },
  plan: { planned: '计划中', outlined: '提纲', drafted: '稿件', final: '定稿', frozen: '冻结' },
};

function renderValue(value, labels) {
  if (value === null) return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (Array.isArray(value)) return value.map(item => renderValue(item, labels)).join('、') || '—';
  if (typeof value === 'object') {
    if (Object.hasOwn(value, 'start')) return value.start === value.end ? String(value.start) : `${value.start}–${value.end}`;
    if (Object.hasOwn(value, 'action')) {
      return `${renderValue(value.action, valueLabels.action)} ${value.id}${value.note ? `（${renderValue(value.note)}）` : ''}`;
    }
  }
  if (typeof value === 'string' && labels && Object.hasOwn(labels, value)) return labels[value];
  return String(value).replace(/\r?\n/g, ' / ');
}

function renderRows(result, section) {
  if (Array.isArray(result)) return result.length ? result.flatMap(row => renderRows(row, section)) : ['（无）'];
  if (result && Object.hasOwn(result, 'source_file')) {
    const { source_file: file, source_line: line, steps, ...fields } = result;
    const text = Object.entries(fields).map(([key, value]) => {
      const labels = key === 'status' ? queryStatusLabels[section] : valueLabels[key];
      return `${columnLabels[key] ?? key}：${renderValue(value, labels)}`;
    });
    return [`- ${text.join('｜')} → ${file}:${line}`, ...(steps ?? []).flatMap(step => renderRows(step, 'steps')).map(row => `  ${row}`)];
  }
  if (result && typeof result === 'object') {
    return Object.entries(result).flatMap(([key, value]) => [`## ${queryLabels[key] ?? key}`, ...renderRows(value, key)]);
  }
  return [result === null ? '（无）' : renderValue(result)];
}

function readIndex(db, root, command, args, configRevision, json) {
  const meta = metadata(db);
  const state = status(meta, meta ? compareSources(meta, snapshot(root, false, configRevision)) : undefined);
  const findings = storedFindings(meta);
  const partial = findings.length ? '提示：索引包含解析发现，结果可能不全；运行 index 查看来源。' : null;
  if (command === 'status') {
    return { fields: { command, ...state, findings }, code: state.state === 'fresh' ? EXIT.OK : EXIT.FAIL,
      text: [statusLabel[state.state], ...changeList(state), partial].filter(Boolean).join('\n') };
  }
  if (!meta) throw new Error(statusLabel.missing);
  const kind = command === 'query' ? args.kind : 'sources';
  const results = command === 'query' ? query(db, args, JSON.parse(meta.get('policy'))) : querySources(db, args);
  const stale = state.state === 'stale';
  return { fields: { command, ...(command === 'query' ? { kind } : {}), stale, results },
    text: json ? undefined : [stale ? `警告：${statusLabel.stale}以下仍为上次索引结果。` : null, partial,
      `# ${queryTitles[kind] ?? queryLabels[kind]}`, ...renderRows(results, kind)].filter(Boolean).join('\n') };
}

export async function main(argv, { importer = defaultImporter } = {}) {
  return runCli('story-db', argv, { full: { type: 'boolean' }, ...queryOptions }, usage, async (root, values, positionals) => {
    const [command, ...operands] = positionals;
    const write = command === 'index';
    let args;
    if (command === 'query') args = queryArgs(operands, values);
    else if (['index', 'status', 'sources'].includes(command)) {
      checkFlags(values, write ? ['full'] : []);
      if (operands.length > (command === 'sources' ? 1 : 0) || operands.some(arg => !arg.trim())) {
        throw new Error(`${command} 的位置参数有误；请查看 --help`);
      }
      args = operands[0]?.trim();
    } else throw new Error(`未知命令：${command ?? '（未提供）'}；请查看 --help`);

    const location = dbLocation(root);
    const { config, found, configRevision } = readProjectConfig(root);
    const DatabaseSync = await sqlite(importer);
    if (!location.exists && !write) {
      if (command !== 'status') throw new Error(statusLabel.missing);
      return { fields: { command, ...status(null), findings: [] },
        text: statusLabel.missing, code: EXIT.FAIL, found };
    }
    if (write) mkdirSync(location.dir, { recursive: true });
    let db;
    try {
      db = new DatabaseSync(location.file, { readOnly: !write });
      if (!write) db.exec('PRAGMA query_only = ON');
      db.exec('PRAGMA busy_timeout = 5000; PRAGMA trusted_schema = OFF');
      const out = transaction(db, write, () => {
        if (!write) return readIndex(db, root, command, args, configRevision, values.json);
        const meta = values.full ? null : metadata(db);
        const result = updateIndex(db, meta, snapshot(root, true, configRevision), config, Boolean(values.full));
        return { fields: { command, ...result }, text: indexText(result),
          code: result.findings.some(item => item.level === 'block') ? EXIT.FAIL : EXIT.OK };
      });
      return { ...out, found };
    } catch (error) {
      if (error.code?.includes('SQLITE')) {
        throw new Error(`无法处理故事索引：${error.message}。如索引损坏，请移走它后重新运行 index。`, { cause: error });
      }
      throw error;
    } finally {
      db?.close();
    }
  });
}

await directMain(import.meta.url, main);
