---
name: fiction-continuity
description: >-
  维护长篇故事档案：找唯一主写入口，查伏笔与支线，核对人物、时间、物品和规则，处理跨章矛盾、章后回写的复核、卷末复盘和讨论稿合并。作者说“这个设定在哪记”“帮我查伏笔”“前后矛盾了”“更新人物关系”“整理时间线”“卷完结复盘”“合并讨论稿”“伏笔是不是该收了”或要做一致性审计时就用，即使没提故事档案。写正文及写完一章时回写该章追踪表用 fiction-chapter，重排剧情用 fiction-planner，审文风用 fiction-review。
  Maintain a long serial's story bible. Use when asked where to record a fact, check or pay off a clue, resolve a contradiction, update relationships, reconcile dates, verify chapter write-back, recap a volume, merge discussion drafts, or audit continuity. Use fiction-chapter to draft prose and update tracking tables right after writing a chapter, fiction-planner to replan the story, and fiction-review for editorial review.
license: MIT
compatibility: 遵循 Agent Skills 规范；脚本需要 Node.js 22.5+，无需数据库。
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---

# 长篇连贯性维护

把故事档案（story bible）当成写作后台：写前找对依据，写后按实际发生的事回写，连载过三百章也不靠记忆维护。

## 何时用 / 不用

- 查一条设定或伏笔、同步人物关系、校时间、合并讨论稿、做卷末复盘或跨章一致性审计：用本 skill。只查不改时给出处和建议，不顺手改表。
- 卷表、节奏、钩子级别、日更分组及区域循环步次归 `fiction-planner`，区域步次写在卷规划的自由正文。就规划而言，`fiction-init` 只搭骨架；`fiction-chapter` 据卷规划写章纲和正文，负责章后回写。本 skill 负责核对、指出冲突和维护主写档案，不替它们写规划或正文。
- 要审视角、文风或行文质量，交给 `fiction-review`。只有作者授权且确认稿件未冻结、公开状态明确时，审校才可直接改正文；结构性重写交回 `fiction-chapter`。初稿未到回写环节就标「待回写」，不报回写失败；完成回写后再验。
- 下游 skill 未安装时，交付已查的文件和行号、待办及未跑的检查；不代做规划、写章、审校或其他下游工作。

## 开始前

依次读作者项目的 `AGENTS.md`（尤其「本书口径」）、`.fiction/config.json`、`bible/sources.md`。缺项目骨架就提示先用 `fiction-init`；未安装时，能查证的先只读出报告，需要写回则请作者补齐有关文件和入口。只缺配置时，说明脚本用 [SB §8](references/formats/config.md) 的默认值；无法确认是否已公开的正文一律不动。

写或改任何机读文件前，先打开文末表中对应的格式摘录，照原格式写，不凭印象另立表头或状态。

下文路径相对书根。核对定稿时，按 [SB §7.1](references/formats/chapter.md) 读章纲「定稿」指定的稿次；未指定才取最大稿次。脚本从书根运行；替换命令中的目录和数字占位符，路径含空格时加引号；在别处运行可加 `--root DIR`。用法见 `brief.mjs --help`、`foreshadow-scan.mjs --help`。

## 流程

### 1. 先找主写入口，再裁决冲突

在 `bible/sources.md` 用信息关键词或 `key` 找 `owner_only` 行，打开登记的文件及锚点。主写入口就是唯一维护该信息正文的地方；`secondary` 只保留一句摘要加跳转，`draft_only` 只供讨论。某类信息没有 owner，先确认信息归属，按 [SB §5](references/formats/project.md) **在 `sources.md` 补登记行，再写主文件**。已有两个入口时，列出重复和差异，请作者定一个；其余降为引用，不两头维护。

按 [SB §3](references/formats/project.md) 分层和裁决。A 权威层 `bible/canon.md`、`bible/timeline.md` 只记已拍板的结果和时间锚点、窗口、期限；B 追踪层按职责维护卷与全书规划、明暗线、支线、伏笔、人物、规则和风格；C 专题索引层是 `bible/inventory.md` 和已登记的 `bible/indexes/*.md`，按需查；D 讨论稿层 `bible/drafts/*.md` 只供参考；章节层（`chapters/`、`drama/`）放正文和章集材料。

不要平均采信，也不要以最近存盘为准。先判断冲突属于哪一类：

| 冲突类型 | 裁决依据 |
|---|---|
| 已公开（冻结）正文与档案冲突 | 冻结正文是读者已见事实。不能改、补句、格式化或新开稿；作者确认后在 `bible/canon.md` 记兼容口径，必要时在后续未冻结章解释。 |
| 最终设定 / 时间 | 设定归 `bible/canon.md`；时间归 `bible/timeline.md`。 |
| 卷详细安排 / 卷摘要 / 卷复盘 / 全书节奏 | 卷详情看 `bible/volumes/{vol}.md`，高于 `vol-info.md` 和章 `outline.md`；摘要看 `chapters/{vol}/vol-info.md`；`chapters/{vol}/summary.md` 只供复盘，不反推规划；全书节奏看 `bible/plot-outline.md`。 |
| 规则细节 / 人物 | `bible/world-rules.md` 高于专题索引；人物稳定特征看 `bible/characters.md`，当前关系与状态看 `bible/character-dynamics.md` 最新的相关记录。 |
| 写法 / 讨论稿 | 项目「本书口径」优先于 `bible/style-guide.md`，再到 skill 默认；讨论稿不能推翻以上任何依据。 |

权威文件自身矛盾、读者看到的两处正文不能相容，或兼容解释会改变既定真相时，停在列证据和方案这一步，请作者裁决。

### 2. 按任务读取最小集

完成固定开场后，按 [SB §4.1](references/formats/project.md) 的顺序读。表内未注明的档案文件都在 `bible/`；`vol-info.md` 位于 `chapters/{vol}/`，章纲在该章目录。只打开相关条目；缺证据再沿主写入口、ID 或引用查，不为保险通读档案。

| 任务 | 必读顺序 | 按需补读 |
|---|---|---|
| 写新章 / 续写 | `AGENTS.md` → `vol-info.md` → `volumes/{vol}.md` → `canon.md` → 简报 → 上一章定稿结尾 | 涉及时间推进必读 `timeline.md`；再按场景补人物档案 / 动态、`world-rules.md`、`inventory.md`。 |
| 讨论方向 / 重排卷 | `canon.md` → `timeline.md` → `vol-info.md` → `volumes/{vol}.md` → `plot-outline.md` → `storylines.md` → `subplots.md` | `foreshadows.md` |
| 校时间 / 倒排期限 | `timeline.md` → `canon.md` → `volumes/{vol}.md` → `plot-outline.md` | |
| 写人物互动 / 感情线 | `characters.md` → `character-dynamics.md` → `appearances.md` → `storylines.md` → `subplots.md` | |
| 写体系 / 战斗 / 专业场景 | `world-rules.md` → `canon.md` → 有关 `indexes/*.md` | `inventory.md` |
| 审校一章 | `AGENTS.md` → `style-guide.md` → 该章 `outline.md` → `fiction-review` 的 lint / length 结果 | 跨章复核再读 `canon.md`、`timeline.md`；无 `fiction-review` 时只报告可定位的一致性问题和未跑检查。 |
| 改编短剧 | `drama/{series}/series.md` → 同目录 `adaptation-map.md` → `characters.md` → `foreshadows.md` → 来源章定稿 | `timeline.md` |
| 只查一条设定 / 伏笔 | `sources.md` 定位 → 对应主文件 → 相关正文（如埋设、最近触及或回收处） | 伏笔挂靠支线时再查 `subplots.md`，问是否该收时走下一步。 |

```bash
node <本 skill 目录>/scripts/brief.mjs N
```

简报列主写入口、上一章末段、规划、待埋与待收、活跃支线、人物级别与出场提醒、时间锚点及相关设定。按名、ID 或路径回读原文；`owners` 是按本章条件筛出的入口，不是完整登记表。简报由卷规划起底，再用章纲逐字段覆盖以显示本章资料；这不改变卷详细规划的裁决优先级。简报即使有提醒也可成功生成；遇 `missing_file`、`parse`、`unknown_character` 或读不到关键前文，先核对原文件，不把空输出当成没有问题；缺到无法校准时停下请作者补证。

三百章以上可用 `fiction-story-db` 的派生索引查出处和关联，再打开 Markdown 核实；更新时先写 Markdown，再请该 skill 更新索引。索引不在、过时或没装时，直接用 `sources.md`、Markdown 搜索及 `brief.mjs`，不影响本流程。

### 3. 扫伏笔与支线，逐条决定

```bash
node <本 skill 目录>/scripts/foreshadow-scan.mjs --at N
```

写前以拟写章为 `N` 排期；查现状或复扫时以审计截止章为 `N`，省略 `--at` 默认取最新有定稿的章号（无定稿时为 0）。看 `due` 到期、`overdue` 逾期、`dormant` 沉睡，另查 `plant_due` 待埋、`subplot_alerts` 支线提醒、`invalid` 数据问题和 `writeback` 回写差异。默认退出码 1 只说明有逾期或 `invalid`；退出 0 不等于其他类别都空。退出 2 先排除调用、书根或配置等错误，不出“无问题”的结论。

按 F-ID 去重，结合原场景、`读者已知`、`作者真相`、回归方式与当前卷职责，逐条给**回收、触及、改期、放弃**建议并写明理由。待埋项另核对本章有没有自然入口；回写差异先核对定稿，不凭脚本替正文作证。作者确认放弃或改期，尤其是挂靠 A 级线的伏笔或 A 级线本身；未确认不改日期、不标弃。具体判法见参考文档。

### 4. 按事件写回，不复制事实

按 [SB §4.2](references/formats/project.md)，先写主文件，再刷新引用和摘要。写追踪表查 [SB §6](references/formats/bible.md)。涉及新设定、方向选择或覆盖作者文字时先请作者确认。`fiction-chapter` 负责按定稿回写并直接机检，`fiction-review` 可独立复查，两者都不依赖本 skill。维护或审计档案时，用定稿核实章纲，别把计划当结果。

| 事件 | 写回位置 |
|---|---|
| 新设定拍板，或冻结正文与设定不一致 | `bible/canon.md`，记录已确认的结论与兼容口径。 |
| 新时间锚点、窗口或期限 | `bible/timeline.md`，并给相对时间的正文口径。 |
| 卷结构或章节规划变动 | 将受影响条目交给 `fiction-planner`，依次同步 `bible/volumes/{vol}.md` → `bible/plot-outline.md` → `chapters/{vol}/vol-info.md` 摘要（[SB §7.4](references/formats/chapter.md)、[SB §7.5](references/formats/chapter.md)）；受影响的章纲交给 `fiction-chapter`。 |
| 收到 `fiction-planner` 的伏笔／支线待入账清单 | 按 [伏笔计划](references/plot-threads.md#伏笔埋下时就知道怎样回来) 将新 F-ID 以 `计划中` 登记到 `bible/foreshadows.md`；按 [支线排期](references/plot-threads.md#支线先挂主线再排六步) 将新支线 ID 登记到 `bible/subplots.md`，只填计划章，实际章留空。 |
| 复核单章回写 | 核对 `fiction-chapter` 已按实际正文在 `bible/appearances.md` 加一行、按章纲实际动作回写 `bible/foreshadows.md` 和 `bible/subplots.md`，并按实际变化更新 `bible/storylines.md`、`bible/character-dynamics.md`、`bible/inventory.md`。 |
| 新人物出场 / 规则变化 | 分别写 `bible/characters.md` / `bible/world-rules.md`。先立新人物档案再安排首秀，章后核实首次出场；规则变化时再刷新受影响的专题引用。 |
| 整卷完结 | 按 [SB §7.4](references/formats/chapter.md) 写 `chapters/{vol}/summary.md`（可剧透，只供审校复盘），同步 `chapters/{vol}/vol-info.md` 正文状态。 |
| 章节进入公开范围 | 把书根、作者确认公开的全局章号和对应发布稿交给 `fiction-init` 的「更新冻结清单」模式。本 skill 不封存。没装时请作者先确认有可用的 `lint.mjs` 入口，再两步处理：① 按 [SB §8](references/formats/config.md) 在 `.fiction/config.json` 的 `frozen.ranges` 追加已确认公开的章，保留旧范围；② 从书根用该入口执行 `--freeze`，核对清单覆盖。没有入口就报待封存；不手改 `.fiction/frozen.json`，不强制覆盖。 |
| 短剧写完一集 | 把集号和实际改动交给 `fiction-short-drama` 写回 `drama/{series}/adaptation-map.md` 该集一行。改编的伏笔状态只由映射表派生，不改小说伏笔表的状态；改动共用设定先走 canon 拍板。 |

档案回写复查：`node <本 skill 目录>/scripts/foreshadow-scan.mjs --at N --only writeback,invalid --fail-on writeback,invalid`。`--at` 是截止章，不是只查一章；按章号读 `writeback`，按文件和行号读 `invalid`，只将相关发现归入本章，其他发现另列。退出 1 表示扫描范围内有发现，不等于目标章有错。脚本只核对已有定稿且有章纲的伏笔 / 支线动作，未写进章纲的动作仍须对定稿人工核对。冻结章留下的差异另报，不回改去消告警。

### 5. 周期审计、卷末复盘或合并讨论稿

每卷收尾、重排前或作者指定的周期，执行**扫描 → 列矛盾（`文件:行号`）→ 提修法 → 作者确认 → 改主文件 → 同口径复扫**。只查不改时停在修法建议，标明待确认项。整卷复盘读实际定稿，区分已收与遗留；合并讨论稿按**拍板 → 写入正典 → 更新依赖**执行。不用复盘倒推规划，不拿讨论稿覆盖现行口径。见事实核对与审计参考。

**内部精确、正文模糊**：内部保留核对所需精度，绝对时间只记在 `bible/timeline.md`，其他文件引用锚点；现实原型留在内部主文件。正文、剧本和对外文案不搬内部路径、编号或原型，改用相对时间和符合 `lint.desensitize.*`（[SB §8](references/formats/config.md)）的称呼。把待检文件交给 `fiction-review` 扫配置词表；未安装就注明未机检。机器只能匹配已配置的词，不能代作者判断哪些映射会暴露身份。

涉及 `publish/blurb.md` 时，文案由 `fiction-planner` 起草、`fiction-review` 按正文审校、`fiction-publish` 提交；若书名有变，把核对 `book.title`（[SB §8](references/formats/config.md)）列入待办。

## 检查

- [ ] 已用脚本列出所需的简报提醒、伏笔排期或章纲回写差异；能定位的项附文件和行号。[脚本]
- [ ] 找到了唯一主写入口；缺入口时先登记后写，引用和摘要不另立事实版本。[模型]
- [ ] 伏笔初读是自然细节，所有未结项都有回归方式；回收先唤起旧场景再给新解释，一章最多收两条。[模型]
- [ ] 支线能指出删掉后哪项主线结果会变；人物、时序、物品和规则都用实际正文与主文件交叉核对。[模型]
- [ ] 伏笔放弃或改期、设定裁决、审计修法与讨论稿采纳的取舍已经确认。[作者]
- [ ] 未把待确认意见静默写回；未改任何冻结章。[模型]
- [ ] 作者确认脱敏词表覆盖本书需要隐去的现实映射。[作者]
- [ ] 核对未被词表捕捉的现实映射及语义泄底，没有提前把作者真相写成读者已知；未做的机检注明待检。[模型]
- [ ] 已由 `fiction-review` 的词表扫描给出对外文字的命中结果。[脚本]

## 产出

查证交付「结论 → 主写入口及 `文件:行号` → 相关事实或计划 → 下一步」。审计另列冲突两端、采用依据、修法、作者待定项与复扫残留。获准写回后，列出实际修改过的档案、摘要、复盘或映射文件，注明改了哪些条目；没有修改也明确说明。

## 参考文档

| 遇到…… | 读哪份 |
|---|---|
| 埋 / 触 / 收 / 弃伏笔，处理支线停滞或跨卷交接 | [伏笔与支线](references/plot-threads.md) |
| 核对人物、时间、物品或规则；卷末复盘、合并讨论稿、执行审计 | [事实核对与一致性审计](references/facts-and-audit.md) |
| 查书根布局、读写优先级或维护 `sources.md` | [SB §1 至 §5：项目结构与读写规则](references/formats/project.md) |
| 写伏笔、支线、人物、出场、时间、物品或明暗线跟踪表 | [SB §6：故事档案机读格式](references/formats/bible.md) |
| 查定稿、对照章纲、写卷复盘或更新卷摘要 | [SB §7：章节文件](references/formats/chapter.md) |
| 核对冻结范围、脱敏规则或扫描阈值 | [SB §8：项目配置](references/formats/config.md) |
