# Progress

Back to the [board](README.md). Dates are absolute (YYYY-MM-DD). Acceptance numbers are written once, in the completed log.

## Status snapshot

<!-- newest first: one entry per recently accepted, committed or in-flight task -->
- 2026-11-21: T9 accepted; T1.b in design with Fable 5.2. Wave 1 dispatched: OpenCode gpt-6.2-sol (T2.a, T2.b, T4.a/c/e/h, main checkout, disjoint leases); agy (T4.b/d/f neon-high, T4.f2 hydrogen-high, T5 neon-high, each in its own git worktree under ../cfs-wt/).
- 2026-11-21: T1 契约冻结并提交（a4b600d）；范围扩展为创意→网文→剧本→分镜→提示词全流程（e7de357）。
- 2026-11-21: grill 完成，计划草案写入 docs/plan.md，T1–T8 建卡，等待作者确认后开工 T1。

## Completed log

| Task | Spec / decision | Commit | Changes and verification |
|---|---|---|---|
| T1 | docs/spec/* | a4b600d | 三份契约 + 词表，作者确认后冻结 |
| T9 | T9 brief | (no files) | 调研报告 5 节齐全，结论进入 T1.b |

## Next-up queue

1. 第一波验收：T2.a/T2.b、T4.a–f、T4.f2、T4.h、T5（交叉评审 + 内部验收 + 提交）
2. T1.b 验收冻结 → 第二波：T2.c、T3、T4.g/i/j、T5.b
3. T4.k → T6 → T7 → T8

## Channel quota

<!-- session state, not policy: one row per external channel and model whose quota matters; resets as an absolute time with zone -->

| Channel · model | State | Checked | Resets | Source | Substitute |
|---|---|---|---|---|---|

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
