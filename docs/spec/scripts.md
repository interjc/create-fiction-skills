# 脚本接口规范

> 契约文件，`spec_version: 1`。状态：已审定、待作者确认后冻结（T1，2026-11-21），改动须总监批准。
> 格式定义见 [story-bible.md](story-bible.md)（下文 `SB §x` 指它的章节）；skill 写法见 [skill-authoring.md](skill-authoring.md)。
> 本文定义每个脚本的命令行、输入、输出、退出码，以及“脚本保证什么、留给谁判断什么”。实现者（T2/T3）不能提问，遇到本文没写的情况：选最保守的行为（报错而不是猜），并在交付报告里列出。

## 1. 总则

### 1.1 运行环境与代码位置

- Node.js ≥ 22.5，只用 `node:` 内置模块（`node:fs`、`node:path`、`node:util`、`node:crypto`、`node:child_process`、`node:test` 等）；ES module，扩展名 `.mjs`；无 `package.json` 依赖。不联网，不调用模型。
- 共用代码唯一源：`shared/lib/*.mjs`。入口模块（`length`、`lint`、`brief`、`foreshadow-scan`、`drama-check`）各导出 `main(argv: string[]): Promise<number>`（返回退出码）和下文列出的纯函数。
- `tools/sync-shared.mjs` 按 `shared/manifest.json` 把 lib 复制进各 skill 的 `scripts/lib/`，并生成入口包装 `skills/<skill>/scripts/<entry>.mjs`（§8）。作者调用方式：`node <skill目录>/scripts/<entry>.mjs ...`。
- 仓库级脚本 `tools/validate.mjs`、`tools/sync-shared.mjs` 只服务本仓库，不复制进 skill。

| shared/lib 模块 | 职责与主要导出 |
|---|---|
| `cli.mjs` | `parseCli(argv, options)`（封装 `node:util` 的 `parseArgs`，未知参数报错）、`findBookRoot(start)`、`emit(result, {json})`、`EXIT = {OK:0, FAIL:1, ERROR:2}` |
| `config.mjs` | `DEFAULT_CONFIG`（与 SB §8 表逐字段一致）、`loadConfig(root) → {config, found, errors}` |
| `md.mjs` | `parseTables(text)`、`parseFields(lines)`、`splitList(s)`、`parseChapterRef(s)`、`parseChapterList(s)`、`sections(text, level)`、`maskComments(text)`、`parseMarkers(text)`、`HOOK_ORDER = ["S","A","B","C"]`（SB §6.1、§7.2 的通用语法） |
| `project.mjs` | `listChapters(root) → [{chapter, volume, dir, drafts, canonical}]`、`resolveSelector(root, sel)`、`volumeOf(root, ch)`、`isFrozen(ch, config)`、`parseRanges(strings)` |
| `bible.mjs` | `parseForeshadows`、`parseSubplots`、`parseCharacters`、`parseAppearances`、`parseDynamics`、`parseTimeline`、`parseInventory`、`parseStorylines`、`parseSources`、`parseVolumePlan`、`parseVolInfo`、`parseOutline`、`parseSettingTags`；每个返回 `{items, errors: Finding[]}`，`items` 带 `file`、`line` |
| `drama.mjs` | `parseSeries`、`parseAdaptationMap`、`parseEpisode` |
| `patterns.mjs` | `DEFAULT_PATTERNS`（§4.2 表）、`loadPatterns(root, config) → {patterns, errors}` |
| 入口模块 | `length.mjs`：`stripMarkdownForLength(md)`、`countChapterCharacters(md)`；`lint.mjs`：`lintFile(text, ctx)`；`brief.mjs`：`buildBrief(root, ch, opts)`；`foreshadow-scan.mjs`：`scan(root, at, opts)`；`drama-check.mjs`：`checkSeries(root, slug, opts)` |

T3（fiction-story-db）的脚本复用 `bible.mjs`、`drama.mjs`、`project.mjs`、`config.mjs` 的解析结果，不另写解析器。

### 1.2 公共约定

| 项 | 规则 |
|---|---|
| 书根 | `--root <dir>`；省略时从当前目录向上找第一个含 `.fiction/config.json` 的目录，找不到再找含 `bible/` 的目录；都没有则退出码 2 |
| 配置 | 按 SB §8 加载；缺文件用默认值，人读输出首行提示一次；类型错误退出码 2；config `version` 高于脚本支持值退出码 2 |
| 章节选择 `<sel>` | `12`、`12-20`、`12,15,20-22`，或一个 `.md` 文件路径；`--all` = 全部有定稿的章。单个章号没有定稿、或范围内一章定稿都没有时退出码 2；范围内缺的章跳过并在人读输出里列出 |
| 输出 | 默认中文人读文本到 stdout，错误信息到 stderr；`--json` 时 stdout 只输出一个 JSON 对象（UTF-8，2 空格缩进，末尾换行），不混入其他文字；无颜色 |
| JSON 信封 | 所有脚本：`{"tool": "<名>", "spec_version": 1, "root": "<绝对路径>", "ok": <bool>, ...}`，其余字段见各节；文件路径一律相对书根（validate / sync 相对仓库根），用 `/` |
| 排序 | findings 按 `file`、`line`、`column`、`rule` 升序；章节结果按章号升序；伏笔按 ID 字典序 |
| 行列 | `line`、`column` 从 1 起；列按 Unicode 码点计；无法定位时为 `null` |
| 退出码 | `0` 通过；`1` 检查未通过（定义见各节）；`2` 用法错误、找不到书根或文件、配置非法、正则非法、内部错误 |
| `--help` | 打印用法，退出码 0 |

Finding（lint、drama-check、foreshadow-scan 的 `invalid`、validate 共用；validate 用 `check` 代替 `rule`，无 `level`）：

```json
{ "rule": "ai-tone", "id": "AT01", "level": "block", "file": "chapters/1/12/v1.md", "line": 34, "column": 5,
  "excerpt": "一丝不易察觉的", "message": "AI 腔：陈词套话", "hint": "换成具体动作或物件" }
```

`level` 只有两级：`block`（必须改，导致退出码 1）和 `suggest`（提示，由模型或作者判断）。人读格式每条一行：`BLOCK chapters/1/12/v1.md:34:5 ai-tone/AT01「一丝不易察觉的」AI 腔：陈词套话 → 换成具体动作或物件`，末尾一行汇总。

## 2. 测试

- `shared/tests/<module>.test.mjs`（`node:test` + `node:assert/strict`），共用 fixtures 放 `shared/tests/fixtures-shared/`：一本原创迷你书，覆盖 SB 每种机读格式的合法与非法样例（不得出现 debook-terms 词）。
- `tools/tests/*.test.mjs` 测 validate 与 sync-shared，用 `tools/tests/fixtures/` 下的迷你仓库。
- 必测：§3.3 的计数向量；`DEFAULT_CONFIG` 与 SB §8 表一致；每条 lint 规则与默认模式至少一个命中、一个不命中样例；每个 JSON 形状的键集合。
- 验收：`node --test shared/tests/ tools/tests/` 与 `node --test skills/*/scripts/tests/` 都通过。

## 3. `length.mjs`：正文字数

```
node scripts/length.mjs <sel> | --all  [--min N] [--root DIR] [--json]
```

读：各章定稿（SB §7.1）、config `length.*`、`frozen.ranges`。

### 3.1 计数口径（照搬来源实现，顺序不可调换）

对文件全文依次执行（正则均为 JS 语法；带 `m` 的按多行模式）：

1. `\r\n?` → `\n`。
2. 删文件开头的 front matter：`/^---\n[\s\S]*?\n---(?:\n|$)/`（仅匹配开头）。
3. 删所有 HTML 注释：`/<!--[\s\S]*?-->/g`。
4. 逐行删除开头的空行、ATX 标题行（`/^[ \t]{0,3}#{1,6}\s+/`）、分隔线行（`/^[ \t]{0,3}(?:[-*_][ \t]*){3,}$/`），直到遇到第一行其他内容。
5. 删下章预告行：`/^[ \t]*\*?下章预告[：:][^\n]*\*?[ \t]*$/gm`。
6. 删代码围栏行（保留围栏内内容）：`/^[ \t]*(?:```+|~~~+).*$/gm`。
7. 删图片：`/!\[[^\]]*]\([^)]*\)/g`。
8. 行内链接留文字：`/\[([^\]]+)]\([^)]*\)/g` → `$1`。
9. 引用式链接留文字：`/\[([^\]]+)]\[[^\]]*]/g` → `$1`。
10. 删链接定义：`/^\s*\[[^\]]+]:\s+\S+.*$/gm`。
11. 删分隔线：`/^\s{0,3}(?:[-*_]\s*){3,}$/gm`。
12. 删标题标记（留文字）：`/^\s{0,3}#{1,6}\s+/gm`。
13. 删引用标记：`/^\s{0,3}>\s?/gm`。
14. 删列表标记：`/^\s{0,3}(?:[-+*]|\d+[.)])\s+/gm`。
15. 删表格分隔行：`/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm`。
16. 删字符 `` | * _ ~ ` ``：`` /[|*_~`]/g ``。
17. 反转义：`` /\\([\\`*{}[\]()#+\-.!_>~|])/g `` → `$1`。
18. 删所有空白：`/\s/g`。
19. 计数 = `Array.from(结果).length`（Unicode 码点数；中文标点、全角符号都计入）。

### 3.2 判定与输出

| 状态 | 条件 | 影响退出码 |
|---|---|---|
| `pass` | `count ≥ min` 且（`soft_max` 为 null 或 `count ≤ soft_max`） | 否 |
| `long` | `count > soft_max` | 否（只提示） |
| `short` | `count < min` | 是，退出码 1 |
| `skipped` | `--all` 且 `skip_frozen` 且该章冻结 | 否 |

显式点名的冻结章照常计数，结果带 `frozen: true`，但不影响退出码。`--min` 覆盖 config。传文件路径时章号取父目录名（非数字则为 `null`）。

人读：`PASS 第12章 2431 字（要求 ≥ 2000）chapters/1/12/v1.md`，状态词 `PASS` / `LONG` / `SHORT` / `SKIP`；末行 `检查 N 章：通过 a，偏长 b，偏短 c，跳过 d。`

```json
{ "tool": "length", "spec_version": 1, "root": "/abs/book", "ok": false, "min": 2000, "soft_max": 5000,
  "results": [ { "chapter": 12, "file": "chapters/1/12/v1.md", "count": 1873, "status": "short", "frozen": false } ],
  "summary": { "checked": 1, "pass": 0, "long": 0, "short": 1, "skipped": 0 } }
```

### 3.3 必测向量

| 输入（JS 字符串） | count |
|---|---|
| `"# 第1章：标题\n\n他推门。\n\n---\n\n“走吧。”\n<!-- hook: A -->\n"` | 9 |
| `` "**加粗**和[链接](a.md)、`code`\n" `` | 10 |
| `"*下章预告：明天见*\n正文"` | 2 |
| `"a_b c\\*d"` | 5 |

保证：计数口径与上文逐步一致、阈值判定。不保证：平台字数（各平台算法不同，发布以平台计数为准）、内容是否注水（交 fiction-review 的删除测试）。

## 4. `lint.mjs`：硬规则扫描

```
node scripts/lint.mjs <sel> | --all | --series SLUG | <file.md>...  [--fail-on block|suggest] [--rules r1,r2] [--root DIR] [--json]
node scripts/lint.mjs --freeze [--force] [--root DIR] [--json]
```

读：章节定稿（kind `chapter`）；`--all` 时另加 `config.lint.extra_files` 匹配的文件（kind `extra`）；`--series` 读 `drama/<slug>/episodes/*.md`（kind `episode`）；显式路径按位置推断 kind。另读 config、`.fiction/lint-patterns.txt`、`bible/subplots.md`（IR07）、`.fiction/frozen.json`。`--rules` 只跑列出的规则。

### 4.1 预处理

- 把 HTML 注释替换成等长空格（保留换行），保证行列不变；注释内容不参与任何文本规则。
- **叙述范围**（`narration`）：在上一步基础上，再把同一行内成对引号 `“…”`、`「…」`、`『…』`、`"…"` 的内容替换为空格。剧本文件的叙述范围 = 动作行 `△` 之后的文字；对白文字属于 `all`。
- `all` 范围 = 去注释后的全部文字。
- 匹配逐行进行，不跨行。字面模式按子串；`re:` 模式用 `new RegExp(src, "gu")`。
- 纯 ASCII 字母数字（可含空格、`-`、`_`、`.`）的词表项：不区分大小写，两侧加 `(?<![A-Za-z0-9])` / `(?![A-Za-z0-9])`；其他按区分大小写的子串。
- 豁免：`<!-- lint-ignore: 规则或ID, ... -->` 单独成行时豁免下一个非空行；`<!-- lint-ignore-file: ... -->` 豁免整个文件。被豁免的不输出，计入 `summary.suppressed`。
- 级别覆盖：`config.lint.rules` 里模式 ID 优先，其次规则名；值 `off` 关闭。

### 4.2 规则

| 规则 | 默认级别 | 适用 | 判定 |
|---|---|---|---|
| `banned-term` | block | 全部 | `lint.banned_terms` 任一项出现（`all` 范围，含标题） |
| `desensitize` | block | 全部 | `lint.desensitize.places/schools/companies/people/other` 任一项出现；`hint` 取词表项的 `hint` |
| `exact-year` | block | 全部（`exact_years=true` 时） | EY01–EY03 |
| `internal-ref` | block（IR07 suggest） | 全部 | IR01–IR07：文件名、路径、章号 ID、伏笔 / 锚点 / 物品 ID、Markdown 链接、泄漏的标记、支线 ID |
| `internal-term` | suggest | 全部 | `lint.internal_terms` 任一项出现（`all` 范围；下章预告行除外） |
| `summary` | 按模式 | chapter、episode、extra | 作者替读者总结的句式（SUM*） |
| `ai-tone` | 按模式 | chapter、episode、extra | AI 腔（AT*） |
| `custom` | 按模式 | 全部 | 作者模式文件里的 `custom` 段 |
| `title-format` | block | chapter | 第 1 行不符合 SB §7.2 正则，或数字 ≠ 目录章号 |
| `hook` | block | chapter | 标记按行识别，正则 `^<!--\s*hook:\s*([A-Za-z])\s*-->$`（去首尾空白后整行匹配，空格可省）。`hook.required` 且无标记；字母不是大写 S/A/B/C；多于一个；不是最后一个非空行 |
| `hook-discouraged` | suggest | chapter | 钩子级别在 `hook.discouraged` 内 |
| `markdown-format` | suggest | chapter | 第 2 行起出现以 `#`、`>`、`- `、`* `、`+ `、`数字. ` 开头的行，或行内含 `**`、`__` |
| `separator-format` | suggest | chapter | 疑似场景分隔却不是恰好 `---`：`/^\s*(?:\*\s*){3,}$/`、`/^\s*(?:_\s*){3,}$/`、`/^\s*-{4,}\s*$/`、`/^\s*[—～~]{3,}\s*$/`、`/^\s+---\s*$|^---\s+$/` |
| `frozen-modified` | block | 项目级 | 见 §4.4 |
| `frozen-unsealed` | suggest | 项目级 | 见 §4.4 |

内置模式（`shared/lib/patterns.mjs` 的 `DEFAULT_PATTERNS`；扩展这份默认表要走契约变更）：

| ID | 规则 | 级别 | 范围 | 模式 | 提示 |
|---|---|---|---|---|---|
| EY01 | exact-year | block | all | `re:(?<![0-9])(19\|20)\d{2}\s*年` | 改相对时间（“那几年”“前些年”） |
| EY02 | exact-year | block | all | `re:(?<![0-9])(19\|20)\d{2}[-/.](0?[1-9]\|1[0-2])(?![0-9])` | 同上 |
| EY03 | exact-year | block | all | `re:[一二][〇零○一二三四五六七八九]{3}\s*年` | 同上 |
| IR01 | internal-ref | block | all | `re:[A-Za-z0-9_./-]+\.(md\|json\|mjs\|js\|txt\|csv)(?![A-Za-z])` | 正文出现文件名 |
| IR02 | internal-ref | block | all | `re:(?<![A-Za-z])(bible\|chapters\|drama\|episodes\|\.fiction)/` | 正文出现项目路径 |
| IR03 | internal-ref | block | all | `re:(?<![A-Za-z])[Cc][Hh]\s?\d+` | 正文出现章号 ID |
| IR04 | internal-ref | block | all | `re:(?<![A-Za-z0-9])[FTI]\d{3,}(?![0-9])` | 正文出现伏笔 / 锚点 / 物品 ID |
| IR05 | internal-ref | block | all | `re:\[[^\]]+\]\([^)]*\)` | 正文出现 Markdown 链接 |
| IR06 | internal-ref | block | all | `re:(hook\|paywall\|lint-ignore)\s*:` | 标记写在注释外 |
| IR07 | internal-ref | suggest | all | `bible/subplots.md` 中定义的每个支线 ID，两侧非字母数字 | 可能是支线 ID 泄漏 |
| SUM01 | summary | suggest | narration | `这就是` | 场景已做出来的意思不再总结 |
| SUM02 | summary | suggest | narration | `问题不在` | 同上 |
| SUM03 | summary | suggest | narration | `值钱的是` | 同上 |
| SUM04 | summary | suggest | narration | `这就够了` | 同上 |
| SUM05 | summary | suggest | narration | `re:真正[^，。！？；\n]{1,12}的是` | 同上 |
| SUM06 | summary | suggest | narration | `显然不是` | 同上 |
| SUM07 | summary | suggest | narration | `re:这(很\|非常\|十分)(重要\|现实\|关键)` | 空泛收束 |
| SUM08 | summary | suggest | narration | `真正的意义在于` | 空泛收束 |
| SUM09 | summary | suggest | narration | `re:说到底\|归根到底\|归根结底` | 论文式收束 |
| SUM10 | summary | suggest | narration | `re:值不值\|小不小气` | 替读者下判断 |
| SUM11 | summary | suggest | narration | `re:(他\|她)(终于)?(明白\|意识到\|懂得)了` | 用动作或决定写出领悟 |
| SUM12 | summary | suggest | narration | `re:这(意味着\|说明了?)` | 让读者自己推出结论 |
| SUM13 | summary | suggest | narration | `re:某种(意义\|程度)上` | 含糊限定 |
| AT01 | ai-tone | block | narration | `re:一丝(不易\|难以)察觉的` | 陈词套话 |
| AT02 | ai-tone | block | narration | `re:(时间\|空气\|世界)(仿佛\|似乎)(静止\|凝固\|停滞)` | 陈词套话 |
| AT03 | ai-tone | block | narration | `re:命运的(齿轮\|馈赠)` | 陈词套话 |
| AT04 | ai-tone | block | narration | `re:总而言之\|综上所述\|值得一提的是\|不难看出\|毋庸置疑\|不可否认` | 说明文连接词 |
| AT05 | ai-tone | block | narration | `re:这不仅(仅)?是[^。！？\n]{1,20}[，,]更是` | 排比升华 |
| AT06 | ai-tone | block | narration | `re:(一种\|一股)(难以言喻\|无法言说\|说不清道不明)的` | 空洞情绪 |
| AT07 | ai-tone | block | narration | `re:心中(五味杂陈\|百感交集)` | 空洞情绪 |
| AT08 | ai-tone | block | narration | `re:仿佛在(诉说\|讲述\|低语)` | 拟人套话 |
| AT09 | ai-tone | block | narration | `re:嘴角(勾起\|扬起\|泛起)一抹` | 陈词套话 |
| AT21 | ai-tone | suggest | narration | `re:不是[^，。！？；\n]{1,15}[，,]\s*而是` | “不是…而是…”对举，确认是否必要 |
| AT22 | ai-tone | suggest | narration | `re:眼(中\|里\|底)闪过一(丝\|抹)` | 换成可见动作 |
| AT23 | ai-tone | suggest | narration | `深吸一口气` | 高频动作，换写法或删 |
| AT24 | ai-tone | suggest | narration | `re:^\s*这一刻[，,]` | 刻意定格 |
| AT25 | ai-tone | suggest | narration | `re:(心中\|心里\|心头)(涌起\|升起\|泛起)一(股\|阵\|丝)` | 直陈情绪 |
| AT26 | ai-tone | suggest | narration | `re:(空气中\|四周)弥漫着` | 氛围套话 |
| AT27 | ai-tone | suggest | narration | `re:(不由得\|不禁)(心中\|心头)?一(紧\|震\|动)` | 直陈情绪 |
| AT28 | ai-tone | suggest | narration | `re:(某种\|一种)(说不清\|莫名)的` | 含糊 |
| AT29 | ai-tone | suggest | narration | `re:(微微\|轻轻)(一笑\|点头\|颔首)` | 高频动作 |

（表格里的 `\|` 在源码中写作 `|`。）

### 4.3 作者扩展文件 `.fiction/lint-patterns.txt`

```
# 注释与空行忽略
[summary:suggest]
总之一句话
[ai-tone:block:all]
re:不禁感慨万千 => 删掉，写出他做了什么
[custom:block]
某个本书不许用的口头禅
[disable]
AT23
```

- 段头：`^\[(summary|ai-tone|custom):(block|suggest)(?::(narration|all))?\]$` 或 `[disable]`。范围省略时 summary / ai-tone 为 `narration`，custom 为 `all`。
- 模式行：`<模式>` 或 `<模式> => <提示>`；`re:` 开头为正则，否则为字面。`[disable]` 段每行一个要关闭的内置 ID。
- 作者模式 ID 为 `U<行号>`。段头非法、正则非法、段外出现模式行：退出码 2，报文件与行号。

### 4.4 冻结章

`--freeze`：对 `frozen.ranges` 内每个章目录下的全部 `v*.md` 计算 SHA-256，写 `.fiction/frozen.json`：

```json
{ "spec_version": 1, "created": "2026-11-21T08:00:00Z", "ranges": ["1-120"],
  "files": { "chapters/1/1/v1.md": "<sha256 hex 小写>" } }
```

`files` 键按字典序。已有清单时：已登记文件哈希变了或文件没了 → 拒绝写入，列出这些文件，退出码 1（`--force` 才覆盖）；新进入范围的章追加；已移出范围的章删除。成功退出码 0，人读输出“新增 a，移除 b，保持 c”。

每次普通 lint 都做全书冻结检查（与选择的章无关）：

| 情况 | 结果 |
|---|---|
| 清单内文件哈希不同或已删除 | `frozen-modified` block，`file` 为该文件 |
| 冻结章目录里出现清单外的 `v*.md` | `frozen-modified` block |
| `frozen.ranges` 非空但无清单，或范围内有章未登记 | `frozen-unsealed` suggest，提示运行 `--freeze` |

```json
{ "tool": "lint", "spec_version": 1, "root": "/abs/book", "ok": false,
  "files": [ { "file": "chapters/1/12/v1.md", "kind": "chapter", "chapter": 12 } ],
  "findings": [ "<Finding>" ],
  "summary": { "files": 1, "block": 2, "suggest": 5, "suppressed": 1 } }
```

退出码：存在级别 ≥ `--fail-on`（默认 `block`）的 finding 时为 1。
保证：词表、模式、格式与冻结哈希的确定性判定。不保证：suggest 是否真有问题（模型判断）；同义改写的 AI 腔、总结句、信息重复、视角越界（交 fiction-review）；脱敏词表是否完整（作者判断）。

## 5. `brief.mjs`：章节写作简报

```
node scripts/brief.mjs <ch> [--vol N] [--root DIR] [--json]
```

只读 Markdown（不需要 story-db）：`sources.md`、`volumes/{vol}.md`、该章 `outline.md`、上一章定稿、`foreshadows.md`、`subplots.md`、`characters.md`、`appearances.md`、`character-dynamics.md`、`timeline.md`、SB §6.8 设定标签所在文件、config。

| 步骤 | 规则 |
|---|---|
| 卷 | SB §7.5 规则；`--vol` 覆盖 |
| 规划 `plan` | 卷规划表该章一行为底，`outline.md` 存在时逐字段覆盖；`source` 为 `outline` / `volume_plan` / `null` |
| 规划文本 | `核心事件` + 规划行全部单元格 + `outline.md` 全文；用于 `kw:` 和设定标签匹配 |
| 上一章 `previous` | 第 ch-1 章定稿，去注释、标题行、下章预告行后，取最后 3 个段落（段落 = 连续非空行，`---` 行不算），以 `\n` 连接；超过 600 码点只留末尾 600，前加 `……` |
| 伏笔 | `resolve` = 规划里的收 + 计划回收区间含 ch 的未结伏笔；`plant` = 规划里的埋 + 状态 `planned` 且埋设章 = ch；`touch` = 规划里的触；`overdue` = 以 at=ch 计算的逾期（§6）；`nearby` = 其余未结伏笔中，埋设章 ∈ [ch-5, ch-1] 或计划回收起点 ∈ [ch+1, ch+due_window]。各组内去重，组间按上述顺序先到先占 |
| 支线 | 全部 `active` 支线；`advance_here` = 在规划支线列表中；`planned_step` = 计划章 = ch 的步骤 |
| 人物 | 规划的在场 + 提及，按别名归一；`last_present` / `last_mentioned` 取 `appearances.md` 中 < ch 的最近章；常驻人物 `last_present = ch-1`；`note` 取该行备注；`relationship` = `character-dynamics.md` 中 章 < ch、人物或对象为此人的最新一行 `现状`；`dormant` = 当前卷在其休眠卷内；不在 characters.md 的标 `unknown: true` |
| 提醒 `warnings` | `absent`：级别核心、非常驻、非休眠、`ch - last_present > appearance.gap_warn`；`unknown_character`；`missing_file`；`parse`（解析错误，带文件行号） |
| 时间 | `now` = 章 ≤ ch 的最后一个硬锚（章号最大，同章取表中靠后者）；`near` = 章 ∈ [ch-2, ch+2] 的锚点；`upcoming` = 类型 window / deadline 且章 ∈ [ch, ch+10] |
| 主写入口 `owners` | `sources.md` 中 `简报` 为 `always` 的行；有人物时加 `characters` 行；`kw:` 任一词出现在规划文本中的行；占位符替换为实际卷号 / 章号 |
| 设定 `settings` | 标签注释的 `chapters` 含 ch，或任一 tag 出现在规划文本中 |

人读输出是 Markdown，标题固定、按此顺序，空节写 `（无）`：

```
# 第{ch}章写作简报（卷{vol}）
## 主写入口
## 本章规划
## 上一章结尾
## 本章要回收的伏笔
## 本章要埋设的伏笔
## 本章触及的伏笔
## 逾期与附近伏笔
## 活跃支线
## 出场人物
## 提醒
## 时间锚点
## 关联设定
```

伏笔条目一行：`- F001 后墙旧钥匙 [partial] 埋2 → 收40-45｜读者已知：……｜真相：……｜未来：……`。人物条目：`- 唐七（核心）上次在场 第9章（3 章前）：躲债｜关系：信任打折，仍收留`。

JSON（`"FS"` 占位表示一个 §6 定义的伏笔对象）：

```json
{ "tool": "brief", "spec_version": 1, "root": "/abs/book", "ok": true, "chapter": 12, "volume": 1,
  "plan": { "source": "outline", "title": "闸房的灯", "core_event": "…", "beat": null, "hook": "A", "weight": "normal",
            "subplots": [ { "id": "B2", "step": "chain" } ], "foreshadow_actions": [ { "action": "touch", "id": "F001" } ],
            "characters": { "present": ["唐七"], "mentioned": ["葛婶"] } },
  "previous": { "chapter": 11, "file": "chapters/1/11/v1.md", "tail": "…" },
  "foreshadows": { "resolve": [], "plant": [], "touch": ["FS"], "overdue": [], "nearby": [] },
  "subplots": [ { "id": "B2", "name": "唐七的旧债", "level": "B", "status": "active", "current_step": "remind",
                  "current_chapter": 9, "advance_here": true, "planned_step": null } ],
  "characters": [ { "name": "唐七", "tier": "core", "last_present": 9, "last_mentioned": null, "gap": 3,
                    "note": "躲债", "relationship": "信任打折，仍收留", "dormant": false, "unknown": false } ],
  "warnings": [ { "type": "absent", "name": "葛婶", "gap": 12, "file": null, "line": null, "message": "…" } ],
  "timeline": { "now": { "id": "T001", "time": "…", "chapter": 1, "event": "…", "kind": "hard", "prose_form": "…" },
                "near": [], "upcoming": [] },
  "owners": [ { "key": "canon", "file": "bible/canon.md", "anchor": null, "purpose": "最终设定", "read_when": "…",
                "write_when": "…", "mode": "owner_only" } ],
  "settings": [ { "name": "闸房值班制度", "tags": ["闸房", "值班"], "file": "bible/world-rules.md", "line": 40 } ] }
```

退出码：生成成功即 0（有 warnings 也是 0）；章号非法或找不到书根为 2。
保证：按上表规则机械汇总，并给出文件与行号。不保证：资料是否够用、是否该补读（模型判断）；简报不替代打开 owner file 阅读原文。

## 6. `foreshadow-scan.mjs`：伏笔与支线扫描

```
node scripts/foreshadow-scan.mjs [--at N] [--only c1,c2] [--dormant N] [--fail-on c1,c2] [--root DIR] [--json]
```

读：`foreshadows.md`、`subplots.md`、各章 `outline.md`、章节目录、config `foreshadow.*`、`subplot.*`。

- `at` 默认 = 有定稿的最大章号（没有则 0）。`--dormant` 覆盖 `dormant_after`。
- 类别（定义见 SB §6.2、§6.3）：`plant_due`、`due`、`overdue`、`dormant`、`writeback`、`subplot_alerts`、`invalid`。`--only` 只输出列出的类别。
- `writeback`：对每个 c ≤ at、有定稿且有 `outline.md` 的章核对：

| outline 动作 | 期望 bible 状态 | 不符时 `expected` |
|---|---|---|
| 埋 F | 记录存在、状态非 `planned`、埋设章 = c | `planted@c` |
| 触 F | c ∈ 触及章，或 c = 实际回收章 | `touched@c` |
| 收 F | 状态 `resolved` 且实际回收章 = c | `resolved@c` |
| 弃 F | 状态 `dropped` | `dropped` |
| 支线 ID 步骤 | 该步骤实际章 = c | `<step>@c` |
| 引用不存在的 F-ID / 支线 ID | — | `exists` |

- `subplot_alerts`：`stalled`（状态 active、大收未完成、`at - current_chapter ≥ stall_after`）；`span`（A/B 级、种因已完成、大收未完成、`at - 种因实际章 ≥ max_span`）；`remind_gap`（种因与提醒都完成，间隔不在 `remind_gap` 内）。
- `invalid`：解析与校验错误（SB §6.2 校验规则、§6.3 步骤序），Finding 形式，结构错误 block、未来出现方式为空 suggest。

FS 对象：

```json
{ "id": "F001", "name": "后墙旧钥匙", "status": "partial", "planted": 2, "target": { "start": 40, "end": 45 },
  "resolved": null, "touched": [9, 21], "last_touch": 21, "future": "…", "reader_view": "…", "author_truth": "…",
  "subplots": ["B2"], "characters": [], "file": "bible/foreshadows.md", "line": 7 }
```

```json
{ "tool": "foreshadow-scan", "spec_version": 1, "root": "/abs/book", "ok": false, "at": 50,
  "params": { "due_window": 3, "overdue_grace": 0, "dormant_after": 30, "stall_after": 20, "max_span": 100, "remind_gap": [5, 15] },
  "counts": { "open": 12, "plant_due": 1, "due": 2, "overdue": 1, "dormant": 3, "writeback": 0, "subplot_alerts": 1, "invalid": 0 },
  "plant_due": ["FS"], "due": ["FS"],
  "overdue": [ { "...FS": "", "overdue_by": 5 } ],
  "dormant": [ { "...FS": "", "silent_for": 29 } ],
  "writeback": [ { "chapter": 12, "kind": "foreshadow", "id": "F004", "action": "plant", "expected": "planted@12",
                   "actual": "planned", "file": "chapters/1/12/outline.md", "line": 15 } ],
  "subplot_alerts": [ { "type": "stalled", "id": "B2", "name": "唐七的旧债", "level": "B", "current_step": "remind",
                        "current_chapter": 9, "value": 41 } ],
  "invalid": [] }
```

（`"...FS"` 表示该对象是 FS 的全部字段再加后面的字段。）`overdue_by = at - (end + overdue_grace)`；`silent_for = at - last_touch`；`subplot_alerts[].value` 为相应的章数差。

人读：每类一个 `## 类别（数量）` 小节，条目同 brief 伏笔行格式，`writeback` 条目写“第12章 outline：埋 F004，但伏笔表仍是 planned”。
退出码：`--fail-on` 列出的任一类别非空时为 1；默认 `overdue,invalid`。
保证：按章号与状态的确定性计算、outline 与 bible 的一致性核对。不保证：伏笔“当下功能”是否成立、回收是否自然、是否该放弃（模型与作者判断）；没写进 outline 的伏笔动作无法核对。

## 7. `drama-check.mjs`：短剧剧本检查

```
node scripts/drama-check.mjs <series> [--ep N|N-M] [--fail-on block|suggest] [--root DIR] [--json]
```

读：`drama/<series>/series.md`、`adaptation-map.md`、`episodes/ep*.md`、`bible/characters.md`、`bible/foreshadows.md`、各章定稿（仅判断存在）、config `drama.*`。`--ep` 只限定单集规则；系列级规则始终全量计算。

单集计数：动作行取 `△` 之后的文字；对白行取冒号后的台词，去掉开头的 `（……）`；均去空白后按码点计。镜头行、场景头、人物行、注释、元数据计 0。`est_seconds = round(chars × 60 / chars_per_minute)`；`tier` = `drama.tiers` 中第一个 `max_seconds ≥ est_seconds`（`null` 视为无穷大）的 `id`。时长区间：该集有 `目标时长` T 时为 `[round(0.8T), round(1.2T)]`，否则用 series `单集时长`，都没有则不检查。

| 规则 | 级别 | 判定 |
|---|---|---|
| `ep-title` | block | 第 1 行不符合 SB §9.3，或集号 ≠ 文件名 |
| `ep-meta` | block | `目标时长` 不是正整数 |
| `scene-header` | block | 二级标题不符合场景头正则；或一集没有场景 |
| `scene-number` | suggest | 场景号不是从 1 连续 |
| `bad-line` | block | 场景内出现 SB §9.3“其他”以外的行 |
| `action-missing` | suggest | 场景内没有动作行 |
| `max-scenes` | suggest | 场景数 > `drama.max_scenes` |
| `hook` | block | `drama.hook.required` 且无标记；级别非法；多于一个；之后还有剧本内容 |
| `length` | `drama.length_level` | `est_seconds` 不在时长区间内 |
| `episode-gap` | suggest | 1 到最大已写集号之间缺集 |
| `episode-total` | suggest | 已写集数 > series `总集数` |
| `paywall-placement` | block | `<!-- paywall -->` 不在钩子标记之后，或其后还有非空、非注释内容 |
| `paywall-missing` | block | 无任何卡点，且最大已写集号 ≥ `paywall.first_at[1]` |
| `paywall-position` | block | 首个卡点集号不在 `paywall.first_at` 区间 |
| `paywall-ratio` | suggest | `总集数` 已知且 首个卡点集号 / 总集数 不在 `paywall.free_ratio` 区间 |
| `paywall-hook` | block | 任一卡点集的钩子低于 `paywall.hook_min` |
| `paywall-plan` | suggest | series `免费集数` 已填且 ≠ 首个卡点集号 |
| `map-missing` | suggest | 已写的集在 adaptation-map 没有行 |
| `map-foreshadow` | block | 映射表引用的 F-ID 不在 `foreshadows.md` |
| `map-character` | suggest | 映射表人物（按别名归一）不在 `characters.md` |
| `map-order` | block / suggest | 同一 F 的“收”所在集早于“埋”所在集为 block；只收未埋为 suggest |
| `map-unresolved` | suggest | 已写集数 = 总集数，且映射表里埋过的 F 未收也未弃 |
| `map-source` | suggest | `来源章` 指向没有定稿的章 |

```json
{ "tool": "drama-check", "spec_version": 1, "root": "/abs/book", "ok": true, "series": "stopped-clock",
  "episodes": [ { "episode": 3, "file": "drama/stopped-clock/episodes/ep003.md", "title": "门缝里的灯", "scenes": 2,
                  "chars": 380, "est_seconds": 91, "tier": "short", "range": [72, 108], "hook": "A", "paywall": true } ],
  "paywall": { "first": 10, "all": [10], "total": 60, "ratio": 0.167 },
  "findings": [],
  "summary": { "episodes": 1, "block": 0, "suggest": 0 } }
```

`ratio` 保留 3 位小数；未知为 `null`。退出码：存在级别 ≥ `--fail-on`（默认 `block`）的 finding 时为 1。
保证：格式、计数估算、卡点位置与比例、映射表一致性。不保证：时长估算准确（只是按语速换算）、前 3 秒钩子是否抓人、卡点情绪是否到位、平台合规（模型与作者判断，方法见 fiction-short-drama）。

## 8. `tools/sync-shared.mjs`：共用代码同步

```
node tools/sync-shared.mjs [--check] [--skill NAME] [--root DIR] [--json]
```

清单 `shared/manifest.json`：

```json
{ "skills": {
    "fiction-init": ["lint", "length"],
    "fiction-planner": ["foreshadow-scan"],
    "fiction-chapter": ["brief", "length", "lint"],
    "fiction-review": ["length", "lint"],
    "fiction-continuity": ["foreshadow-scan", "brief"],
    "fiction-short-drama": ["drama-check", "lint"],
    "fiction-story-db": [],
    "fiction-publish": ["length"] } }
```

值为入口名列表（对应 `shared/lib/<entry>.mjs`，必须导出 `main`）；空列表表示只要 lib 副本（供 skill 自己的脚本 import）。初始清单如上，T4 各 skill 需要增减时报总监改清单。

对每个 skill（或 `--skill` 指定的一个）生成：

| 目标 | 内容 | 归属 |
|---|---|---|
| `skills/<s>/scripts/lib/*.mjs` | `shared/lib/*.mjs`（不递归）的逐字节副本 | 整个目录归同步脚本；多余文件删除 |
| `skills/<s>/scripts/<entry>.mjs` | 下方包装文本 | 生成文件 |
| `skills/<s>/scripts/tests/<entry>.test.mjs` | `shared/tests/<entry>.test.mjs` 的副本（源文件存在时） | 生成文件 |
| `skills/<s>/scripts/tests/fixtures-shared/` | `shared/tests/fixtures-shared/` 递归镜像 | 整个目录归同步脚本；多余文件删除 |

包装文本（LF 结尾，`<entry>` 替换为入口名）：

```js
#!/usr/bin/env node
// GENERATED by tools/sync-shared.mjs. Edit shared/lib/<entry>.mjs instead.
import { main } from './lib/<entry>.mjs';
process.exitCode = await main(process.argv.slice(2));
```

- 测试文件以 `../lib/`、`./fixtures-shared/` 相对路径引用，所以在 `shared/tests/` 与 skill 内都能运行。
- skill 自己的其他脚本与测试不动。目标位置已有同名文件但不是本脚本生成的（包装缺 `GENERATED` 行）：不覆盖，退出码 2。
- 缺 skill 目录时创建 `scripts/` 各级目录（SKILL.md 缺失由 validate 报）。
- `--check`：不写任何文件，列出 `missing` / `drift` / `stale`，有任一项退出码 1。写模式成功退出码 0；清单非法、入口模块不存在或缺 `main` 导出，退出码 2。

```json
{ "tool": "sync-shared", "spec_version": 1, "root": "/abs/repo", "ok": true, "mode": "check",
  "changes": [ { "skill": "fiction-review", "action": "drift", "file": "skills/fiction-review/scripts/lib/md.mjs" } ] }
```

`action` ∈ 写模式 `create` / `update` / `delete`，检查模式 `missing` / `drift` / `stale`。

## 9. `tools/validate.mjs`：全仓结构校验

```
node tools/validate.mjs [--only c1,c2] [--root DIR] [--json]
```

书根换成仓库根：向上找第一个同时含 `skills/` 和 `docs/spec/` 的目录。

文件集合：存在 `.git` 且能执行 `git` 时，用 `git ls-files -z --cached --others --exclude-standard`（尊重 `.gitignore`）；否则递归遍历，排除 `.git/`、`node_modules/`、`.agent-team/`。前 8192 字节含 NUL 的视为二进制，跳过文本检查。

| 检查 | 判定（违反即 error） |
|---|---|
| `skill-md` | `skills/` 下每个一级目录都有 `SKILL.md` |
| `frontmatter` | 文件以 `---` 行开头并有闭合 `---` 行；按 YAML 子集解析（顶层 `key: value`，值可为纯量、单 / 双引号、`>` `>-` `|` `|-` 块标量；`metadata` 为一层映射）；只允许 `name`、`description`、`license`、`compatibility`、`metadata`、`allowed-tools`；`name` 符合 `^fiction-[a-z0-9]+(-[a-z0-9]+)*$`、≤64 字符、等于目录名 |
| `description` | 解析后（块标量按 YAML 折叠规则，去末尾换行）非空；≤1024 码点；含 `[㐀-鿿]`；含至少 3 个连续英文词 `/[A-Za-z]{2,}(?:[\s,'-]+[A-Za-z]{2,}){2,}/`；第一个汉字位置早于该英文片段（中文在前）；不含 `<`、`>` |
| `compatibility` | 存在时 ≤500 码点 |
| `skill-lines` | `SKILL.md` ≤500 行（行数 = `\n` 个数，末行无换行时 +1） |
| `reference-lines` | `skills/*/references/**/*.md` 每份 ≤400 行 |
| `links` | 所有 `.md` 的行内链接 / 图片 `[..](目标)` 与链接定义 `[x]: 目标`；跳过代码围栏与行内代码；跳过带协议（`^[A-Za-z][A-Za-z0-9+.-]*:`）、`#` 开头、`//` 开头的目标；去掉 `<>` 包裹、空格后的标题、`#片段`、`?查询`，百分号解码后相对该文件目录解析，必须存在（文件或目录）；`/` 开头的目标直接报错（要求相对路径） |
| `imports` | `skills/`、`shared/`、`tools/` 下所有 `.mjs` `.js`：静态 `import … from`、`export … from`、`import '…'`、字面量 `import('…')`、`require('…')` 的说明符必须以 `node:` 开头，或以 `./` `../` 开头且解析到存在的文件；任何 `package.json` 的 `dependencies`、`devDependencies`、`peerDependencies`、`optionalDependencies` 必须不存在或为空 |
| `debook` | 见下 |
| `shared-drift` | 调用 sync-shared 的检查逻辑，有任何 `missing` / `drift` / `stale` |
| `marketplace` | `.claude-plugin/marketplace.json` 存在时：是合法 JSON；其中每个以 `./skills/` 开头的字符串值指向存在的目录 |

`docs/spec/debook-terms.txt` 解析：

- UTF-8，去 BOM；每行去首尾空白；空行与 `#` 开头的行忽略；行内 ` #`（空格加井号）之后视为注释。
- 段头 `[names]` `[orgs]` `[terms]` `[book]` `[params]` `[allow-paths]`；未知段头、首个段头之前出现词条：退出码 2。
- 词条：字面，或 `re:` 开头的正则（`u` 标志）。匹配规则同 §4.1（纯 ASCII 字母数字词不区分大小写且加边界，其余区分大小写子串）。
- `[allow-paths]`：相对仓库根的 glob，`/` 分隔；`**` 匹配任意层（含零层），`*` 匹配段内任意字符，`?` 匹配段内一个字符，以 `/` 结尾表示该目录下全部。命中任一 glob 的文件跳过；词表文件自身总是跳过。
- 每个命中输出一条：`{ "check": "debook", "file": "…", "line": 3, "message": "命中 [names] 词条：…" }`。

```json
{ "tool": "validate", "spec_version": 1, "root": "/abs/repo", "ok": false,
  "skills": [ { "name": "fiction-review", "lines": 212, "description_chars": 640 } ],
  "findings": [ { "check": "links", "file": "skills/fiction-review/SKILL.md", "line": 88, "message": "链接目标不存在：references/x.md" } ],
  "summary": { "files": 143, "errors": 1 } }
```

退出码：有任何 finding 为 1；词表或参数非法为 2。
保证：上表各项的结构性判定。不保证：description 触发是否准确（T7 评测）、内容是否保留了来源方法（L2/L3 验收清单）、词表是否收全（作者与词表维护者）。

## 10. 诚实标注汇总

| 脚本 | 脚本保证 `[脚本]` | 留给模型 `[模型]` | 留给作者 `[作者]` |
|---|---|---|---|
| length | 计数与阈值 | 注水 / 删减是否得当 | 阈值本身 |
| lint | 词表、模式、格式、冻结哈希 | suggest 的取舍、同义改写的问题 | 词表与模式清单 |
| brief | 汇总规则 | 资料是否足够 | — |
| foreshadow-scan | 到期 / 逾期 / 沉睡 / 回写一致 | 回收质量、伏笔当下功能 | 是否放弃或改期 |
| drama-check | 格式、估算时长、卡点位置与比例、映射一致 | 钩子与卡点的戏剧效果 | 平台合规、付费策略 |
| validate / sync-shared | 仓库结构 | — | — |
