# create-fiction-skills 一期计划

> 状态：草案，待作者确认（2026-11-21）。确认后按本文件派工；实施中如有偏差，先改本文件再改产物。
> 任务看板：[docs/agent-team/README.md](agent-team/README.md)。团队与委派规则：[AGENTS.md](../AGENTS.md) `## Subagent team`。

## 1. 目标

把《开源筑基丹》长期连载（600+ 章）里跑通的写作方法，抽成一套**公开、可组合、跨宿主**的网文与竖屏短剧写作 skills：

- 作者主导：AI 负责查资料、起草、审校、记账；作者拍板设定和方向。
- 长篇不崩：设定、时间线、伏笔、支线、人物关系都只有一个主写入口，每章写完都要回写。
- 网文与短剧打通：短剧 skill 直接读取网文项目的 story bible，不从零重新改编。

## 2. 已确认的决定（grill 结果）

| # | 决定 | 结果 |
|---|---|---|
| D1 | 写作形式 | 网文长篇 + 竖屏短剧（影视长剧/电影剧本留到二期） |
| D2 | 通用化方式 | 通用内核 + 题材包 + 项目口径；书专属规则由 `fiction-init` 生成到作者自己的项目里 |
| D3 | 状态层 | Markdown 是唯一权威；检查脚本零依赖 Node `.mjs`；SQLite 索引保留为可选 skill `fiction-story-db` |
| D4 | 发布形态 | Agent Skills 标准目录（`skills/<name>/SKILL.md`）+ Claude Code plugin marketplace |
| D5 | 套件拆分 | 按工作流拆 9 个 skill，统一 `fiction-` 前缀（见 §4） |
| D6 | 平台发布 | 收录 `fiction-publish`，标为实验性；作者个人参数改成首次询问并写入项目配置 |
| D7 | 示例 | 新写一本原创小示例书；只借用《开源筑基丹》的方法，不搬正文 |
| D8 | 质量门槛 | 结构校验 + 脚本单测 + 每个核心 skill 2–3 个小规模评测，结果交作者抽查 |
| D9 | 外部团队 | gpt-6.2-sol 的活优先 OpenCode、其次 Codex CLI；agy 用 gemini-4-neon（执行可用 gemini-4-hydrogen）；其他情况走内部 |
| D10 | 保密边界 | 外部团队可读两个仓库的全部内容 |
| D11 | 外包范围 | 尽量外发，包括 SKILL.md 正文起草；内部负责契约、规格冻结、验收和提交 |
| D12 | 语言 | SKILL.md 与 references 用中文；frontmatter description 中英双语；README 中英两版 |
| D13 | 许可 | MIT（仓库已有 LICENSE） |

## 3. 定位：和市面方案的区别

调研（2026-11）结论：主流套件（inkos、oh-story-claudecode、webnovel-writer 等）已经收敛到“单一权威状态 + 派生视图 + 章节提交”；短剧类 skill 都从外部小说重新改编。我们的差异化：

1. **网文 → 短剧直通**：`fiction-short-drama` 读取同一份 story bible（人物、伏笔、时间线），在 `adaptation-map.md` 里维护“章 → 集”映射和短剧侧的伏笔进度（小说伏笔表只记小说，不回写；改编改动设定时走 canon 拍板）。市面上没有。
2. **人能读的 Markdown 权威 + 主写入口注册表**：每类信息只在一份文件里维护，`sources.md` 写清楚谁读谁写；不强迫作者学 JSON。
3. **伏笔到期 / 逾期告警**：伏笔表带“计划回收章”，脚本扫出已到期、已逾期、长期沉睡的伏笔。
4. **作者已有手稿也能接入**：`fiction-init` 支持“导入已有稿件 → 反向抽取 bible”，不只服务从零开写。
5. **可复现的评测样本**：示例书里放一份故意埋了设定矛盾、时间错位、AI 腔的测试稿，review 类 skill 用它做回归。
6. **诚实标注**：每个 skill 写明哪些检查由脚本保证，哪些要靠模型或作者判断。

## 4. 套件结构

```
create-fiction-skills/
├── .claude-plugin/marketplace.json     # 两个插件：create-fiction（核心 7 个）、create-fiction-extras（story-db、publish）
├── skills/
│   ├── fiction-init/          建书：问答生成项目 AGENTS.md、bible 骨架、主写入口表、选题材包；或导入已有稿件
│   ├── fiction-planner/       书名简介、黄金三章、全书/卷纲/章纲、爽点节拍、钩子分级、日更组合
│   ├── fiction-chapter/       写章六步闭环：brief → resources → outline → 正文 → 字数检查 → 章后沉淀
│   ├── fiction-review/        硬规则扫描 + 编辑式 review + 去 AI 味 + 跨章复核，闭环到无明显问题
│   ├── fiction-continuity/    story bible 读写协议：伏笔/支线/人物/时间线/物品、冲突裁决、伏笔逾期扫描
│   ├── fiction-craft/         技法库：场景、scene-sequel、信息分层、对话、氛围、叙事渲染、风格指南模板；references/genres/ 题材包
│   ├── fiction-short-drama/   竖屏短剧：原创或从 bible 改编、分集大纲、前 3 秒钩子、付费卡点、剧本格式与机检
│   ├── fiction-story-db/      可选：node:sqlite 索引（零依赖）+ brief / update / sources，服务 300 章以上长篇
│   └── fiction-publish/       实验：平台定时发布（先番茄），参数化
├── shared/lib/                 脚本共用代码的唯一源，由 tools/sync-shared.mjs 复制进各 skill 的 scripts/
├── examples/demo-book/         原创示例书：完整 bible + 3 章网文 + 3 集短剧 + 1 份埋雷测试稿
├── evals/                      每个核心 skill 2–3 个评测用例与结果
├── docs/spec/                  契约：story-bible 规范、SKILL 写作规范、去书专属化词表
└── tools/validate.mjs          全仓结构校验
```

每个 skill 自带用到的脚本（可以单独安装），共用逻辑只在 `shared/lib/` 维护一份。

### 4.1 来源映射（open-cultivation → 新 skill）

| 来源 | 去向 | 处理 |
|---|---|---|
| `AGENTS.md` §二–§五（主角规范、脱敏、文件管理、创作规则） | `fiction-init` 的项目 AGENTS.md 模板 | 书专属值变成待填字段；通用规则（克制视角、信息只说一遍、不替主角总结）进内核 |
| `idea/README.md`（分层、主写入口、按任务读取、按事件写回） | `fiction-continuity` | 几乎原样通用化，这是内核 |
| `skills/chapter-writer/SKILL.md` | `fiction-chapter`（流程）、`fiction-planner`（钩子分级、爽点节拍、日更组合）、`fiction-craft`（准备章/行动章/交易/分赃写法） | 冻结章、日志、执法队、地图循环等书专属规则移出；地图循环抽象成“区域循环”题材模板 |
| `chapter-writer/review-guideline.md`、`writing-craft/references/serial-blueprint-audit.md` | `fiction-review` | 闭环流程、八步审核、总结句搜索通用；修为层级、翻译设备等移出 |
| `writing-craft/`（SKILL、style-guide、scene-craft、dual-line、atmosphere、narrative-techniques） | `fiction-craft` | 风格指南改成“如何为自己的书写风格指南”的模板，原书例句不搬 |
| `skills/story-db/` + `tools/db/`（Drizzle schema、seed、brief、update、sources） | `fiction-story-db` | 改用 `node:sqlite`，去掉 pnpm/Drizzle 依赖，schema 对齐 docs/spec |
| `tools/chapter-length.ts` | `shared/lib/length.mjs` | 零依赖移植，保留计数口径（排除 Markdown 标识、标题、注释、空白） |
| `skills/publish-to-fanqie/` | `fiction-publish` | 每日字数阈值、AI 选项、默认时间、检测方式改为首次询问并写入 `.fiction/config.json` |
| （无） | `fiction-short-drama` | 新写，参考调研里的公开做法（时长档位、△ 动作、付费卡点配比、合规检查） |

## 5. 契约（先于一切派工冻结）

`docs/spec/story-bible.md` 定义所有 skill 和脚本共享的项目结构：

```
<book>/
├── AGENTS.md                  # 本书规则（fiction-init 生成，作者维护）
├── .fiction/config.json       # 字数阈值、钩子级别、禁用词、脱敏规则、平台参数
├── bible/
│   ├── sources.md             # 主写入口注册表：信息类型 → 唯一文件 → 何时读 → 何时写
│   ├── canon.md  timeline.md  world-rules.md
│   ├── characters.md  character-dynamics.md
│   ├── plot-outline.md  volumes/{卷}.md
│   ├── storylines.md  subplots.md  foreshadows.md  inventory.md
├── chapters/{卷}/vol-info.md, summary.md, {章}/outline.md, resources.md, v{n}.md
└── drama/{剧名}/series.md, adaptation-map.md, episodes/ep{NNN}.md
```

规范里写死脚本要解析的格式：伏笔表与支线表的列名、状态符号、钩子注释 `<!-- hook: A -->`、章节路径规则、`config.json` 字段。脚本只认规范，skill 正文只引用规范，不各自另立格式。

另外两份契约：

- `docs/spec/skill-authoring.md`：frontmatter（name 与目录同名、description 中英双语且 ≤1024 字符）、SKILL.md ≤500 行、细节下沉 references、脚本零依赖、每条检查标注“脚本保证 / 模型判断 / 作者判断”。
- `docs/spec/debook-terms.txt`：去书专属化词表（人名、组织、书名、书内术语、作者个人参数），全仓 grep 必须为 0（示例与说明里引用来源时除外，白名单写在同一文件）。

## 6. 任务与派工

流程定义见 subagent-team skill。层级：L1 = 本会话（总监）；L2 = 内部专家子 agent；L3 = 内部执行/审查/联络员；L4 = 外部团队。

| 任务 | 内容 | 流程 | 执行 | 审查 |
|---|---|---|---|---|
| T1 | 契约：story-bible 规范、skill-authoring 规范、去书专属化词表、仓库骨架、validate.mjs 规格 | designed（L2 设计，L1 定稿） | 内部 | 作者确认 |
| T2 | 共用脚本：length / lint（禁用词、脱敏、总结句、AI 腔两级、内部引用泄漏）/ brief（读 markdown）/ foreshadow-scan / drama-check + `sync-shared.mjs` + `validate.mjs`，全部带 `node --test` | outsource | OpenCode · gpt-6.2-sol · medium（备选 Codex） | 内部 L3 + agy 只读二审 |
| T3 | `fiction-story-db`：node:sqlite 移植 Drizzle schema、seed、brief、update、sources，带测试 | outsource | OpenCode · gpt-6.2-sol · medium（备选 Codex） | 内部 L3 + agy 只读二审 |
| T4.a | `fiction-init` SKILL.md + 模板 | outsource | OpenCode · gpt-6.2-sol · high（备选 Codex） | agy neon 交叉 + 内部 |
| T4.b | `fiction-planner` | outsource | agy · gemini-4-neon-high | gpt-6.2-sol 交叉（OpenCode，备选 Codex） + 内部 |
| T4.c | `fiction-chapter` | outsource | OpenCode · gpt-6.2-sol · high（备选 Codex） | agy neon 交叉 + 内部 |
| T4.d | `fiction-review` | outsource | agy · gemini-4-neon-high | gpt-6.2-sol 交叉（OpenCode，备选 Codex） + 内部 |
| T4.e | `fiction-continuity` | outsource | OpenCode · gpt-6.2-sol · high（备选 Codex） | agy neon 交叉 + 内部 |
| T4.f | `fiction-craft` 主体 | outsource | agy · gemini-4-neon-high | gpt-6.2-sol 交叉（OpenCode，备选 Codex） + 内部 |
| T4.f2 | 题材包（修仙/玄幻、都市、悬疑、言情、科幻、历史；同一模板） | outsource | agy · gemini-4-hydrogen | 内部 |
| T4.g | `fiction-short-drama`：L2 先出方法设计（含 bible 直通），冻结后外发起草 | designed+outsource | 设计内部 L2；起草 agy · gemini-4-neon-high | gpt-6.2-sol 交叉（OpenCode，备选 Codex） + 内部 L2 验收 |
| T4.h | `fiction-publish`：参数化移植 | outsource | OpenCode · gpt-6.2-sol · medium（备选 Codex） | 内部 |
| T5 | 示例书：bible、3 章、3 集短剧、埋雷测试稿（矛盾清单单独存放供评测对照） | outsource | agy · gemini-4-neon-high | 内部内容审查 |
| T6 | 打包：marketplace.json、plugin.json、README 中文版；英文 README 翻译 | direct + outsource | 中文内部；英文 agy · gemini-4-hydrogen | 内部 |
| T7 | 评测：每个核心 skill 2–3 个用例（触发是否准确 + 对示例书跑一遍），产出交作者抽查 | designed | 内部 L2/L3 | 作者 |
| T8 | 集成：跨 skill 一致性、交叉引用、全量验收、提交 | solo | L1 | — |

依赖：T1 → T2/T3/T4/T5 并行 → T6 → T7 → T8。T4 各 skill 的 brief 都附：契约文件、来源映射对应行、原文件路径（外部可直接读 open-cultivation）、去书专属化词表。

OpenCode 与 Codex：两者都跑 gpt-6.2-sol。按作者 2026-11-21 的指示，gpt-6.2-sol 的活先派 OpenCode，OpenCode 不可用或额度用完再派 Codex。二者是同一模型，互相不担任交叉审查；gpt 起草的产物由 agy 交叉审，agy 起草的产物由 gpt-6.2-sol 交叉审。

## 7. 验收标准

全仓（每次提交前由 L1 跑）：

```bash
node tools/validate.mjs            # frontmatter、行数、链接可达、双语 description、零依赖、词表 grep = 0
node --test skills/*/scripts/tests/
python3 <skill-creator>/scripts/quick_validate.py skills/<name>   # 逐个 skill
```

单个 SKILL.md 的内容验收（内部 L3/L2 按清单打勾）：

- 来源映射表里该行的每条通用方法都有落点，或在验收记录里写明舍弃理由。
- 没有书专属内容；书专属规则都变成“项目口径”待填字段或题材包示例。
- 流程每一步都写清读哪个文件、写哪个文件，路径与 `docs/spec/story-bible.md` 一致。
- 每条检查标了“脚本保证 / 模型判断 / 作者判断”。
- description 能让宿主在该触发时触发、不该触发时不触发（T7 验证）。

委派铁律：规格冻结才外发；外部只交 diff 与报告，不做 git 写操作；联络员跑验收命令；内部独立审查；同一任务两轮不过收回内部；只有 L1 提交。

## 8. 风险

- **方法被“通用化”到没味道**：保留原书方法的具体操作（场景五要素、删除测试、总结句搜索词、准备章六步），只换掉书内名词。验收清单第一条就是查这个。
- **外部起草的中文 skill 质量不稳**：交叉审查 + 内部定稿；两轮不过收回内部重写。
- **平台 UI 变化让 fiction-publish 失效**：标实验性，写明最后验证日期。
- **示例书与原书撞题材或撞设定**：示例书选不同题材（brief 里明确），并跑词表 grep。

## 9. 待作者确认

见 [docs/agent-team/progress.md](agent-team/progress.md) “Open questions”。
