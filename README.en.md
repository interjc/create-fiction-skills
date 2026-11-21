# create-fiction-skills

An open, MIT-licensed suite of Agent Skills for writing **Chinese** web novels and vertical short dramas: **web novel → episodic script → storyboard → image / video prompts**. It includes 12 pipeline-split skills; any stage can serve as the stopping point—writing only the web novel is a complete workflow on its own.

The method is generalized from the actual production workflow of a serialized web novel of 600+ chapters. The author leads, while AI handles research, drafting, review, and bookkeeping.

中文版：[README.md](README.md)

## Features

- **Web novel straight to short drama**: The short-drama skills read the same story bible (characters, foreshadowing, timeline) directly and maintain a "chapter → episode" mapping in `adaptation-map.md`, avoiding adaptation from scratch.
- **One category, one primary write entry**: `bible/sources.md` specifies which single file owns each type of information, when to read it, and when to write it. Story bibles are human-readable Markdown—no JSON required.
- **Foreshadowing due / overdue scan**: The foreshadowing table includes a planned payoff chapter, allowing scripts to detect due, overdue, and long-dormant threads.
- **Works with existing manuscripts**: `fiction-init` can import existing drafts and reverse-extract a story bible, not just start books from scratch.
- **Reproducible eval fixtures**: `evals/fixtures/` includes a chapter seeded with lore contradictions, timeline mismatches, and AI-isms, paired with an answer key for regression testing review skills.
- **Honest check labeling**: Every skill labels checks as `[脚本]` (script-checked), `[模型]` (model-judged), or `[作者]` (author-judged), making clear what scripts guarantee versus what relies on the model or author.
- **Spoiler-safe visuals**: The storyboard and prompt stages start with a spoiler-filtered brief, and use an asset registry and continuity locks to keep characters and scenes consistent across episodes.

## Honest Notes

- Markdown files are the single source of truth; scripts only perform mechanical checks (word count, formatting, sanitization, banned words, due foreshadowing, presence of continuity lock terms, etc.) and do not judge prose quality.
- Scripts have zero external dependencies, use only built-in `node:` modules, and require Node.js 22.5+.
- `fiction-publish` is **experimental**, operates through your logged-in browser, and currently supports Fanqie Novel only.
- Provider "dialect cards" for prompts were only verified on the check date stated on each card; provider APIs and syntax change, so confirm against official docs before use.
- This suite **does not call any image or video generation APIs**—it outputs prompts only and lists a manifest for your confirmation before generation.

## Installation

### Claude Code (Plugin Marketplace)

```text
/plugin marketplace add interjc/create-fiction-skills
/plugin install create-fiction@create-fiction-skills
/plugin install create-fiction-extras@create-fiction-skills
```

Two plugins:

- `create-fiction`: The 10 core skills.
- `create-fiction-extras`: Optional `fiction-story-db` (story index) and experimental `fiction-publish`.

### Other Hosts

Copy the entire `skills/<name>/` directory into your host's skills directory (following the Agent Skills specification). Each skill bundles the scripts and contract excerpts it uses and can be installed standalone.

### Requirements

Scripts require Node.js 22.5+; `fiction-story-db` uses `node:sqlite`.

## Quick Start

Inside your book project directory, just talk to the AI.

**1. Start a book from scratch**

> 我想写一本都市悬疑网文，主角是个修钟表的，帮我开书。  
> *I want to write an urban suspense web novel with a watchmaker protagonist—help me start the book.*

Start with `fiction-planner` to sharpen a vague idea into a premise with clear selling points, then use `fiction-init` to set up the project, return to `fiction-planner` for the blurb and volume plan, and use `fiction-chapter` to write chapter by chapter.

**2. Import an existing manuscript and continue writing**

> 我有 30 章旧稿在 manuscript/ 里，导入并整理出故事档案，然后告诉我伏笔哪些该收了。  
> *I have 30 existing chapters in manuscript/—import them, organize the story bible, and tell me which foreshadowing threads are ready to pay off.*

`fiction-init` imports the draft and reverse-extracts the story bible; `fiction-continuity` checks foreshadowing and the timeline.

**3. Adapt written chapters into a vertical short drama, through storyboards and prompts**

> 把前 3 章改成竖屏短剧，每集 80 秒左右，写到图片和视频提示词为止。  
> *Adapt the first 3 chapters into a vertical short drama at around 80 seconds per episode, through image and video prompts.*

`fiction-short-drama` adapts the chapters into episodic scripts, `fiction-storyboard` breaks them into storyboards, and `fiction-visual-prompts` writes the prompts.

When unsure where to start, turn to `fiction-workflow`: ask it "where is the project at?" or "what should I do next?"—it reads project state, helps set your endpoint, and hands the next step to the matching skill.

## Skills Overview

| Skill | Plugin | What It Does | Bundled Scripts |
|---|---|---|---|
| `fiction-workflow` | create-fiction | Entry point: inspects stage and per-episode progress, sets endpoint, routes next step | status |
| `fiction-init` | create-fiction | Scaffolds a book; imports drafts & reverse-extracts story bible; updates freeze checklist | lint, length |
| `fiction-planner` | create-fiction | Ideation, title & synopsis, opening three chapters, book & volume outlines, hooks & daily cadence | foreshadow-scan |
| `fiction-chapter` | create-fiction | Six-step single-chapter loop: check lore, outline, draft, script-check, write back | brief, length, lint, foreshadow-scan |
| `fiction-review` | create-fiction | Chapter review, approved revision, de-AI-ifying prose, cross-chapter verification | length, lint, foreshadow-scan |
| `fiction-continuity` | create-fiction | Story bible read/write protocol: foreshadowing, subplots, characters, timeline, conflict handling | foreshadow-scan, brief |
| `fiction-craft` | create-fiction | Craft library, genre packs, and per-book style guide | (none) |
| `fiction-short-drama` | create-fiction | Adapted or original vertical short drama: episode outlines, hooks, paywall beats, script checks | drama-check, lint |
| `fiction-storyboard` | create-fiction | Breaks scripts into "segment → shot" storyboards; builds minimal asset entries & continuity table | storyboard-check, drama-check |
| `fiction-visual-prompts` | create-fiction | Turns storyboards into reference image, keyframe, and video prompts; dialect cards; pre-gen confirmation | prompt-check, storyboard-check |
| `fiction-story-db` | create-fiction-extras | Optional: rebuildable SQLite index for 300+ chapter serials | story-db suite (`node:sqlite`) |
| `fiction-publish` | create-fiction-extras | Experimental: scheduled Fanqie Novel publishing and status verification | length |

## Demo Book

`examples/demo-book/` is a small original demo book that also serves as a fixture for scripts and evals:

- Complete story bible: `bible/` (worldbuilding, characters, timeline, foreshadowing, subplots, style guide, etc.).
- 3 web novel chapters: `chapters/1/1` to `chapters/1/3`.
- Short drama *The Stopped Clock* (`drama/stopped-clock/`): 3 episode scripts, plus storyboards, visual asset registry, continuity table, and image/video prompts for those 3 episodes.

The seeded test draft is in `evals/fixtures/flawed-chapter/`, containing one flawed chapter and an answer key. `evals/prepare.mjs` prepares a draft book root for eval cases, and `evals/diff.mjs` compares changes before and after a run.

Run checks on the demo book (from the repository root):

```bash
node skills/fiction-short-drama/scripts/drama-check.mjs stopped-clock --root examples/demo-book
node skills/fiction-storyboard/scripts/storyboard-check.mjs stopped-clock --root examples/demo-book
node skills/fiction-visual-prompts/scripts/prompt-check.mjs stopped-clock --root examples/demo-book
node skills/fiction-workflow/scripts/status.mjs --root examples/demo-book
```

The script and storyboard checks should report 0 blocking errors; the prompt check emits a few "advisory" notices (such as lock terms not appearing verbatim), which are non-blocking. To see how scripts report issues on the seeded draft, run:

```bash
node skills/fiction-review/scripts/lint.mjs 4 --root evals/fixtures/flawed-chapter
```

## Repository Structure

```text
.claude-plugin/marketplace.json   Manifest for the two plugins
skills/<name>/                    Individual skills: SKILL.md, references/, scripts/
shared/lib/                       Single source of truth for shared script code
shared/manifest.json              Which scripts each skill bundles
examples/demo-book/               Original demo book
evals/                            Eval fixtures and helper scripts
docs/spec/                        Shared format contracts for skills and scripts
docs/agent-team/                  Development board, decisions and lessons
tools/                            validate.mjs, sync-shared.mjs
```

## Development

```bash
npm run validate   # Repo-wide structure and de-book-term validation
npm test           # node --test for scripts and tools
npm run sync       # Copy shared/lib/ into each skill
```

Maintain shared code only in `shared/lib/` and distribute changes with `npm run sync`; do not edit the copies inside individual skills directly. Use only original content from `examples/demo-book/` in examples and docs. Run `npm run validate` and `npm test` before committing.

### How this repo is developed

This repository is built with the [subagent-team](https://github.com/interjc/subagent-team-skills) method: the main session acts as director (orchestration and acceptance), in-house subagents design and review, and external agents (agy, Codex CLI, OpenCode) take drafting, rework and cross-review. The task board, decisions (D-01…), lessons and progress live in [`docs/agent-team/`](docs/agent-team/README.md), so anyone can pick up or reproduce the work.

To keep developing the same way, install the matching skills (`subagent-team`, `cli-agent-delegation`, `agent-handover`):

```bash
# Claude Code (plugin: three skills plus two read-only reviewer agents)
claude plugin marketplace add interjc/subagent-team-skills
claude plugin install subagent-team@subagent-team-skills
```

```bash
# Any other agent that supports Agent Skills (skills CLI)
npx skills add interjc/subagent-team-skills
```

```bash
# Codex
codex plugin marketplace add https://github.com/interjc/subagent-team-skills
codex plugin add subagent-team@subagent-team-skills
```

Restart the agent afterwards. See that repository's README for external-agent setup and quota handling.

## References & Acknowledgements

The following open-source projects inspired parts of our approach. All borrowing is strictly at the **idea level**: formats and wording are original, and no files were copied, so no Apache NOTICE is included.

| Project | License | Ideas Borrowed |
|---|---|---|
| [short-drama-factory](https://github.com/lixiaoxiao9888-create/short-drama-factory) | MIT | Per-episode length and episode-count ratios, tiered paywall beats and hard rules, cold-open taboos, four-gear episode pacing, OS / VO usage rules, trimming threads and merging characters during adaptation; script shootability checks (negative pseudo-actions, consecutive pure dialogue, OS / VO quotas and no-opening rule) |
| [short-drama](https://github.com/0xsline/short-drama) | MIT | Cliffhanger suspense patterns, ratios of key episodes and strong-hook episodes, tasks required of free episodes |
| [shuohao-skills](https://github.com/eternityspring/shuohao-skills) | Apache-2.0 | Cold opens must carry motion, "scripts govern drama, storyboards govern shooting", one main plot plus one subplot, character tiering, batched episode writing and revision discipline; two-level "segment (single generation) → shot" storyboard structure with default durations, dialogue fitting within shots, shots claiming source script lines |
| [drama-skills](https://github.com/zenstory-ai/drama-skills) | MIT | Adapt only owned or licensed works; staged Markdown documents as source of truth; three-layer visual asset boundary ("identity / stage state / single-shot action"); continuity lock terms with "exempt when reference image is attached"; prompt dialect cards; batch confirmation before paid generation; editing shots without renumbering |
| [screenwriting-skills](https://github.com/jtydhr88/screenwriting-skills) | MIT | Action lines describe only what can be seen and heard |
| [awesome-short-drama-skills](https://github.com/UnderleveledBuilder/awesome-short-drama-skills) | CC0-1.0 | Short-drama skill ecosystem index, used for survey reference |
| [inkos](https://github.com/Narcooo/inkos) | AGPL-3.0 | One idea only: a static frame can only capture a single moment; no code or text copied |

## License

[MIT](LICENSE)
