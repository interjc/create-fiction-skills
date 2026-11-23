# Lessons and user adjustments

Back to the [board](README.md). Newest first. Record a row when the user corrects the process, an escalation reveals a gap in a brief, an outsourced job fails, or a trap costs time. When a row becomes a project-wide rule, write the rule once in AGENTS.md and fill "Promoted to" with a link; do not restate it here.

| Date | Source | Lesson or adjustment | Promoted to |
|---|---|---|---|
| 2026-11-23 | director | 云端会话（claude.ai/code 容器）里没有 opencode / codex / agy，AGENTS.md 记录的环境检查是桌面端的。开工前先 `which` 一遍外部 CLI；缺失时按「其他情况走内部」派内部子代理，并在 plan 与任务卡里写明，而不是等外部通道 | — |
| 2026-11-21 | liaison report (T4.b, T4.f) | agy 两份草稿的 frontmatter `description` 是不加引号的普通标量且含 `: `，严格 YAML（quick_validate）拒收，各耗一轮返工。已在临时检查器 `check-skill.mjs` 加规则，`_common-skill.md` 要求 description 用 `>-` 块标量 | `.agent-team/briefs/_common-skill.md`；T2.b validate 的 YAML 子集解析器同样应拒收 |
| 2026-11-21 | user: "扩展……把网文改写为剧本 - 剧本改写为场景脚本 - 脚本改写为视频/图片生成的提示词……从创意到网文小说到剧本到短剧（但也可以只到网文）的工作流"；"如果有比较困难的问题可以先尝试给 fable 5.2 评估"；"一定要活用外部委派，本 agent 主要是做任务牵引和监督验收" | 范围扩成完整流水线；难题先问 Fable 5.2；总监只牵引与验收 | docs/plan.md D14–D17；AGENTS.md `## Subagent team` |
| 2026-11-21 | user: "每一个关键环节完成都 git commit" | 每个关键环节验收通过后立即本地提交 | AGENTS.md, `## Subagent team` |
| 2026-11-21 | user: "优先用 opencode 的 gpt，其次用 codex 的" | gpt-6.2-sol 的活先派 OpenCode，再派 Codex | AGENTS.md, `## Subagent team` |
| 2026-11-21 | user: "现在升级了，有 6.2-sol 了" | OpenCode 2.3.2 提供 gpt-6.2-sol，启用为第二条 gpt-6.2-sol 通道 | AGENTS.md, `## Subagent team` |
| 2026-11-21 | user: "agy 主用 gemini-4-neon，opencode 和 codex 主用 gpt-6.2-sol，其他情况走内部"；"agy 的执行也可以用 gemini-4-hydrogen" | 外部模型固定；OpenCode 在没有 gpt-6.2-sol 时不派活 | AGENTS.md, `## Subagent team` |
| 2026-11-21 | user (grill 第 3 轮): 外包范围选“尽量外发”，保密边界选“两个仓库都全开” | SKILL.md 正文起草也外发；外部可读原书全部内容 | AGENTS.md, `## Subagent team` |
| 2026-11-21 | director | OpenCode (ChatGPT login) hit its usage limit mid-run; two jobs died with exit 2 and empty replies, one leaving half-written files. Codex CLI still had quota. Probe the fallback with a one-word prompt, re-dispatch with a takeover note saying partial files exist and are unreviewed, and give Codex no web-dependent work: "verify on the web" becomes "mark 未核对 or remove". | — |
| 2026-11-22 | director | Codex `exec` refuses a non-git working directory ("Not inside a trusted directory"), so an eval dry run on a scratch book copy failed in 1 s. Run `git init` + a baseline commit in the scratch book first; `evals/diff.mjs` and `prepare.mjs` now skip `.git/` so the "unchanged" assertions still hold. | evals/diff.mjs, evals/prepare.mjs |
