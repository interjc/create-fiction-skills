# Decisions

Back to the [board](README.md). Append new decisions at the end. Never rewrite one: when it is overturned, add an "Overturned (YYYY-MM-DD)" note under its heading.

<!--
### D-01: <title> (<YYYY-MM-DD>)
- Decision: <...>
- Decided by: <user / director / L2 expert>; user's words: "<verbatim quote>"
- Motivation and evidence: <...>
- Rejected options: <...>
- Overturn if: <...>
- Status: <planned | landed in <commit>>
-->

### D-01: 一期范围与形态 (2026-11-21)
- Decision: 见 [docs/plan.md](../plan.md) §2 的 D1–D13（grill 三轮，作者逐项选择）
- Decided by: user
- Status: planned

### D-02: fiction-chapter 与 fiction-review 也带 foreshadow-scan (2026-11-21)
- Decision: 清单（scripts.md §8）给 `fiction-chapter`、`fiction-review` 加入 `foreshadow-scan`，章后回写与审校时可直接跑 `--only writeback`，不依赖 `fiction-continuity` 是否安装。
- Decided by: director
- Motivation and evidence: T4.c 草稿指出本章回写机检只能借道 fiction-continuity；T4.d brief 也要求审校跑 `--only writeback,invalid`。入口是同一份 shared 代码，多复制一份成本为零。
- Rejected options: 维持原清单、缺 continuity 时只做人工核对（会让“本章完工”的判定依赖另一个 skill 是否安装）。
- Overturn if: 包体积或 validate 规则要求每个入口只属于一个 skill。
- Status: spec §8 已改（随 T1.b 冻结提交）；shared/manifest.json 待 T2.a 验收后同步，再请 T4.c/T4.d 改调用

### D-03: T1.b 契约扩展按 Fable 5.2 草案冻结 (2026-11-21)
- Decision: 采纳 `.agent-team/drafts/T1b.md` 全部 16 条设计与 H 节默认答案：`spec_version` 不升；OS/VO 与连续对白默认值保留且只给 suggest；`pr-lock` 为 suggest；资产库唯一主写文件不变，`fiction-storyboard` 建最小条目与连戏表，`fiction-visual-prompts` 补全外观、锁定词与参考图；validate 加 `dialect-card`（T2.c）；`status` 只给 `fiction-workflow`；三个新 skill 进核心插件。另把示例人物外观对齐示例书，validate 的 frontmatter 规则加“不带引号的纯量含 `: ` 报错”（D-02 同批的教训）。
- Decided by: L2 expert (Fable 5.2) 设计，director 验收；依据作者 2026-11-21 的授权："如果有比较困难的问题可以先尝试给 fable 5.2 评估后继续 除非实在无法解决的再问我"
- Motivation and evidence: T9 调研报告；草案 F 节列出不采纳的建议及理由；厂商限制未核实，全部不进契约，改由作者确认后写入 `prompts.dialects`。
- Rejected options: 见草案 F 节（JSON 主源、LOCK 编号、IMG/PLAN/REF 三态、行号溯源、指纹过期、厂商数字内置等）。
- Overturn if: T2.c 实现或 T5.b 手写分镜时发现格式写不出来或规则误报过多。
- Status: landed in docs/spec（本次提交）；plan.md 的插件与两 skill 分工描述同步

### D-04: 冻结（`lint.mjs --freeze`）统一归 fiction-init (2026-11-21)
- Decision: 首次导入的冻结和此后“新章节进入公开范围”的追加冻结都由 `fiction-init` 负责：它有一个独立的“更新冻结清单”模式（改 `frozen.ranges` → `lint.mjs --freeze` → 报告）。`fiction-publish`、`fiction-continuity`、`fiction-review` 遇到这一事件一律交给 `fiction-init`；未安装时给出两步命令请作者执行。
- Decided by: director（agy 交叉审查 R-gpt 跨 skill 第 2 条）
- Motivation and evidence: 草稿里 publish 交 init、continuity 交 review，而 init 拒绝对既有项目重冻、review 没有冻结流程，形成断链。init 在核心插件里且已带 `lint`，不用改清单；publish 在 extras 插件里，不能当唯一入口。
- Rejected options: 归 fiction-publish（extras 插件，很多作者不装）；归 fiction-continuity（需加 lint 入口，且它管事实不管发布状态）。
- Status: planned（随 wave 1 返工落地）

### D-05: 契约格式以原文摘录随 skill 发布 (2026-11-21)
- Decision: 采纳 Fable 5.2 方案 A：`tools/sync-shared.mjs` 按 `shared/formats.json`（8 个主题、12 个 skill 的分配）把 story-bible.md 指定章节原文摘进 `skills/<s>/references/formats/<topic>.md`，保留章节号；validate 新增 `spec-ref`（skill 里不得出现 `docs/spec` / 契约文件名；`SB §x` 必须落在本 skill 的主题内）。scripts.md 新增 §8.1，skill-authoring.md 第 5 节“格式只在契约里定义”一条改写。
- Decided by: L2 expert (Fable 5.2) 设计，director 验收（agy 交叉审查指出单独安装时格式无处可查）
- Motivation and evidence: 契约 1061 行无法整份放进单个 reference；手写摘要会漂移；把格式写进书里依赖 fiction-init。摘录与 `scripts/lib/` 副本同步更新，`shared-drift` 拦漏同步。草案：`.agent-team/drafts/formats-shipping.md`。
- Rejected options: 每个 skill 手写精简示例（B）；fiction-init 往书里写格式摘要（C）。
- Status: spec landed（本次提交）；实现排进 T2.c 的第一个子任务（T2.b 验收后立即派）；`shared/formats.json` 在 T2.a 交付后由总监建
