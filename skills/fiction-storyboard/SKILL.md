---
name: fiction-storyboard
description: >-
  竖屏短剧分镜工作流：基于已定稿且过检的分集剧本，先做防剧透简报与视觉资产最小建档，再按“段（一次视频生成）→ 镜（段内剪切）”拆解分镜，逐镜核对台词认领、动作依据、竖屏构图、单瞬起止与跨集连戏，最后跑脚本验收并交接下游提示词。作者说“画分镜”“拆镜头”“做场景脚本”“切镜”“把第几集转成分镜”“剧本改了同步分镜”时就用，即使没提“分镜”二字。写或改分集剧本（含改台词）请用 fiction-short-drama；补全资产锁定词、写图片/视频提示词或做付费生成确认请用 fiction-visual-prompts。
  Vertical short-drama storyboard workflow: turn finalized, validated episode scripts into segment-and-shot storyboards with spoiler briefs, minimal visual asset entries, continuity tracking, verbatim dialogue/action claiming, 9:16 vertical framing, single-instant start-to-end shot design, and automated storyboard validation. Use when asked to storyboard an episode, break a script into shots, cut segments, or sync storyboards after script edits. Use fiction-short-drama for writing or editing episode scripts and dialogue, and fiction-visual-prompts for full asset locks, reference-image slots, and image/video prompts.
license: MIT
compatibility: 遵循 Agent Skills 规范；脚本需要 Node.js 22.5+。
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---

# 竖屏短剧分镜

把已定稿且通过机检的分集剧本拆成可拍摄、可对账的两级分镜（段 → 镜），同步维护最小视觉资产条目与跨集连戏表。

## 何时用 / 不用

- **用本 skill**：把 `drama/{series}/episodes/ep{NNN}.md` 拆成分镜；为本集入画的人物、地点、道具建最小资产条目或变体；维护跨集连戏状态；剧本修订定稿后同步更新既有分镜。
- **写或改分集剧本（含改台词、补映射行、定稿）**：交给 `fiction-short-drama`。本 skill 绝不改动剧本正文或台词；剧本未定稿、映射缺行、机检有阻断或动作拍不出来时退回上游。未装 `fiction-short-drama` 时，列出未定稿状态、缺失映射行或具体报错与行号，请作者手改后再继续。
- **补全资产完整外观与锁定词、写参考图槽位、写图片 / 视频提示词、做付费生成前确认**：交给 `fiction-visual-prompts`。本 skill 绝不代写 `锁定词`，不在分镜里写提示词或模型参数，也不调用任何生成接口。
- **判断项目所处阶段**：交给 `fiction-workflow`；未装时直接向作者核对目标系列与集号。

缺少下游 `fiction-visual-prompts` 时，交付已通过检查的分镜、资产库与连戏表，明确注明 **`prompt-check` 未运行（本 skill 不代跑）**，并交出下游手做清单：补全资产完整外观与 `锁定词`、在 `drama/{series}/prompts/` 写参考图槽位与分集图片 / 视频提示词、按段号与镜号核对无误后再由作者决定是否生成。

## 开始前

先在书根读 `AGENTS.md`（尤其「本书口径」）、`.fiction/config.json`、`bible/sources.md`（主写入口注册表，见 [SB §5](references/formats/project.md)）。再按任务最小必读顺序（[SB §4.1](references/formats/project.md)）读取：

- **画分镜**：该集剧本 `drama/{series}/episodes/ep{NNN}.md` → `storyboard-check.mjs --brief` 输出 → `drama/{series}/visual/assets.md` → `drama/{series}/visual/continuity.md`；按需补读上一集分镜最后一段与出场人物的 `bible/characters.md` 条目；原创剧（`series.md` 为 `来源：原创`）另读 `drama/{series}/series.md` 的 `## 悬念账`。
- **建 / 改视觉资产**：`drama/{series}/series.md` → `bible/characters.md`（主要人物与本集出场人物）→ `drama/{series}/visual/assets.md` → 已写剧本中出现的地点与道具；涉及伏笔、器物或年代制式时按需补读 `bible/inventory.md`、`bible/foreshadows.md`、`bible/timeline.md`、`bible/world-rules.md`。

写入或修改任何机读文件前，先打开文末参考文档表里对应的格式摘录，照原文写，不凭印象。

短剧视觉链按上游优先裁决（[SB §3](references/formats/project.md)）：`characters.md` 稳定特征 > `visual/assets.md` > 分镜 > 提示词；剧本 > 分镜 > 提示词。发现上游有误先回上游改，不在分镜里另起说法。

缺项目骨架时提示先用 `fiction-init`；未装 `fiction-init` 时，请作者先按 [SB §2](references/formats/project.md)、[SB §5](references/formats/project.md) 与 [SB §8](references/formats/config.md) 手补 `AGENTS.md`（含 `## 本书口径`）、`.fiction/config.json`、`bible/sources.md`、`bible/characters.md` 及 `drama/{series}/` 必需文件。仅缺 `.fiction/config.json` 时脚本按契约默认值运行（[SB §8](references/formats/config.md)），告知作者。

路径约定：以 `bible/`、`drama/{series}/` 开头的路径相对书根；正文中简写的 `visual/...`、`storyboards/...`、`episodes/...` 均相对 `drama/{series}/`。所有脚本从书根运行，路径含空格时加引号。

## 七步流程

### 1. 开工前检：确认定稿与映射，再跑剧本检查和简报

进入拆镜（含后续剧本返修同步）前，先逐项核验三道入口门槛：

1. **剧本已定稿**：打开 `drama/{series}/episodes/ep{NNN}.md`（[SB §9.3](references/formats/drama.md)），确认元数据为 `- 状态：定稿`（由作者定稿）。
2. **映射行完整**：打开 `drama/{series}/adaptation-map.md`（[SB §9.2](references/formats/drama.md)），确认目标集存在对应行且人物、伏笔列已按本集补齐（缺行虽只报 `map-missing` 建议，但会让简报漏掉本集映射人物及其秘密）。
3. **剧本机检全绿**：运行（用法见 `drama-check.mjs --help`）：

```text
node <本 skill 目录>/scripts/drama-check.mjs <series> --ep <N>
```

须**退出码为 0**，且**系列级与目标集均零 `block`**（退出码 2 为参数、配置或读取错误，不算通过）。以上任一项不满足，**停下并退回 `fiction-short-drama`**（未装则列明缺口与报错行号请作者手修）。若存在 `unshootable`、`dialogue-run` 等 `suggest`，能靠拆镜化解的继续，实在拍不出的请作者先改剧本。

入口门槛通过后，跑分镜简报（用法见 `storyboard-check.mjs --help`）：

```text
node <本 skill 目录>/scripts/storyboard-check.mjs <series> --ep <N> --brief
```

逐节通读全部五节：`## 来源`、`## 本集不得画出的真相`（来源于 `adaptation-map.md` 任一行或任一资产 `揭示伏笔` 中的未早收伏笔）、`## 人物秘密`（来源于本集映射 `人物` 列与 `series.md` `主要人物` 中填了 `作者真相` 者）、`## 尚不可用的资产`、`## 连戏现状`。若 `series.md` 为 `来源：原创`，简报不会扫描原创悬念，**须手工补读 `drama/{series}/series.md` 的 `## 悬念账`**，一并纳入防剧透清单。

### 2. 建最小视觉资产与记连戏净变化

按 [SB §9.4](references/formats/storyboard.md) 与 [SB §6.1](references/formats/storyboard.md) 更新 `drama/{series}/visual/assets.md`（首次建档参考 [视觉资产模板](assets/assets.template.md)）：

- **最小条目原则**：仅为本集需入画的人物、地点、道具建 `### {资产键}` 与一行可见 `- 外观：`（地点可补 `锚点`，确有 `bible/inventory.md` 对应条目的道具补 `- 物品：Ixxx`，涉密条目补 `- 揭示伏笔：` 或 `- 揭示集：`）。**不写 `锁定词`**，完整外观润色与参考图槽位留给 `fiction-visual-prompts`。首次建档时仅在画幅异于 config `visual.aspect_ratio` 时写 `画幅`，并与作者确认全剧基本 `画风`。
- **规范名与变体**：`## 人物` 用 `bible/characters.md` 规范名，无档案群演不建条目；同一名称不跨组重复；造型或状态变化用 `名称@变体名`（同组须先有本体条目）。三层不混写，细则见[视觉资产写法指南](references/assets-guide.md)。
- **刷新简报**：只要本步**新增或修改了任何 `揭示伏笔` / `揭示集`**，须立刻重跑一次 `node <本 skill 目录>/scripts/storyboard-check.mjs <series> --ep <N> --brief`，把新纳入的伏笔真相与门禁资产同步进本集核对清单。

若本集存在会延续到后续集的状态变化（换装、持续伤污、道具转手/损毁/退场、地点持久变动），按 [SB §9.5](references/formats/storyboard.md) 直接把本集净变化写入 `drama/{series}/visual/continuity.md`（首次建表参考 [跨集连戏表模板](assets/continuity.template.md)），让步骤 6 的机检一次验收。遇到简报中 `continuity.md` 与 `bible/inventory.md` 不一致时，除已有作者批准并记入 `adaptation-map.md` 的改编口径外，其余差异全部并列请作者裁决，**绝不回写小说 `bible/inventory.md`**；细则见[跨集连戏指南](references/continuity.md)。

### 3. 先分段，再切镜

打开 [SB §9.6](references/formats/storyboard.md) 与 [SB §6.1](references/formats/storyboard.md)，按 [分镜模板](assets/storyboard.template.md) 编写 `drama/{series}/storyboards/ep{NNN}.md`，初始写 `- 状态：初稿`。

1. **先分段（`## SEG01｜场景1`）**：一段 = 一次视频生成，**绝不跨场景**。常规按剧情单元分成 9–15 秒的段（短过场单拍可短于 9 秒），总时长不得超过 `storyboard.segment.max_seconds`（默认 15 秒，见 [SB §8](references/formats/config.md)）。必填 `地点`，按需填 `站位`、`环境声`、`配乐`。
2. **段内切镜（`### SH001｜3s`）**：单镜围绕 3 秒落刀，落在 `storyboard.shot.seconds`（默认 2–5 秒），时长不得为 0。必填 `景别`（6 项闭集）与 `画面`，按需填 `运镜`（8 项闭集，默认 `固定`）、`转场`（4 项闭集，默认 `切`）、`人物`、`道具`、`依据`、`声音`、`备注`。
3. **原文认领台词与动作**：
   - **台词**：按剧本顺序原样复制该场景每句对白进镜块（含标点与适用的 `（OS）` / `（VO）`），**不改字、不删词**。单句台词按 `drama.chars_per_minute`（默认 250 码点/分，不取整）换算秒数装不进单镜时，拆成相邻镜头的合法对白行，拼合后须与原句逐字一致。
   - **动作与镜头行**：把 `△` 动作行与 `【…】` 镜头行的原文片段原样摘入 `- 依据：`（每段至少 4 个码点，多段用 `；` 分隔），并确保 `画面` 真正把动作演出来。
4. **镜头语言与竖屏构图**：全集第 1 镜**必须有运动主体**；景别远近相间、时长长短相间；对话切正反打并留反应镜，关键动作插短特写；在动作中途切镜（动接动）；一段内**最多 1–2 次非固定运镜**，默认 `固定`；9:16 竖屏少用空荡远景，靠前中后景拉纵深、借人物动作带出环境，机位、角度、焦段写入 `画面`。细则见[分段切镜语法](references/shot-grammar.md)与[竖屏构图与画面写法](references/vertical-framing.md)。
5. **保持编号稳定**：插镜用新号或字母后缀（如 `SH003a`），不顺延改旧号，不复用已删编号。

### 4. 按单瞬原则写清 `画面`

每镜 `画面` 按 **「起点 → 动作 → 终点」** 组织，使下游 `fiction-visual-prompts` 写首帧提示词时只定格起点一瞬、不提前抢跑过程或结果。仅当某镜收尾构图或接力姿态必须锁死时，在 `备注` 注明建议下游加写尾帧提示词。写法见[单瞬与首尾帧边界](references/single-instant.md)。

### 5. 逐镜过防剧透核对

对照最新 `--brief` 清单（以及原创剧 `series.md` 的 `## 悬念账`），逐镜并连同段级 `站位`、`环境声`、`配乐` 及镜级 `画面`、`声音`、`备注` 一起核对：

- 不直接引用 `尚不可用的资产`（触发 `sb-spoiler` 阻断），也不换说法在画面文字里泄露 `本集不得画出的真相`、`人物秘密` 或原创 `悬念账`；标「本集揭示」的伏笔在揭示镜头之前同样藏住。
- 需提前入画但不能露底时，用背影、前景遮挡、借原有光源逆光剪影或局部取景；本体受门禁限制时建 `揭示集：1` 遮挡变体，并向 `fiction-visual-prompts` 交接禁挂本体参考图与须清空继承字段的提醒（[SB §9.9](references/formats/storyboard.md)）。拿不准尺度时停下来问作者。细则见[防剧透逐镜核对](references/spoiler-guard.md)。

### 6. 跑机检、核覆盖、定稿与剧本返修同步

写完分镜与本集连戏净变化后，从书根运行（用 `--json` 便于核对覆盖与时长汇总，用法见 `storyboard-check.mjs --help`）：

```text
node <本 skill 目录>/scripts/storyboard-check.mjs <series> --ep <N>
node <本 skill 目录>/scripts/storyboard-check.mjs <series> --ep <N> --json
```

- **确认真正跑过全量检查**：不仅要求退出码 0、零 `block`，还须在输出里核实 **`assets.exists` 为 `true`**（无 `va-missing`，否则资产、防剧透与连戏检查会被跳过）且 **目标集 `N` 出现在 `episodes[]` 中**（确认目标集分镜已被实际校验）。退出码 2 不算通过。
- **逐条处置 `suggest`**：决定修改或保留并记明理由。注意任何非空 `备注` 都会静默豁免该镜的 `sb-people` 与 `sb-continuity`，因此凡带 `备注` 的镜头须人工复核连戏是否真的正确（[跨集连戏指南](references/continuity.md)）。
- **定稿与失败回退**：清零全部 `block`、核实场景与台词无漏认领、取得作者对存疑项与定稿的确认后，才将 `状态` 改为 `定稿` 并最后重跑一次 `storyboard-check.mjs`。`定稿` 下 `sb-dialogue-missing` 与 `sb-scene-uncovered` 会升为 `block`；**若重跑出现任何 `block` 或非零退出码，立即把 `状态` 退回 `初稿` 或 `修改`**，修完重验，绝不带错交接。
- **剧本后期修订时的同步流程**：
  1. 先按步骤 1 确认修订后的剧本已重新定稿、映射行已更新，并跑 `node <本 skill 目录>/scripts/drama-check.mjs <series> --ep <N>` 确认退出码 0 且零阻断。
  2. 跑 `node <本 skill 目录>/scripts/storyboard-check.mjs <series> --ep <N>` 定位过期的台词与 `依据`，**先修分镜并保持未动编号稳定**。
  3. 若剧本改动影响了跨集状态，先修订 `drama/{series}/visual/continuity.md`（[SB §9.5](references/formats/storyboard.md)）中该集原行，再对受影响的后续集跑 `node <本 skill 目录>/scripts/storyboard-check.mjs <series> --ep <N>-<末集>` 并同步修正。
  4. 全部过检后，把本集及受影响后续集的变动 `SEG` / `SH` 清单交接给 `fiction-visual-prompts` 同步提示词（[SB §4.2](references/formats/project.md)），顺序不可颠倒。

### 7. 汇报与交接

按下方格式向作者汇报，并明确是否交接给 `fiction-visual-prompts`。

## 交付检查

- [ ] `drama-check.mjs <series> --ep N` 退出码 0、系列级与目标集零 `block`，`adaptation-map.md` 本集行完整（无 `map-missing`）。 `[脚本]`
- [ ] 目标集剧本已由作者定稿（`状态：定稿`）。 `[作者]`
- [ ] 本 skill 未改动任何剧本台词、动作或剧情；需改剧本已退回上游。 `[模型]`
- [ ] 开工前已跑 `storyboard-check.mjs --ep N --brief` 并读完全部五节；修改揭示字段后已刷新简报；原创剧已手工核对 `series.md` `## 悬念账`。 `[模型]`
- [ ] `visual/assets.md` 已为本集入画人物（规范名）、地点、道具与必要变体建最小条目，未代写 `锁定词`。 `[模型]`
- [ ] `storyboard-check.mjs <series> --ep N` 退出码 0、零 `block`，且输出确认 `assets.exists: true`、目标集在 `episodes[]` 内；定稿后重跑通过。 `[脚本]`
- [ ] 所有 `suggest` 已逐条处置；带 `备注` 的镜头已人工复核连戏；本集跨集净变化已写入 `visual/continuity.md`，未回写小说 `inventory.md` 或 `foreshadows.md`。 `[模型]`
- [ ] 第 1 镜有运动主体；景别与时长有起伏；每段非固定运镜 ≤2 次；剧本动作行真正落实为 `画面` 表演（不只挂 `依据`）；`画面` 按单瞬「起点 → 动作 → 终点」写成；竖屏纵深清晰。 `[模型]`
- [ ] 已逐镜并连同段级字段对照禁画清单核对，无换说法泄底。 `[模型]`
- [ ] 视觉基调、重头戏拍法、防剧透存疑、跨侧道具差异与分镜定稿均已由作者拍板。 `[作者]`

## 产出与汇报

产出或更新：`drama/{series}/storyboards/ep{NNN}.md`、`drama/{series}/visual/assets.md`、按需更新 `drama/{series}/visual/continuity.md`。汇报分五条：

1. **分镜规模与时长**：从 `storyboard-check.mjs --ep N --json` 的 `episodes[]` 取集号、路径、`status`、`segments`、`shots`、`seconds` 与 `range`（`range` 为 `null` 时报「未设目标时长」；超出区间属建议项，说明调整或保留理由）。
2. **机检结果**：`drama-check` 与 `storyboard-check` 退出码与 `block` 数（均须为 0），确认 `assets.exists: true` 且目标集已检；列出未消除的 `suggest` 及每条理由。
3. **资产与连戏变动**：本轮在 `visual/assets.md` 新建的最小条目与变体（含需下游注意的遮挡变体继承项）；在 `visual/continuity.md` 新增或修订的行。
4. **返修同步范围**（仅返修时）：本集及受影响后续集的变动 `SEG` / `SH` 编号清单，供 `fiction-visual-prompts` 同步。
5. **待作者确认**：防剧透存疑、跨侧物品差异、重头戏拍法或需退回剧本修改之处；无则写「无」。

## 参考文档

| 遇到…… | 读哪份 |
| --- | --- |
| 查目录路径、视觉链冲突裁决、最小必读顺序与按事件写回 | [SB §1–§5：项目结构与读写规则](references/formats/project.md) |
| 核对分集剧本、场景头、对白行与映射表格式 | [SB §6.1、§9–§9.3：短剧剧本](references/formats/drama.md) |
| 写视觉资产、跨集连戏表、分镜字段、闭集词表与防剧透规则 | [SB §6.1、§9.4–§9.6、§9.9：视觉资产与分镜](references/formats/storyboard.md) |
| 查画幅、段镜时长、人数上限、语速等 config 默认值 | [SB §8：项目配置](references/formats/config.md) |
| 分段切镜、跨镜拆台词、非固定运镜计数、第 3 集示范 | [分段切镜语法](references/shot-grammar.md) |
| 9:16 竖屏构图、前中后景纵深、机位焦段写入 `画面` | [竖屏构图与画面写法](references/vertical-framing.md) |
| 写「起点 → 动作 → 终点」、区分首帧单瞬与何时标尾帧 | [单瞬与首尾帧边界](references/single-instant.md) |
| 写资产三层边界、地点相对方位与锚点、道具筛选与字迹规则 | [视觉资产写法指南](references/assets-guide.md) |
| 用 `--brief` 与原创悬念账逐镜防剧透、四种藏法、遮挡变体 | [防剧透逐镜核对](references/spoiler-guard.md) |
| 写跨集净变化、变体解析、闪回豁免、与 `inventory.md` 差异处理 | [跨集连戏指南](references/continuity.md) |
| 新建分镜、资产库或跨集连戏表骨架 | [分镜模板](assets/storyboard.template.md)、[视觉资产模板](assets/assets.template.md)、[跨集连戏表模板](assets/continuity.template.md) |
