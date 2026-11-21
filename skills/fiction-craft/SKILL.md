---
name: fiction-craft
description: >-
  小说与网文写作技法库及风格指南构建工具：提供场景构建、场景-反应节奏、欲扬先抑、对话潜台词、信息分层、双线结构、氛围营造、混搭题材写法及准备/行动/分赃/交易/规则册子等章型剧本，并指导新建或从样章反向提炼项目
  bible/style-guide.md。当用户询问具体怎么写某类场景、解决对话像话剧/节奏发闷/信息说太满/氛围不够等问题、设计题材混搭口径、或制定本书文风指南时使用，即使没提“技法”二字。只提供技法与风格校准：完整写新章用
  fiction-chapter，技法问答或示范用本 skill，具体已有稿件的回修用 fiction-review，卷纲与爽点规划用 fiction-planner，设定与伏笔维护用
  fiction-continuity。Web-novel craft library and style-guide builder: covers
  scene craft, scene-sequel pacing, dialogue, layered information, dual-line
  structure, atmosphere, genre-blend voice, chapter playbooks, and building
  bible/style-guide.md. Use for technique questions, demos, or codifying a book's
  voice. Use fiction-chapter for drafting, fiction-review for fixes to an existing draft,
  plotting to fiction-planner, and bible tracking to fiction-continuity.
license: MIT
compatibility: Agent Skills standard; tested on Claude Code, also readable by Codex and OpenCode. No scripts required.
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---

# 写作技法与风格指南

负责为作者及其他写作 skill 提供可落地的叙事技法、章型剧本与题材口径，并指导建立或校准单本书的 `bible/style-guide.md`。

## 何时用 / 不用

**何时使用**：
- 写到具体段落卡住，需要查场景、节奏、对话、信息投放、双线、氛围或特定章型（准备章、行动章、分赃盘点、交易、规则册子）的可执行写法。
- 设计混搭题材的叙事语言（例如用理性体系的语言描写奇幻体系），或查阅特定题材的通用套路与避坑项。
- 为新书起草 `bible/style-guide.md`，或从作者已写好的 2–3 章里反向抽取个人文风并固化为团队口径。
- 收到 `fiction-chapter`、`fiction-review` 或 `fiction-planner` 的跳转引用，需要读取某份专项技法或题材包。

**何时不用（转交兄弟 skill；下游缺席时只交付本步产物、待办清单与未执行检查，不越权代做）**：
- 要走完整写新章闭环、写章纲、整章结构性重写或章后回写：交给 `fiction-chapter`（未安装时，仅交付技法改法与章节待办，说明未执行整章起草与回写闭环）。
- 要对整章或对外文案做硬规则机检、去 AI 味、删除测试和跨章复核：交给 `fiction-review`（未安装时，交付风格对照清单并说明机检脚本与跨章复核未运行）。
- 要做书名简介、黄金三章、全书/卷纲、钩子分级或日更排班：交给 `fiction-planner`（未安装时，仅提供章内节奏技法并说明全书/卷级排期未做）。
- 要维护伏笔、支线、人物档案、时间线、物品清单，或处理冻结正文与设定冲突的兼容口径：交给 `fiction-continuity`（未安装时，列出待更新的主写入口清单，不代改其他主写入口）。
- 要从零初始化项目骨架、导入旧稿，或把新公开章节加入/更新冻结清单：交给 `fiction-init`（未安装时，可单独协助起草 `bible/style-guide.md` 并列出缺失骨架待办；更新冻结清单则告知作者更新 `.fiction/config.json` 的 `frozen.ranges` 并运行 `lint.mjs --freeze` 两步，本 skill 不代执行）。

## 开始前

开始前先读取作者项目根目录下的三份文件（目录结构与主写入口见 [SB §2](references/formats/project.md)、[SB §5](references/formats/project.md)）：

1. `AGENTS.md`：重点读 `## 本书口径`（主角口径、视角纪律、书专属禁区与规则）。
2. `.fiction/config.json`：重点读 `book.genres`（本书启用的题材包 ID）与 `lint.*`（禁用词、脱敏规则）。
3. `bible/sources.md`：确认 `style_guide` 对应的主写入口（默认 `bible/style-guide.md`）。若 `bible/style-guide.md` 已存在，一并读取。

要写或要改任何机读文件之前，先打开对应的摘录文件（本 skill 为 [references/formats/project.md](references/formats/project.md)），照里面的格式与边界写，不凭印象。若项目配置文件不存在，提示作者可先运行 `fiction-init` 建立项目骨架，同时说明“未找到项目配置，以下按通用默认口径给出建议”。

**口径优先级**（见 [SB §3](references/formats/project.md)）：项目 `AGENTS.md`「本书口径」 > `bible/style-guide.md` > 题材包 > 本 skill 通用默认。发现冲突时向上位口径看齐，不私自覆写。

## 核心原则

所有技法都围绕五条底层原则展开，避免写成辞藻堆砌或机械套路：

1. **克制**：精准细节胜过华丽描写。一个具体的物件磨损、手部停顿，比整段抽象抒情更有力量。
2. **反差**：用日常生活的平凡反衬非凡或异常。先立住普通人的柴米油盐与边界感，异变出现时的冲击才成立。
3. **留白**：不替读者解释一切。动作与事实已经说清的意思，不在段末再补一层作者总结；让读者自己把线索接上。
4. **真实**：人物反应服从真实人性，不服从剧情便利。普通人初次撞见超常或危机，第一反应往往是怀疑、回避或算账，而不是立刻豪情万丈。
5. **结构循环**：大跨度阶段（换新地图、进新副本、开新卷）需要稳定的推进骨架，让读者形成“摸清门槛 → 进入运转 → 撞上麻烦 → 拿走收益”的期待，而不是写成散点游记或游戏任务框。

## 流程

按当前任务选择模式 A 或模式 B；本 skill 不带执行脚本，所有文本判断与口径确认均由模型与作者配合完成。

### 模式 A：按需查阅技法或定向改写

1. **界定写作难题**：先弄清问题落在哪个层面——场景画面感、节奏张力、对话质感、信息投放、氛围悬疑、特定章型，还是题材口径。
2. **只读命中的参考文档**：按文末路由表读取 1–2 份对应 `references/*.md`；若 `.fiction/config.json` 的 `book.genres` 有值，同步读取对应的 `references/genres/<genre>.md`。不要全量读取无关文档。
3. **对齐本书口径**：把参考文档的通用规则与 `AGENTS.md`「本书口径」、`bible/style-guide.md` 逐项对照，过滤掉与本书相悖的默认项（例如本书故意采用第一人称或高密度冷幽默时，服从本书口径）。
4. **输出可执行方案**：给出具体改法（如压缩哪一段、拆哪句总结、按哪几步重排场景）或定向示范片段。
   - **已冻结章节为只读事实**（见 [SB §3](references/formats/project.md)）：对冻结章只做技法分析与问题报告，绝不重写、不补句、不覆盖。
   - 按 `fiction-continuity` 的冲突优先级（[SB §3](references/formats/project.md)），只将作者在本流程明确确认且无冲突的设定裁决写入 `bible/canon.md`，未确认或有冲突的交 `fiction-continuity`。
   - **非冻结章节**：涉及改动既定设定或覆盖作者已有正文时，先停下来问作者；整章结构性重写交回 `fiction-chapter`。

### 模式 B：构建或校准 `bible/style-guide.md`

1. **判断起步方式**：询问或确认作者是否有至少 2–3 章满意的样章。有样章走“反向抽取”；尚未动笔走“问答共定”。
2. **读取模板与方法**：读取 [references/style-guide-template.md](references/style-guide-template.md) 与 [assets/style-guide.template.md](assets/style-guide.template.md)，确认七个核心维度（句长节奏、标志性标点、单句成段、对话习惯、幽默剂量、禁用表达、作者自选样段）及叙事视角与禁止清单。
3. **生成风格草案**：
   - 反向抽取路径：读作者指定的样章（只读不改原章），统计句长分布、高频标点、段落行数、连续对话句数、描写取材与情绪写法，摘出 2–4 段由作者把关的基准样段并记录其**样章路径**（`chapters/{vol}/{ch}/v{n}.md`），整理成草案。
   - 问答共定路径：按七个维度做一轮精简提问，把作者的偏好写成具体可判定的条目（如“连续对话不超过 3 句”“感叹号按作者上限控制”），避免空泛形容词。
4. **请作者拍板**：把草案连同两类待同步建议一并交给作者确认：
   - **字面禁词与脱敏词表** → 建议写入 `.fiction/config.json` 的 `lint.banned_terms` / `lint.desensitize.*`（默认级别 `block`，报阻断）；
   - **自定义句式或正则** → 建议写入 `.fiction/lint-patterns.txt` 的合法段头（如 `[summary:suggest]`、`[custom:block:all]`，`block` 报阻断、`suggest` 报提示；语法见 `fiction-review`（或 `fiction-chapter`、`fiction-init`）附带的 `lint.mjs --help`；均未安装时人工核对）。
   未获确认前，不覆盖已有的 `bible/style-guide.md`。
5. **写入与交接**：确认后写入 `bible/style-guide.md`（并核对 `bible/sources.md` 中 `style_guide` 登记一致，见 [SB §5](references/formats/project.md)）。把确认后的**基准样章路径**写入 `bible/style-guide.md`，同时提醒作者将其同步登记到项目 `AGENTS.md`「本书口径」，供 `fiction-review` 审校校准声音时对照；句式呼吸、留白与声音贴合度仍由审校阅读与作者把关。

## 检查

- [ ] 本次引用的技法与建议未违背项目 `AGENTS.md`「本书口径」与现有 `bible/style-guide.md` `[模型]`
- [ ] 给出的写作建议或改写方案落地到具体操作（如五要素、三句插动作、四步册子法），没有空泛说教 `[模型]`
- [ ] 新建或更新 `bible/style-guide.md` 时，七个风格维度均写成可执行的判定标准，且不含虚构的他人样段 `[模型]`
- [ ] `bible/style-guide.md` 中的样段、禁用表达和核心文风口径已经作者本人确认 `[作者]`
- [ ] 已区分字面禁词（`config.json` `lint.banned_terms`）与正则/句式（`lint-patterns.txt` 合法段头）的写入方式，并按 `block` 阻断 / `suggest` 提示明确标注 `[作者]`
- [ ] 确认后的基准样章路径已记入 `bible/style-guide.md`，并已提醒作者登记到项目 `AGENTS.md`「本书口径」供 `fiction-review` 校准 `[作者]`
- [ ] 未改动任何冻结章节（冻结章仅做分析报告），也未越权修改 `canon.md`、`world-rules.md` 等其他主写入口 `[模型]`

## 产出

- **模式 A**：针对当前难题的技法诊断、步骤化改法或示范改写（默认直接呈现在回复中，由作者决定是否采纳；若为冻结章仅交分析与转交待办）。
- **模式 B**：创建或更新项目根目录下的 `bible/style-guide.md`（参考 [assets/style-guide.template.md](assets/style-guide.template.md)），并输出建议同步到 `.fiction/config.json` / `.fiction/lint-patterns.txt` 的条目及供 `fiction-review` 使用的基准样章路径。
- **汇报格式**：简述本次调用的参考文档/题材包、变动的文件路径（若有）、移交兄弟 skill 的待办（若有），以及需作者确认的口径分歧或待填样段。

## 参考文档

### 契约摘录

| 遇到什么问题 | 读取哪份文档 |
|---|---|
| 核对项目目录结构、分层与冲突裁决、文件职责、主写入口注册表（SB §1–§5） | [references/formats/project.md](references/formats/project.md) |

### 技法参考

| 遇到什么问题 | 读取哪份文档 |
|---|---|
| 场景发散、没画面感、开场拖沓、转场生硬、快慢节奏失衡、结尾平淡、流水账 | [references/scene-craft.md](references/scene-craft.md) |
| 爽感不足、冲突升级卡壳、场景-反应（Scene-Sequel）节拍失控、期待感断档、情绪波形平直、大事无涟漪、新区域像旅游笔记、多角色混乱 | [references/narrative-techniques.md](references/narrative-techniques.md) |
| 对话像话剧、千人一面、人物替作者讲设定、潜台词薄、对话后旁白重复解释、写强角色爱瞎猜心理 | [references/dialogue.md](references/dialogue.md) |
| 设定一次倒太多、同一信息反复讲、文内册子/文书像讲课、专业术语难懂、明暗双线三层信息结构、系统/鉴定界面越界、现实映射脱敏 | [references/information.md](references/information.md) |
| 氛围太浮夸、写异象不够克制、缺少尺度感、环境描写沦为风景画、混搭题材语言打架 | [references/atmosphere.md](references/atmosphere.md) |
| 要写准备/集合章、行动/探索章、分赃/盘点/换装、买卖交易场景、规则册子场景 | [references/chapter-types.md](references/chapter-types.md) |
| 要新建或更新 `bible/style-guide.md`，或从已有章节反向抽取文风 | [references/style-guide-template.md](references/style-guide-template.md) 与模板 [assets/style-guide.template.md](assets/style-guide.template.md) |

### 题材包

题材差异统一落在 `references/genres/`，按 `.fiction/config.json` 的 `book.genres` 加载（混搭题材可同时加载多份）：

| 题材 | 参考文档 |
|---|---|
| 修仙 / 玄幻 | [references/genres/xianxia.md](references/genres/xianxia.md) |
| 都市 | [references/genres/urban.md](references/genres/urban.md) |
| 悬疑 | [references/genres/suspense.md](references/genres/suspense.md) |
| 言情 | [references/genres/romance.md](references/genres/romance.md) |
| 科幻 | [references/genres/scifi.md](references/genres/scifi.md) |
| 历史 | [references/genres/history.md](references/genres/history.md) |
| 如何新增自定义题材包 | [references/genres/README.md](references/genres/README.md) |
