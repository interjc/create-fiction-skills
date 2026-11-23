---
name: fiction-review
description: >-
  网文章节审校、获准回修与去 AI 味闭环：先定目标类型与改稿授权，对网文章节读衔接并跑硬规则脚本（字数、脱敏、禁词、内部引用、冻结校验、AI 腔、总结句与伏笔回写），再按六步编辑阅读与蓝本八步法定位问题，仅在获授权且非冻结时修稿并复查；支持跨章复核及简介、短剧台词文笔审校。要求审校、review、回修、去 AI 味、查水剧情、跨章复核，或说“帮我看看这章”“读起来像报告”时使用。具体已有稿件的对白回修用本 skill，技法问答或示范用 fiction-craft；写新章或结构重写用 fiction-chapter，维护 bible 用 fiction-continuity，短剧结构与卡点用 fiction-short-drama。Web-novel review, authorized revision, and de-AI-flavour loop: verifies target type and edit authorization, checks seams, runs length/lint/foreshadow-scan scripts, performs six-step editorial review, eight-step blueprint audit, cross-chapter checks, and authorized fixes on unfrozen drafts; also reviews blurbs and episode scripts as prose. Trigger on review, revise, de-AI-flavour, filler check, or "reads like a report". Use this skill to fix dialogue in an existing draft, fiction-craft for technique questions or demos, fiction-chapter to draft or rewrite, fiction-continuity for bible updates, and fiction-short-drama for drama checks.
license: MIT with Commons Clause v1.0 (see LICENSE)
compatibility: Agent Skills standard; tested on Claude Code, also readable by Codex and OpenCode. Scripts need Node.js 22.5+.
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---

# 网文审校与回修

负责网文章节成稿后的质检、去 AI 味、获准回修与跨章复核，并按需对对外简介或短剧分集台词做文笔审校。审校的目标不是找茬式挑字，而是保证正文像小说、像本书、符合当前阶段的人物与节奏。

## 何时用 / 不用

- **适用**：
  - 单章初稿或修订稿的审校、获准回修、去 AI 味与水剧情清理。
  - 稿件“读起来像报告”“节奏发平”“对话像作者在讲设定”的诊断与局部修整。
  - 相邻多章或整卷的批量跨章复核（章尾雷同、情绪波形、原则空转、前后口径）。
  - 冻结章（已公开或锁定章节）的只读体检与口径排查。
  - 对外简介（如 `publish/blurb.md`）或短剧分集剧本的纯文笔与对白自然度审校。
- **不适用（转交兄弟 skill；若兄弟 skill 未安装，交付涉及的文件、待办清单与未执行检查项，绝不静默代做）**：
  - 起草新章、大篇幅续写或**结构性重写**（整章重定职责、大改场景骨架）→ 交给 `fiction-chapter`。
  - 维护 story bible、全局伏笔/支线治理、跨卷设定冲突裁决 → 交给 `fiction-continuity`。
  - 短剧分集结构、格式、时长估算、付费卡点与章集映射同步 → 交给 `fiction-short-drama`。
  - 冻结章管理（修改 `frozen.ranges` 与生成/更新冻结哈希清单）→ 交给 `fiction-init`（“更新冻结清单”模式）；未安装时告知作者两步：核对 `.fiction/config.json` 的 `frozen.ranges`，再运行冻结命令（见 `lint.mjs --help`）。
  - 建立或改写本书风格指南、查询题材包与具体章型模板 → 交给 `fiction-craft`。
  - 规划卷级大纲、区域循环排布、日更分组或起草 `publish/blurb.md` → 交给 `fiction-planner`。
  - 对外发布正文或提交 `publish/blurb.md` → 交给 `fiction-publish`。
  - 更新可选 SQLite 派生索引 → 交给 `fiction-story-db`（未安装则跳过，Markdown 仍是唯一权威）。

## 三种审校模式与授权原则

| 模式 | 触发条件 | 允许动作 | 停止条件 |
|---|---|---|---|
| **只审不改（review-only，保守默认）** | **所有冻结章（强制）**；**公开/冻结状态不明的章节（强制）**；请求未明确授权改稿时（如“帮我看看”“找找问题”） | 只检查、列问题清单与修改方向，**绝不修改正文、不格式化、不新开稿次** | 输出完整报告即结束 |
| **审改闭环（review-and-fix）** | **仅当请求已明确授权改稿**（如“审完直接改”“回修去 AI 味”）**且已确认目标未冻结** | 检查 → 记录问题 → 局部修稿与同步（默认只修阻断与重要，见下节） → 二次复查与重跑脚本 | 无明显问题，或**满两轮自动回修后交由作者接手** |
| **批量 / 跨章复核（batch / cross-chapter）** | 相邻 3 章、阶段段落或整卷 | 批量跑脚本并连读正文与 `chapters/{vol}/summary.md`，默认只审不改 | 输出跨章问题表；需改稿时逐章获授权并核验未冻结 |

- **建议在独立新上下文中运行**：与起草分离的干净会话能明显减少对自己句子的盲区；若仍在原起草会话内运行，开始前须重读 `bible/style-guide.md` 与校准样章以重置手感。
- **两轮回修上限**：审改闭环最多自动执行两轮修改与复查，且只自动修**阻断**与**重要**；**次要**与**备注**列给作者，经授权才改（作者的改稿请求已点名的范围视为已授权，如“回修去 AI 味”覆盖 AI 腔与总结句）。两轮后仍有分歧或口味取舍时停下，整理为待决项交给作者，防止越改越碎。
- **冻结章与未知状态保护**：落在 `.fiction/config.json` 的 `frozen.ranges` 内或已登记在 `.fiction/frozen.json` 的章节一律只审不改（[SB §3](references/formats/project.md)、[SB §7.1](references/formats/chapter.md)）。若两处均无该章记录且作者未说明是否已公开，按公开状态未知只审不改，回修前先向作者确认。

## 问题分层与严重度

每条发现同时标两样：标签 `[脚本] / [模型] / [作者]` 说“谁来判”，层级说“判错了多严重”，两者互不替代。

| 层级 | 包括什么 | 可用严重度 | 能否判“未通过” |
|---|---|---|---|
| 硬约束 | 脚本 `block`、目标章 `SHORT`、`AGENTS.md`「本书口径」里作者定为硬规则的条目 | 阻断 | 能 |
| 审定约束 | 事实、因果、连戏、canon 与冻结正文、伏笔口径、人物底线；破局或反转没有前文依据（模型结合上下文判） | 阻断 / 重要 | 能 |
| 技法默认 | references 里标为可调默认的技法规则、`lint.mjs` 的多数 `suggest`、套路重复 | 次要 / 备注 | 不能单独判 |
| 口味选项 | 风格偏好、措辞取舍等风格指南未写明的事 | 备注 | 不能 |

- **严重度**分阻断 / 重要 / 次要 / 备注四档，前两档只给硬约束与审定约束，拿不准一律记备注交作者；各档判据、升级规则与记录示例见 [editorial-criteria.md](references/editorial-criteria.md)「问题分层、严重度与结论档」。
- **技法默认偏离不得单独判未通过**：题材不同，默认技法未必适用（悬疑、日常类不必每章正面对抗或反转）。同一处若同时违反已立事实或因果，按审定约束那条定级。
- **结论四档**：
  - **未通过**：有阻断，或有未获豁免的重要（优先判定；同时存在的待拍板项另列，不改判暂定）。
  - **暂定**：无上述问题，但结论取决于待作者拍板的项（设定未定、口径冲突、脚本项未覆盖）。
  - **通过附意见**：无阻断、无重要，有次要或备注列给作者。
  - **通过**：无阻断、无重要，次要与备注为零或已处理。

## 开始前

> **机读文件格式铁律**：要写或要改任何机读文件之前，先打开 `references/formats/` 中对应的契约摘录文件，照里面的格式写，不凭印象。

1. **读取项目基础文件**（按 [SB §4.1](references/formats/project.md)）：
   - `AGENTS.md`（重点读 `## 本书口径`：主角口径、叙事视角、禁区、本书专属硬规则、作者指定的校准样章）。
   - `.fiction/config.json`（字数、钩子、冻结范围、脱敏与禁词、题材列表 `book.genres`、节奏与日更/爆更参数，见 [SB §8](references/formats/config.md)）。
   - `bible/sources.md`（主写入口注册表，见 [SB §5](references/formats/project.md)）。
   - 若项目缺少配置，提示作者可用 `fiction-init` 初始化；无法确认公开状态时锁定只审不改并在报告首行注明。
2. **加载风格与题材校准基准**：
   - 读 `bible/style-guide.md` 与 `AGENTS.md`「本书口径」列出的校准样章（未指定时询问作者；暂不指定则以最近 1–2 章定稿作参照并说明）。
   - 读 `config.json` 的 `book.genres`：若已配置题材且安装了 `fiction-craft`，加载对应题材包的审校雷区与体系口径作补充参照；未配置或未安装 `fiction-craft` 时，按通用标准与 `bible/world-rules.md` 审校并在报告说明。
   - 优先级固定：**项目 `AGENTS.md`「本书口径」 > `bible/style-guide.md` > 本 skill 默认规则**（[SB §3](references/formats/project.md)）。
3. **识别审校目标并分流（禁止把非网文章节套进网文章节流程）**：
   - **A. 网文章节**（单章或批量）：确认定稿路径（[SB §7.1](references/formats/chapter.md)）、冻结状态与是否获授权改稿，进入下方完整闭环（步骤 1–6）。
   - **B. 对外文案**（如 `publish/blurb.md` 等 `lint.extra_files`）：**跳过**步骤 1、`length.mjs` 与 `foreshadow-scan.mjs`；仅显式传路径跑 `node <本 skill 目录>/scripts/lint.mjs publish/blurb.md`，再按 [editorial-criteria.md](references/editorial-criteria.md) 第六步与 [de-ai-guide.md](references/de-ai-guide.md) 做脱敏、卖点钩子与去 AI 味审校；若修改或确定了书名，提示作者同步核对 `config.json` 的 `book.title`（[SB §8](references/formats/config.md)）。
   - **C. 短剧分集文笔**（`drama/{series}/episodes/ep{NNN}.md`）：**跳过**步骤 1、`length.mjs` 与 `foreshadow-scan.mjs`；仅显式传路径跑 `node <本 skill 目录>/scripts/lint.mjs <ep文件路径>`（或 `--series <slug>`），再做对白上口度、动作画面可见性与去 AI 味审校；格式、时长估算、卡点与章集映射**一律交 `fiction-short-drama`**（未安装时注明未做短剧结构/卡点机检）。
   - **D. 无项目书根的独立散稿**：`length.mjs` 与 `lint.mjs` 依赖书根（无书根且未传 `--root` 会以退出码 `2` 失败）。无书根时不强跑脚本，说明“无项目书根，未跑脚本”，直接按通用标准执行 `[模型]` 人工审校（默认只审不改，获授权才改）。

## 网文章节审校闭环流程

### 步骤 1：读衔接（先看接缝，再看本章）

- 读上一章定稿末尾 3–5 段与本章开头前 3 段，检查时间、空间、人物位置与情绪接续。
- 读本章末尾 5 段与下一章 `outline.md`（无则看 `bible/volumes/{vol}.md` 章节规划表或下一章定稿开头），确认章末钩子能往下接。
- 读本章 `outline.md`（[SB §7.3](references/formats/chapter.md)），核对职责、场景、伏笔与支线动作、钩子级别；按需补读 `bible/canon.md`、`bible/timeline.md`（涉及时间推进/跳时/期限时必读）及出场人物的 `bible/characters.md` / `bible/character-dynamics.md`。

### 步骤 2：硬规则扫描（脚本先行，再核本书口径）

> 任何脚本返回退出码 `2`（找根失败、配置非法、缺定稿或参数错误）都必须单独报为“脚本运行失败（退出码 2）”，不可混为“未通过”或“跳过”。详细参数见各脚本 `--help`。

1. **字数检查**：
   ```bash
   node <本 skill 目录>/scripts/length.mjs <章号或文件路径>
   ```
   - 核对逐章状态（`PASS` / `LONG` / `SHORT` / `SKIP`）：低于 `config.length.min`（`SHORT`）属硬规则失败。注意：点名冻结章时即便 `SHORT` 退出码仍为 `0`，汇报须以逐章状态为准。
   - 遇到 `SHORT`：**只审不改模式下只报告偏短及补足方向**；仅在已获改稿授权且未冻结时，才在步骤 4 补足有效内容（动作、代价感现场、分寸变化、有用物件，严禁空总结凑字）。
   - 遇到 `LONG`（超 `config.length.soft_max`，退出码为 `0`）：是否职责过满、能否迁移说明段，由步骤 3 的 `[模型]` 编辑阅读判断。
2. **硬规则与模式扫描**：
   ```bash
   node <本 skill 目录>/scripts/lint.mjs <章号或文件路径>
   ```
   - **区分目标稿发现与全书冻结异常**：`lint.mjs` 每次都会顺带扫全书冻结状态。汇报时将“目标稿 `block`/`suggest`”与“全书冻结状态（`frozen-modified` / `frozen-unsealed`）”分栏列出。无 `frozen-modified` **不证明已封存**（未建清单仅报 `frozen-unsealed` suggest，未配范围则不报）。
   - 目标稿 `block` 级（脱敏、禁用词、精确年份、内部引用泄漏、标题与钩子格式、高危 AI 腔 `AT01–AT09`）属硬约束，必须清零方可通过；`suggest` 级（总结句 `SUM01–SUM13`、中度 AI 腔 `AT21–AT29`、内部写作术语、不鼓励钩子等）多属技法默认，由模型逐条评估改或留并按分层定级。
   - 若报 `frozen-unsealed`：转交 `fiction-init` 更新冻结清单（未安装时告知作者两步操作，见上文）。
3. **伏笔与支线回写扫描（区分初稿审校与回写后验收）**：
   ```bash
   node <本 skill 目录>/scripts/foreshadow-scan.mjs --at <章号> --only writeback,invalid
   ```
   - **初稿审校（`fiction-chapter` 尚未做章后回写前）**：先说明本章回写状态为**“待回写”**，不把本章 `writeback` 缺失判为失败；但仍须检查并汇报 `invalid`（bible 自身格式/校验错误）。
   - **回写后终审 / 返修验收**：先确认本章存在 `outline.md` 与定稿（任一缺失会导致 `writeback` 跳过该章，须明确报“未覆盖”，不得报通过）。由于 `--at` 为截止章且默认退出码不因 `writeback` 失败（可用 `--fail-on writeback,invalid`），必须按目标章号逐条读取输出：本章项与历史遗留项分列。
4. **本书硬口径核对**：对照 `AGENTS.md`「本书口径」逐项检查脚本不覆盖的书专属硬规则（属硬约束，违反记阻断）。

### 步骤 3：编辑式阅读（固定六步顺序）

按固定顺序通读，避免陷进局部措辞漏掉结构硬伤（细则见 [editorial-criteria.md](references/editorial-criteria.md)）：

1. **剧情职责**：章级“删掉本章会怎样”测试；反打卡与反空转；区域循环定位（若采用）。
2. **场景推进**：场景五要素；逐段删除测试（水剧情质检）；压缩无增量流水账；至少一个小转折；章尾前推力；对抗戏写清谁占上风与赌注，破局与反转有前文依据、不靠天降外援。
3. **人物分寸**：主角聪明落到判断与克制；处事边界与立场符合本书口径；强角色少心理揣测；新人物有明确功能。
4. **信息投放**：信息只说一遍；私下背景 / 正式执行分层；文书册子四步法；清单细节沉入 `inventory.md`。
5. **对话质量**：“角色会说还是作者想让读者知道”检验；每 2–3 句插动作/环境变化；身份口吻；专业术语首现附白话解释。
6. **语言与去 AI 味**：清理总结句与报告腔；抽象改具象；三层 AI 味排查与防过度修剪（见 [de-ai-guide.md](references/de-ai-guide.md)）；段落节奏与中性标题。

- 若稿件“剧情没错但读着像报告”，或属中后段连载回修，按 [blueprint-audit.md](references/blueprint-audit.md) 的八步法重点精查开头前三段、段尾总结句与最后五段章尾。
- **记录格式**：每处问题记为 `位置 / 问题 / 修改方向 / 严重度·层级`（如 `重要·审定约束`、`次要·技法默认`）。

### 步骤 4：获准修稿与事实同步（仅审改闭环模式）

只审不改模式（含冻结章与公开状态不明章）跳过本步。

1. **只做局部修整，结构性重写交回 `fiction-chapter`**：局部病句、重复、去 AI 味、微调段落顺序、小幅补实细节，在当前未冻结定稿 `v{n}.md` 上修改（涉及较大幅度改稿前先征得作者同意，再按 [SB §7.1](references/formats/chapter.md) 决定覆盖或新开 `v{n+1}.md`）。若发现必须重定本章职责、大幅增删重排场景或整章重写，**停下并交回 `fiction-chapter`**（未安装时仅交付修改方案与待办，不代写整章）。
2. **改后先对照正文与 `outline.md`，再按事件表处理沉淀**（[SB §4.2](references/formats/project.md)）：
   - 局部修辞也可能无意删掉出场人物、改变伏笔措辞或变动规则/物品。改完后先将新正文与 `outline.md` 核对，再按变化分类：
     - **章后必核项**（已完成章后回写时）：`appearances.md`、`foreshadows.md`、`subplots.md`。
     - **按实际变化写回项**：时间锚点/期限 → `timeline.md`；体系规则 → `world-rules.md`；明/暗线进展 → `storylines.md`；新人物 → `characters.md`；关系/弧线变化 → `character-dynamics.md`；物品变动 → `inventory.md`；卷级规划变动须按 `volumes/{vol}.md` → `plot-outline.md` → `vol-info.md` 顺序并先经作者确认。
     - 按 `fiction-continuity` 的冲突优先级（[SB §3](references/formats/project.md)），只将作者在本流程明确确认且无冲突的设定裁决写入 `bible/canon.md`，未确认或有冲突的交 `fiction-continuity`。
   - 涉及跨章或全局 bible 同步、冲突裁决时，**委托 `fiction-continuity`**（未安装时交付具体变更清单与目标文件，改机读文件前必读 `references/formats/bible.md`）。
   - **短剧分集修改**若引起人物/伏笔/剧情点变动，**转交 `fiction-short-drama`** 同步 `adaptation-map.md`，绝不回写小说 `foreshadows.md`。
   - **派生索引**：全部 Markdown 同步完成后，若项目启用 `fiction-story-db`，委托其更新索引；未安装则跳过。
3. **何时停下来问作者**：涉及设定拍板、冻结章冲突的兼容口径、改动核心人物底线或剧情走向、或存在方向取舍时，暂停并给 2–3 个选项。

### 步骤 5：二次复查与闭环收口（仅审改闭环模式）

1. **重跑全部已覆盖脚本**：重跑 `length.mjs` 与 `lint.mjs`；若本章处于回写后阶段或步骤 4 同步了伏笔/支线回写，**必须重跑 `foreshadow-scan.mjs --at <章号> --only writeback,invalid`** 验证。
2. **复读改动段及前后各一段**：确认未引入新的信息重复、解释过度、口气漂移或过度修剪；对比新旧稿，列出被删掉的强钩子与金句，非有意删除的恢复。
3. 仍有明显问题且为第 1 轮 → 进入第 2 轮修改与复查；满两轮仍有未决项 → 停止自动修改，交由作者处理。无明显问题则收口。

### 步骤 6：批量 / 跨章复核（跨章模式或每 3 章）

先按区间跑 `node <本 skill 目录>/scripts/length.mjs <起始章>-<结束章>`（或 `--all`，注意默认跳过冻结章并如实报 `SKIP`）与 `node <本 skill 目录>/scripts/lint.mjs <起始章>-<结束章>`，再连读相邻 3 章（可配合 `chapters/{vol}/summary.md`），对照 [blueprint-audit.md](references/blueprint-audit.md) 第八步检查：章尾雷同、边界与风险兑现、原则复读、情绪波形、爽点节拍（`config.rhythm.beat_every`）、日更与爆更末章钩子（日常 `config.daily.last_hook_min`、爆更 `config.daily.burst.last_hook_min`，见 [SB §8](references/formats/config.md)）及区域循环节奏；同时按第八步的“套路重复”门槛查破局手段、对抗结构、固定微动作与收尾方式是否跨章撞车（最高记次要）。C 类短剧分集文笔的跨集复核同样适用这组口径，镜头重复交 `fiction-short-drama`。

## 审校检查清单

- [ ] 改稿前已核验授权与公开/冻结状态；冻结章及状态不明章严格只审不改 `[模型]`
- [ ] 全书冻结校验状态已单独汇报（区分无异常 / `frozen-unsealed` / `frozen-modified` / 未配置冻结范围） `[脚本]`
- [ ] 目标章字数达到 `config.length.min`（按逐章状态核对，非仅看退出码） `[脚本]`
- [ ] 超 `config.length.soft_max`（`LONG`）时已评估是否职责过满或存在可迁移说明段 `[模型]`
- [ ] 目标稿 `lint.mjs` 全部 `block` 项清零（脱敏、禁词、精确年份、内部引用、标题/钩子格式、`AT01–AT09`） `[脚本]`
- [ ] 目标稿 `lint.mjs` 全部 `suggest` 项已逐条评估并决定修改、保留或局部豁免 `[模型]`
- [ ] 回写后终审已运行 `foreshadow-scan.mjs --at <章号> --only writeback,invalid` 且确认目标章被覆盖、本章项无遗漏（初稿审校标注“待回写”；改稿同步后已重跑） `[脚本]`
- [ ] 改稿后已将新正文与 `outline.md` 对照，按 [SB §4.2](references/formats/project.md) 事件表核对必核与按变化写回项 `[模型]`
- [ ] 上下章衔接自然，章末钩子能接入下一章规划且级别合理 `[模型]`
- [ ] 通过章级职责删除测试与逐段删除测试，无流水账与无效水段 `[模型]`
- [ ] 开头前三段先落可见物件/动作/地点，场景五要素齐全，每章有小转折，章尾有前推力；对抗戏上风与赌注清楚，破局有前文依据 `[模型]`
- [ ] 人物分寸、对话口吻、信息只说一遍与分层投放符合 `AGENTS.md`「本书口径」与题材口径 `[模型]`
- [ ] 深层 AI 味已清理且未触发过度修剪，新旧稿对比未误删强钩子与金句，风格与 `bible/style-guide.md` 及校准样章一致 `[模型]`
- [ ] 跨章复核已按套路重复门槛核查（至少两处具体位置并说明削弱了什么，不只贴“AI 味”标签） `[模型]`
- [ ] 每条模型发现已标严重度与层级；技法默认偏离未单独判未通过，拿不准的记备注 `[模型]`
- [ ] 脱敏词表完整性、核心设定与冻结兼容口径、日更/爆更排期与两轮后剩余取舍项已交作者确认 `[作者]`

## 产出与汇报格式

- **可能修改的文件**（仅获授权且非冻结的审改闭环）：当前未冻结定稿 `v{n}.md`（或经同意的新稿次与 `outline.md`）；因本次修改而触发的本章 bible 主写入口（步骤 4.2；跨章或全局同步交 `fiction-continuity`）；获授权修改的对外文案或短剧分集台词。
- **高信号汇报模板**（按目标类型填标题，严格区分脚本验证、模型判断、未运行/未覆盖项与作者拍板项）：

```markdown
<第X章 / 对外文案 <路径> / 第N集文笔 / 独立散稿> review（模式：审改闭环 / 只审不改；轮次：1/2）：
- 脚本已验：
  - length：PASS / LONG / SHORT / SKIP / 未运行（原因） / 运行失败（退出码2）（N 字，要求 ≥ min，软上限 soft_max）
  - lint（目标稿）：0 block / N suggest（改 X，留 Y） / 未运行（原因） / 运行失败（退出码2）
  - lint（全书冻结状态）：正常（已封存） / frozen-unsealed（建议交 fiction-init） / frozen-modified（列文件） / 未配置
  - foreshadow-scan：通过（本章 0 项，历史遗留 M 项） / 待回写（初稿审校） / 未覆盖（缺 outline 或定稿） / 不适用 / 运行失败（退出码2）
- 模型发现（位置 / 问题 / 修改方向 / 严重度·层级）：
  1. ……
- 已执行修改与复扫：……（同步主写入口：……；修后复扫结果：……；只审不改写“无，仅报告”）
- 复查结论：通过 / 通过附意见（次要 N 条、备注 M 条，见上） / 暂定（待拍板：……） / 未通过（阻断 N 条、重要 M 条）
- 需作者拍板 / 交接下游：……（无则写“无”）
```

- 整篇无明显问题时仍须写明“无明显问题”，剩余风险以备注列出；目标章 `SHORT` 或目标稿 `lint.mjs` 存在未清 `block` 项时，一律判未通过，不因“剧情职责完整”放行。

## 参考文档

| 遇到以下情况时 | 阅读参考文档 |
|---|---|
| 执行六步编辑阅读、逐段删除测试、排查对抗与破局、对话/信息投放，给发现定层级与严重度、判结论档，或对接 `## 本书口径` 与题材包 | [editorial-criteria.md](references/editorial-criteria.md) |
| 稿件“读起来像报告”、蓝本八步精查、修改开头/章尾、跨章复核与套路重复检查或风格指南校准 | [blueprint-audit.md](references/blueprint-audit.md) |
| 系统去 AI 味、处置 `AT*`/`SUM*` 提示、识别深层 AI 腔或防过度修剪 | [de-ai-guide.md](references/de-ai-guide.md) |
| 核对项目分层、冲突裁决、按任务读取、按事件写回与 `sources.md`（SB §1–§5） | [formats/project.md](references/formats/project.md) |
| 核对或修改伏笔、支线、人物、出场/关系、时间线、物品、明暗线机读表（SB §6） | [formats/bible.md](references/formats/bible.md) |
| 核对定稿与冻结规则、正文与钩子格式、`outline.md` 与卷规划表（SB §6.1、§7） | [formats/chapter.md](references/formats/chapter.md) |
| 核对 `.fiction/config.json` 全部配置键、默认值与脱敏/节奏/日更参数（SB §8） | [formats/config.md](references/formats/config.md) |
