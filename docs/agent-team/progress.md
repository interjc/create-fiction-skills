# Progress

Back to the [board](README.md). Dates are absolute (YYYY-MM-DD). Acceptance numbers are written once, in the completed log.

## Status snapshot

<!-- newest first: one entry per recently accepted, committed or in-flight task -->
- 2026-11-21: 12 个 skill 全部验收提交；示例书走完分镜与提示词（T5.b）；validate 0 错误、skill 测试 145 通过。进行中：T6（marketplace.json 已过 `claude plugin validate`，README 中文起草中）、T7（评测集设计中）。OpenCode 的 ChatGPT 额度约 22:25 JST 用尽，gpt-6.2-sol 工作改走 Codex。
- 2026-11-21: T9 accepted; T1.b in design with Fable 5.2. Wave 1 dispatched: OpenCode gpt-6.2-sol (T2.a, T2.b, T4.a/c/e/h, main checkout, disjoint leases); agy (T4.b/d/f neon-high, T4.f2 hydrogen-high, T5 neon-high, each in its own git worktree under ../cfs-wt/).
- 2026-11-21: T1 契约冻结并提交（a4b600d）；范围扩展为创意→网文→剧本→分镜→提示词全流程（e7de357）。
- 2026-11-21: grill 完成，计划草案写入 docs/plan.md，T1–T8 建卡，等待作者确认后开工 T1。

## Completed log

| Task | Spec / decision | Commit | Changes and verification |
|---|---|---|---|
| T1 | docs/spec/* | a4b600d | 三份契约 + 词表，作者确认后冻结 |
| T9 | T9 brief | (no files) | 调研报告 5 节齐全，结论进入 T1.b |
| T1.b | D-03 | be17ab6 | Fable 5.2 设计，总监并入 SB §9.4–§9.9、scripts §11–§13 |
| 格式随 skill 发布 | D-05 | f913db6 | scripts §8.1、validate `spec-ref`、skill-authoring §5 |
| T2.a/T2.b | scripts §1–§10 | 62064a2 | 117 tests pass；示例书真跑通过；测试命令改为带引号 glob（Node 26） |
| T5 | SB 全文 | 63ca67a | 3 章 2279/2574/2349 字、lint 0；埋雷章 7 处脚本项全部检出 |
| T4 wave 1 | D-02/D-04/D-05 | 7b42fde, d959c62 | init/chapter/planner/review/continuity/publish/craft+genres：交叉评审 → 返工 → 内部验收 |
| T2.c1/T2.c2 + R-T2 | scripts §8.1、§11–§13、D-07 | 31089fe, ee47426, a430dc6 | 156 shared/tools tests；真同步生成 references/formats/ |
| T4.i storyboard | D-03、D-08 | c3c513e, 6362633 | GPT 审 14 条 → agy 返工 → 内部验收 |
| T4.g short-drama | D-07 | 45095b2 | L2 设计 → agy 起草 → GPT 审 15 条 → 返工 → 内部验收 |
| T4.j visual-prompts、T3 story-db | D-08 | 49a6774 | 方言卡联网核对；未核实项删除；story-db 11 tests、query_only |
| T5.b | SB §9.4–§9.9 | 5618de8 | 三个检查器 0 block；内部内容审查 9 条修正（含一处剧透） |
| T4.k workflow | D-04 | dc66130 | GPT 审 13 条 → agy 返工 → 内部验收 |

## Next-up queue

1. T6：README 中文（内部）→ README.en.md（agy hydrogen）→ 提交 marketplace.json
2. T7：评测集（evals/<skill>/evals.json、trigger-eval.json）验收
3. T8：跨 skill 一致性、全量验收、提交

## Channel quota

<!-- session state, not policy: one row per external channel and model whose quota matters; resets as an absolute time with zone -->

| Channel · model | State | Checked | Resets | Source | Substitute |
|---|---|---|---|---|---|
| OpenCode · openai/gpt-6.2-sol | usage limit reached | 2026-11-21 22:25 JST | unknown | job error "ChatGPT usage limit reached" | Codex CLI · gpt-6.2-sol (probe OK) |

## User decisions

<!-- numbered summary; the full record is in decisions.md -->

## Open questions

<!-- questions only the human can answer; never delete, mark answered -->
- [answered 2026-11-21 by user: "确认，开工 T1"] Q1 (2026-11-21, to: human): 是否确认 docs/plan.md 并开工？
- [answered 2026-11-21 by user] Q2 (2026-11-21, to: human): OpenCode 没有 gpt-6.2-sol，是暂不使用（当前默认），还是允许用 openai/gpt-6.1-sol？ → 用户已升级 OpenCode，2.3.2 已提供 openai/gpt-6.2-sol（probe 验证），按原规则启用，承接 T3、T4.h。
- [answered 2026-11-21 by user: "接受，派 T2–T5"] Q4 (2026-11-21, to: human): T1 契约默认值是否接受？章节字数下限 2000（≥）、软上限 5000；伏笔 30 章未触及算沉睡；短剧首个付费卡点在第 8–15 集、免费比例 5–25%、卡点集钩子 ≥ A、语速 250 字/分钟；story.db 默认不进 git；短剧伏笔进度只记在 adaptation-map，不回写小说伏笔表。
- [open] Q3 (2026-11-21, to: human): docs/agent-team/ 看板与委派记录随公开仓库一起提交（当前默认），还是只留本地？本机路径已放在 git-ignored 的 .agent-team/local.md。

## Pitfalls

| Location | What it is | Why it is this way | Guidance |
|---|---|---|---|
