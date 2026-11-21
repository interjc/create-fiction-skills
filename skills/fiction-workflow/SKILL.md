---
name: fiction-workflow
description: >-
  网文与竖屏短剧流水线路由：查看阶段与逐集进度，选定或切换终点（网文、剧本、分镜或提示词），按门槛交接具体章集，上游改动后按顺序回退。作者问“进行到哪了”“下一步做什么”“该走哪一步”，或说“设定终点”“切换终点”“跑完整条流水线”时使用。具体的单阶段制作请求直接交给负责的 skill。
  Route the web-novel and vertical short-drama pipeline. Use for “where am I?”, “what next?”, “which step?”, “set or change the endpoint”, or “run the whole pipeline”. Report project and episode progress, set workflow.target, and route specific chapters or episodes through gates and upstream rechecks. Use the owning skill for a concrete single-stage task.
license: MIT
compatibility: Agent Skills standard; tested on Claude Code, also readable by Codex and OpenCode. Scripts need Node.js 22.5+.
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---

# 创作总入口与阶段路由

负责判读项目当前阶段与逐集状态、确认流水线终点，并按门槛把下一步工作与具体章集交给负责的兄弟 skill。全链路为「创意 → 网文 → 分集剧本 → 分镜 → 图片与视频提示词」，停在网文或之后任一阶段都是完整终点，也可跳过网文直接做原创短剧。

## 何时用 / 不用

- **何时用本 skill**：
  - 询问从哪开始写、下一步做什么、项目整体进度或各集状态。
  - 了解从创意到网文 / 短剧 / 分镜 / 提示词的全流程分工。
  - 选定或切换流水线终点（如「只写小说不做短剧」，或调高 / 降低终点）。
  - 上游文件修改后，确认应按什么顺序回退重跑受影响的下游产物。
- **不用本 skill（具体制作请求直接交对应 skill；本 skill 绝不代做兄弟 skill 的活，也不复述其方法）**：
  - 已明确点名制作任务（例如「写第 5 章」「审校这章」「把第 3 章改成短剧」「给第 2 集画分镜」「写生图提示词」「发到番茄」）→ 直接交给对应 skill，不经本 skill 绕行。
  - 各兄弟 skill 归属：`fiction-init`（建书骨架、导入旧稿、更新公开章冻结清单）、`fiction-planner`（网文创意孵化、卖点定位、起草 `publish/blurb.md`、黄金三章、全书与卷级规划）、`fiction-chapter`（单章 `outline.md`、正文起草、结构重写、章后回写与回写扫描）、`fiction-review`（章节与对外文案审校、去 AI 味、获准局部回修、跨章复核）、`fiction-continuity`（跨章与全局 story bible 治理、冲突裁决、伏笔/支线审计、卷末复盘）、`fiction-craft`（场景/对话/氛围/章型技法、题材包、`bible/style-guide.md`）、`fiction-short-drama`（小说改编或原创短剧立项、映射表、分集剧本）、`fiction-storyboard`（拆段切镜、最小视觉资产条目、跨集连戏表）、`fiction-visual-prompts`（补全资产完整外观与锁定词、参考图与帧图/视频提示词、生成前预览确认）、`fiction-story-db`（可选 extras，约 300 章以上长篇派生索引）、`fiction-publish`（实验 extras，平台提交章节与已审简介）。

## 开始前

按 [SB §4.1](references/formats/project.md)（判断项目处在哪个阶段）依次确认：

1. **书根位置**（[SB §1](references/formats/project.md)–[SB §2](references/formats/project.md)）：操作对象始终是作者的书项目根目录，绝不是 skill 安装目录或上级仓库。尚未建书根（仅有构思或零散旧稿）时，不强跑脚本，按步骤 3 与步骤 4 的无书根入口路由。
2. **项目基础文件**（存在时读取）：`AGENTS.md`（尤其 `## 本书口径`）、`.fiction/config.json`（关注 `workflow.target` 与 `frozen.ranges`，[SB §8](references/formats/config.md)）、`bible/sources.md`（主写入口注册表，[SB §5](references/formats/project.md)）。缺文件不猜设定，也不代建骨架。

**机读文件格式铁律**：要写或要改任何机读文件（如 `.fiction/config.json`）之前，先打开文末参考文档表中对应的格式摘录文件，照里面的格式写，不凭印象。

## 流程

### 1. 定位书根

核实作者当前的书根目录（含 `.fiction/config.json` 或 `bible/`，[SB §2](references/formats/project.md)）。若当前目录不是书根，请作者确认路径并在下一条命令传 `--root <书根>`。若尚无书根，标记为「无书根（状态脚本未运行）」，直接转步骤 3 定终点与步骤 4 入口路由。

### 2. 读状态（脚本机械汇总）

已定位书根时运行（选项见 `status.mjs --help`）：

```text
node <本 skill 目录>/scripts/status.mjs --root <书根> --json
```

- 退出码 `2` 表示书根无效、配置非法或用法错误：立即停下报告报错，绝不把坏配置当成 `empty`。
- 退出码 `0` 时读取 `stage`、`target`、`novel`（`bible`、`chapters`、`last_chapter`、`frozen`）、`series[]`（`series`、`title`、`total`、`stage`、`assets`、`refs`、`episodes[]`）与 `warnings`。
- 用白话向作者说明现状；`warnings` 非空时逐条原样汇报并交回对应文件负责人核对，绝不忽视解析异常。
- **绝不把 `stage` 当成质量合格结论**：`status.mjs` 仅按文件存在与状态字段机械汇总，不跑内容检查；`done` 也只表示「块状态标记为已出」，不证明文件存在或全集镜段已覆盖。

### 3. 定终点与定界 `[作者]`

- **选定终点**：`fiction-init` 已写入终点时直接沿用；当 `target` 为 `null` 且作者尚未回答时，一次性请作者选择终点（[SB §8](references/formats/config.md)）：`novel`（只写网文）/ `script`（到分集剧本）/ `storyboard`（到分镜）/ `prompts`（到图片与视频提示词）。原创短剧可直接走 `fiction-short-drama` 模式 B。
- **写入 `workflow.target`**：
  - 书项目骨架已存在时，只在 `workflow.target` 仍为 `null` 且作者已确认终点时，由本 skill 按 [SB §8](references/formats/config.md) 写入并核对（保留其余键不变）；书根已有 `bible/` 但还没有 `.fiction/config.json` 时，只按 SB §8 新建仅含 `{"workflow":{"target":…}}` 的最小配置，这是本 skill 唯一可新建的文件。
  - 书项目尚未建骨架时，把作者已答的终点交给 `fiction-init` 写入，建好后重读配置；仍为 `null` 才按上一条补写。若因缺少 `fiction-init` 而仅建了最小降级骨架（无 `.fiction/config.json`），在汇报中注明「`workflow.target` 待写入配置」并保留作者已确认值。
- **切换终点与终点定界**：作者随时可调高或降低终点（同样须作者确认后再改 `workflow.target`）。**本次工作范围以当前 `workflow.target` 为上限**：机械 `stage` 高于 `target` 完全正常（已有下游文件留在原地即可，不越过 `target` 推进）；即使存在短剧文件，只要本次任务是网文写作，网文连载路线始终可用。

### 4. 按「终点定界 → 逐集门槛」路由

先用当前 `target` 限定本次路由上限；进入短剧链路后，先选定 `series` 与 `episode`（结合 `adaptation-map.md` 与作者批次找缺口，不靠总数相减猜集号），再**按同一集从上游到下游逐道查门槛**：任一门槛未过或该文件有 `warnings` 解析异常，一律退回该门槛的负责 skill（完整字段条件、降终点路径与案例见 [路由详表与案例](references/routing.md)）。

小说章节的「定稿」指选用的稿件文件，作者审批另行确认；分集剧本与分镜的 `状态：定稿` 表示作者已确认。

| 当前状态 / 场景 | 入口条件与门槛 | 交给哪个 skill | 交接输入与说明 |
|---|---|---|---|
| 无书根 / `empty`（网文意向，点子模糊） | 尚无故事定位与卖点 | `fiction-planner` | 模糊想法、题材意向；先收敛定位再建书 |
| 无书根 / `empty`（网文意向，创意已定） | 方向已定，缺项目骨架 | `fiction-init` | 书根路径与作者已确认终点；由 `fiction-init` 建骨架并写 `workflow.target` |
| 无书根 / `empty` / 仅有规范旧稿无档案 | `novel.bible === false`，有外部旧稿或无档案手稿 | `fiction-init`（作者要求反抽档案时请它先确认导入范围） | 旧稿路径、章卷意向与公开状态待核清单；改短剧（模式 C）也先走此步 |
| 无书根 / `empty`（仅原创短剧意向，不写网文） | `target` 为 `script` / `storyboard` / `prompts` | `fiction-init` → `fiction-short-drama`（模式 B） | 交书根与已确认终点，搭最小骨架后由 `fiction-short-drama` 自行完成短剧立项（无需先走 `fiction-planner`） |
| 已有短剧目录但尚无分集 | `series[].stage === null`（`stage` 可为 `empty`/`bible`/`novel`），`target` 非 `novel` | `fiction-short-drama` | `series`、`series.md` 与 `adaptation-map.md`；缺基础档案先补最小骨架 |
| `bible`（走网文路线） | `novel.bible === true && novel.chapters === 0`；卷规划缺目标章职责 | `fiction-planner` | 书根与 `bible/`；补齐全书大纲、卷规划表与目标起始章（可从第 0 或第 1 章起） |
| `bible`（走网文路线） | 卷规划已确认起始章与本章职责 | `fiction-chapter` | 书根、已确认卷号与规划表给出的章号（不写死第 1 章） |
| 网文连载（`novel`，或已有短剧时继续写网文） | 常规逐章推进；`target: novel` 已达终点 | `fiction-chapter` → `fiction-review` → 回 `fiction-chapter` | 先查卷规划（缺章职责先交 `fiction-planner`）；`fiction-chapter` 负责起草、修稿与章后回写及核对；跨章/全局档案治理交 `fiction-continuity`；局部技法或风格指南交 `fiction-craft`。`target: novel` 时不推销短剧 |
| 网文提交平台 | **仅在作者要求提交/排期/查状态时** | `fiction-publish`（实验 extras） | 目标平台（当前仅适配番茄 `fanqie`）、作品、作者确认的定稿或获准提交的 `publish/blurb.md` 及授权范围；未适配或缺已登录会话时只做本地准备交付 |
| 新增章节已公开发布 | 作者核实已公开章号与采用稿 | `fiction-init`（更新冻结清单模式） | 书根、已公开全局章号与采用稿（仅此 skill 负责封存） |
| 启动小说改短剧（模式 A） | `target` 非 `novel`，`novel.bible === true` 且已有定稿（无档案手稿走模式 C 先交 `fiction-init`） | `fiction-short-drama`（模式 A） | 书根、`bible/` 与已定稿范围 |
| 剧本门槛未过（任意高于 `novel` 的 `target`） | 目标集 `script !== "final"`（含 `null`/`draft`/`revised`）、映射缺行、或缺 `drama-check` / `lint --series` 通过报告 | `fiction-short-drama` | **点名 `series` 与具体集号**、`episodes/`、`adaptation-map.md` 与相关 `warnings` |
| 到达 `script` 终点 | `target: script` 且目标集均过剧本门槛（即使磁盘已有更高阶段文件） | 停在剧本终点 | 已达当前终点；不推进分镜，按需可交 `fiction-review` 精修台词 |
| 进分镜 / 分镜门槛未过 | `target` 为 `storyboard` 或 `prompts`；**已过剧本门槛**（`script: final` + 映射完整 + `drama-check` 与 `lint --series` 通过），但 `storyboard !== "final"` 或 `assets === false` | `fiction-storyboard` | **点名 `series` 与具体集号**、已定稿剧本、映射表与 `visual/` |
| 到达 `storyboard` 终点 | `target: storyboard` 且目标集均过分镜与资产门槛（即使磁盘已有提示词文件） | 停在分镜终点 | 已达当前终点；不推进提示词 |
| 提示词阶段（`target: prompts`） | **已过剧本门槛且已过分镜与资产门槛**（`storyboard: final` + `assets: true` + `storyboard-check` 零阻断） | `fiction-visual-prompts` | **点名 `series` 与具体集号**、分镜、`visual/assets.md`、`refs` 与块状态；由其核对镜段覆盖、参考图就绪与当前批次确认。本 skill 绝不授权生成；提示词交付后停下即合法终点，作者在套件外生成后可按需回 `fiction-visual-prompts` 回填 |

**长篇可选索引**：仅当网文约 300 章以上、需要高频跨卷检索时，可提示可选装 `fiction-story-db`（extras 插件，建在 Markdown 之后的派生索引，永不作为必需前提，[SB §1](references/formats/project.md)）。

### 5. 上游改动后的回退与重跑

当上游变动且下游**已存在受影响产物**时，严格按 [SB §3](references/formats/project.md)（上游优先）与 [SB §4.2](references/formats/project.md)（按事件写回）顺序交接，绝不跳过任何一环的检查脚本：

1. **共享设定、共享人物稳定特征或未冻结小说章变动**：共享设定与人物稳定特征交 `fiction-continuity`（未冻结章正文先在 `fiction-chapter` / `fiction-review` 收口；冻结章不可改，经作者拍板在 `bible/canon.md` 记兼容口径）→ 对照 `adaptation-map.md` 找出**已存在且受影响**的集号交 `fiction-short-drama` → 受影响集已有分镜/提示词时按第 2 条继续。
2. **已有下游产物的集数改了剧本**：交 `fiction-short-drama` 修订、补全映射并跑 `drama-check` 与 `lint --series` 至零阻断后重新定稿 → 对**已存在且受影响**的分镜（含跨集连戏受波及的后续集）交 `fiction-storyboard` 重跑 `storyboard-check` 并更新分镜与 `visual/continuity.md` → 对**已存在且受影响**的提示词交 `fiction-visual-prompts` 同步并重跑 `prompt-check`。
3. **分镜或视觉资产变动（按写入归属分流）**：
   - 改分镜、跨集连戏或最小资产条目 / 揭示门禁 → `fiction-storyboard`（过 `storyboard-check`）→ 若已有受影响提示词，再交 `fiction-visual-prompts` 同步并过 `prompt-check`。
   - 仅补全或调整 `visual/assets.md` 的完整外观、提示词称呼或锁定词（不改共享设定、不动镜头设计）→ 直接交 `fiction-visual-prompts` 重跑 `storyboard-check` 与 `--brief` 复核资产，再同步受影响的参考图与已存在提示词并过 `prompt-check`。

### 6. 缺兄弟 skill 时的降级

目标 skill 未安装时，按对应一行交付文件与未跑检查，绝不即兴代做其工作：

| 缺失 skill | 一行降级（缺项 + 交付/所需文件 + 未运行的检查） |
|---|---|
| `fiction-init` | 缺建书与冻结工具：建骨架请作者按 [SB §2](references/formats/project.md)、[SB §5](references/formats/project.md)、[SB §8](references/formats/config.md) 手建 `AGENTS.md`、`.fiction/config.json`、`bible/sources.md` 及基础档案（导入基线 `length`/`lint` 未运行）；冻结须先确认有可用 `lint.mjs` 入口再追加已核实 `frozen.ranges` 并跑 `--freeze`，无入口则只交付待封存章号清单，不先改配置（冻结哈希封存未运行）。 |
| `fiction-planner` | 缺规划工具：交付 `AGENTS.md`、`.fiction/config.json` 与现有 `bible/`，由作者手写 `bible/plot-outline.md`、`bible/volumes/{vol}.md` 与 `publish/blurb.md`；`foreshadow-scan` 排期扫描与节奏核对未运行。 |
| `fiction-chapter` | 缺写章工具：交付 `bible/volumes/{vol}.md`、`chapters/{vol}/vol-info.md` 与目标章号，由作者手写 `chapters/{vol}/{ch}/`（`resources.md`、`outline.md`、`v{n}.md`）并按 `bible/sources.md` 回写；`brief`、`length`、`lint` 与章后 `foreshadow-scan` 未运行。 |
| `fiction-review` | 缺审校工具：交付待审稿件、`outline.md`、`AGENTS.md` 与 `bible/style-guide.md`，由作者自行审改；`length`、`lint`、`foreshadow-scan` 与跨章复核未运行。 |
| `fiction-continuity` | 缺连贯性工具：交付冲突证据、待改档案清单与 `bible/sources.md`，由作者按主写入口手核手改；`brief` 与 `foreshadow-scan` 未运行。 |
| `fiction-craft` | 缺技法与题材包：交付 `AGENTS.md`「本书口径」与 `bible/style-guide.md`，由作者按自定口径写作或建风格指南；题材包对照未加载。 |
| `fiction-short-drama` | 缺短剧剧本工具：交付 `bible/`（或手稿 / 立项笔记）与 `drama/{series}/`，由作者手写 `series.md`、`adaptation-map.md` 与 `episodes/ep{NNN}.md`；`drama-check` 与 `lint --series` 未运行。 |
| `fiction-storyboard` | 缺分镜工具：交付已定稿 `episodes/ep{NNN}.md`、`adaptation-map.md` 与 `visual/`，由作者手建/手修 `visual/assets.md`、`visual/continuity.md` 与 `storyboards/ep{NNN}.md`；前置 `drama-check`、防剧透 `--brief` 与 `storyboard-check` 未运行。 |
| `fiction-visual-prompts` | 缺提示词工具：交付已定稿 `storyboards/ep{NNN}.md`、`visual/assets.md`、`visual/continuity.md` 与 `episodes/ep{NNN}.md`，由作者补全锁定词并手写 `prompts/assets-image.md`、`prompts/ep{NNN}-image.md` 与 `prompts/ep{NNN}-video.md`；前置 `storyboard-check`、`prompt-check` 与生成前预览清单未运行。 |
| `fiction-publish` | 缺实验性发布工具：交付作者确认的定稿路径或获准提交的 `publish/blurb.md` 及 `publish/log.csv`，由作者自行登录平台提交记账；`length` 本地参考计数、平台字数核验与日志复算未运行。 |
| `fiction-story-db` | 缺可选索引工具：继续直接读 `bible/sources.md` 与 Markdown 源文件；可选 SQLite 派生索引未建立（不影响任何必跑检查）。 |

### 7. 汇报

每次路由结束按五段汇报：

1. **当前阶段**：有书根时报 `status.mjs` 汇总的 `stage`、小说定稿/冻结数、各部短剧逐集状态与 `warnings`（`[脚本]`，注明非质量结论）；无书根时标明「未运行（无书根）」。
2. **当前终点 `[作者]`**：`workflow.target` 当前值（或「未设定 / 待写入配置」）。
3. **下一步交给谁与原因 `[模型]`**：目标 skill、具体章号或剧名与集号、涉及文件、触发哪道门槛或事件。
4. **需要作者决定的事 `[作者]`**：选/改终点、确认批次或回退范围、发布授权或套件外生成决定；无则写「无」。
5. **没跑的检查**：明确列出留给下游 skill 跑的检查，以及因兄弟 skill 缺失而未运行的检查。

## 检查

- [ ] 阶段与各集状态来自 `status.mjs`（无书根时标明未运行） `[脚本]`
- [ ] 下一步交给哪个 skill `[模型]`
- [ ] 终点与改终点 `[作者]`
- [ ] 写 `workflow.target` 前作者已回答 `[作者]`
- [ ] 没有代做兄弟 skill 的活 `[模型]`
- [ ] 回退顺序符合 [SB §4.2](references/formats/project.md) `[模型]`

## 产出

默认只读项目状态并输出路由汇报；书项目存在时，按步骤 3 在 `workflow.target` 仍为 `null` 时写入作者选定的终点，或应作者明确请求切换终点（[SB §8](references/formats/config.md)）。

## 参考文档

| 遇到…… | 读哪份 |
|---|---|
| 查完整「阶段 × 终点」路由表、字段与异常判读、降终点/回退表与典型案例 | [路由详表与案例](references/routing.md) |
| 新手作者想看全流水线各阶段产出、归属 skill、把关检查与完成定义 | [全流水线概览](references/pipeline-overview.md) |
| 核对项目目录路径、上游优先裁决、最小必读集、按事件写回与 `sources.md`（SB §1–§5） | [SB §1–§5：项目结构与读写规则](references/formats/project.md) |
| 读写 `.fiction/config.json` 的 `workflow.target` 或核对配置键与默认值（SB §8） | [SB §8：项目配置](references/formats/config.md) |
