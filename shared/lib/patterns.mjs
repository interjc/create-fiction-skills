import { finding } from './cli.mjs';
import { linesOf } from './md.mjs';
import { readOptional } from './project.mjs';

const raw = String.raw;
const pattern = (id, rule, level, scope, source, hint) => ({ id, rule, level, scope, source, hint });
const yearHint = '改相对时间（“那几年”“前些年”）';
const summaryHint = '场景已做出来的意思不再总结';
const year = (id, source) => pattern(id, 'exact-year', 'block', 'all', source, yearHint);
const ref = (id, source, hint) => pattern(id, 'internal-ref', 'block', 'all', source, hint);
const summary = (id, source, hint = summaryHint) => pattern(id, 'summary', 'suggest', 'narration', source, hint);
const ai = (id, level, source, hint) => pattern(id, 'ai-tone', level, 'narration', source, hint);

/** 契约中的默认模式；IR07 的词表由支线文件提供。 */
export const DEFAULT_PATTERNS = Object.freeze([
  year('EY01', raw`re:(?<![0-9])(19|20)\d{2}\s*年`),
  year('EY02', raw`re:(?<![0-9])(19|20)\d{2}[-/.](0?[1-9]|1[0-2])(?![0-9])`),
  year('EY03', raw`re:[一二][〇零○一二三四五六七八九]{3}\s*年`),
  ref('IR01', raw`re:[A-Za-z0-9_./-]+\.(md|json|mjs|js|txt|csv)(?![A-Za-z])`, '正文出现文件名'),
  ref('IR02', raw`re:(?<![A-Za-z])(bible|chapters|drama|episodes|\.fiction)/`, '正文出现项目路径'),
  ref('IR03', raw`re:(?<![A-Za-z])[Cc][Hh]\s?\d+`, '正文出现章号 ID'),
  ref('IR04', raw`re:(?<![A-Za-z0-9])[FTI]\d{3,}(?![0-9])`, '正文出现伏笔 / 锚点 / 物品 ID'),
  ref('IR05', raw`re:\[[^\]]+\]\([^)]*\)`, '正文出现 Markdown 链接'),
  ref('IR06', raw`re:(hook|paywall|lint-ignore)\s*:`, '标记写在注释外'),
  pattern('IR07', 'internal-ref', 'suggest', 'all', null, '可能是支线 ID 泄漏'),
  summary('SUM01', '这就是'),
  summary('SUM02', '问题不在'),
  summary('SUM03', '值钱的是'),
  summary('SUM04', '这就够了'),
  summary('SUM05', raw`re:真正[^，。！？；\n]{1,12}的是`),
  summary('SUM06', '显然不是'),
  summary('SUM07', 're:这(很|非常|十分)(重要|现实|关键)', '空泛收束'),
  summary('SUM08', '真正的意义在于', '空泛收束'),
  summary('SUM09', 're:说到底|归根到底|归根结底', '论文式收束'),
  summary('SUM10', 're:值不值|小不小气', '替读者下判断'),
  summary('SUM11', 're:(他|她)(终于)?(明白|意识到|懂得)了', '用动作或决定写出领悟'),
  summary('SUM12', 're:这(意味着|说明了?)', '让读者自己推出结论'),
  summary('SUM13', 're:某种(意义|程度)上', '含糊限定'),
  ai('AT01', 'block', 're:一丝(不易|难以)察觉的', '陈词套话'),
  ai('AT02', 'block', 're:(时间|空气|世界)(仿佛|似乎)(静止|凝固|停滞)', '陈词套话'),
  ai('AT03', 'block', 're:命运的(齿轮|馈赠)', '陈词套话'),
  ai('AT04', 'block', 're:总而言之|综上所述|值得一提的是|不难看出|毋庸置疑|不可否认', '说明文连接词'),
  ai('AT05', 'block', raw`re:这不仅(仅)?是[^。！？\n]{1,20}[，,]更是`, '排比升华'),
  ai('AT06', 'block', 're:(一种|一股)(难以言喻|无法言说|说不清道不明)的', '空洞情绪'),
  ai('AT07', 'block', 're:心中(五味杂陈|百感交集)', '空洞情绪'),
  ai('AT08', 'block', 're:仿佛在(诉说|讲述|低语)', '拟人套话'),
  ai('AT09', 'block', 're:嘴角(勾起|扬起|泛起)一抹', '陈词套话'),
  ai('AT21', 'suggest', raw`re:不是[^，。！？；\n]{1,15}[，,]\s*而是`, '“不是…而是…”对举，确认是否必要'),
  ai('AT22', 'suggest', 're:眼(中|里|底)闪过一(丝|抹)', '换成可见动作'),
  ai('AT23', 'suggest', '深吸一口气', '高频动作，换写法或删'),
  ai('AT24', 'suggest', raw`re:^\s*这一刻[，,]`, '刻意定格'),
  ai('AT25', 'suggest', 're:(心中|心里|心头)(涌起|升起|泛起)一(股|阵|丝)', '直陈情绪'),
  ai('AT26', 'suggest', 're:(空气中|四周)弥漫着', '氛围套话'),
  ai('AT27', 'suggest', 're:(不由得|不禁)(心中|心头)?一(紧|震|动)', '直陈情绪'),
  ai('AT28', 'suggest', 're:(某种|一种)(说不清|莫名)的', '含糊'),
  ai('AT29', 'suggest', 're:(微微|轻轻)(一笑|点头|颔首)', '高频动作'),
].map(Object.freeze));

/** 按规则编译字面模式，纯 ASCII 词表项加边界并忽略大小写。 */
export function literalPattern(text, { word = false, sensitive = false } = {}) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = word || (/^[A-Za-z0-9 _.-]+$/.test(text) && /[A-Za-z0-9]/.test(text));
  return boundary
    ? new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, sensitive ? 'gu' : 'giu')
    : new RegExp(escaped, 'gu');
}

/** 编译模式文件的 re: 正则或区分大小写的字面子串。 */
export function compilePattern(source) {
  if (source.startsWith('re:')) {
    if (!source.slice(3)) throw new Error('正则不能为空');
    return new RegExp(source.slice(3), 'gu');
  }
  return new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gu');
}

/** 加载默认及作者扩展模式。 */
export function loadPatterns(root, config) {
  const file = config.lint.patterns_file;
  const text = readOptional(root, file);
  const errors = [];
  const custom = [];
  const disabled = new Set();
  const report = (line, message, excerpt) => errors.push(finding('patterns', file, message, { line, excerpt }));
  let section = null;
  for (const [i, rawLine] of linesOf(text ?? '').entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === '[disable]') {
      section = { rule: 'disable' };
      continue;
    }
    const header = /^\[(summary|ai-tone|custom):(block|suggest)(?::(narration|all))?\]$/.exec(line);
    if (header) {
      const [, rule, level, scope = rule === 'custom' ? 'all' : 'narration'] = header;
      section = { rule, level, scope };
      continue;
    }
    if (/^\[[A-Za-z][A-Za-z-]*(?::[a-z:]+)?\]$/i.test(line) || /^\[(?:summary|ai-tone|custom|disable)\b/i.test(line)) {
      report(i + 1, '模式段头非法', line);
      section = null;
      continue;
    }
    if (!section) {
      report(i + 1, '模式必须写在段内', line);
      continue;
    }
    if (section.rule === 'disable') {
      if (DEFAULT_PATTERNS.some(item => item.id === line)) disabled.add(line);
      else report(i + 1, '不能关闭未知的内置模式', line);
      continue;
    }
    const arrow = line.indexOf('=>');
    const source = (arrow === -1 ? line : line.slice(0, arrow)).trim();
    const hint = arrow === -1 ? null : line.slice(arrow + 2).trim() || null;
    try {
      if (!source) throw new Error('模式不能为空');
      compilePattern(source);
      custom.push(pattern(`U${i + 1}`, section.rule, section.level, section.scope, source, hint));
    } catch (error) {
      report(i + 1, `模式非法：${error.message}`, line);
    }
  }
  return { patterns: [...DEFAULT_PATTERNS.filter(item => !disabled.has(item.id)), ...custom], errors };
}
