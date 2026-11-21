# AGENTS.md — create-fiction-skills

公开的网文与竖屏短剧写作 skills 套件。方法来自长篇连载《开源筑基丹》的实践，内容通用化后发布。

- 一期计划与已确认决定：[docs/plan.md](docs/plan.md)
- 契约（所有 skill 与脚本共用的格式）：`docs/spec/`（T1 产出后以此为准）
- 任务看板：[docs/agent-team/README.md](docs/agent-team/README.md)

## 项目规则

- skill 放在 `skills/<name>/SKILL.md`，名称统一 `fiction-` 前缀，遵守 `docs/spec/skill-authoring.md`。
- 正文与 references 用中文；frontmatter `description` 中英双语。
- 脚本零依赖（只用 `node:` 内置模块），Node 22.5+；共用代码只在 `shared/lib/` 维护，用 `node tools/sync-shared.mjs` 复制进各 skill。不要直接改 skill 里的副本。
- 不得出现《开源筑基丹》的书专属内容（人名、组织、书内术语、作者个人发布参数），以 `docs/spec/debook-terms.txt` 为准。
- 不搬运原书正文；示例只用 `examples/demo-book/` 里的原创内容。
- 提交前跑：`node tools/validate.mjs` 和 `node --test 'skills/*/scripts/tests/*.test.mjs'`。

## Subagent team
<!-- Policy for the subagent-team skill. Edit freely; the skill reads it at the start of each task. -->
- Host harness: Claude Code desktop (confirmed 2026-11-21)
- Model policy: hybrid — external models fixed by the user (below); in-house roles auto
- Cost preference: balanced
- Decided: 2026-11-21, confirmed by the user
- Environment (checked 2026-11-21): Node.js v26.7.0, Codex CLI 0.166.0, Codex plugin no, agy 1.5.13, agy-staff yes (0.7.4), OpenCode 2.3.2
- Team board: docs/agent-team/README.md + native task list
- External delegation: roster
- External scope: outsource as much as the gate allows, including first drafts of SKILL.md bodies; contracts, spec freezing, acceptance and commits stay in-house (user, 2026-11-21)
- External confidentiality: full for this repository and for the source novel repository (user, 2026-11-21); the source path is in `.agent-team/local.md` (git-ignored)
- External order: gpt-6.2-sol work → OpenCode first, then Codex CLI; agy per the table; anything else in-house (user, 2026-11-21)

| Layer | Role | Tier | Model | Effort |
|---|---|---|---|---|
| L1 | Director (main session) | high | the session's own model (never switched) | high |
| L2 | Designer / task lead / content acceptance | high | auto | medium–high |
| L2 | Principal expert (hard design calls) | top | Fable 5.2 | default |
| L3 | In-house reviewer (routine) | mid | auto, ≠ author's model | medium |
| L3 | Runner, liaison | low | auto (Haiku) | low |

| External team | Channel | Model | Use for | May edit? | Status |
|---|---|---|---|---|---|
| Codex CLI | CLI (`codex-run.mjs`) | gpt-6.2-sol · medium/high | second choice for gpt-6.2-sol work, when OpenCode is unavailable or out of quota | yes | verified 2026-11-21 (model listed) |
| agy | agy-staff plugin, fallback `agy-run.mjs` | gemini-4-neon (main); gemini-4-hydrogen for execution and bulk | SKILL.md drafts, genre packs, demo book, translation, read-only cross review | yes | verified 2026-11-21 (models listed) |
| OpenCode | ACP (`opencode-acp-run.mjs`) | openai/gpt-6.2-sol only | first choice for all gpt-6.2-sol work: scripts, story-db, publish, SKILL.md drafts, read-only cross review of agy drafts (same model as Codex, so the two never cross-review each other) | yes, allow-listed shell | verified 2026-11-21 (OpenCode 2.3.2, model listed) |

- Director role: orchestration, supervision and acceptance until the whole program is done; delegate everything else, external first (user, 2026-11-21)
- Hard design problems: consult Fable 5.2 (in-house principal expert) first; ask the author only when that cannot settle it (user, 2026-11-21)
- Never outsourced: `docs/spec/` (contracts), `docs/plan.md`, final acceptance of every SKILL.md
- Shared files (director only): `AGENTS.md`, `docs/plan.md`, `docs/spec/*`, `.claude-plugin/*`, `docs/agent-team/README.md`
- Acceptance commands: `node tools/validate.mjs`; `node --test 'skills/*/scripts/tests/*.test.mjs'`; skill-creator `quick_validate.py` per skill
- Commit / push / deploy: commit locally at every key milestone (each accepted task or sub-task, each frozen contract, each board transition worth keeping), after its checks pass; push only when asked (user, 2026-11-21)
- Lessons and user adjustments: docs/agent-team/lessons.md
