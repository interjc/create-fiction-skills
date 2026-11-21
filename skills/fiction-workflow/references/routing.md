# 路由详表与案例

## 目录

- [如何解读 `status.mjs --json` 与异常状态](#如何解读-statusmjs---json-与异常状态)
- [完整阶段 × 终点路由表](#完整阶段--终点路由表)
- [横向事件与回退重跑表](#横向事件与回退重跑表)
- [典型路由案例（钟表铺示例）](#典型路由案例钟表铺示例)

## 如何解读 `status.mjs --json` 与异常状态

`status.mjs` 仅按文件存在与状态字段机械汇总（参数见 `status.mjs --help`），不运行任何内容检查；单文件解析出错记进 `warnings`，退出码仍为 `0`。有书根但配置非法、找不到书根或用法错误时退出码为 `2`，须先报修而不得当成 `empty`。

| JSON 字段 | 含义 | 路由判读要点 |
|---|---|---|
| `target` | `workflow.target`：`novel` / `script` / `storyboard` / `prompts` / `null` | `fiction-init` 已写则沿用；书项目已存在且仍为 `null` 时，本 skill 按 [SB §8](formats/config.md) 写入作者选定值。当前 `target` 限定本次路由上限。 |
| `stage` | 全书最高机械阶段：`empty` / `bible` / `novel` / `script` / `storyboard` / `prompts` | 取所有小说与短剧文件显示的最高阶段。可高于当前 `target`（作者降终点后常见），**绝不代表前序集数或内容合格**。 |
| `novel.bible` | `bible/` 下是否至少有一份 `.md` | `false` 时项目无故事档案。若 `chapters > 0` 而 `bible: false`，属无档案手稿，改短剧须先走 `fiction-init` 导入（模式 C），不可直接走模式 A。 |
| `novel.chapters` / `last_chapter` / `frozen` | 有定稿的章数、最大定稿章号（`chapters === 0` 时为 `null`）、其中冻结章数 | 冻结章只读（[SB §3](formats/project.md)）；`chapters` 约 300+ 时可提示可选 `fiction-story-db`。 |
| `series[]` | `drama/<slug>/` 下各部短剧摘要 | 一本书可有多部短剧；路由前先指定 `series` 与 `title`。即使只有 `drama/<slug>/` 而无 `bible/` 与分集，全书 `stage` 仍为 `empty` 且该剧 `stage` 为 `null`。 |
| `series[].total` / `stage` | `series.md` 总集数（缺则为 `null`）与本剧最高阶段（`script`/`storyboard`/`prompts`/`null`） | 不可仅用 `total` 减已定稿集数猜下一集；须对照 `adaptation-map.md` 与作者确认的批次按具体 `episode` 键找缺口。 |
| `series[].assets` / `refs` | `visual/assets.md` 是否存在、`prompts/assets-image.md` 有效槽位 `{total, done}` | `assets: false` 时挡在分镜/资产门槛，不可进入提示词；`refs.done` 仅表示槽位标记为已出。 |
| `series[].episodes[]` | 仅包含**磁盘上存在剧本、分镜或提示词文件**的集，按 `episode` 升序 | **完全缺文件的计划集不会出现在数组中**；须对照 `adaptation-map.md` 与批次清单补查未开工集号。 |
| `episodes[].script` / `storyboard` | `draft` / `revised` / `final` / `null` | `null` 可能是缺文件，也可能是文件标题/状态解析失败（见 `warnings`）。逐集路由须先过 `script === "final"`，再过 `storyboard === "final"`。 |
| `episodes[].image` / `video` | `{blocks, approved, done}` 或 `null`（`blocks` 不含已作废块） | `blocks === 0` 表示空文件或全作废块；`blocks > approved + done` 既可能是草稿块，也可能包含**状态非法**的块（同时出现在 `warnings`）；`done` 仅表示块标记为已出，**不证明文件存在或全集镜段已覆盖**（由 `prompt-check` 核验）。 |
| `warnings` | 解析提醒列表 | 非空时必须先按文件与行号核对原文件并交回该文件负责 skill 修复，绝不把带解析错误的集放行到下游。 |

## 完整阶段 × 终点路由表

路由顺序固定：**① 用当前 `target` 限定本次上限 → ② 若目标在短剧链路，选定 `series` 与具体 `episode` → ③ 逐集先查 `warnings`、再依次核对剧本门槛与分镜/资产门槛**。

| 场景 / 机械 `stage` | `status --json` 与门槛条件 | `target` | 交给哪个 skill | 交接输入与说明 |
|---|---|---|---|---|
| 无书根 / `empty`（网文点子模糊） | 无书根，或 `novel.bible === false && novel.chapters === 0 && series.length === 0`；只想先磨网文前提 | 先问定 | `fiction-planner` | 模糊想法与题材意向；卖点拍板后再建书。 |
| 无书根 / `empty`（网文创意已定） | 同上；准备从零建书 | 任意 | `fiction-init` | 书根路径与作者已确认终点；由 `fiction-init` 建骨架并写 `workflow.target`，仍为 `null` 才由本 skill 补写。 |
| 无书根 / `empty` / 无档案旧稿 | 外部散稿，或 `novel.chapters > 0 && novel.bible === false` | 任意 | `fiction-init`（作者要求反抽档案时请它先确认导入范围） | 旧稿路径、章卷映射意向、已公开章待核范围；改短剧（模式 C）也先走此步反抽档案。 |
| 无书根 / `empty`（仅原创短剧意向） | 不写网文，直接做原创短剧 | `script` / `storyboard` / `prompts` | `fiction-init` → `fiction-short-drama`（模式 B） | 交书根与已确认终点，搭最小骨架后由 `fiction-short-drama` 自行立项（不强走 `fiction-planner`）；缺 `fiction-init` 时按降级注明 `workflow.target` 待写入配置。 |
| 已建剧目录尚无分集 | `series[].stage === null`（全书 `stage` 可为 `empty`/`bible`/`novel`） | `script` / `storyboard` / `prompts` | `fiction-short-drama` | `series`、`series.md`、`adaptation-map.md`；若 `novel.bible === false` 先补最小档案骨架。 |
| `bible`（走网文路线，缺章规划） | `novel.bible === true && novel.chapters === 0`；卷规划缺目标章职责 | 任意（含写网文） | `fiction-planner` | 书根与 `bible/`；补齐大纲、卷规划与确认的起始章号（可为第 0 或第 1 章）。 |
| `bible`（走网文路线，规划就绪） | 同上；已确认卷规划含起始章职责 | 任意（含写网文） | `fiction-chapter` | 书根、卷号与卷规划确定的章号。 |
| `novel`（或 `script`/`storyboard`/`prompts` 切回写网文） | 常规网文连载；无论是否存在短剧目录 | `novel`（或本次任务为写网文） | `fiction-chapter` → `fiction-review` → 回 `fiction-chapter` | 缺下一章规划先交 `fiction-planner`；`fiction-chapter` 管起草、修稿与章后回写；跨章治理交 `fiction-continuity`。`target: novel` 已达终点，不推进已有或新建短剧。 |
| `novel`（启动小说改编模式 A） | `novel.bible === true && novel.chapters > 0 && series.length === 0` | `script` / `storyboard` / `prompts` | `fiction-short-drama`（模式 A） | 书根、`bible/` 与已定稿范围；从故事档案直通立项与映射。 |
| 任一短剧阶段：剧本门槛未过 | 目标集在 `episodes[]` 缺失（计划未写），或 `script !== "final"`（`null`/`draft`/`revised`），或映射缺行，或剧本侧有 `warnings`，或缺 `drama-check` / `lint --series` 通过报告 | `script` / `storyboard` / `prompts` | `fiction-short-drama` | **即使同集已有 `storyboard: final` 或 `prompts` 块，也必须先退回本 skill**；交 `series`、具体 `episode`、`episodes/`、`adaptation-map.md` 与 `warnings`。 |
| `script` / `storyboard` / `prompts` × `target: script` | 目标集均已过剧本门槛（`script: final` + 映射完整 + `drama-check` 与 `lint --series` 零阻断） | `script` | 停在剧本终点 | 已达当前终点；即使磁盘已有更高阶段文件也不推进分镜（按需可用 `fiction-review` 精修台词）。 |
| 进分镜 / 分镜门槛未过 | 目标集**已过剧本门槛**，但 `storyboard !== "final"`（`null`/`draft`/`revised`）、或 `assets === false`、或分镜/资产侧有 `warnings` | `storyboard` / `prompts` | `fiction-storyboard` | **点名 `series` 与具体 `episode`**、已定稿剧本、`adaptation-map.md`、`visual/` 与 `warnings`。 |
| `storyboard` / `prompts` × `target: storyboard` | 目标集均已过剧本门槛与分镜/资产门槛（`storyboard: final` + `assets: true` + `storyboard-check` 零阻断） | `storyboard` | 停在分镜终点 | 已达当前终点；即使磁盘已有提示词文件也不推进提示词。 |
| 提示词阶段（`target: prompts`） | 目标集**已过剧本门槛且已过分镜/资产门槛**；无论 `image`/`video` 为 `null`、`blocks === 0`、存在草稿/非法状态、`approved > 0`、`refs` 未齐，或需回填 | `prompts` | `fiction-visual-prompts` | **点名 `series` 与具体 `episode`**、分镜、`visual/assets.md`、`prompts/`、`refs` 与 `warnings`。由其运行 `prompt-check`、核对镜段覆盖与参考图就绪并向作者列批次确认；本 skill 绝不授权生成。提示词交付后停下即合法终点，作者在套件外生成后可按需回该 skill 回填。 |

## 横向事件与回退重跑表

回退严格按 [SB §3](formats/project.md)（上游优先）与 [SB §4.2](formats/project.md)（按事件写回）执行，只同步**已存在且受影响**的下游产物，不跳过任一阶段检查：

| 事件 | 路由与检查顺序 | 说明 |
|---|---|---|
| 新章确认公开发布 | `fiction-init`（「更新冻结清单」模式） | 仅由 `fiction-init` 更新 `frozen.ranges` 并跑 `lint.mjs --freeze`；排期或审核中不算已公开。 |
| 作者要求提交章节或已审简介 | `fiction-publish`（实验 extras） | 仅在作者要求提交时交接，附平台（当前仅 `fanqie`）、作品、作者确认的定稿或获准提交的 `publish/blurb.md` 及授权范围；未适配或缺已登录会话时只做本地交付。 |
| 局部技法或建 `bible/style-guide.md` | `fiction-craft` | 不代替 `fiction-chapter` 写章或 `fiction-review` 审校。 |
| 跨章矛盾、全局伏笔审计或卷末复盘 | `fiction-continuity`（需重排卷再交 `fiction-planner`） | 仅用于跨章或全局故事档案治理；单章章后回写归 `fiction-chapter`。 |
| 300+ 章高频跨卷查证 | `fiction-story-db`（可选 extras） | 派生索引建在 Markdown 之后；改事实先改 Markdown。 |
| 共享设定 / 人物稳定特征 / 未冻结小说章变动 | 设定与人物稳定特征交 `fiction-continuity`（正文先由 `fiction-chapter` / `fiction-review` 收口；冻结章只经作者拍板在 `bible/canon.md` 记口径）→ 对照 `adaptation-map.md` 找已存在且受影响的集交 `fiction-short-drama` → 受影响集已有分镜/提示词时接下一行 | 不回改冻结章正文。 |
| 已有下游产物的集数改了剧本 | `fiction-short-drama`（改剧本与映射，过 `drama-check` 与 `lint --series` 后重定稿）→ 已有受影响分镜与连戏交 `fiction-storyboard`（过 `storyboard-check`）→ 已有受影响提示词交 `fiction-visual-prompts`（过 `prompt-check`） | 顺序不可反；不碰未受影响的集。 |
| 分镜、连戏或最小资产条目 / 揭示门禁改动 | `fiction-storyboard`（过 `storyboard-check`）→ 若该集已有提示词，交 `fiction-visual-prompts`（过 `prompt-check`） | 最小资产条目归 `fiction-storyboard`。 |
| 仅改 `visual/assets.md` 完整外观、提示词称呼或锁定词 | `fiction-visual-prompts`（先重跑 `storyboard-check` 与 `--brief` 复核资产，再同步受影响提示词并过 `prompt-check`） | 完整外观与锁定词归 `fiction-visual-prompts`；动到共享设定或镜头设计则按上两行回退。 |

## 典型路由案例（钟表铺示例）

以下案例使用虚构的钟表铺世界（林砚、唐七、葛婶、闸房），仅示范状态判读、门槛分流与交接清单。

### 案例 1：纯创意起步，选定「只写网文」

- **现状**：无书根。作者问「我想写修旧钟表的悬疑网文，只写小说不做短剧，现在只有林砚和旧表铺的点子，该从哪开始？」
- **路由**：状态脚本「未运行（无书根）」；终点由作者定为 `novel`；点子尚模糊，先交 **`fiction-planner`** 收敛前提与卖点，拍板后再交 **`fiction-init`** 建骨架并写入 `workflow.target: "novel"`。开写时章号取自卷规划（不写死第 1 章）；进入连载后走 `fiction-chapter` → `fiction-review` → 回 `fiction-chapter`，不推销短剧。

### 案例 2：已有下游文件，但作者把终点降回 `novel`

- **现状**：`status --json` 返回 `stage: "prompts"`, `target: "prompts"`, `novel: { bible: true, chapters: 42, last_chapter: 42, frozen: 30 }`，另有短剧 `clock-ledger`。作者说「短剧先暂停，把终点切回只写网文，接下来继续写小说，另外第 31–35 章刚公开了」。
- **路由**：作者确认后，本 skill 更新 `.fiction/config.json` 的 `workflow.target` 为 `"novel"`；机械 `stage` 仍为 `prompts` 属正常，本次工作受 `novel` 限定、不推进短剧。① 第 31–35 章已公开 → 交 **`fiction-init`（「更新冻结清单」模式）**封存；② 查 `bible/volumes/` 下一章规划，有规划行则交 **`fiction-chapter`**，缺规划行则先交 **`fiction-planner`**。

### 案例 3：不写网文，直接做原创短剧

- **现状**：无书根。作者问「不写小说，直接用《钟表铺夜账》的点子做原创短剧，做到分镜为止，怎么开局？」
- **路由**：状态脚本「未运行（无书根）」，确认 `target: "storyboard"`，跳过网文合法。交 **`fiction-init`** 搭原创短剧最小骨架并写入 `workflow.target: "storyboard"`，再交 **`fiction-short-drama`（模式 B）**自行完成短剧立项与首批分集（不绕道 `fiction-planner`）。若缺 `fiction-init`，按降级行注明 `workflow.target` 待写入配置并保留作者已确认值。

### 案例 4：同一集上游未过门槛（含 `warnings` 与跨集混进度）

- **现状**：`status --json` 返回 `stage: "prompts"`, `target: "prompts"`, `series[0]` 为 `clock-ledger`（`assets: true`, `refs: { total: 10, done: 4 }`）：
  - 第 1 集：`script: "final"`, `storyboard: "final"`, `image: { blocks: 12, approved: 0, done: 0 }`, `video: { blocks: 4, approved: 2, done: 0 }`（无 `warnings`）
  - 第 2 集：`script: "draft"`, `storyboard: "final"`, `video: { blocks: 3, approved: 1, done: 0 }`（`warnings` 含 `episodes/ep002.md` 解析提醒）
  - 第 3 集：在 `adaptation-map.md` 中已规划，但未出现在 `episodes[]`（磁盘尚无文件）
- **路由**（逐集核门槛，绝不凭 `approved > 0` 授权生成）：
  1. **第 2 集 → 退回 `fiction-short-drama`**：尽管分镜已 `final` 且视频有 `approved: 1`，但剧本仍为 `draft` 且有 `warnings`，未过剧本门槛，严禁送往提示词或生成；先交 `fiction-short-drama` 修剧本、补映射并过 `drama-check` 与 `lint --series`，之后再按步骤 5 回退核对已有分镜与提示词。
  2. **第 1 集 → `fiction-visual-prompts`**：已过剧本与分镜/资产门槛；交 `fiction-visual-prompts` 跑 `prompt-check`、核对镜段覆盖、参考图与当前批次确认（本 skill 不代授权生成）。
  3. **第 3 集 → `fiction-short-drama`**：对照 `adaptation-map.md` 发现未建档，按集号交其起草。

### 案例 5：已有分镜与提示词后修改剧本，且缺少 `fiction-storyboard`

- **现状**：`target: "prompts"`，作者要改写 `clock-ledger` 第 1 集林砚与唐七的台词；该集已有 `storyboards/ep001.md` 与 `prompts/ep001-*.md`，且当前环境未安装 `fiction-storyboard`。
- **路由**：按 [SB §4.2](formats/project.md) 顺序回退——① 先交 **`fiction-short-drama`** 改 `episodes/ep001.md` 与 `adaptation-map.md`，跑 `drama-check` 与 `lint --series` 至零阻断并重定稿；② 第二步需 `fiction-storyboard` 但未安装，在此停下按降级行交付：已重定稿的 `episodes/ep001.md`、`adaptation-map.md`、现有 `storyboards/ep001.md` 与 `visual/`，请作者手修分镜与连戏表，明确注明前置 `drama-check`、防剧透 `--brief` 与 `storyboard-check` 未运行，不跳过分镜直接交 `fiction-visual-prompts`。
