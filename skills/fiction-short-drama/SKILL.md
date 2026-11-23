---
name: fiction-short-drama
description: >-
  竖屏短剧改编与原创剧本闭环：立项、分集大纲与章集映射、分批写分集剧本、前 3 秒钩子与付费卡点设计、机检与映射回写。涉及改编短剧、把小说改成竖屏短剧、写短剧剧本 / 分集剧本、分集大纲、章集映射、付费卡点、前 3 秒钩子、断章、原创短剧、续写下一集短剧、检查短剧格式与时长时使用。建项目用 fiction-init；小说策划用 fiction-planner；写小说用 fiction-chapter；改共享档案用 fiction-continuity；润色用 fiction-review；转分镜用 fiction-storyboard；路由用 fiction-workflow。
  Vertical short-drama adaptation and original scripting workflow: series setup, episode outlines, chapter-to-episode mapping, batched episode scripts, first-3-second hooks, cliffhangers, paywall breaks, and script checks. Use when adapting a novel into a vertical short drama, writing or continuing short-drama episodes, planning episode outlines or maps, placing paywalls, or checking script format and duration. Use fiction-init for setup, fiction-planner for novel planning, fiction-chapter for novel chapters, fiction-continuity for shared bible edits, fiction-review for polish, fiction-storyboard for storyboards, and fiction-workflow for routing.
license: MIT
compatibility: 遵循 Agent Skills 规范；脚本需要 Node.js 22.5+。
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---

# 竖屏短剧剧本

把已有小说的 story bible（故事设定档案）或原创短剧创意，落成可拍、可机检的竖屏短剧分集剧本与章集映射，并与下游分镜衔接。

## 何时用 / 不用

- **用本 skill**：把小说改编成竖屏短剧、从创意写原创短剧、做分集大纲与章集映射、设计前 3 秒钩子 / 断章 / 付费卡点、分批起草、续写或获准返修分集剧本、只读检查既有短剧的格式与时长。
- **不用本 skill（边界与未安装时的降级）**：
  - `fiction-init`：搭项目骨架（`AGENTS.md`、配置、`sources.md`、bible 文件）。无项目时先请作者运行它；未安装时，本 skill 仅按 [SB §6.2](references/formats/bible.md)、[SB §6.4](references/formats/bible.md) 创建 `bible/characters.md` 和空表头的 `bible/foreshadows.md`（缺少任一文件会导致 `drama-check.mjs` 以退出码 2 报错），告知作者哪些文件缺失、哪些暂用契约默认，并把补齐骨架列为待办。
  - `fiction-planner`：小说创意策划、卖点变体、题材定位与卷纲规划。只做原创短剧时，本 skill 自行完成短剧立项（梗概、情绪承诺、主角诉求、反派筹码、单元切分）；只有作者同时想写成小说或大范围探索题材卖点时才转交它。未安装时只完成短剧侧立项。题材共性在已安装 `fiction-craft` 时查其题材包。
  - `fiction-chapter`：写小说正文。改编进度超过小说已写章节时，映射表规划行可指向未写章（`drama-check.mjs` 报 `map-source` 建议），但绝不代写小说正文；未安装时仅保留规划行待作者补章。
  - `fiction-continuity`：维护共享 bible（设定裁决、已有共享人物、伏笔表、时间线）。本 skill 只在 `bible/characters.md` 追加带 `范围：短剧:{series}` 的短剧专属人物块（[SB §6.4](references/formats/bible.md)、[SB §9.1](references/formats/drama.md)），不改其他 bible 文件；未安装时把需改动的共享设定交作者落盘。
  - `fiction-review`：对白与动作文笔精修。若作者只请求审校，先交付文笔意见，**仅在作者明确授权后才回修正文**；结构、时长、卡点、映射与硬规则由本 skill 自跑 `drama-check.mjs` 与 `lint.mjs --series` 把关；未安装时仅交付结构与机检结论，标明未做文笔精修。
  - `fiction-storyboard`：下一阶段（分集剧本 → 分镜）。`fiction-workflow`：跨阶段路由。缺任一下游 skill 时，交付已有文件、下一步待办与未跑检查，不代做其职责。

## 开始前（步骤 0）

依次打开项目根目录的 `AGENTS.md`（尤其「本书口径」）、`.fiction/config.json`（关注 `drama.*`，见 [SB §8](references/formats/config.md)）、`bible/sources.md`（主写入口表，[SB §5](references/formats/project.md)）。写法优先级：项目「本书口径」> `bible/style-guide.md` > 本 skill 默认（[SB §3](references/formats/project.md)）。下文的创作数字均为可调默认，机读格式按契约执行。

**在写入或修改任何机读文件之前，先打开文末参考表里对应的格式摘录，照里面的格式写，不凭印象。**

先判**任务入口（三选一）**，再看作品来源：

1. **新建剧集**：尚未立项，按来源走完整流程（步骤 1 起）。
2. **续写 / 获准返修**：先读已有 `drama/{series}/series.md`、`adaptation-map.md` 与上一集末尾或目标分集，**沿用已确认的总设定与映射**，不重走立项；覆盖已有分集或映射文字前须取得作者明确授权 `[作者]`；直奔步骤 4 → 5 → 6 → 复检。
3. **只读检查**：不创建、不修改任何文件，直接跳到步骤 5 运行两个脚本并出具机检与人工复核报告。

新建或规划时确认**作品来源**与**版权前提**：

- **模式 A（从小说改编）**：已有 story bible，走步骤 1 → 2 → 3 → 4。
- **模式 B（从创意原创）**：无小说；`series.md` 写 `来源：原创`，映射表 `来源章` 写 `原创`，跳过步骤 2，由步骤 1 进入步骤 3。
- **模式 C（有手稿无 bible）**：先交给 `fiction-init` 导入模式抽取 bible；未装时见 [改编与分集规划指南](references/adaptation.md) 的模式 C 降级做法（告知缺失文件与默认配置，按作者确认的章号与稿次分批取材，把导入与建档列为待办）。
- **版权确认 `[作者]`**：只改编作者自有版权或已获改编授权的作品；绝不凭书名记忆复原或拼凑外部小说。

## 流程

### 1. 立项 `drama/{series}/series.md`

确认英文目录 slug（`^[a-z0-9][a-z0-9-]*$`，[SB §2](references/formats/project.md)），用 [短剧总设定模板](assets/series.template.md) 按 [SB §9.1](references/formats/drama.md) 建 `series.md`。一次性向作者提问并附参考默认，写入确认答案，绝不猜测平台规则（详见 [立项与配置指南](references/series-setup.md)）：

- **单集时长与总集数**：60–90 秒（漫剧 / AI 短集）、90–120 秒（常规，多为 60 / 80 / 100 集）、150–195 秒（长集，多为 30 / 40 / 50 集，1 集长集内容量约等于 2 集常规集）。写入 `单集时长：N-M`，对应配置 `drama.tiers`（`micro` ≤60、`short` ≤120、`standard` ≤180、`long` 无上限，[SB §8](references/formats/config.md)）。
- **免费集数与付费卡点**：配置 `drama.paywall.first_at` 默认 `[8, 15]`、`free_ratio` 默认 `[0.05, 0.25]`。常规参考首卡点：60 集 8–11、80 集 10–15、100 集 13–19（或 8–12）。若选定首卡点落于当前配置的 `first_at` 或 `free_ratio` 之外（如 100 集选第 16–19 集，或前置卡点短剧 30–60 集选第 3–5 集），须提醒作者确认并调整配置 `[作者]`。免费 / 广告剧把 `drama.paywall.first_at` 设为 `null`（跳过 `paywall-missing` 与 `paywall-ratio`；若剧本仍留标记会给 `paywall-position` 建议，`paywall-placement` 与 `paywall-hook` 仍照常检查），`免费集数` 留空且不放 `<!-- paywall -->`。
- **目标平台、题材、主要人物与制作形态**：`主要人物` 每人须在 `bible/characters.md` 有条目（由模型核对 `[模型]`）；制作形态（实拍 / AI 生成视频 / 漫剧）写入 `## 制作形态`。旁白解说主导剧提醒作者将 `drama.voiceover.os_max` / `vo_max` 设为 `null`。开场类型（动作冲突（默认）/ 异常静止 / 反差旁白 / 生活切片）写入 `## 开场类型`，一行类型加一句理由，由作者拍板 `[作者]`。
- **自由小节**：按需填入 `## 人物弧`、`## 单元与节奏规划`、`## 改编口径`、`## 合规注意`；模式 B 另填 `## 原创立项核心`（情绪承诺、主角显性诉求、反派筹码）与 `## 悬念账`。

### 2. Bible 直通改编（仅模式 A）

先读 bible 而非原书正文。按扩展自 [SB §4.1](references/formats/project.md) 的顺序读：`series.md` → `adaptation-map.md` → `bible/plot-outline.md` → `bible/volumes/{vol}.md` 章节规划表（[SB §7.5](references/formats/chapter.md)）→ `chapters/{vol}/summary.md`（若有）→ `bible/subplots.md` → `bible/foreshadows.md` → `bible/characters.md` → `bible/character-dynamics.md` → `bible/storylines.md` → 涉时间时读 `bible/timeline.md`。

- **拉节点表**：按章号顺序梳理，**1 个节点 = 1 次可见的关系变化、权力位次变化或信息差翻转**，取自 `character-dynamics.md` 各行、`subplots.md` 的 ②③⑤⑥ 步、`foreshadows.md` 埋 / 触 / 收章和卷规划表 `heavy` 重章（详见 [改编与分集规划指南](references/adaptation.md)）。
- **仅四类情况开原书定稿**（定稿判定见 [SB §7.1](references/formats/chapter.md)）：(a) 写当前批次时打开该批 `来源章` 定稿取道具、意象、空间与原句；(b) 某章段 bible 过薄；(c) 核对冻结章事实（冻结正文高于 bible，[SB §3](references/formats/project.md) 第 1 条）；(d) `summary.md` 与 bible 冲突（原样报告作者，不自行裁决）。绝不因“怕漏”通读全书（[SB §1](references/formats/project.md)）。

### 3. 分集规划 → `drama/{series}/adaptation-map.md`

用 [章集映射模板](assets/adaptation-map.template.md) 按 [SB §9.2](references/formats/drama.md) 建映射表（可先写规划行，写集后补全）。单元、重点集与卡点排期写在 `series.md` 的 `## 单元与节奏规划`；映射表不自创列，可选列 `集末状态` 除外（规划行留空，写集后回写）。详见 [改编与分集规划指南](references/adaptation.md) 与 [付费卡点与钩子设计](references/paywall-and-hooks.md)：

- **节点配比**：≤120 秒每集 1 节点（一推一挡或一铺一收）；150–195 秒每集 2 节点 + 约 50% 处中段钩子。节点不够则补冲突、造回合或下调总集数；过多则砍线或拆季；超约 200 章的长篇第一季通常取前约三分之一并收束最强约 20 场名场面。
- **砍线 / 并人 / 改序**：1 主线 + 最多 1 副线；支线按 [SB §6.3](references/formats/bible.md) 分级（A 留并压缩；B 压成道具或一句台词并入主线，或载卡点时留；C 删，除非载有保留伏笔）。合并同功能人物（默认主角 1–5、有名配角 ≤10、功能龙套 ≤10 用标签）；删修炼、赶路、过场。由卡点布局驱动改序，不得破坏先埋后收（`map-order`）与 `timeline.md` 硬锚点，改动记入 `改动` 列。
- **单元、重点集与卡点**：每单元 20–30 集（长集 10–15 集）约合小说 1 卷，四幕约 20/35/25/20%。重点集约 25%–35%、强悬念集约 10%–15%、前 10 集 ≥3 集重点集和 ≥2 集强悬念集（方法参考，非机检规则）。卡点前 2–3 集逐级蓄压，断在反击或真相揭晓前约 0.5 秒，付费首集前 15 秒兑现；免费段立核心冲突、留 ≥3 悬念并给甜头；逆袭 / 复仇类默认 ≤3 集让反派付可见代价。`<!-- paywall -->` 放在**最后一集免费集末尾、`<!-- hook: X -->` 之后**（如第 10 集末尾标记 → 第 11 集起付费），首标记集号写入 `免费集数`；后续标记仅在平台采用阶梯分段解锁时添加。
- **伏笔口径**：`伏笔` 列按 [SB §7.3](references/formats/chapter.md) 写 `埋 / 触 / 收 / 弃` + F-ID；剧本只演 `读者已知`，`作者真相` 留到计划回收那集。**绝不回写 `bible/foreshadows.md` 状态列**（[SB §9.2](references/formats/drama.md)）。模式 B 保持空伏笔表、`伏笔` 列留空，在 `series.md` 的 `## 悬念账` 追踪。
- **开工前作者拍板三件事 `[作者]`**：砍哪些线、并哪些人、大节点与付费卡点落点。分集梗概按 ≤10 集一批规划。

### 4. 分批写集 `drama/{series}/episodes/ep{NNN}.md`

每批 ≤5 集；从 `adaptation-map.md` 本批规划行、上一集映射行（含 `集末状态`，有此列时）、上集结尾与相关 bible 启动，不带入上一批整套剧本全文。按 [SB §9.3](references/formats/drama.md) 与 [分集剧本模板](assets/episode.template.md) 落稿，`状态` 仅取 `初稿` / `修改` / `定稿`（新稿填 `初稿`），仅在与全剧不同时写 `目标时长`。详见 [分集写作技法](references/episode-writing.md)：

- **开场与接续**：按 `## 开场类型` 写首拍（未写时按动作冲突型）。通则：首拍立住一个具体的“不对劲”；开场 VO（或主角 OS）至多一条，下一条是与之反差的动作行；禁起床拉窗帘、超 2 秒赶路、灌输背景的旁白、无冲突闲聊、开场人物扎堆。非反差旁白型不用 OS/VO 顶场景 1 第一行（`voiceover-open`）。开场在动作里接住上一集的 `集末状态`（无此列时接上集结尾），不站着复述，也不立刻泄完悬念。第 1 集前约 5 行亮明「谁要什么 + 数字或期限」；动作冲突型的爽剧 / 逆袭 35–45 秒给出首次反击。
- **节奏与场数**：90–120 秒走四挡（0–15 秒抓人立筹码 → 15–45 秒交锋 → 45–85 秒底牌与可见结算 → 85–110 秒余波与钩子），每 15–30 秒有可见变化，不换场地重复同一争吵；150–195 秒按目标时长约 50% 切分两轮 + 中段钩子、B 轮升级。场数默认 ≤2（90–120 秒）、≤3（150–195 秒）、1–2（≤60 秒）；配置 `drama.max_scenes`（默认 5）只是上限。
- **断章与钩子**：末拍留开放动作、未答之问或未解声响，不写总结句；末场后恰好一个 `<!-- hook: X -->`（S > A > B > C，[SB §7.2](references/formats/chapter.md)），参考卡点与单元收尾 S、常规 A、缓冲 B、避免 C。
- **对白、动作、镜头与 OS/VO**：每 2–4 句对白（紧凑戏 2–3 句）插一条动作或反应（`dialogue_run_max` 默认 6 只是上限）；一句一口气，常规 ≤25 字、超 35 字拆句；通用对白技法查 `fiction-craft`。动作行用现在时、只写看得见听得见的事实，禁否定伪动作、微表情、气味 / 味道与心理活动，道具交代出处，AI 视频只写常见日常动作；`【镜头】` 慎用，不写镜号与提示词（剧本管戏，分镜管拍）。OS/VO 仅限五类正当用途，禁用于设定灌输、复述动作、替代交锋、连续两条和紧贴钩子（配置默认 `os_max` 2 / `vo_max` 1；常规集建议 OS ≤1）。
- **对抗与破局**：对抗戏先写清诉求与赌注；上风看筹码不看音量，换手要有可见动作确认；破局来自前文已交代的证据、权限、代价或人物选择，巧合只添麻烦不解围（技法默认，悬疑、日常类不必场场正面对抗）。
- **人物口吻与改稿**：按 `characters.md`、`character-dynamics.md` 最新现状与 `style-guide.md` 写台词（遮名仍可辨谁说话）。改完一拍，重读前后相邻拍核对站位、手中道具与在场名单。
- **批末回看**：每批写完，对照上一批看破局手段、对抗结构、集尾钩子类型与镜头用法是否连续同型；同一危机链上沿用同型钩子不算重复。

### 5. 机检（每批与只读检查运行）

从书根依次运行（完整参数见各自 `--help`）：

```text
node <本 skill 目录>/scripts/drama-check.mjs <series> --ep N-M
node <本 skill 目录>/scripts/lint.mjs --series <series>
```

只读全剧检查时可省去 `--ep`。`--ep N-M` 只限定单集规则，系列级规则始终全量计算。清零所有 `block`；所有 `suggest` 对照 [机检规则处置指南](references/drama-check-guide.md) 逐条核对：

- `unshootable`（`UA01–UA04`、`UA11`、`UA12`）：改写为可见动作，仅当反应特写明确可拍时保留。
- `dialogue-run`：补动作或反应打断，仅刻意快口交锋时保留。
- `voiceover-quota`：删减或转动作，仅旁白主导剧保留（或把配置对应项设为 `null`）。
- `voiceover-open`：`## 开场类型` 是反差旁白且满足开场通则时，记「已核对，保留：理由」；否则改为动作开场或所选类型的首拍。对应 `drama.voiceover.*_max` 为 `null` 时脚本不报。
- `map-handoff`（映射表有 `集末状态` 列时）：按集末状态写法补写该格。

`drama-check.mjs` 无行内豁免注释，核对保留的 `suggest` 在汇报里记明「已核对，保留：理由」。`length` 估算仅按字符数 ÷ `chars_per_minute`，不等于实拍时长。

### 6. 回写与复检

- 补全 `drama/{series}/adaptation-map.md` 本批各行：`人物` 按实际出场、`伏笔` 按实际动作、`改动` 写合并 / 删减 / 改序理由，有 `集末状态` 列时填交给下一集的场内事实（谁知道什么、筹码在谁手里、关系、停在哪半个动作、剩余时限，具体到人、物、时间；[SB §9.2](references/formats/drama.md)）；发现本集结尾接不上下一集规划时，回到步骤 3 改映射，不在下一集硬补。
- 模式 B 原创短剧同步按实际埋设、揭示与兑现更新 `series.md` 的 `## 悬念账`（含 `实际兑现集` 与 `状态`），并复核未泄出 `幕后真相`。
- 新增短剧专属人物：在 `bible/characters.md` 追加块并标 `- 范围：短剧:{series}`（[SB §6.4](references/formats/bible.md)）。仅短剧生效的调整记入 `series.md` 的 `## 改编口径`。按 `fiction-continuity` 的冲突优先级（[SB §3](references/formats/project.md)），只将作者在本流程明确确认且无冲突的共享设定裁决写入 `bible/canon.md`，未确认或有冲突的交 `fiction-continuity`。
- 绝不修改小说章节、`bible/foreshadows.md` 或已有共享人物条目。原书来源章后续修订时，列出受影响集号供作者重查。
- **回写与返修后必须重跑步骤 5 的两个脚本**，防止回写引入 `map-foreshadow`、`map-order` 或 `parse` 阻断；验收只认最新一次脚本结果。

### 7. 合规与肖像 / 版权核对

每批收尾与全剧定稿前，模型先标疑点 `[模型]`，再按 [合规与版权核对清单](references/compliance.md) 逐项由作者确认 `[作者]`（现实名脱敏配合 `lint.mjs --series` `[脚本]`）。一律写明「以平台与主管部门官方现行文本为准」，不引法规号或日期，核对日期记入 `series.md` 的 `## 合规注意`。

### 8. 交接 `fiction-storyboard`

交接须同时满足四项（以回写和返修后的最终文件为准）：(1) 最新一次 `drama-check.mjs` 与 `lint.mjs --series` 均成功执行且**退出码均为 0**，把本剧两项结果一并交给分镜；(2) 本批目标集号全部出现在 `drama-check.mjs` 的 `episodes[]` 中；(3) `adaptation-map.md` 对应行已补齐，有 `集末状态` 列时含这一格（分镜需靠埋 / 收集防剧透）；(4) 作者已把剧本 `状态` 改为 `定稿` `[作者]`。

若已有分镜的集数日后修订剧本，按 [SB §4.2](references/formats/project.md) 把受影响集号与改动清单先交给 `fiction-storyboard` 重检并同步分镜，再交 `fiction-visual-prompts` 更新提示词，顺序不可反；本 skill 不触碰 `storyboards/` 或 `prompts/`。缺任一下游 skill 时，交付最终文件、待办与未跑检查。

## 检查

`block` 属硬约束，一律清零；`suggest` 多为技法默认；`[模型]` 项按事实因果类（审定约束）与写法类（技法默认）分别定级，细则见 [机检规则处置指南](references/drama-check-guide.md)「级别与问题分层」。单条技法偏离不单独构成返修理由。

- [ ] 格式、场景头、对白行、钩子与卡点标记 `[脚本]`
- [ ] 时长估算与档位 `[脚本]`
- [ ] 卡点集位置、比例、钩子下限 `[脚本]`
- [ ] 映射表 F-ID / 人物存在、先埋后收 `[脚本]`
- [ ] 已定稿非末集的 `集末状态` 已填（`map-handoff`，映射表有此列时） `[脚本]`
- [ ] 拍不出的动作模式、连续对白、OS/VO 数量与开场 `[脚本]`
- [ ] 禁用词、脱敏、精确年份、内部引用 `[脚本]`
- [ ] `series.md` 主要人物已建档、短剧人物 `范围` 正确、映射与剧本实际出场一致、分集 `状态` 仅取合法三值 `[模型]`
- [ ] 每集达标质变节点（常规集 1 个、长集 2 个含中段钩子；涵盖关系、权力或信息变化） `[模型]`
- [ ] 首拍立住不对劲、符合所选开场类型、接住上集集末状态 `[模型]`
- [ ] 断章是开放瞬间而非总结 `[模型]`
- [ ] 卡点前蓄压、付费首集 15 秒兑现 `[模型]`
- [ ] 动作行看得见听得见 `[模型]`
- [ ] 对抗戏写清上风与赌注，破局有前文依据 `[模型]`
- [ ] 本批与上一批的破局手段、对抗结构、集尾钩子类型与镜头用法未连续同型（同一危机链沿用同型钩子除外） `[模型]`
- [ ] 人物口吻可辨 `[模型]`
- [ ] 不提前写出作者真相 `[模型]`
- [ ] 砍线、并人、卡点位置 `[作者]`
- [ ] 时长档、总集数、平台、付费方案 `[作者]`
- [ ] 改编改动 canon `[作者]`
- [ ] 定稿 `[作者]`
- [ ] 合规、肖像、版权 `[作者]`

## 产出与汇报

交付：`drama/{series}/series.md`、`drama/{series}/adaptation-map.md`、本批 `drama/{series}/episodes/ep{NNN}.md`，及如有新增时的 `bible/characters.md` 短剧人物块。每批完成后向作者简报四项：

1. **本批进度**：集号范围、核心节点、估算时长区间与钩子 / 卡点落点。
2. **最终机检结果**：回写后最新一次 `drama-check.mjs` 与 `lint.mjs --series` 的退出码、`episodes[]` 覆盖情况与 `block` / `suggest` 统计；每条保留的 `suggest` 写明「已核对，保留：理由」。
3. **回写与改动**：映射表更新、悬念账更新（模式 B）、短剧人物追加、`## 改编口径` 记录；若有原书冲突或 canon 待决单独列出。
4. **待作者确认**：需拍板项、合规核对日期、是否转 `状态：定稿` 交接 `fiction-storyboard`（缺下游 skill 时附待办与未跑检查）。

## 参考文档

| 遇到…… | 读哪份 |
| --- | --- |
| 查目录路径、冲突裁决、主写入口或剧本改动后的下游顺序 | [SB §1–§5：项目结构与读写规则](references/formats/project.md) |
| 查伏笔表、支线分级、人物 `范围` 字段、关系日志或时间线格式 | [SB §6：bible 机读格式](references/formats/bible.md) |
| 查定稿判定、钩子分级（S/A/B/C）、伏笔动作或卷规划表 | [SB §6.1、§7：章节文件](references/formats/chapter.md) |
| 写 `series.md`、`adaptation-map.md` 或 `ep{NNN}.md` 之前核对格式 | [SB §6.1、§9.0–§9.3：短剧剧本](references/formats/drama.md) |
| 查 `drama.*` 档位、卡点、对白 / OS / VO 或脱敏配置键 | [SB §8：项目配置](references/formats/config.md) |
| 从小说 bible 直通改编、模式 C 降级、拉节点表、砍线并人改序或原书修订重查 | [改编与分集规划指南](references/adaptation.md) |
| 立项问答、时长 / 集数预设、免费或旁白剧配置、原创短剧起步 | [立项与配置指南](references/series-setup.md) |
| 排三级付费卡点、选悬念套路、控重点集比例或长集中段钩子 | [付费卡点与钩子设计](references/paywall-and-hooks.md) |
| 选开场类型与写开场、接住集末状态、四挡节奏、可拍动作行、对抗戏与破局、批末回看、OS/VO 取舍与口吻检验 | [分集写作技法](references/episode-writing.md) |
| 逐条处置 `drama-check` 与 `lint --series` 报错（含 `voiceover-open` 保留口径与 `map-handoff`）、解读 JSON 输出或给问题定层级与严重度 | [机检规则处置指南](references/drama-check-guide.md) |
| 做题材红线、肖像、版权与 AI 标识的作者自查清单 | [合规与版权核对清单](references/compliance.md) |
