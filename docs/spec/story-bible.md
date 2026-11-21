# Story Bible 规范（作者项目结构）

> 契约文件，`spec_version: 1`。状态：已冻结（T1，作者确认 2026-11-21），改动须总监批准，并同步 [scripts.md](scripts.md) 与 `shared/lib/`。
> 相关契约：[scripts.md](scripts.md)（脚本接口）、[skill-authoring.md](skill-authoring.md)（skill 写法）、[debook-terms.txt](debook-terms.txt)（去书专属化词表）。
> 本文只定义“作者的书”这一侧：目录、每份文件的职责、脚本要解析的格式。skill 正文只引用本文，不另立格式；脚本只认本文。

## 1. 总则

1. **Markdown 是唯一权威**。`.fiction/story.db` 之类索引随时可删可重建，任何改动先改 Markdown。
2. **一类信息只有一个主写入口**（owner file）。其他文件需要提到同类信息时，只写一句摘要加跳转，不复制维护正文。登记表是 `bible/sources.md`。
3. **按任务读取**：先读最小必读集（§4.1），缺信息再下钻；不因“怕漏”全量读 `bible/`。
4. **按事件写回**：发生什么变化，就改哪份 owner file（§4.2）。章写完没回写，这章不算写完。
5. **作者真相与读者已知分开记**：凡是会制造悬念的信息（伏笔、人物秘密），同时写“读者此刻以为什么”和“作者知道的真相”，避免正文提前泄底。
6. **内部精确、正文模糊**：bible 里可以写精确时间、现实原型；正文和对外文案按 `config.json` 的脱敏规则模糊化（由 `lint.mjs` 检查）。

## 2. 目录结构

```
<book>/
├── AGENTS.md                    # 本书规则；必须含 `## 本书口径` 一节（fiction-init 生成，作者维护）
├── .fiction/
│   ├── config.json              # §8，唯一配置文件
│   ├── lint-patterns.txt        # 可选：作者扩展的 AI 腔 / 总结句模式（格式见 scripts.md §4.3）
│   ├── frozen.json              # 由 `lint.mjs --freeze` 生成，冻结章哈希清单，不手改
│   └── story.db                 # 可选：fiction-story-db 生成的派生索引
├── bible/
│   ├── sources.md               # 主写入口注册表（§5）
│   ├── canon.md                 # 最终设定裁决
│   ├── timeline.md              # 时间锚点（§6.6）
│   ├── world-rules.md           # 体系与规则
│   ├── style-guide.md           # 本书风格指南（fiction-craft 模板生成）
│   ├── characters.md            # 人物静态档案（§6.4）
│   ├── character-dynamics.md    # 人物关系与弧线变化（§6.5）
│   ├── appearances.md           # 每章出场记录（§6.5）
│   ├── plot-outline.md          # 全书阶段与节奏
│   ├── volumes/{vol}.md         # 卷详细规划，含章节规划表（§7.5）
│   ├── storylines.md            # 明线 / 暗线实际进展（§6.7）
│   ├── subplots.md              # 支线生命周期（§6.3）
│   ├── foreshadows.md           # 伏笔表（§6.2）
│   ├── inventory.md             # 物品 / 资源持有与状态（§6.7）
│   ├── indexes/*.md             # 可选：专题索引（势力、地点、技能……），每份都要在 sources.md 登记
│   └── drafts/*.md              # 讨论稿与原始素材：只读参考，永不推翻上面任何文件
├── chapters/{vol}/
│   ├── vol-info.md              # 卷摘要（§7.4）
│   ├── summary.md               # 卷剧情复盘（含剧透，review 用）
│   └── {ch}/outline.md, resources.md, v{n}.md
├── drama/{series}/
│   ├── series.md  adaptation-map.md  episodes/ep{NNN}.md   # §9
└── publish/
    ├── blurb.md                 # 书名、简介、标签、宣传语等对外文案（按正文标准 lint）
    └── log.csv                  # fiction-publish 的发布记录
```

路径规则（脚本按此解析）：

| 占位 | 规则 |
|---|---|
| `{vol}` | 卷号，正整数，不补零：`chapters/3/` |
| `{ch}` | 章号，非负整数，全书全局唯一、不按卷重置、不补零：`chapters/3/57/` |
| `v{n}` | 稿次，正整数：`v1.md`、`v2.md`；重大修改才开新稿，小修直接覆盖 |
| `{series}` | 短剧目录名，ASCII slug：`^[a-z0-9][a-z0-9-]*$`；中文剧名写在 `series.md` |
| `ep{NNN}` | 集号，至少 3 位补零：`ep001.md`；超过 999 集用 4 位 |

相对 plan.md §5 只做了补充（appearances.md、style-guide.md、indexes/、drafts/、.fiction 下的三个文件、publish/），没有改名。

## 3. 分层与冲突裁决

| 层 | 文件 | 写入原则 |
|---|---|---|
| A 权威层 | `canon.md`、`timeline.md` | 只写已拍板的结果、硬锚点和期限；不写摇摆中的方案 |
| B 追踪层 | `volumes/{vol}.md`、`plot-outline.md`、`storylines.md`、`subplots.md`、`foreshadows.md`、`characters.md`、`character-dynamics.md`、`appearances.md`、`world-rules.md`、`style-guide.md` | 高频读写，各管一类信息 |
| C 专题索引层 | `inventory.md`、`indexes/*.md` | 按需查；规则类内容回到 `world-rules.md` |
| D 讨论稿层 | `drafts/*.md` | 只读参考；合并前不得覆盖任何上层文件 |
| 章节层 | `chapters/**`、`drama/**` | 正文与章级材料；冻结章只读 |

冲突时按下表裁决，不要“平均采信”：

| # | 冲突类型 | 以谁为准 | 备注 |
|---|---|---|---|
| 1 | 已公开（冻结）正文 vs 任何 bible 文件 | 冻结正文是读者已见事实，不能改 | 只能改 bible 口径，或在后续章节补解释；口径说明记进 `canon.md` |
| 2 | 设定 | `canon.md` | |
| 3 | 时间 | `timeline.md` | |
| 4 | 当前卷详细安排 | `volumes/{vol}.md` | 高于 `vol-info.md` 和各章 `outline.md` |
| 5 | 当前卷摘要 | `chapters/{vol}/vol-info.md` | |
| 6 | 卷剧情复盘 | `chapters/{vol}/summary.md` | 只服务 review，不反推规划 |
| 7 | 全书节奏 | `plot-outline.md` | |
| 8 | 规则细节 | `world-rules.md` 高于 `indexes/*.md` | |
| 9 | 人物：稳定特征 / 当前状态 | 稳定特征看 `characters.md`；当前关系与状态看 `character-dynamics.md` 最新一行 | |
| 10 | 写法 | 项目 `AGENTS.md`「本书口径」> `style-guide.md` > skill 默认 | |
| 11 | 草稿 / 讨论稿 | 不能推翻以上任一项 | |

## 4. 文件职责

| 文件 | 放什么 | 不放什么 |
|---|---|---|
| `AGENTS.md` | 本书规则、「本书口径」（主角口径、视角、禁区、书专属写法）、项目工作流 | 设定细节（去 canon）、计划 |
| `canon.md` | 已拍板的世界观与设定结论、冻结正文的口径说明 | 讨论中的方案、章节事件流水 |
| `timeline.md` | 故事内时间锚点、时间窗口、期限、正文口径 | 散文式回顾 |
| `world-rules.md` | 能力 / 体系 / 社会运行规则、等级与评价标准 | 章节事件 |
| `style-guide.md` | 本书叙述声音、句式偏好、禁用写法、对白习惯 | 通用技法（在 fiction-craft） |
| `characters.md` | 人物稳定档案、秘密（作者真相 / 读者已知） | 临时状态、关系变化 |
| `character-dynamics.md` | 人物分级、关系与弧线的“变化” | 静态档案的重复 |
| `appearances.md` | 每章实际在场 / 被提及的人物 | 计划出场（在 outline） |
| `plot-outline.md` | 全书阶段、卷与章节范围、节奏计划 | 已发生的复盘 |
| `volumes/{vol}.md` | 本卷分段、人物与势力配置、章节规划表 | 正文摘录 |
| `storylines.md` | 明线 / 暗线“已经发生了什么” | 未来规划 |
| `subplots.md` | 支线分级、挂靠主线、六步生命周期 | 整章剧情 |
| `foreshadows.md` | 每条伏笔的埋设、触及、回收、未来出现方式 | 支线整体进度 |
| `inventory.md` | 关键物品 / 资源的持有、消耗、损坏、转手 | 规则（去 world-rules） |
| `chapters/{vol}/vol-info.md` | 卷名、范围、卷级主线、正文状态的短摘要 | 详细规划 |
| `chapters/{vol}/summary.md` | 整卷剧情复盘（可完整剧透）：剧情回顾、人物变化、伏笔进出、遗留问题 | 未来规划 |
| `{ch}/outline.md` | 本章职责、场景顺序、支线 / 伏笔动作、钩子（§7.3） | 正文 |
| `{ch}/resources.md` | 本章真正要用的资料短摘：上章结尾、相关设定、人物关系、时间口径，每条注明来源文件 | 整份文档的复制 |

### 4.1 按任务读取（最小必读集，按顺序）

| 任务 | 必读 | 按需补读 |
|---|---|---|
| 写新章 / 续写 | AGENTS.md → `vol-info.md` → `volumes/{vol}.md` → `canon.md` → `brief.mjs` 输出 → 上一章结尾 | `timeline.md`（涉及时间推进时必读）、出场人物的 characters / dynamics、`world-rules.md`、`inventory.md` |
| 讨论方向 / 重排卷 | `canon.md` → `timeline.md` → `vol-info.md` → `volumes/{vol}.md` → `plot-outline.md` → `storylines.md` → `subplots.md` | `foreshadows.md` |
| 校时间 / 倒排期限 | `timeline.md` → `canon.md` → `volumes/{vol}.md` → `plot-outline.md` | |
| 写人物互动 / 感情线 | `characters.md` → `character-dynamics.md` → `appearances.md` → `storylines.md` → `subplots.md` | |
| 写体系 / 战斗 / 专业场景 | `world-rules.md` → `canon.md` → `indexes/*.md` | `inventory.md` |
| 审校一章 | AGENTS.md → `style-guide.md` → 该章 `outline.md` → `lint.mjs` / `length.mjs` 输出 | `canon.md`、`timeline.md`（跨章复核） |
| 改编短剧 | `drama/{series}/series.md` → `adaptation-map.md` → `characters.md` → `foreshadows.md` → 来源章正文 | `timeline.md` |

### 4.2 按事件写回

| 发生变化 | 必须更新 |
|---|---|
| 新设定拍板；发现冻结正文与设定不一致 | `canon.md` |
| 新时间锚点 / 窗口 / 期限 | `timeline.md` |
| 卷结构或章节规划变动 | `volumes/{vol}.md` → `plot-outline.md` → `vol-info.md` 摘要（按此顺序） |
| 一章写完（每章必做） | `appearances.md` 加一行；`foreshadows.md`、`subplots.md` 按 outline 的动作回写；有变化时同步 `storylines.md`、`character-dynamics.md`、`inventory.md` |
| 新人物出场 | `characters.md` |
| 规则变化 | `world-rules.md` |
| 整卷完结 | `summary.md`、`vol-info.md` 正文状态 |
| 新增章节进入公开发布范围 | `config.json` 的 `frozen.ranges`，然后运行 `lint.mjs --freeze` |
| 短剧写完一集 | `adaptation-map.md` 该集一行 |

## 5. `bible/sources.md`：主写入口注册表

一张表，表头固定（列名精确匹配，顺序可变）：

| 列 | 含义 | 格式 |
|---|---|---|
| `key` | 信息类型 ID | ASCII snake_case，全表唯一 |
| `信息` | 这类信息是什么 | 文本 |
| `主写入口` | 唯一 owner file，相对书根 | 可含 `{vol}`、`{ch}`、`{series}` 占位 |
| `锚点` | 文件内标题（可空） | 文本或 `-` |
| `何时读` / `何时写回` | 触发条件 | 文本 |
| `模式` | `owner_only`（唯一主写）/ `secondary`（次级参考，内容须从主写派生）/ `draft_only`（讨论稿） | 三选一 |
| `简报` | `brief.mjs` 是否列出：`always` / `characters`（本章有出场人物时）/ `kw:词1\|词2`（本章规划文本含任一词时）/ `-` | 见左 |

`fiction-init` 写入的默认行（作者可增删；`key` 名是契约，其他 skill 按 key 查找）：

| key | 信息 | 主写入口 | 锚点 | 何时读 | 何时写回 | 模式 | 简报 |
|---|---|---|---|---|---|---|---|
| canon | 最终设定 | bible/canon.md | - | 写章、改设定前 | 设定拍板时 | owner_only | always |
| timeline | 时间锚点 | bible/timeline.md | - | 涉及时间推进 | 新锚点 / 期限 | owner_only | always |
| world_rules | 体系与规则 | bible/world-rules.md | - | 写体系类场景 | 规则变化 | owner_only | kw:规则\|能力\|战斗 |
| style_guide | 本书风格 | bible/style-guide.md | - | 写章、审校 | 新写法规则定下 | owner_only | always |
| characters_static | 人物档案 | bible/characters.md | - | 有人物出场 | 新人物 | owner_only | characters |
| characters_dynamic | 关系变化 | bible/character-dynamics.md | - | 有人物出场 | 关系变化 | owner_only | characters |
| appearances | 出场记录 | bible/appearances.md | - | 查上次出场 | 每章写完 | owner_only | - |
| global_plot | 全书节奏 | bible/plot-outline.md | - | 规划 | 结构变动 | owner_only | always |
| volume_plan | 卷详细规划 | bible/volumes/{vol}.md | 章节规划 | 写章、规划 | 规划变动 | owner_only | always |
| volume_summary | 卷摘要 | chapters/{vol}/vol-info.md | - | 写章 | 规划变动后同步 | secondary | always |
| volume_review | 卷复盘 | chapters/{vol}/summary.md | - | review | 卷完结 | secondary | - |
| storylines | 主线 / 暗线进展 | bible/storylines.md | - | 写章 | 实际推进 | owner_only | always |
| subplots | 支线生命周期 | bible/subplots.md | - | 写章 | 支线步骤推进 | owner_only | always |
| foreshadows | 伏笔 | bible/foreshadows.md | - | 写章 | 埋 / 触 / 收 / 放弃 | owner_only | always |
| inventory | 物品资源 | bible/inventory.md | - | 涉及物品 | 获得 / 消耗 / 损坏 | owner_only | kw:物品\|道具\|资源 |
| drafts | 讨论稿 | bible/drafts/ | - | 讨论方向 | 不作依据 | draft_only | - |
| drama_series | 短剧总设定 | drama/{series}/series.md | - | 写短剧 | 设定变化 | owner_only | - |
| drama_map | 章→集映射 | drama/{series}/adaptation-map.md | - | 改编 | 每集写完 | owner_only | - |

## 6. 机读格式

### 6.1 通用语法（所有机读格式共用）

| 项 | 规则 |
|---|---|
| 表格 | GFM 管道表：表头行 + 分隔行 + 数据行，遇到第一行非 `\|` 开头的行结束。单元格去首尾空白；表头去掉 `**`、反引号后精确匹配列名；按列名取值，列顺序可变，多余列忽略；单元格内 `\|` 表示字面竖线。一个文件可有多张同类表（例如按卷分组），脚本按表头识别 |
| 字段行 | `- 键：值` 或 `- **键**：值`（全角或半角冒号）。正则 `^- (?:\*\*)?([^*：:]+?)(?:\*\*)?[：:]\s*(.*)$`；后续缩进 ≥2 空格的行并入上一字段值 |
| 空值 | 空单元格、`-`、`—`、`无` 都视为空 |
| 列表 | 用 `、` `，` `,` 分隔；去空白、去空项。人名等列表项内不得含这些分隔符 |
| 章号引用 | `N`；范围 `N-M`（`-` `–` `—` `~` `～` 都可）；`?` 或 `待定` 表示未定。章号列表是逗号类分隔的 `N` / `N-M` 混合，解析后展开为整数集合 |
| 状态单元格 | 可写符号、中文名、ASCII 别名或其组合（如 `🔵 planted`），解析时必须恰好命中一个状态 |
| ID | 各表 ID 在本文件内唯一，按字面比较（`F001` ≠ `F1`）。建议 3 位补零 |

### 6.2 伏笔表 `bible/foreshadows.md`

文件可按 `## 分组` 放多张表。列：

| 列 | 必填 | 格式 / 含义 |
|---|---|---|
| `ID` | 是 | `^F\d{3,}$` |
| `伏笔` | 是 | 短名，用于检索 |
| `读者已知` | 是 | 读者此刻看到 / 以为的样子（表面意义） |
| `作者真相` | 是 | 真相与长线意义；正文不得提前写出 |
| `埋设章` | 是 | 章号；状态为计划中时是“计划埋设章”，可为 `?` |
| `计划回收章` | 是 | `N`、`N-M` 或 `?` |
| `实际回收章` | 是 | 章号；未回收时为空 |
| `触及章` | 否 | 章号列表：再次提醒、部分揭示过的章 |
| `状态` | 是 | 见下表 |
| `未来出现方式` | 是 | 它将怎样回来（场景、载体、谁来揭）；未回收的伏笔不得为空 |
| `支线` | 否 | 支线 ID 列表 |
| `人物` | 否 | 人名列表 |
| `备注` | 否 | 放弃时必须写理由 |

| 状态 | 符号 | ASCII | 含义 |
|---|---|---|---|
| 计划中 | ⚪ | `planned` | 已规划，正文尚未埋 |
| 已埋设 | 🔵 | `planted` | 正文已埋 |
| 部分揭示 | 🟡 | `partial` | 揭了一层，仍未收 |
| 已回收 | 🟢 | `resolved` | 收完；必须填实际回收章 |
| 已放弃 | ⚫ | `dropped` | 不再回收；必须填备注 |

“未结” = `planted` 或 `partial`。脚本可判定的派生量（由 `foreshadow-scan.mjs` 计算，参数在 config `foreshadow.*`）：

| 派生 | 定义（`at` = 当前章） |
|---|---|
| `last_touch` | max(埋设章, 触及章中 ≤ at 的最大值) |
| 待埋 `plant_due` | 状态 `planned` 且 埋设章 ≤ at |
| 到期 `due` | 未结，计划回收章已定，`start - due_window ≤ at ≤ end + overdue_grace` |
| 逾期 `overdue` | 未结，计划回收章已定，`at > end + overdue_grace` |
| 沉睡 `dormant` | 未结，`at - last_touch ≥ dormant_after`（与是否定了回收章无关） |

校验规则（违反即 `invalid`）：ID 唯一；`resolved` 必有实际回收章且 ≥ 埋设章；非 `resolved` 不得有实际回收章；计划回收章起点 ≥ 埋设章；`dropped` 必有备注；未结伏笔的未来出现方式非空。

```markdown
## 第一卷

| ID | 伏笔 | 读者已知 | 作者真相 | 埋设章 | 计划回收章 | 实际回收章 | 触及章 | 状态 | 未来出现方式 | 支线 |
|---|---|---|---|---|---|---|---|---|---|---|
| F001 | 后墙旧钥匙 | 前任店主忘下的杂物 | 能打开河堤旧闸房 | 2 | 40-45 | | 9、21 | 🟡 partial | 闸房停电夜，钥匙成唯一入口 | B2 |
| F002 | 停在三点十分的座钟 | 坏了没修 | 记录了一次失踪的时刻 | 1 | 18 | 18 | | 🟢 | - | |
| F003 | 葛婶的旧照片 | 邻居墙上的普通合影 | 照片背面有第二个日期 | ? | ? | | | ⚪ planned | 葛婶搬家时掉出 | |
```

### 6.3 支线 `bible/subplots.md`

分级定义（来源方法，原样通用化）：

| 级别 | 定义 | 典型跨度 |
|---|---|---|
| A 大支线 | 直接推动或挑战主线，涉及核心人物，贯穿多卷 | 3 卷以上 |
| B 中支线 | 服务当前卷，丰富主线厚度 | 1–2 卷 |
| C 小支线 | 单章或 2–3 章完成，填节奏低谷、补世界观 | 1–3 章 |

铁律：任何支线都必须能挂靠到主线（`挂靠主线` 字段必填）；删掉后对主线毫无影响的支线，要么重新挂靠，要么砍掉。

六步生命周期（A/B 级按六步走；C 级可只有 ①⑥）：

| 序 | 步骤 | ASCII | 作用 |
|---|---|---|---|
| ① | 种因 | `seed` | 埋种子；必须有当下功能 |
| ② | 提醒 | `remind` | 换角度再出现；默认与 ① 间隔 `subplot.remind_gap` 章 |
| ③ | 连环 | `chain` | 与其他线交叉，让读者察觉“有联系” |
| ④ | 误导 | `mislead` | 给出看似合理但错误的解释 |
| ⑤ | 小收 | `small_reveal` | 解决表层，暴露深层 |
| ⑥ | 大收 | `big_reveal` | 完整揭示；A/B 级默认 `subplot.max_span` 章内必须收 |

每条支线一个三级标题块：

- 标题：`### {ID}：{名称}`，ID 正则 `^[ABC]\d+[a-z]?$`，首字母即级别。
- 字段行：`状态`（必填：进行 `active` / 休眠 `dormant` / 完结 `resolved` / 放弃 `dropped`）、`挂靠主线`（必填）、`人物`、`活跃卷`（卷号范围）、`伏笔`（F-ID 列表）。
- 生命周期表，表头 `步骤 | 计划章 | 实际章 | 内容`。`步骤` 单元格含序号、中文名或 ASCII 任一即可；`实际章` 填章号 = 已完成，空 = 未完成，`跳过`/`skip` = 跳过。
- 派生：`current_step` = 按序最后一个已完成步骤；`current_chapter` = 其实际章。
- 校验：已完成步骤的实际章按步骤序不递减。支线内容只写推进，伏笔细节只引用 F-ID，不复述。

```markdown
### B2：唐七的旧债

- 状态：active
- 挂靠主线：债主逼他借用钟表铺，把林砚拖进闸房旧案
- 人物：唐七、林砚
- 伏笔：F001

| 步骤 | 计划章 | 实际章 | 内容 |
|---|---|---|---|
| ①种因 seed | 3 | 3 | 唐七半夜来借电话 |
| ②提醒 remind | 10 | 9 | 催债短信被林砚看见 |
| ③连环 chain | 21 | | 债主认得那把旧钥匙 |
| ⑥大收 big_reveal | 45 | | |
```

### 6.4 人物档案 `bible/characters.md`

- `## 分组`（主角、配角……）随意；`### 名字` 一个人物一块，标题文本就是规范名，不加括号注释。
- 机读字段（字段行，键用中文或 ASCII 皆可）：

| 键 | ASCII | 必填 | 格式 |
|---|---|---|---|
| 身份 | `role` | 是 | 文本 |
| 级别 | `tier` | 是 | 核心 `core` / 重要 `major` / 次要 `minor` / 龙套 `extra` |
| 首次出场 | `first_chapter` | 否 | 章号 |
| 别名 | `aliases` | 否 | 列表；出场记录与短剧台词里可用别名，脚本归一到规范名 |
| 常驻 | `always_present` | 否 | `是`/`否`，默认否；常驻人物（一般是主角）每章视为在场，不必逐章记录 |
| 休眠卷 | `dormant_volumes` | 否 | 卷号列表；这些卷内不发缺席提醒 |
| 范围 | `scope` | 否 | `全部`（默认）/ `小说` / `短剧:{series}`（只在某部短剧里出现的改编人物） |
| 读者已知 | `reader_view` | 否 | 读者目前对此人的认识 |
| 作者真相 | `author_truth` | 否 | 隐藏身份、秘密；正文按计划才揭 |

- 其余字段自由（建议：外貌、性格表层 / 深层、说话风格、关键能力、成长弧线、口头禅、社交行为模式），脚本不解析。

```markdown
### 林砚

- 身份：接手旧钟表铺的年轻修表匠
- 级别：核心
- 首次出场：1
- 别名：小林、林师傅
- 常驻：是
- 读者已知：只想把铺子撑过这个冬天
- 作者真相：他父亲当年是闸房的值班员
- 说话风格：短句，爱用零件打比方
```

### 6.5 出场记录与关系变化

`bible/appearances.md`：每章一行，章写完后按**实际正文**记录（不是照抄 outline）。表头 `章 | 在场 | 提及 | 备注`；`备注` 写成 `人名：一句状态；人名：一句状态`（`；` 或 `;` 分条，第一个冒号分人名）。常驻人物不必写。

```markdown
| 章 | 在场 | 提及 | 备注 |
|---|---|---|---|
| 9 | 唐七 | 葛婶 | 唐七：躲债，第一次说谎 |
| 10 | 唐七、葛婶 | | 葛婶：认出旧钥匙的形状 |
```

`bible/character-dynamics.md`：人物分级表自由；机读部分是“关系变化日志”表，表头 `章 | 人物 | 对象 | 变化 | 现状`（`对象` 为空表示自身弧线）。某人“当前关系”= 该人物（或对象）最新一行的 `现状`。

```markdown
| 章 | 人物 | 对象 | 变化 | 现状 |
|---|---|---|---|---|
| 9 | 林砚 | 唐七 | 发现对方隐瞒欠债 | 信任打折，仍收留 |
```

### 6.6 时间锚点 `bible/timeline.md`

正文只写相对时间（“入冬后”“三天后”），绝对时间只在这里。锚点表表头 `ID | 时间 | 章 | 事件 | 类型 | 正文口径`：

| 列 | 格式 |
|---|---|
| `ID` | `^T\d{3,}$` |
| `时间` | 本书历法下的时间，文本；能锁到日 / 月 / 季就写到那一级 |
| `章` | 章号；前史事件写 `-` |
| `类型` | 硬锚 `hard`（正文明写，可校时）/ 软锚 `soft`（口语回忆，只作气氛）/ 窗口 `window` / 期限 `deadline` |
| `正文口径` | 正文里怎么写这个时间 |

```markdown
| ID | 时间 | 章 | 事件 | 类型 | 正文口径 |
|---|---|---|---|---|---|
| T001 | 第一年 霜降后第三天 | 1 | 林砚接手钟表铺 | 硬锚 | 那年霜降刚过 |
| T002 | 第一年 冬至前 | 30 | 债主给出的最后期限 | 期限 | 冬至之前 |
```

### 6.7 其他追踪表（story-db 会索引，脚本不做校验）

- `inventory.md`：表头 `ID | 物品 | 持有 | 状态 | 获得章 | 变动章 | 备注`；ID `^I\d{3,}$`；状态 持有 `held` / 消耗 `consumed` / 外借 `lent` / 损坏 `damaged` / 遗失 `lost` / 转手 `transferred`。
- `storylines.md`：表头 `ID | 故事线 | 类型 | 起始章 | 状态 | 最新进展 | 更新章`；ID `^L\d+$`；类型 明线 / 暗线；状态 ⚪ 未开始 `planned` / 🔵 进行 `active` / 🟢 完结 `resolved` / 🔴 搁置 `paused`。

```markdown
| ID | 物品 | 持有 | 状态 | 获得章 | 变动章 | 备注 |
|---|---|---|---|---|---|---|
| I001 | 旧钥匙 | 林砚 | 持有 | 2 | 2 | 见 F001 |
```

### 6.8 设定标签注释

`canon.md`、`world-rules.md`、`indexes/*.md` 里，任一标题的**下一行**可以写一条隐藏注释，供 `brief.mjs` 和 story-db 检索：

```markdown
## 闸房值班制度
<!-- tags: 闸房, 值班; chapters: 20-45 -->
```

`tags` 为列表；`chapters` 为章号范围或列表，可省。

## 7. 章节文件约定

### 7.1 稿件与定稿

- 正文：`chapters/{vol}/{ch}/v{n}.md`。**定稿** = `outline.md` 的 `## 定稿` 节指定的稿次；没指定时取 n 最大者。所有脚本只看定稿。
- 冻结章：章号落在 `config.frozen.ranges` 内的章节，正文只读：不改、不重写、不补句、不格式化、不新开稿次。由 `.fiction/frozen.json` 哈希检测（scripts.md §4）。

### 7.2 正文格式 `v{n}.md`

```markdown
# 第12章：闸房的灯

正文第一段……

---

第二个场景……

*下章预告：一句话（可选）*

<!-- hook: A -->
```

| 元素 | 规则 |
|---|---|
| 标题行 | 第 1 行，正则 `^# 第(\d+)章：(\S.*)$`；全角冒号；数字为阿拉伯数字且等于目录章号 |
| 场景分隔 | 单独一行，内容恰为 `---`（前后各留一空行） |
| 下章预告 | 可选，单独一行 `*下章预告：……*`，放在钩子标记之前；不计字数 |
| 钩子标记 | `<!-- hook: X -->`，X ∈ `S` `A` `B` `C`；每章恰好一个，且是文件最后一个非空行 |
| 作者批注 | `<!-- note: …… -->`，可跨行；不计字数、不进发布稿 |
| lint 豁免 | `<!-- lint-ignore: 规则或模式ID, …… -->` 单独一行，豁免下一个非空行；`<!-- lint-ignore-file: …… -->` 豁免全文件 |
| 其他 | 正文不用列表、引用块、粗体等 Markdown 标识；不出现文件名、章号 ID、伏笔 ID 等内部引用（lint 检查） |

钩子分级（S > A > B > C，脚本按此比较“不低于”）：

| 级别 | 类型 | 用在哪里 |
|---|---|---|
| S | 重大反转、生死危机、身份揭穿 | 卷高潮、爆更期每日最后一章、付费卡点 |
| A | 新信息揭露、悬念加深、强冲突将起 | 日常更新每日最后一章的默认 |
| B | 情绪转折、做出决定、关系变化 | 日更非末章、过渡章 |
| C | 平静收束 | 尽量避免；只用于高潮后的喘息章 |

### 7.3 `outline.md`（先定提纲，再写正文）

第 1 行 `# 第{ch}章 outline`。二级标题名精确匹配，顺序建议如下；带“机读”的节由脚本解析：

| 节 | 必填 | 内容与格式 |
|---|---|---|
| `## 标题` | 是 | 一行章标题（不含“第N章：”） |
| `## 本章职责` | 是 | 一句话：推进什么、改变了什么 |
| `## 场景` | 是 | 编号列表，每个场景写清锚点、时间感、驱动、转变（场景要素见 fiction-craft） |
| `## 支线推进` | 机读 | `- {支线ID} {步骤}：说明`；步骤用中文或 ASCII；不推进步骤可省略步骤 |
| `## 伏笔` | 机读 | `- {动作} {F-ID}：说明`；动作 埋 `plant` / 触 `touch` / 收 `resolve` / 弃 `drop` |
| `## 出场人物` | 机读 | `- 在场：名单`、`- 提及：名单` |
| `## 钩子` | 机读 | `- 级别：X`、`- 内容：……` |
| `## 爽点` | 否 | 本章爽点类型与位置 |
| `## 日更位置` | 否 | 如“当日第 2 章（末章）” |
| `## 定稿` | 否 | 一行 `v{n}` |

章写完后，`foreshadow-scan.mjs` 用这里的支线 / 伏笔动作核对 bible 是否已回写（`writeback`）。

```markdown
# 第12章 outline

## 标题
闸房的灯

## 本章职责
林砚第一次用旧钥匙，发现闸房有人近期来过。

## 场景
1. 河堤夜路｜停电后半小时｜想确认唐七的说法｜看见闸房窗内有光
2. 闸房内｜同一夜｜找人｜只找到一张新烟盒

## 支线推进
- B2 连环：债主的烟盒出现在闸房

## 伏笔
- 触 F001：钥匙能开门
- 埋 F004：新烟盒

## 出场人物
- 在场：唐七
- 提及：葛婶

## 钩子
- 级别：A
- 内容：烟盒里夹着林砚父亲的值班表
```

### 7.4 其他章节层文件

| 文件 | 格式 |
|---|---|
| `{ch}/resources.md` | 写正文前建立；每条一行，末尾 `（来源：相对路径#标题）`；首条写上章结尾，次条写本章职责与写法边界。不解析，不复制整份文档，目的是写作时不再来回全仓库搜索 |
| `{vol}/summary.md` | 整卷完结时（或作者要求复盘时）写，可完整剧透；建议四节 `## 剧情回顾`、`## 人物变化`、`## 伏笔进出`、`## 遗留问题`；只服务 review，不反推规划 |
| `{vol}/vol-info.md` | 第 1 行 `# 第{vol}卷：{卷名}`，随后字段行 `卷名`、`章节范围`（`N-M`，机读）、`卷级主线`、`详细规划`（`bible/volumes/{vol}.md`）、`正文状态`；只写摘要 |

### 7.5 卷详细规划 `bible/volumes/{vol}.md`

自由正文（分段、情绪波形、人物与势力配置）加机读部分：字段行 `章节范围`（与 vol-info 不一致时以此为准），以及 `## 章节规划` 下的表，表头 `章 | 核心事件 | 爽点 | 钩子 | 支线 | 伏笔 | 人物 | 权重`：

| 列 | 格式 |
|---|---|
| `章` | 章号 |
| `核心事件` | 一句话 |
| `爽点` | 文本或空（题材包给出常用类型） |
| `钩子` | 计划级别 `S`/`A`/`B`/`C` |
| `支线` | 支线 ID 列表 |
| `伏笔` | 同 outline 的动作写法，`、` 分隔，如 `埋F004、触F001` |
| `人物` | 计划出场名单 |
| `权重` | 轻 `light` / 中 `normal` / 重 `heavy`，默认中 |

章与卷的对应：已有目录按 `chapters/{vol}/{ch}/` 判定；尚无目录的章按 `volumes/*.md` 的章节范围判定，其次按 `vol-info.md`。

## 8. `.fiction/config.json`

UTF-8 JSON。加载规则：与下方默认值深合并（对象递归合并，数组整体替换，显式 `null` 保留为 `null`）；未知键保留并忽略；类型不符时脚本以退出码 2 报错。缺文件时全部用默认值，并在输出里提示“未找到 config，使用默认值”。

| 键 | 类型 | 默认 | 使用者 | 含义 |
|---|---|---|---|---|
| `version` | int | `1` | 全部 | 配置版本 |
| `book.title` | string\|null | `null` | init、publish | 书名 |
| `book.genres` | string[] | `[]` | craft | 题材包 ID |
| `length.min` | int | `2000` | length | 通过条件：有效字符数 ≥ min |
| `length.soft_max` | int\|null | `5000` | length | 超过只提示，不失败 |
| `length.skip_frozen` | bool | `true` | length | `--all` 时跳过冻结章 |
| `hook.required` | bool | `true` | lint | 每章必须有钩子标记 |
| `hook.discouraged` | string[] | `["C"]` | lint | 使用这些级别时给 suggest |
| `frozen.ranges` | string[] | `[]` | lint、length、chapter | 冻结章范围，如 `["1-120"]` |
| `lint.banned_terms` | (string\|{term,hint})[] | `[]` | lint | 正文禁用词 |
| `lint.desensitize.places` | 同上 | `[]` | lint | 现实地名 |
| `lint.desensitize.schools` | 同上 | `[]` | lint | 现实学校名 |
| `lint.desensitize.companies` | 同上 | `[]` | lint | 现实公司 / 品牌名 |
| `lint.desensitize.people` | 同上 | `[]` | lint | 现实人名 |
| `lint.desensitize.other` | 同上 | `[]` | lint | 其他可映射现实的词 |
| `lint.desensitize.exact_years` | bool | `true` | lint | 正文禁止精确公历年份 / 日期 |
| `lint.internal_terms` | string[] | `["伏笔","钩子","爽点","支线","暗线","大纲","章纲","细纲","主写入口","本章","上一章","下一章","outline","resources"]` | lint | 写作术语泄漏词（suggest） |
| `lint.extra_files` | string[] | `["publish/blurb.md"]` | lint | 按正文标准检查的额外文件（glob） |
| `lint.rules` | {id: "block"\|"suggest"\|"off"} | `{}` | lint | 覆盖规则或模式的级别；模式 ID 优先于规则名 |
| `lint.patterns_file` | string | `".fiction/lint-patterns.txt"` | lint | 作者扩展模式文件 |
| `foreshadow.due_window` | int | `3` | scan、brief | 计划回收章前几章开始算“到期” |
| `foreshadow.overdue_grace` | int | `0` | scan | 超过计划回收终点几章后算“逾期” |
| `foreshadow.dormant_after` | int | `30` | scan | 未结伏笔多少章没被触及算“沉睡” |
| `subplot.stall_after` | int | `20` | scan | 进行中支线多少章无新步骤算“停滞” |
| `subplot.remind_gap` | [int,int] | `[5,15]` | scan | ② 与 ① 的建议间隔 |
| `subplot.max_span` | int | `100` | scan | A/B 级从 ① 到 ⑥ 的最长跨度 |
| `appearance.gap_warn` | int | `10` | brief | 核心人物缺席多少章提醒 |
| `rhythm.beat_every` | [int,int] | `[3,5]` | planner、review | 每隔几章至少一个爽点 |
| `rhythm.external_event_max_gap` | int | `2` | planner、chapter | 连续几章无外部事件后必须插入打断 |
| `daily.chapters_per_day` | int | `2` | planner | 日常每日章数 |
| `daily.last_hook_min` | "S"\|"A"\|"B"\|"C" | `"A"` | planner、review | 每日末章钩子不低于 |
| `daily.burst.chapters_per_day` | [int,int] | `[3,5]` | planner | 爆更期每日章数 |
| `daily.burst.last_hook_min` | 同上 | `"S"` | planner | 爆更期每日末章钩子不低于 |
| `publish.platform` | string\|null | `null` | publish | 平台 ID，如 `"fanqie"` |
| `publish.daily_word_threshold` | int\|null | `null` | publish | 每日平台计数须严格大于此值 |
| `publish.default_time` | "HH:MM"\|null | `null` | publish | 默认定时发布时间 |
| `publish.ai_disclosure` | "yes"\|"no"\|null | `null` | publish | 平台“是否使用 AI”选项 |
| `publish.detection_mode` | "basic"\|"full"\|null | `null` | publish | 平台内容检测方式 |
| `publish.typo_prompt` | "submit"\|"stop"\|null | `null` | publish | 平台提示错别字时的处理 |
| `publish.scheduled` | bool\|null | `null` | publish | 是否定时发布 |
| `publish.preview_keyword` | string\|null | `null` | publish | 预告关键词；`""` 表示留空 |
| `publish.log_file` | string | `"publish/log.csv"` | publish | 发布记录路径 |
| `publish.confirmed_at` | "YYYY-MM-DD"\|null | `null` | publish | 作者最后确认参数的日期 |
| `drama.chars_per_minute` | int | `250` | drama-check | 估算时长用的语速 |
| `drama.length_level` | "block"\|"suggest" | `"suggest"` | drama-check | 单集时长越界的级别 |
| `drama.tiers` | {id,max_seconds}[] | `[{"id":"micro","max_seconds":60},{"id":"short","max_seconds":120},{"id":"standard","max_seconds":180},{"id":"long","max_seconds":null}]` | drama-check | 时长档位，按 max 升序；`null` 表示无上限 |
| `drama.max_scenes` | int | `5` | drama-check | 单集场景数上限（suggest） |
| `drama.hook.required` | bool | `true` | drama-check | 每集必须有钩子标记 |
| `drama.paywall.first_at` | [int,int] | `[8,15]` | drama-check | 首个付费卡点所在集的允许范围 |
| `drama.paywall.free_ratio` | [number,number] | `[0.05,0.25]` | drama-check | 免费集数 / 总集数 的允许范围 |
| `drama.paywall.hook_min` | 钩子级别 | `"A"` | drama-check | 卡点集钩子不低于 |

`publish.*` 全部默认 `null`，含义是“首次使用时询问作者，确认后写回 config 并填 `confirmed_at`”。skill 不得自带任何个人发布参数作默认值。

`shared/lib/config.mjs` 导出 `DEFAULT_CONFIG`，必须与上表默认值逐字段一致（表中 `a.b.c` 即嵌套对象路径）；scripts.md 的测试要求覆盖这一点。

## 9. 短剧 `drama/{series}/`

本节只定最小可解析格式。短剧方法（T4.g）可以扩展，但新增标记或字段须经总监批准后写进本节。

### 9.1 `series.md`

第 1 行 `# {剧名}`，随后字段行：`来源`（`原创` / `改编`）、`总集数`（int）、`单集时长`（秒，`N-M`）、`免费集数`（计划首个卡点集，可空）、`目标平台`、`题材`、`一句话梗概`、`主要人物`（列表，须在 `characters.md` 有条目，改编新增人物用 `范围：短剧:{series}`）。其余小节自由（人物弧、分季、合规注意）。

```markdown
# 停摆的钟

- 来源：改编
- 总集数：60
- 单集时长：60-120
- 免费集数：10
- 主要人物：林砚、唐七
```

### 9.2 `adaptation-map.md`：章 → 集映射（短剧侧唯一主写入口）

表头 `集 | 来源章 | 剧情点 | 人物 | 伏笔 | 改动`。`来源章` 为章号 / 范围 / 列表或 `原创`；`人物` 为本集出场名单；`伏笔` 为动作 + F-ID（`埋F001、收F002`，动作同 §7.3）；`改动` 写合并、删减、改序的理由。

- 短剧侧的伏笔状态由本表派生（哪集埋、哪集收），**不回写** `foreshadows.md` 的状态列；小说伏笔表只记小说。若改编改动了设定，走 canon 拍板流程。
- 每集写完补全该行；`drama-check.mjs` 校验 F-ID 与人物存在、先埋后收、集文件与行一一对应。

```markdown
| 集 | 来源章 | 剧情点 | 人物 | 伏笔 | 改动 |
|---|---|---|---|---|---|
| 1 | 1-2 | 接手停摆的钟表铺 | 林砚、唐七 | 埋F002 | 两章并一集，删搬家过程 |
| 2 | 3 | 唐七半夜借电话 | 林砚、唐七 | 埋F001 | |
```

### 9.3 分集剧本 `episodes/ep{NNN}.md`

```markdown
# 第3集：门缝里的灯

- 状态：初稿
- 目标时长：90

## 场景1：钟表铺·内·夜
人物：林砚、唐七
△ 柜台上的座钟停在三点十分。林砚伸手去拨，指针不动。
唐七：（压低声音）别碰，它昨天也停在这儿。
林砚：昨天？你昨天来过？
【特写】后墙缝里透出一线光。

## 场景2：后巷·外·夜
△ 唐七先一步拉开后门。

<!-- hook: A -->
<!-- paywall -->
```

| 元素 | 规则 |
|---|---|
| 标题行 | 第 1 行 `^# 第(\d+)集：(\S.*)$`，数字等于文件集号 |
| 元数据块 | 标题后、第一个场景前的字段行：`状态`（初稿 / 修改 / 定稿）、`目标时长`（秒，覆盖 series 的单集时长）。章集映射只在 adaptation-map，这里不重复 |
| 场景头 | `^## 场景(\d+)：(.+)·(内\|外\|内外)·(日\|夜\|晨\|昏)$`；场景号在集内从 1 连续 |
| 人物行 | 可选，紧跟场景头：`人物：名单` |
| 动作行 | 以 `△` 开头（U+25B3），后接动作描述 |
| 对白行 | `角色名：台词` 或 `角色名（OS/VO/情绪）：台词`；台词开头可带 `（动作）`。正则 `^([^\s：:△【<（(#]{1,16})(（[^）]{1,20}）)?：(.+)$`；`旁白`、`字幕` 是保留角色名 |
| 镜头 / 转场 | `【……】` 开头的一行，如 `【特写】`、`【闪回】` |
| 钩子标记 | `<!-- hook: X -->`，同章节分级；每集恰好一个，位于最后一个场景之后 |
| 付费卡点 | `<!-- paywall -->` 放在**最后一集免费集**的末尾、钩子标记之后，表示下一集起付费；可有多个，第一个为首个卡点 |
| 其他 | 场景内只允许：空行、人物行（仅首行）、动作行、对白行、镜头行、HTML 注释 |

## 10. story-db 映射（可选 skill `fiction-story-db`）

数据库 `.fiction/story.db`（`node:sqlite`），是派生索引：只存“在哪里、什么状态、关联什么”，正文内容永远在 Markdown。可随时删除重建；是否提交进 git 由作者决定（fiction-init 默认写进 `.gitignore`）。写操作（如“记录本章出场”）必须先改 Markdown，再重建或增量更新索引。所有表都带 `source_file`（相对书根）与 `source_line`（1 起）。

| 表 | 来源 | 主要列（与本文字段对应） |
|---|---|---|
| `meta` | — | `key`、`value`（`spec_version`、`indexed_at`、各源文件 `sha256`，用于增量） |
| `source_registry` | `sources.md` | `key` PK、`purpose`(信息)、`owner_file`、`owner_anchor`、`read_when`、`write_when`、`mode`、`brief_rule`(简报) |
| `characters` | `characters.md` | `name` PK、`aliases`、`role`、`tier`、`first_chapter`、`always_present`、`dormant_volumes`、`scope`（合并来源的 character_meta） |
| `character_appearances` | `appearances.md` | `character`、`chapter`、`appearance_type`(`present`/`mentioned`)、`note` |
| `relationship_changes` | `character-dynamics.md` | `chapter`、`character`、`target`、`change`、`state` |
| `foreshadows` | `foreshadows.md` | `id` PK、`name`、`reader_view`、`author_truth`、`planted_chapter`、`target_start`、`target_end`、`resolved_chapter`、`touched_chapters`、`status`、`future`、`subplot_ids`、`characters`、`note`、`source_anchor`(所在 `##` 标题) |
| `subplots` | `subplots.md` | `id` PK、`name`、`level`、`status`、`main_link`、`current_step`、`current_chapter`、`active_volumes`、`characters`、`foreshadow_ids` |
| `subplot_steps` | `subplots.md` 生命周期表 | `subplot_id`、`step`、`planned_chapter`、`actual_chapter`、`skipped`、`content` |
| `timeline_anchors` | `timeline.md` | `id` PK、`time_text`、`chapter`、`event`、`kind`、`prose_form` |
| `inventory` | `inventory.md` | `id` PK、`name`、`holder`、`status`、`acquired_chapter`、`changed_chapter`、`note` |
| `storylines` | `storylines.md` | `id` PK、`name`、`kind`、`start_chapter`、`status`、`latest`、`updated_chapter` |
| `settings` | §6.8 标签注释 | `name`(标题)、`tags`、`relevant_chapters`、`source_anchor` |
| `chapter_plans` | `volumes/*.md` 章节规划表，`outline.md` 覆盖同名字段 | `chapter` UNIQUE、`volume`、`title`、`core_event`、`beat`、`hook_planned`、`weight`、`foreshadow_actions`、`subplot_ids`、`required_characters`、`status`(派生：`planned`/`outlined`/`drafted`/`final`/`frozen`) |
| `chapters` | `chapters/**/v*.md` | `chapter` PK、`volume`、`draft_file`(定稿)、`title`、`length`、`hook_actual`、`frozen`、`sha256` |
| `episodes` | `drama/*/episodes/*.md` | `series`、`episode`、`title`、`scenes`、`est_seconds`、`hook`、`paywall` |
| `adaptation_map` | `adaptation-map.md` | `series`、`episode`、`source_chapters`、`characters`、`foreshadow_actions` |

与来源 schema 的差异：伏笔 ID 改为字符串 `F001`（来源是自增整数，无法在 Markdown 里引用）；`character_meta` 并入 `characters`；去掉 `source_registry.domain`（由 `key` 承担）；新增 `subplot_steps`、`relationship_changes`、`timeline_anchors`、`chapters` 和短剧两表；出场类型去掉 `indirect`（并入 `mentioned`）。

## 11. 变更

冻结后任何格式变更：先改本文件并升 `spec_version`，再改 `shared/lib/` 解析器与测试，最后改引用它的 skill。脚本遇到更高的 `spec_version`（config `version`）时以退出码 2 提示升级。
