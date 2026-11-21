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
