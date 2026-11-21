# 全流水线概览

## 目录

- [套件原则](#套件原则)
- [阶段 0：建书与导入（`empty` → `bible`）](#阶段-0建书与导入empty--bible)
- [阶段 1：大纲与卷级规划（`bible`）](#阶段-1大纲与卷级规划bible)
- [阶段 2：网文连载（`novel`）](#阶段-2网文连载novel)
- [阶段 3：竖屏短剧分集剧本（`script`）](#阶段-3竖屏短剧分集剧本script)
- [阶段 4：分镜与最小视觉资产（`storyboard`）](#阶段-4分镜与最小视觉资产storyboard)
- [阶段 5：图片与视频提示词（`prompts`）](#阶段-5图片与视频提示词prompts)
- [横向配套与可选扩展](#横向配套与可选扩展)

## 套件原则

1. **任一阶段均可作终点**：全链路为「创意 → 网文 → 分集剧本 → 分镜 → 图片 / 视频提示词」，停在 `novel`、`script`、`storyboard` 或 `prompts` 都是完整项目（[SB §2](formats/project.md)）。
2. **支持原创短剧直入**：不写网文也可直接进入短剧阶段，跳过网文阶段不算缺失。
3. **Markdown 为唯一权威**：设定、正文、剧本、分镜与提示词均保存在主写 Markdown 文件中，主写入口登记在 `bible/sources.md`（[SB §1](formats/project.md)、[SB §5](formats/project.md)）。
4. **上游优先与诚实分工**：冲突裁决与上游改动回退遵守 [SB §3](formats/project.md) 与 [SB §4.2](formats/project.md)；脚本只保证机械规则，内容判断归模型，拍板、定稿、合规、发布与外部生成归作者。

## 阶段 0：建书与导入（`empty` → `bible`）

- **负责 skill**：`fiction-init`（网文模糊点子可先由 `fiction-planner` 收敛）。
- **产出路径**（[SB §2](formats/project.md)）：`AGENTS.md`、`.fiction/config.json`（[SB §8](formats/config.md)）、`bible/sources.md`、`bible/` 下基础故事档案、`bible/volumes/{vol}.md` 与 `chapters/{vol}/vol-info.md`；旧稿导入另产 `chapters/{vol}/{ch}/v{n}.md`、`.fiction/frozen.json` 与 `bible/drafts/import-*.md`。
- **把关检查**：导入时跑 `length.mjs`、`lint.mjs` 记基线，对已公开章跑 `lint.mjs --freeze`；书根、口径、映射与公开范围由作者确认。
- **完成定义**：项目基础骨架就位；旧稿导入的映射、冻结范围与合入条目均经作者确认。

## 阶段 1：大纲与卷级规划（`bible`）

- **负责 skill**：`fiction-planner`（文风与题材口径配合 `fiction-craft`，新伏笔/支线入账配合 `fiction-continuity`）。
- **产出路径**（[SB §2](formats/project.md)）：`publish/blurb.md`、`bible/plot-outline.md`、`bible/volumes/{vol}.md`、`chapters/{vol}/vol-info.md`；按需配合 `fiction-craft` 建 `bible/style-guide.md`。
- **把关检查**：已有项目重排或开新卷前跑 `foreshadow-scan.mjs`；`publish/blurb.md` 交 `fiction-review` 做 `lint.mjs` 与审校；定位、文案与卷方案由作者拍板。
- **完成定义**：目标卷的 `bible/volumes/{vol}.md` 章节规划表经作者确认，并按 `volumes/{vol}.md` → `plot-outline.md` → `vol-info.md` 顺序落盘（[SB §4.2](formats/project.md)）。

## 阶段 2：网文连载（`novel`）

> **可作为完整终点（`workflow.target: "novel"`）**。

- **负责 skill**：`fiction-chapter`（章纲、正文、结构重写、章后回写）、`fiction-review`（审校、获准局部回修、跨章复核）；跨章或全局档案治理交 `fiction-continuity`。
- **产出路径**（[SB §2](formats/project.md)）：`chapters/{vol}/{ch}/resources.md`、`outline.md`、`v{n}.md`，每章回写的 `bible/` 主写档案，以及完卷时的 `chapters/{vol}/summary.md` 与 `chapters/{vol}/vol-info.md`。
- **把关检查**：`brief.mjs`（写前汇总）、`length.mjs`（字数底线）、`lint.mjs`（硬规则与全书冻结校验）、`foreshadow-scan.mjs`（章后回写与档案校验）；编辑阅读归模型，设定与改稿授权归作者。
- **完成定义**：单章字数达标、`lint` 零阻断、审校闭环完成，且章后回写通过 `foreshadow-scan` 核对；达 `novel` 终点时保持连载循环即可。

## 阶段 3：竖屏短剧分集剧本（`script`）

> **可作为完整终点（`workflow.target: "script"`）**；支持小说 `bible/` 改编（模式 A）与无网文原创起步（模式 B）。

- **负责 skill**：`fiction-short-drama`（纯台词文笔精修可按需交 `fiction-review`）。
- **产出路径**（[SB §2](formats/project.md)）：`drama/{series}/series.md`、`drama/{series}/adaptation-map.md`、`drama/{series}/episodes/ep{NNN}.md`，以及如有新增时的 `bible/characters.md` 短剧专属人物块（不回写小说 `bible/foreshadows.md`）。
- **把关检查**：`drama-check.mjs`（格式、估算时长、卡点、映射与新增建议项）、`lint.mjs --series`（硬规则与脱敏）；戏剧效果归模型，立项参数、砍线并人、卡点、合规/版权与剧本 `定稿` 归作者。
- **完成定义**：目标批次或全剧剧本两项机检均零阻断、映射表完整、合规已确认，且作者将目标分集标为 `状态：定稿`。

## 阶段 4：分镜与最小视觉资产（`storyboard`）

> **可作为完整终点（`workflow.target: "storyboard"`）**。

- **负责 skill**：`fiction-storyboard`（不改上游剧本，问题退回 `fiction-short-drama`）。
- **产出路径**（[SB §2](formats/project.md)）：`drama/{series}/visual/assets.md`（最小条目与揭示门禁，不写锁定词）、`drama/{series}/visual/continuity.md`、`drama/{series}/storyboards/ep{NNN}.md`。
- **把关检查**：入口门槛（剧本定稿 + 映射完整 + `drama-check.mjs` 零阻断）、开工前 `storyboard-check.mjs --brief`、完稿后 `storyboard-check.mjs`（结构、时长、台词认领、依据、资产、防剧透与连戏）；镜头语言归模型，视觉基调与分镜 `定稿` 归作者。
- **完成定义**：在 `status` 的 `assets: true`（`storyboard-check` 输出里对应 `assets.exists: true`） 且目标集被覆盖前提下通过 `storyboard-check`（零阻断），定稿后复跑仍零阻断；上游剧本变动时须按 [SB §4.2](formats/project.md) 先重跑本阶段。

## 阶段 5：图片与视频提示词（`prompts`）

> **套件终站（`workflow.target: "prompts"`）**；本套件不调用任何生成接口，交付提示词后即可停下。

- **负责 skill**：`fiction-visual-prompts`（镜头设计与段时长问题退回 `fiction-storyboard`，[SB §3](formats/project.md)）。
- **产出路径**（[SB §2](formats/project.md)）：补全后的 `drama/{series}/visual/assets.md`（完整外观、提示词称呼与锁定词）、`drama/{series}/prompts/assets-image.md`、`drama/{series}/prompts/ep{NNN}-image.md`、`drama/{series}/prompts/ep{NNN}-video.md`，以及经作者核对官方文档后写入 `.fiction/config.json` 的方言参数；作者若在套件外生成成品，可按需放置文件（如 `drama/{series}/visual/refs/`）并回填。
- **把关检查**：入口门槛（`storyboard-check.mjs` 零阻断 + `--brief`）、`prompt-check.mjs`（块结构、引用、已出文件存在性、内部编号与脱敏、台词包含、锁定词提示、防剧透、长度与方言参数比较）；画面与声音匹配归模型，方言核对、是否外部生成与成品验收归作者。
- **完成定义**：目标集提示词通过 `prompt-check`（零阻断）、覆盖计划镜段并交付作者即可作为终点；外部生成与回填 `文件` / `状态：已出` 为作者按需执行的后续动作。

## 横向配套与可选扩展

| skill | 定位 | 何时介入 | 备注 |
|---|---|---|---|
| `fiction-workflow`（本 skill） | 总入口与路由 | 查进度、选/改终点、确认下一步或排回退顺序 | 只跑 `status.mjs`，绝不代做兄弟 skill 的活。 |
| `fiction-craft` | 技法库与题材包 | 解决局部写作技法问题、查题材包或建 `bible/style-guide.md` | 无脚本；口径以项目 `AGENTS.md`「本书口径」为先（[SB §3](formats/project.md)）。 |
| `fiction-continuity` | 故事档案后台 | 跨章矛盾裁决、全局伏笔/支线审计、卷末复盘或合并讨论稿 | 绝不修改冻结章正文。 |
| `fiction-init`（冻结模式） | 冻结清单维护 | 新章节确认公开发布后更新 `frozen.ranges` 并跑 `lint.mjs --freeze` | 唯一负责封存的 skill。 |
| `fiction-story-db`（可选 extras） | 长篇派生索引 | 仅网文约 300 章以上高频跨卷检索时启用 | 可随时重建，不替代 Markdown（[SB §1](formats/project.md)）。 |
| `fiction-publish`（实验 extras） | 平台提交 | 作者明确要求向已适配平台提交定稿章节或已审简介时 | 依赖作者已登录会话与授权；未适配或缺会话时仅做本地交付。 |
