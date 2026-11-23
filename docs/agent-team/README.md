# Agent team board

Live and durable state of agent work in this project: which task follows which flow, who holds it, what waits for whom. Rules and the team policy live in [AGENTS.md](../../AGENTS.md) (section `## Subagent team`); this directory links to them and never restates them.

The director (L1) maintains this file. Each card under `tasks/` has exactly one writer at a time: its holder.

## Reading order (take-over)

1. This file: tasks and their holders
2. [progress.md](progress.md): status snapshot, completed log, next-up queue, open questions for the human
3. [decisions.md](decisions.md) and [lessons.md](lessons.md) for the area you will touch
4. The cards of the tasks you take over; open escalations: `team-board.mjs status`

## Tasks

| Task | Title | Flow | Holder | Status |
|---|---|---|---|---|
| [T1](tasks/T1.md) | 契约：story-bible / skill-authoring / 词表 / 骨架 | designed | director | committed |
| [T2](tasks/T2.md) | 共用零依赖脚本 + validate + sync-shared | outsource | OpenCode gpt-6.2-sol | committed (a430dc6; R-T2 fixes) |
| [T3](tasks/T3.md) | fiction-story-db（node:sqlite） | outsource | Codex gpt-6.2-sol (OpenCode quota ran out mid-run) | committed (49a6774) |
| [T4](tasks/T4.md) | SKILL.md 起草与验收 | designed+outsource | director | all 12 skills committed (7b42fde … dc66130) |
| [T5](tasks/T5.md) | 原创示例书 + 埋雷测试稿 | outsource | agy neon (worktree) | committed (63ca67a) |
| [T6](tasks/T6.md) | 打包：marketplace / README 中英 | direct | director; README zh in-house writer | done (311384d, cb2e52c) |
| [T7](tasks/T7.md) | 小规模评测 | designed | in-house L2 eval designer | done (609d493) |
| [T8](tasks/T8.md) | 集成与全量验收 | solo | director | done (2ceaf01) |
| [T9](tasks/T9.md) | 开源短剧/分镜/提示词项目调研 | outsource | liaison-agy-research | accepted |
| [T1.b](tasks/T1.b.md) | 契约扩展：分镜/提示词/视觉资产 | consult | director | committed |
| T5.b | 示例书：视觉资产、3 集分镜与提示词 | outsource | agy neon (worktree) | committed (5618de8) |
| [T10](tasks/T10.md) | 审校分层 / 对抗戏破局 / 套路重复（drama-skills 第二轮） | designed+direct | in-house L2 writer | committed (e93e3a4) |
| [T11](tasks/T11.md) | 难题咨询：按题材开场 / 集末状态列 | consult | Fable 5.2 | done → D-11 (1e9d7c7) |
| T12 | 按 T11 结论落地（a 脚本 / b 正文 / c 短剧正文 / d 示例书） | designed+direct | director; in-house writers | committed (07f1bd3 + this commit) |
| T13 | README 致谢补本轮借鉴项 | direct | director | committed (this commit) |

## Files

- [progress.md](progress.md): status snapshot, completed log, next-up queue, user decisions, open questions, pitfalls
- [decisions.md](decisions.md): numbered decisions; never rewritten, only marked overturned
- [lessons.md](lessons.md): user adjustments and lessons learned; rules promoted from here live in [AGENTS.md](../../AGENTS.md)
- `tasks/<ID>.md`: one card per task or external job (flow, holder, lease, log, questions, result)
