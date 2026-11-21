# Progress

Back to the [board](README.md). Dates are absolute (YYYY-MM-DD). Acceptance numbers are written once, in the completed log.

## Status snapshot

<!-- newest first: one entry per recently accepted, committed or in-flight task -->
- 2026-11-21: grill 完成，计划草案写入 docs/plan.md，T1–T8 建卡，等待作者确认后开工 T1。

## Completed log

| Task | Spec / decision | Commit | Changes and verification |
|---|---|---|---|

## Next-up queue

1. T1 契约（作者确认计划后开始）
2. T2 / T3 / T4 / T5 并行（T1 冻结后）

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
