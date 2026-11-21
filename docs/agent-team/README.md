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
| [T1](tasks/T1.md) | 契约：story-bible / skill-authoring / 词表 / 骨架 | designed | director | planned |
| [T2](tasks/T2.md) | 共用零依赖脚本 + validate + sync-shared | outsource | liaison-T2 | planned |
| [T3](tasks/T3.md) | fiction-story-db（node:sqlite） | outsource | liaison-T3 | planned |
| [T4](tasks/T4.md) | 9 个 SKILL.md 起草与验收 | designed+outsource | director | planned |
| [T5](tasks/T5.md) | 原创示例书 + 埋雷测试稿 | outsource | liaison-T5 | planned |
| [T6](tasks/T6.md) | 打包：marketplace / README 中英 | direct | director | planned |
| [T7](tasks/T7.md) | 小规模评测 | designed | director | planned |
| [T8](tasks/T8.md) | 集成与全量验收 | solo | director | planned |

## Files

- [progress.md](progress.md): status snapshot, completed log, next-up queue, user decisions, open questions, pitfalls
- [decisions.md](decisions.md): numbered decisions; never rewritten, only marked overturned
- [lessons.md](lessons.md): user adjustments and lessons learned; rules promoted from here live in [AGENTS.md](../../AGENTS.md)
- `tasks/<ID>.md`: one card per task or external job (flow, holder, lease, log, questions, result)
