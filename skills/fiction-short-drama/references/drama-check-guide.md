# 机检规则处置指南

## 目录

- [一、命令与退出码](#一命令与退出码)
- [二、解读 JSON 输出与人工留存口径](#二解读-json-输出与人工留存口径)
- [三、`drama-check.mjs` 规则全表](#三drama-checkmjs-规则全表)
- [四、`lint.mjs --series` 对剧本生效的规则](#四lintmjs---series-对剧本生效的规则)
- [五、级别与问题分层](#五级别与问题分层)

---

## 一、命令与退出码

从书根运行本 skill 自带的两个脚本（完整参数与示例见各自 `--help`）：

```text
node <本 skill 目录>/scripts/drama-check.mjs <series> [--ep N|N-M] [--fail-on block|suggest] [--root DIR] [--json]
node <本 skill 目录>/scripts/lint.mjs --series <series> [--fail-on block|suggest] [--root DIR] [--json]
```

- **`--ep N|N-M` 的范围**：只过滤单集级规则；系列级规则（缺集、超总集数、卡点位置与比例、映射表与解析发现）始终按全剧计算。回写或返修后必须重跑两项脚本，交接前确认退出码均为 `0` 且本批目标集号全部出现在 `episodes[]` 中。
- **退出码**：`0` 通过；`1` 存在级别 ≥ `--fail-on`（默认 `block`）的发现；`2` 用法错误、找不到书根或必需文件、配置非法或内部错误。
  - `drama-check.mjs` 需要读取 `bible/characters.md` 和 `bible/foreshadows.md`；缺任一文件会直接退出码 `2`。无完整骨架时先按 [SB §6.2](formats/bible.md)、[SB §6.4](formats/bible.md) 建好这两份文件。

---

## 二、解读 JSON 输出与人工留存口径

加 `--json` 后，`drama-check.mjs` 返回的核心字段：

- `episodes[]`：每集一条，含 `episode`、`file`、`title`、`scenes`（场数）、`chars`（有效字数：动作行 `△` 后文字 + 对白冒号后去开头动作括号的台词，去空白计码点）、`est_seconds`（估算秒数）、`tier`（归档 ID）、`range`（允许秒数区间）、`hook`、`paywall`（布尔）、`os`、`vo`。
- `paywall`：`first`（首个卡点集号或 `null`）、`all`（全部卡点集号数组）、`total`（总集数）、`ratio`（首卡点 ÷ 总集数，保留 3 位小数）。
- `findings[]`：每条含 `rule`、`id`、`level`（`block` / `suggest`）、`file`、`line`、`column`、`excerpt`、`message`、`hint`。
- `summary`：`episodes`、`block`、`suggest`。

**两条关键注意事项**：

1. **`drama-check.mjs` 不支持行内豁免注释**：不要在剧本里写 `<!-- lint-ignore -->` 试图跳过 `drama-check`。经过核对确实合理而保留的 `suggest`，在本批汇报里记为**「已核对，保留：理由」**。
2. **`length` 只是语速换算**：`est_seconds = round(chars × 60 / drama.chars_per_minute)`，不感知沉默动作、长镜头停顿或语速变化，仅作初筛参考。

---

## 三、`drama-check.mjs` 规则全表

### 1. 文件解析与透传发现（全剧）

| 规则 | 级别 | 含义 | 修复做法 | 何时可保留 |
| --- | --- | --- | --- | --- |
| `parse` | `block` | `series.md`（首行 `# 剧名`、字段重复、`来源` / `总集数` / `单集时长` / `免费集数` 非法）、`adaptation-map.md`（缺表缺列、集号重复或非正整数、`来源章` 或伏笔动作非法）或 `bible/characters.md` 的解析错误 | 按报错文件与行号修正格式（`characters.md` 共享条目交 `fiction-continuity` 或作者修） | 不可保留 |
| `foreshadow` | `block` / `suggest` | `drama-check.mjs` 读取 `bible/foreshadows.md` 时透传的校验发现（结构错误 `block`，未结伏笔缺 `未来出现方式` 为 `suggest`） | 本 skill 不改共享伏笔表，向作者报告文件与行号，由 `fiction-continuity`（或作者）修正后重跑 | `block` 不可保留 |

### 2. 格式与结构规则（单集）

| 规则 | 级别 | 含义 | 修复做法 | 何时可保留 |
| --- | --- | --- | --- | --- |
| `ep-title` | `block` | 首行不符 `# 第N集：集名` 或集号与 `ep{NNN}.md` 不一致（[SB §9.3](formats/drama.md)） | 对齐首行格式、全角冒号与文件名补零集号 | 不可保留 |
| `ep-meta` | `block` | `目标时长` 非正整数或重复出现 | 改为正整数秒数，或与全剧相同时删去该行 | 不可保留 |
| `scene-header` | `block` | 场景头不符 `## 场景N：地点·内\|外\|内外·日\|夜\|晨\|昏`，或整集无场景 | 按 [SB §9.3](formats/drama.md) 修正分隔点与时段字 | 不可保留 |
| `scene-number` | `suggest` | 场景号未从 1 连续递增 | 按顺序重编号 `场景1`、`场景2`…… | 极少保留，建议修齐 |
| `bad-line` | `block` | 场景内出现非空行、非紧跟场景头的 `人物：`、非 `△`、非对白行、非 `【……】`、非注释的杂行 | 改成合法动作 / 对白 / 镜头行；切勿以全角左括号 `（` 开头 | 不可保留 |
| `action-missing` | `suggest` | 某场景里一条 `△` 动作行也没有 | 补入可见开场动作与互动反应 | 纯黑屏电话极短过场经核对可保留 |
| `max-scenes` | `suggest` | 场数超过 `drama.max_scenes`（默认 5） | 合并同类空间，删去无推进过场 | 快切蒙太奇特例经核对可保留 |
| `hook` | `block` | `drama.hook.required` 为 `true`（默认）且缺标记；级别非大写 `S/A/B/C`；多于一个；或其后仍有剧本内容 | 末场后只留一个合法钩子标记 | 不可保留 |
| `length` | `drama.length_level`（默认 `suggest`） | `est_seconds` 落在本集或全剧允许秒数区间之外 | 偏短补真实回合，偏长压废话或拆集；确需特例时填本集 `目标时长` | 大量无台词动作戏致字数偏低时可保留并说明 |

### 3. 写作质量建议规则（单集）

| 规则 | 级别 | 含义 | 修复做法 | 何时可保留 |
| --- | --- | --- | --- | --- |
| `unshootable`（`UA01–UA04`、`UA11`、`UA12`） | `suggest` | 动作行命中拍不出的句式模式（`UA01–UA04` 否定伪动作、`UA11` 微表情、`UA12` 心理活动） | 改写成具体可见动作、身体姿态或听得见的声音 | 仅当近景反应特写明确拍得出来时保留 |
| `dialogue-run` | `suggest` | 同场景连续对白行超过 `drama.dialogue_run_max`（默认 6；空行与注释不打断） | 每 2–4 句插一条动作、反应或道具变化 | 刻意设计的快口压迫交锋经核对可保留 |
| `voiceover-quota` | `suggest` | 单集 OS 超 `os_max`（默认 2）或 VO 超 `vo_max`（默认 1）；括号按 `，` `,` `、` `/` 与空白拆词全词匹配（不分大小写），`旁白` 算 VO、`字幕` 不计 | 删减重复独白，把能演出来的转成动作与对白 | 旁白解说主导剧保留（建议同步把配置对应项设为 `null`） |
| `voiceover-open` | `suggest` | 场景 1 第一条内容行是 OS 或 VO 行 | 一律改为带运动的可见动作开场 | 不建议保留，改为动作开场 |

### 4. 系列规模与付费卡点规则（全剧）

| 规则 | 级别 | 含义 | 修复做法 | 何时可保留 |
| --- | --- | --- | --- | --- |
| `episode-gap` | `suggest` | 第 1 集到最大已写集之间有缺号 | 补写缺集或核对文件名补零 | 跳写试拍集阶段可暂保留 |
| `episode-total` | `suggest` | 已写集数超过 `series.md` 的 `总集数` | 合并冗集，或经作者确认更新 `总集数` | 扩集确认前不可放任 |
| `paywall-placement` | `block` | `<!-- paywall -->` 不在 `<!-- hook: X -->` 之后，或其后还有非空、非注释内容（钩子与卡点间及卡点后均允许空行与注释） | 把 `<!-- paywall -->` 移到钩子标记之后，且其后不留任何剧本内容 | 不可保留 |
| `paywall-missing` | `block` | `paywall.first_at` 非 `null`、全剧无卡点、且最大已写集号 ≥ `first_at[1]` | 在最后一集免费集末尾补上 `<!-- paywall -->`；免费剧则把 `first_at` 设为 `null` | 不可保留 |
| `paywall-position` | `block` / `suggest` | `first_at` 非 `null` 时首卡点不在区间内为 `block`；`first_at` 为 `null` 而剧本仍留卡点为 `suggest` | 调整卡点集号，或经作者确认改配置 `drama.paywall.first_at`；免费剧误标应删去 | `block` 不可保留 |
| `paywall-ratio` | `suggest` | `paywall.first_at` 非 `null`、`总集数` 已知且首卡点集号 ÷ 总集数不在 `free_ratio` 区间 | 核对免费集数或总集数，必要时请作者改配置 | 经作者确认的特殊平台方案可保留 |
| `paywall-hook` | `block` | 任一卡点集钩子低于 `paywall.hook_min`（默认 `A`；即使 `first_at` 为 `null`，残留卡点仍会检查） | 加强断章悬念并提升钩子级别至达标 | 不可保留 |
| `paywall-plan` | `suggest` | 剧本已存在首个实际卡点且 `series.md` 的 `免费集数` 已填，但两者不等 | 同步 `series.md` 的 `免费集数` 或调整首卡点落点 | 规划未定稿时暂留，定稿前须对齐 |

### 5. 映射表与 Bible 一致性规则（全剧）

| 规则 | 级别 | 含义 | 修复做法 | 何时可保留 |
| --- | --- | --- | --- | --- |
| `map-missing` | `suggest` | 已写的分集在 `adaptation-map.md` 没有对应行 | 立即在映射表补回该集一行（[SB §9.2](formats/drama.md)） | 不可拖延到交接前 |
| `map-foreshadow` | `block` | 映射表 `伏笔` 列引用了 `bible/foreshadows.md` 不存在的 F-ID | 核对 ID 拼写；原创剧不填 F-ID，改记 `series.md` `## 悬念账` | 不可保留 |
| `map-character` | `suggest` | 映射表 `人物` 列出现 `bible/characters.md`（含别名）里没有的人名（注：脚本不核验 `series.md` `主要人物` 与 `范围`） | 补规范名；短剧新增角色在 `characters.md` 追加带 `范围：短剧:{series}` 的块 | 一次性标签龙套经核对可保留，核心 / 配角须建档 |
| `map-order` | `block` / `suggest` | 同一 F-ID「收」早于「埋」为 `block`；只收未埋为 `suggest` | 调整集序或补埋设集 | `block` 不可保留；前史倒叙经核对可保留 `suggest` |
| `map-unresolved` | `suggest` | 已写集数等于 `总集数`，但埋下的 F-ID 既未收也未弃 | 终局前回收，或改记为弃并写明改动理由 | 留作第二季悬念经作者确认可保留 |
| `map-source` | `suggest` | `来源章` 指向尚无规范定稿的小说章节 | 核对章号；改编超前或模式 C 散稿未导入时标明原因 | 合理保留，绝不代写小说章 |

---

## 四、`lint.mjs --series` 对剧本生效的规则

运行 `lint.mjs --series <series>` 时，文件类型为 `episode`。预处理与豁免口径：

- **扫描范围**：HTML 注释先整体屏蔽；`narration`（叙述范围）对剧本仅指动作行 `△` 之后的文字，**且同一行内成对引号（`“…”`、`「…」`、`『…』`、`\"…\"`）内的文字也会被屏蔽**；对白文字属于 `all` 范围。
- **豁免与覆盖**：`<!-- lint-ignore: 规则或ID -->` 单独成行时**豁免下一个非空行**，`<!-- lint-ignore-file: ... -->` 豁免全文件（[SB §7.2](formats/chapter.md)；仅对 `lint.mjs` 生效，对 `drama-check.mjs` 无效）。可在 `.fiction/config.json` 的 `lint.rules` 按模式 ID（优先）或规则名覆盖为 `block` / `suggest` / `off`（[SB §8](formats/config.md)），或在 `.fiction/lint-patterns.txt` 的 `[disable]` 段关闭内置模式。

| 规则 | 默认级别 | 剧本中检查什么 | 修复做法 |
| --- | --- | --- | --- |
| `banned-term` | `block` | `lint.banned_terms` 禁用词（`all` 范围，含标题与对白） | 替换为符合本书口径的表述 |
| `desensitize` | `block` | `lint.desensitize.*` 现实地名、学校、公司、人名等 | 按提示换成虚构或模糊称谓 |
| `exact-year` | `block` | `exact_years=true` 时命中精确公历年份 / 年月（`EY01–EY03`） | 改用相对时间（「十五年前」「入冬前」） |
| `internal-ref` | `block`（`IR07` `suggest`） | 泄漏文件名、项目路径、章号 ID、F/T/I 编号、Markdown 链接、注释外标记、支线 ID | 删掉内部编号，改回戏内称呼 |
| `internal-term` | `suggest` | 出现「伏笔」「钩子」「大纲」等写作术语 | 非戏内角色讨论剧本时改回自然台词 |
| `summary` | 内置 `SUM01–SUM13` 默认全为 `suggest` | 动作行出现替观众下结论的总结句（作者扩展模式按配置级别） | 删掉总结，改成具体动作或道具画面 |
| `ai-tone` | `AT01–AT09` `block`；`AT21–AT29` `suggest` | 动作行命中陈词套话或空洞情绪词 | 清零全部 `block`，把套话换成可拍动作 |
| `custom` | 按作者配置 | `.fiction/lint-patterns.txt` 的自定义规则 | 按作者自定义提示处理 |
| `frozen-modified` / `frozen-unsealed` | `block` / `suggest` | 项目级冻结小说章检查（每次 lint 都会跑） | 均先交作者核实；`frozen-modified` 绝不改动冻结正文或强覆哈希；`frozen-unsealed` 经作者确认新公开范围后转 `fiction-init`「更新冻结清单」模式补封存（未安装时请作者两步处理：先更新 `.fiction/config.json` 的 `frozen.ranges`，再从书根运行 `node <本 skill 目录>/scripts/lint.mjs --freeze`，见 [SB §4.2](formats/project.md)） |

---

## 五、级别与问题分层

脚本级别回答“脚本怎么报”，分层回答“这条问题有多严重、能不能挡住交接”。本节只是人工处置口径，不改变任何规则的级别与脚本行为；与 `fiction-review` 的审校分层同一套说法。

| 层级 | 本 skill 里包括什么 | 处置 |
| --- | --- | --- |
| 硬约束 | 两个脚本的全部 `block`（格式、解析、钩子与卡点标记、映射 F-ID 与先埋后收、禁词、脱敏、精确年份、内部引用），以及 `AGENTS.md`「本书口径」里作者定的硬规则；`length` 级别取 `drama.length_level`，配成 `block` 即归此层 | 一律清零，不能写“已核对，保留”；未清不交接 |
| 审定约束 | `[模型]` 复核里的事实、因果与连戏问题：站位、道具、在场名单、伤势前后不接，提前写出作者真相，破局或反转没有前文依据；以及关乎映射与规划一致性的 `suggest`：`map-missing`、核心或配角的 `map-character`、`map-unresolved`、`episode-total`、`paywall-plan` | 修，或经作者确认后保留；第三节表中「何时可保留」列允许保留的，按该行口径记「已核对，保留：理由」并写明作者已确认 |
| 技法默认 | 多数写作类 `suggest`：`unshootable`、`dialogue-run`、`voiceover-quota`、`max-scenes`、`length`（默认 `suggest` 时）、`action-missing`；本 skill references 里的可调默认（四挡节奏、场数预算、对抗四步、跨批套路重复） | 逐条核对，改或记“已核对，保留：理由”；单独不构成返修理由 |
| 口味选项 | 作者偏好的台词腔调、镜头取舍 | 只作备注 |

- **严重度**沿用四档：阻断（硬约束，必须清）、重要（审定约束，须修，作者豁免除外）、次要（仅技法默认，不挡交接，不因数量多升级）、备注（技法默认或口味，拿不准的一律记备注交作者）。
- **升级例外**：套路重复或技法问题同时违反了已立事实或因果（例如上一集立下的伤势、欠债、身份暴露这一集无解释地消失），按审定约束记“重要”，一次即可。
- **汇报写法**：保留的技法类 `suggest` 照旧记「已核对，保留：理由」；`[模型]` 发现按 `位置 / 问题 / 修改方向 / 严重度·层级` 列出，先列阻断与重要。交接门槛不变：两个脚本最新一次退出码均为 `0`。
