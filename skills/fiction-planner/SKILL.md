---
name: fiction-planner
description: >-
  网文创意孵化、开篇定位与卷级规划：收敛模糊点子为卖点与金手指边界、起草书名简介标签（publish/blurb.md）、设计黄金三章、编排全书大纲与明暗双线节奏、制定卷纲与章节规划表、排布爽点节拍/欲扬先抑/情绪波形/S-A-B-C钩子/日更与爆更分组及区域循环结构，并结合伏笔扫描排期。当作者构思新书、拟书名写简介、磨开篇、列全书大纲、开新卷、重排卷次或调节奏钩子时触发。只管单章以上规划：建书与冻结交给 fiction-init，单章 outline 与写正文交给 fiction-chapter，文案与正文审校交给 fiction-review，平台提交交给 fiction-publish，改短剧交给 fiction-short-drama。
  Web-novel ideation, positioning, and volume-level planning: turn vague ideas into marketable hooks, draft publish/blurb.md, design golden first three chapters, whole-book and volume outlines, beat/emotion waves, S-A-B-C hook and daily groupings, region cycles, and foreshadow schedules. Use when brainstorming a book, drafting titles/blurbs, planning volumes, pacing, or scheduling payoffs; hand setup/freezing to fiction-init, chapter outlines/drafting to fiction-chapter, review to fiction-review, submission to fiction-publish, and adaptation to fiction-short-drama.
license: MIT with Commons Clause v1.0 (see LICENSE)
compatibility: Agent Skills standard; tested on Claude Code, also readable by Codex and OpenCode. Scripts need Node.js 22.5+.
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---

# 创意与卷纲规划

负责网文项目中**单章以上**的创意与卷级规划：把模糊点子收敛成书目定位、对外文案初稿、黄金三章（开篇前三章，决定读者留存）、全书大纲与卷级规划（章节规划表、节奏波形、钩子级别、日更分组与区域循环备注），再把卷级计划交给下游写章或审校。

## 何时用 / 不用

**何时使用本 skill：**
- 只有模糊点子，想收敛题材定位、核心卖点、主角优势（金手指）及其代价与读者预期。
- 要拟书名、起草或改写 `publish/blurb.md`（书名、简介、标签、宣传语）。
- 要设计或重构开篇黄金三章，验证“为什么继续读”。
- 要起草或调整全书大纲、分卷区间、明暗双线节奏、重大反转与卷级大钩子链。
- 要开新卷、重排卷次、编排 `bible/volumes/{vol}.md` 的 `## 章节规划` 表，或按日更 / 爆更期调配爽点、情绪波形与 S/A/B/C 钩子。
- 要为游历、多地点、副本、单元探案类分卷设计稳定的“区域循环”结构。

**何时转交兄弟 skill（只交接，不静默代做）：**
- **建书骨架、导入已有稿件、更新公开冻结清单（`frozen.ranges` 与 `lint.mjs --freeze`）**：交给 `fiction-init`。未安装时，交付已产出的讨论稿或模板清单、待办步骤（新建目录或更新 `frozen.ranges` 并运行 `lint.mjs --freeze`）以及未跑检查项。
- **依据卷纲写单章 `outline.md`、正文起草与章后回写**：交给 `fiction-chapter`。未安装时，交付本卷 `bible/volumes/{vol}.md`（含自由区的日更分组与区域三项备注）、待写的单章提纲清单及未做的正文/回写检查。
- **设定冲突裁决、把新规划的伏笔/支线入账与日常维护**：交给 `fiction-continuity`。未安装时，交付待登记的伏笔/支线清单与冲突点，明确标注未完成入账与一致性复核，由作者手动回写。
- **`publish/blurb.md` 与正文的机检、脱敏核查、编辑式审校**：交给 `fiction-review`。未安装时，交付 `publish/blurb.md`、逐项人工复核清单（对应 `lint.desensitize.*`、`lint.banned_terms`、`lint.internal_terms`）并注明“机检未运行”。
- **对外提交书名、简介与章节到发布平台**：交给 `fiction-publish`。未安装时，交付 `publish/blurb.md` 与 `book.title` 核对提醒，由作者自行发布。
- **场景写法、对话、氛围、题材包详情**：参考 `fiction-craft`（尤其是 `references/genres/<id>.md`）。未安装时，向作者确认题材惯例与读者预期即可。
- **把网文改编为竖屏短剧**：交给 `fiction-short-drama`。未安装时，交付已定稿的 `bible/plot-outline.md`、`bible/volumes/{vol}.md`、短剧侧待建文件清单（`series.md`、`adaptation-map.md`）并注明改编检查未运行。

## 开始前

要写或要改任何机读文件之前，先打开对应的契约摘录文件（`references/formats/*.md`），照里面的格式写，不凭印象。

进入规划前，按顺序读取三类项目文件：

1. **项目 `AGENTS.md`**（重点读 `## 本书口径`）：确认主角口径、视角纪律、书专属规则与题材忌讳。项目规则优先级高于本 skill 默认值（[SB §3](references/formats/project.md)）。
2. **`.fiction/config.json`**（字段与默认值见 [SB §8](references/formats/config.md)）：读取 `book.title`、`book.genres`、`rhythm.beat_every`（默认 `[3,5]`）、`rhythm.external_event_max_gap`（默认 `2`）、`daily.*`（默认日常 `2` 章/天、末章下限 `A`；爆更期 `3-5` 章/天、末章下限 `S`）、`hook.discouraged`（默认 `["C"]`）、`frozen.ranges`、`foreshadow.*`、`subplot.*`、`lint.desensitize.*`、`lint.banned_terms`、`lint.internal_terms` 与 `lint.extra_files`。
3. **`bible/sources.md`**（[SB §5](references/formats/project.md)）：确认唯一主写入口，避免改错次级派生文件。

**按任务补读最小集**（[SB §4.1](references/formats/project.md)，不因怕漏而全量扫 `bible/`）：
- 讨论全书方向或重排卷：`bible/canon.md` → `bible/timeline.md` → `chapters/{vol}/vol-info.md` → `bible/volumes/{vol}.md` → `bible/plot-outline.md` → `bible/storylines.md` → `bible/subplots.md`；按需补读 `bible/foreshadows.md`。
- 若安装了 `fiction-craft` 且 `book.genres` 非空，先查看对应题材包 `references/genres/<id>.md`，对齐爽点偏好与雷区。
- 若重排范围触及 `frozen.ranges` 中的已公开冻结章（[SB §7.1](references/formats/chapter.md)），冻结章正文只读，只调整未冻结章节，涉及冻结章的口径冲突交 `fiction-continuity`；若需追加公开冻结范围，转交 `fiction-init`。

**缺失文件处理**：若作者从零构思新书、项目文件尚未建立，提示作者可随时运行 `fiction-init` 初始化骨架；当前先按 [SB §8](references/formats/config.md) 默认值构思，并在输出开头注明“当前使用默认参数”。

## 流程

作者可从第 1 步走完全程，也可直接跳到当前阶段（如开新卷或重排，直接从步骤 5 开始）。**凡涉及核心定位、双线阈值、卷次重排或覆盖已有规划，先出方案请作者拍板，获确认后再落盘权威文件。**

### 步骤 1：创意定位与卖点收敛

1. 收集初始点子（题材、主角困境、想写的名场面、预计篇幅与目标平台）。若已安装 `fiction-craft` 且选定了题材，先对照对应题材包（`references/genres/<id>.md`）里的卖点偏好与雷区。
2. 按 [references/ideation-and-blurb.md](references/ideation-and-blurb.md) 产出 `2-3` 个前提变体，每个变体写清：核心卖点、主角优势 / 金手指（主角独有的破局能力或信息差，若题材需要）及其**代价、限制与成长空间**、目标读者画像、一句话卖点（One-line pitch）。
3. 竞品对照：**向作者询问 `2-3` 部参考作品**，只拆解结构、基调与卖点差异；绝不编造销量、订阅、点击或榜单数据。
4. 做“为什么继续读”五问校验，并起草定位概览（一句话定位、氛围参考、双线结构、核心人设草稿）。
5. **停下来请作者拍板**：选定前提变体与边界后再继续，未定稿留在 `bible/drafts/`。按 `fiction-continuity` 的冲突优先级（[SB §3](references/formats/project.md)），只将作者在本流程明确确认且无冲突的设定裁决写入 `bible/canon.md`，未确认或有冲突的交 `fiction-continuity`。

### 步骤 2：对外包装文案起草（`publish/blurb.md`）

1. 基于已拍板定位，参照 [references/ideation-and-blurb.md](references/ideation-and-blurb.md) 与模板 [assets/blurb-template.md](assets/blurb-template.md) 起草：书名候选（至少 3 组不同风格）、四段式简介、核心标签与一句话宣传语。
2. 按 [SB §1.6](references/formats/project.md) 与 [SB §8](references/formats/config.md) 分别核对文案约束：
   - **脱敏**：不出现精确公历年份与可映射现实的词（`lint.desensitize.*`）；
   - **禁用词**：避开 `lint.banned_terms`；
   - **内部术语**：不泄漏 `lint.internal_terms`（如“伏笔”“钩子”“爽点”“支线”“大纲”等）。
3. **停下来请作者选定**，确认后写入 `publish/blurb.md`。若选定或更改了书名，同时提醒核对 `.fiction/config.json` 中的 `book.title`（供 `fiction-init` / `fiction-publish` 使用）。
4. 分工收口：本 skill 只负责起草；把 `publish/blurb.md` 交给 `fiction-review` 按正文标准机检与复审（`lint.extra_files` 默认包含此文件），待提交平台时再交给 `fiction-publish`。

### 步骤 3：黄金三章设计

1. 按 [references/ideation-and-blurb.md](references/ideation-and-blurb.md) 规划第 1–3 章硬任务：第 1 章立处境 + 渴望 + 首个异常/冲突；第 2 章主动试探 + 首个小验证/小爽点及其边界；第 3 章抬升赌注 + 推开更大门缝 + 强追读钩子。
2. 核对开篇反模式（不写设定说明书开头、不用泛天气开场、前 3 章零无增量铺垫、控制人物数）。
3. **停下来请作者确认**前三章走向；确认后将在步骤 6 落入卷 1 的 `## 章节规划` 前三行。

### 步骤 4：全书大纲与明暗双线规划

1. 参照 [references/outline-and-dual-line.md](references/outline-and-dual-line.md) 与模板 [assets/plot-outline-template.md](assets/plot-outline-template.md) 设计全书骨架：阶段划分、分卷区间、卷级大钩子链（约 `50%` 处种下下卷种子）、明暗双线四阶段介入阈值（**阈值由作者按总篇幅拍板，只维护在 `bible/plot-outline.md` 中**，项目 `AGENTS.md` 如需提及只引用不另抄）、关键反转序列（读者已知与作者真相分离）及结局方向。
2. **停下来请作者拍板**阶段划分、双线阈值与结局方向。
3. **落盘时机（守住 [SB §4.2](references/formats/project.md) 顺序）**：
   - 若本次**仅做全书宏观规划、不涉及已有卷改动或单卷细排**，获作者确认后即可写入 `bible/plot-outline.md`；
   - 若本次**同时要新建或重排具体分卷**，本步先在对话或 `bible/drafts/` 保留已确认草案，等步骤 6 卷规划获确认后，再按 `bible/volumes/{vol}.md` → `bible/plot-outline.md` → `chapters/{vol}/vol-info.md` 顺序一并落盘。

### 步骤 5：伏笔与支线排期扫描（已有项目开新卷或重排时必跑）

1. **首扫保留全部诊断类别**（不加 `--only`，避免遮蔽 `invalid` 与 `writeback`），以当前最新定稿章号运行（参数与默认 `--fail-on` 详见 `foreshadow-scan.mjs --help`）：
   ```bash
   node <本 skill 目录>/scripts/foreshadow-scan.mjs --at <当前最新定稿章号>
   ```
   - 退出码 `2`（找不到书根、配置或用法错误）：先排查命令与环境，不得当作无异常继续；
   - 退出码 `1`（默认存在 `overdue` 或 `invalid`）或出现 `writeback` 缺口：先将 `invalid` / `writeback` 交 `fiction-continuity`（或作者手动）修齐 bible，再排新卷。
2. **覆盖整卷区间防漏项**：单个 `--at` 只反映截至该章的快照。清完现状欠账后，针对拟规划卷区间 `[vol_start, vol_end]`，**人工核查 `bible/foreshadows.md` 的 `埋设章` 与 `计划回收章` 列**（并可追加运行 `--at <vol_end> --only plant_due,due,overdue,dormant,subplot_alerts` 预览整卷将到期的项），把本卷区间内全部待埋、到期、逾期、沉睡伏笔与停滞支线汇总进排期池。
3. **纯新书处理**：尚未建 `bible/foreshadows.md` 或 `bible/subplots.md` 时跳过脚本，但在本步单独列出本卷计划新设的伏笔与支线清单，供交接前入账。
4. **排期与拍板**：`overdue` / `due` 优先排入本卷前中段回收，无法按期回收的列出改期或放弃选项交作者拍板；`dormant` 安排轻触及或回收；`subplot_alerts`（`stalled` / `span` / `remind_gap`）按 `subplot.*` 配置补齐推进节点。

### 步骤 6：卷级规划、节奏波形与日更编排

1. 参照 [references/rhythm-and-cadence.md](references/rhythm-and-cadence.md) 与模板 [assets/volume-plan-template.md](assets/volume-plan-template.md) 编制本卷草案：
   - **分段与情绪波形**：紧 → 松 → 更紧；不连两章同为高潮或同为低谷；低谷章承载支线、涟漪、人物深化或下卷种子。
   - **爽点节拍**：按 `.fiction/config.json` 的 `rhythm.beat_every`（默认每 `3-5` 章）落地明确爽点并轮换类型；用微/中/宏观欲扬先抑放大落差。
   - **外部打断与小弧线**：**连续无外部事件的章数**不超过 `rhythm.external_event_max_gap`（默认 `2` 章），下一章安排外部事件打断；每约 `3` 章完成一个小弧线。
   - **支线与涟漪**：每章至少触及 `1` 条活跃支线、安排至少 `1` 位互动角色；按 `subplot.remind_gap` 与 `subplot.max_span` 排布六步节点并预留章末衔接点；重大事件后将直接/间接/远端三层涟漪分散到后续数章；单章回收伏笔不超过 `1-2` 个。
   - **钩子分级与日更/爆更分组**：在 `## 章节规划` 表 `钩子` 列标明计划级别（`S`/`A`/`B`/`C`，定义见 [SB §7.2](references/formats/chapter.md)）。日常更新按 `daily.chapters_per_day`（默认 `2` 章）分组，每日末章不低于 `daily.last_hook_min`（默认下限 `A`）；爆更期按 `daily.burst.chapters_per_day`（默认 `3-5` 章）排成“爽点 → 喘息 → 更大爽点”波浪，末章不低于 `daily.burst.last_hook_min`（默认下限 `S`）。写作上 `C` 级仅限大高潮后的喘息章；机检中命中 `hook.discouraged`（默认 `["C"]`）会触发提示。**把按发布日整理的章号分组写入卷纲自由区 `## 日更 / 爆更分组备注`**，供 `fiction-chapter` 填入单章 `outline.md` 的 `## 日更位置`（[SB §7.3](references/formats/chapter.md)）。
2. **若本卷属于游历、多地点、副本或单元结构**：加载 [references/region-cycle.md](references/region-cycle.md)，确立本站本地故事主线与至少 `1` 条挂靠支线，按**区域循环**八步拆解，控制单章推进 `1-2` 步。**按章号把三项（当前区域循环步次、本章新增的区域理解、本章结算收益）记入卷纲自由区 `## 区域循环逐章备注`**，不改动契约八列表表头；后续由 `fiction-chapter` 写入单章 `outline.md` 的 `## 本章职责`。
3. **交接前 ID 核对**：核对 `## 章节规划` 表引用的全部 F-ID 与支线 ID 是否已在 `bible/foreshadows.md`（[SB §6.2](references/formats/bible.md)）和 `bible/subplots.md`（[SB §6.3](references/formats/bible.md)）登记；未登记的新项汇总成待入账清单。
4. **先停下来请作者确认完整方案**（章节规划表、节奏波形、日更分组、区域三项、待入账 ID 清单），**获确认后再严格按 [SB §4.2](references/formats/project.md) 顺序落盘**：
   1. 先写或改 **`bible/volumes/{vol}.md`**（`- 章节范围` + 自由区 + [SB §7.5](references/formats/chapter.md) 八列表：`章 | 核心事件 | 爽点 | 钩子 | 支线 | 伏笔 | 人物 | 权重`）；模板里的 `{起始章}-{结束章}` 占位必须先换成实际章号，否则脚本读不通；
   2. 再同步 **`bible/plot-outline.md`**（对齐该卷范围、核心主线与大钩子）；
   3. 最后更新 **`chapters/{vol}/vol-info.md`**（[SB §7.4](references/formats/chapter.md) 摘要字段，不复制规划表）。

### 步骤 7：交接下游

按职责交接给对应 skill；若目标 skill 未安装，交付已产出的文件、明确待办清单与未运行检查项，不静默代做：
- 依据本卷规划写单章 `outline.md` 与正文、并完成章后回写 → **`fiction-chapter`**；
- 新规划的伏笔/支线待入账清单、改期/放弃回写或设定冲突 → **`fiction-continuity`**；
- `publish/blurb.md` 机检与润色审校 → **`fiction-review`**；
- 书名简介与章节对外提交（同步核对 `book.title`）→ **`fiction-publish`**；
- 建书骨架或更新公开冻结清单 → **`fiction-init`**；
- 流水线继续向竖屏短剧改编 → **`fiction-short-drama`**。

## 检查

交付任何规划产物前，逐项核对并如实汇报：

- [ ] 若为已有项目，已以现状章号跑全量 `foreshadow-scan.mjs`（未用 `--only` 遮蔽诊断类，退出码非 `2`），已完整列出 `invalid`、`writeback`、`overdue`、`due`、`plant_due`、`dormant` 与 `subplot_alerts` `[脚本]`
- [ ] 已结合整卷区间 `[vol_start, vol_end]` 核查 `bible/foreshadows.md` 计划回收列并将到期/沉睡项与停滞支线排入卷纲；规划表引用的 F-ID 与支线 ID 均已登记，或已单列待入账清单交下游 `[模型]`
- [ ] `bible/volumes/{vol}.md`（[SB §7.5](references/formats/chapter.md)）与 `chapters/{vol}/vol-info.md`（[SB §7.4](references/formats/chapter.md)）格式合规，且在作者确认后按 `volumes/{vol}.md` → `plot-outline.md` → `vol-info.md` 顺序落盘 `[模型]`
- [ ] 若起草了 `publish/blurb.md`，已按 `lint.desensitize.*`、`lint.banned_terms`、`lint.internal_terms`（[SB §8](references/formats/config.md)）做初查，并注明须交 `fiction-review` 机检；书名变动时已提示核对 `book.title` `[模型]`
- [ ] 爽点密度满足 `rhythm.beat_every`，连续无外部事件的章数不超过 `rhythm.external_event_max_gap`，无连续两章同为高潮或同为低谷；日更/爆更分组已写入卷纲自由区，每日末章钩子均不低于配置下限（日常 `daily.last_hook_min` / 爆更 `daily.burst.last_hook_min`），C 级与 `hook.discouraged` 处理得当 `[模型]`
- [ ] 每卷存在活跃大钩子且约 `50%` 处已种下下卷种子；A/B 级支线均挂靠主线并按 `subplot.remind_gap` / `subplot.max_span` 排期；若为区域循环卷，每站有本地主线与挂靠支线、八步完整、三项已按章记入卷纲自由区、无警戒反模式 `[模型]`
- [ ] 竞品对照未编造销量/榜单数据；核心卖点、金手指代价、双线阈值、书名简介、逾期伏笔改期/放弃与卷规划方案均已获作者拍板 `[作者]`

## 产出

根据当前进入的步骤，创建或更新以下文件：
- `publish/blurb.md`（书名、简介、标签、宣传语初稿）
- `bible/plot-outline.md`（全书阶段、双线阈值、分卷大钩子链、反转序列、结局方向）
- `bible/volumes/{vol}.md`（卷详细规划、自由区日更分组与区域三项备注、`## 章节规划` 八列表）
- `chapters/{vol}/vol-info.md`（卷级摘要）
- `bible/drafts/*.md`（尚未拍板的创意变体或大纲草案，只读参考）

**给作者的汇报格式**：
1. 本次新建 / 更新的文件清单（注明确认后是否按 `volumes` → `plot-outline` → `vol-info` 顺序同步）。
2. `foreshadow-scan.mjs` 扫描结果与整卷伏笔/支线排期摘要（含退出码说明、待入账 ID 清单；纯新书注明跳过脚本）。
3. 节奏与日更体检摘要（爽点间隔、无外部事件最长连章、情绪峰值、每日末章钩子达标情况、大钩子与下卷种子位置）。
4. 待作者拍板的决策项、下游交接目标（若下游 skill 未安装，列出交付文件、待办清单与未运行检查项）。

## 参考文档

| 遇到以下场景时 | 阅读文件 |
|---|---|
| 查看目录结构、冲突裁决、最小必读集、按事件写回顺序与 `sources.md`（SB §1–§5） | [references/formats/project.md](references/formats/project.md) |
| 查看伏笔表、支线六步表、人物与时间锚点等 `bible/` 机读格式（SB §6） | [references/formats/bible.md](references/formats/bible.md) |
| 查看卷详细规划八列表、`vol-info.md`、`outline.md` 与钩子分级规范（SB §6.1、§7） | [references/formats/chapter.md](references/formats/chapter.md) |
| 查看 `.fiction/config.json` 全部字段与默认值（SB §8） | [references/formats/config.md](references/formats/config.md) |
| 从模糊点子收敛卖点、设计金手指边界、起草 `publish/blurb.md` 或打磨黄金三章 | [references/ideation-and-blurb.md](references/ideation-and-blurb.md) |
| 编排全书大纲、明暗双线介入节奏、三层信息、大钩子链、A/B/C 支线排期与三层涟漪 | [references/outline-and-dual-line.md](references/outline-and-dual-line.md) |
| 排布爽点节拍、欲扬先抑、冲突升级阶梯、情绪波形、钩子分级与日更/爆更分组 | [references/rhythm-and-cadence.md](references/rhythm-and-cadence.md) |
| 规划游历、多地点、副本、单元探案类分卷的八步“区域循环”与警戒清单 | [references/region-cycle.md](references/region-cycle.md) |
| 复制对外文案空模板创建 `publish/blurb.md` | [assets/blurb-template.md](assets/blurb-template.md) |
| 复制全书大纲空模板创建 `bible/plot-outline.md` | [assets/plot-outline-template.md](assets/plot-outline-template.md) |
| 复制卷级规划空模板创建 `bible/volumes/{vol}.md` | [assets/volume-plan-template.md](assets/volume-plan-template.md) |
