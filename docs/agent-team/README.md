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
| [T6](tasks/T6.md) | 打包：marketplace / README 中英 | direct | director; README zh in-house writer | in progress (marketplace.json validated) |
| [T7](tasks/T7.md) | 小规模评测 | designed | in-house L2 eval designer | in progress |
| [T8](tasks/T8.md) | 集成与全量验收 | solo | director | planned |
| [T9](tasks/T9.md) | 开源短剧/分镜/提示词项目调研 | outsource | liaison-agy-research | accepted |
| [T1.b](tasks/T1.b.md) | 契约扩展：分镜/提示词/视觉资产 | consult | director | committed |
| T5.b | 示例书：视觉资产、3 集分镜与提示词 | outsource | agy neon (worktree) | committed (5618de8) |

## Files

- [progress.md](progress.md): status snapshot, completed log, next-up queue, user decisions, open questions, pitfalls
- [decisions.md](decisions.md): numbered decisions; never rewritten, only marked overturned
- [lessons.md](lessons.md): user adjustments and lessons learned; rules promoted from here live in [AGENTS.md](../../AGENTS.md)
- `tasks/<ID>.md`: one card per task or external job (flow, holder, lease, log, questions, result)
