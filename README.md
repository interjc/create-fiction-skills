# create-fiction-skills

一套公开的、MIT 许可的 Agent Skills，覆盖中文网文与竖屏短剧写作：**网文 → 分集剧本 → 分镜 → 图片 / 视频提示词**。共 12 个 skill，按流水线拆分；任何一个阶段都可以作为终点，只写到网文也是完整的用法。

方法来自一部 600 多章长篇网文连载的实际写作流程，内容已通用化。作者主导，AI 负责查资料、起草、审校和记账。

English version: [README.en.md](README.en.md)

## 特点

- **网文直通短剧**：短剧 skill 直接读取同一份故事档案（人物、伏笔、时间线），用 `adaptation-map.md` 维护“章 → 集”映射，不从零重新改编。
- **一类信息，一个主写入口**：`bible/sources.md` 写明每类信息只在哪份文件维护、何时读、何时写。档案是人能读的 Markdown，不需要学 JSON。
- **伏笔到期 / 逾期扫描**：伏笔表带“计划回收章”，脚本能扫出已到期、已逾期和长期沉睡的伏笔。
- **已有手稿也能接入**：`fiction-init` 支持导入旧稿并反向抽取故事档案，不只服务从零开书。
- **可复现的评测样本**：`evals/fixtures/` 里有一章故意埋了设定矛盾、时间错位和 AI 腔的稿子，附答案清单，用于 review 类 skill 的回归。
- **诚实标注**：每个 skill 把检查项标成 `[脚本]`、`[模型]`、`[作者]`，说清哪些由脚本保证，哪些靠模型或作者判断。
- **视觉防剧透**：分镜与提示词阶段先做防剧透简报，并用资产库与连戏锁保持人物、场景跨集一致。

## 诚实说明

- Markdown 文件是唯一权威；脚本只做机械检查（字数、格式、脱敏、禁词、伏笔到期、锁定词是否出现等），不判断文笔好坏。
- 脚本零依赖，只用 `node:` 内置模块，需要 Node.js 22.5+。
- `fiction-publish` 是**实验性**的，通过你已登录的浏览器操作，目前只支持番茄小说。
- 提示词的各厂商“方言卡”只在卡上写明的核对日期当天核对过，厂商接口和写法会变，使用前请对照官方文档确认。
- 本套件**不调用任何图片 / 视频生成接口**，只产出提示词；生成前会列清单请你确认。

## 安装

### Claude Code（插件市场）

```text
/plugin marketplace add interjc/create-fiction-skills
/plugin install create-fiction@create-fiction-skills
/plugin install create-fiction-extras@create-fiction-skills
```

两个插件：

- `create-fiction`：核心 10 个 skill。
- `create-fiction-extras`：可选的 `fiction-story-db`（故事索引）与实验性的 `fiction-publish`。

### 其他宿主

把 `skills/<name>/` 整个目录复制到宿主的 skills 目录即可（遵循 Agent Skills 标准）。每个 skill 自带它用到的脚本和契约摘录，可以单独安装。

### 环境要求

脚本需要 Node.js 22.5+；`fiction-story-db` 使用 `node:sqlite`。

## 快速开始

在书项目目录里，直接对 AI 说话即可。

**1. 从零开一本书**

> 我想写一本都市悬疑网文，主角是个修钟表的，帮我开书。

点子还模糊时先用 `fiction-planner` 磨卖点，拍板后由 `fiction-init` 建骨架，再用 `fiction-planner` 做简介和卷纲，最后交 `fiction-chapter` 逐章写。

**2. 已有手稿，导入接着写**

> 我有 30 章旧稿在 manuscript/ 里，导入并整理出故事档案，然后告诉我伏笔哪些该收了。

`fiction-init` 导入并反向抽取档案，`fiction-continuity` 查伏笔与时间线。

**3. 把已写章节改成竖屏短剧，做到分镜与提示词**

> 把前 3 章改成竖屏短剧，每集 80 秒左右，写到图片和视频提示词为止。

`fiction-short-drama` 改编出分集剧本，`fiction-storyboard` 拆分镜，`fiction-visual-prompts` 写提示词。

不确定该从哪步开始时，找 `fiction-workflow`：问它“项目进行到哪了”“下一步做什么”，它会读项目状态、帮你定终点，并把下一步交给对应的 skill。

## Skill 一览

| Skill | 插件 | 做什么 | 自带脚本 |
|---|---|---|---|
| `fiction-workflow` | create-fiction | 总入口：判读阶段与逐集进度，定终点，路由下一步 | status |
| `fiction-init` | create-fiction | 建书骨架；导入旧稿并反抽故事档案；更新冻结清单 | lint, length |
| `fiction-planner` | create-fiction | 创意孵化、书名简介、黄金三章、全书与卷级规划、钩子与日更节奏 | foreshadow-scan |
| `fiction-chapter` | create-fiction | 单章写作六步闭环：查设定、定章纲、写正文、机检、回写 | brief, length, lint, foreshadow-scan |
| `fiction-review` | create-fiction | 章节审校、获准回修、去 AI 味、跨章复核 | length, lint, foreshadow-scan |
| `fiction-continuity` | create-fiction | 故事档案读写协议：伏笔、支线、人物、时间线、冲突处理 | foreshadow-scan, brief |
| `fiction-craft` | create-fiction | 技法库、题材包与本书风格指南 | （无） |
| `fiction-short-drama` | create-fiction | 小说改编或原创竖屏短剧：分集大纲、钩子、付费卡点、剧本机检 | drama-check, lint |
| `fiction-storyboard` | create-fiction | 剧本拆成“段 → 镜”分镜，建资产最小条目与连戏表 | storyboard-check, drama-check |
| `fiction-visual-prompts` | create-fiction | 分镜写成参考图、首尾帧与视频提示词，方言卡，生成前确认 | prompt-check, storyboard-check |
| `fiction-story-db` | create-fiction-extras | 可选：为 300 章以上长篇建可重建的 SQLite 索引 | story-db 系列（`node:sqlite`） |
| `fiction-publish` | create-fiction-extras | 实验性：番茄小说定时发布与状态核验 | length |

## 示例书

`examples/demo-book/` 是一本原创的小示例书，同时也是脚本和评测的样本：

- 完整故事档案：`bible/`（设定、人物、时间线、伏笔、支线、风格指南等）。
- 3 章网文：`chapters/1/1` 至 `chapters/1/3`。
- 短剧《停摆的钟》（`drama/stopped-clock/`）：3 集剧本，以及这 3 集的分镜、视觉资产库、连戏表和图片 / 视频提示词。

埋雷测试稿在 `evals/fixtures/flawed-chapter/`，含一章有问题的正文和答案清单。`evals/prepare.mjs` 为评测用例准备草稿书根，`evals/diff.mjs` 对比运行前后的改动。

在示例书上跑检查（在仓库根目录执行）：

```bash
node skills/fiction-short-drama/scripts/drama-check.mjs stopped-clock --root examples/demo-book
node skills/fiction-storyboard/scripts/storyboard-check.mjs stopped-clock --root examples/demo-book
node skills/fiction-visual-prompts/scripts/prompt-check.mjs stopped-clock --root examples/demo-book
node skills/fiction-workflow/scripts/status.mjs --root examples/demo-book
```

剧本与分镜检查应为 0 阻断；提示词检查会给出若干“建议”级提示（如锁定词字面未出现），不阻断。想看脚本如何报问题，可以对埋雷稿跑：

```bash
node skills/fiction-review/scripts/lint.mjs 4 --root evals/fixtures/flawed-chapter
```

## 仓库结构

```text
.claude-plugin/marketplace.json   两个插件的清单
skills/<name>/                    各 skill：SKILL.md、references/、scripts/
shared/lib/                       脚本共用代码的唯一源
shared/manifest.json              每个 skill 带哪些脚本
examples/demo-book/               原创示例书
evals/                            评测样本与辅助脚本
docs/spec/                        各 skill 与脚本共用的格式契约
docs/agent-team/                  开发看板、决策与经验记录
tools/                            validate.mjs、sync-shared.mjs
```

## 开发

```bash
npm run validate   # 全仓结构与去书专属化校验
npm test           # 脚本与工具的 node --test
npm run sync       # 把 shared/lib/ 复制进各 skill
```

共用代码只在 `shared/lib/` 维护，改完用 `npm run sync` 分发；不要直接改各 skill 里的副本。示例与文档只用 `examples/demo-book/` 里的原创内容。提交前请跑 `npm run validate` 和 `npm test`。

### 开发方式与看板

本仓库按 [subagent-team](https://github.com/interjc/subagent-team-skills) 的方法开发：主 session 做总管，负责牵引和验收；内部 subagent 做设计与审查；外部 agent（agy、Codex CLI、OpenCode）承接起草、返工和交叉评审。任务看板、决策（D-01…）、经验教训和进度都在 [`docs/agent-team/`](docs/agent-team/README.md)，可据此接手或复现开发过程。

想用同一套方法继续开发，先装对应的 skills（`subagent-team`、`cli-agent-delegation`、`agent-handover`）：

```bash
# Claude Code（插件，含三个 skill 和两个只读审核 agent）
claude plugin marketplace add interjc/subagent-team-skills
claude plugin install subagent-team@subagent-team-skills
```

```bash
# 其他支持 Agent Skills 的 agent（skills CLI）
npx skills add interjc/subagent-team-skills
```

```bash
# Codex
codex plugin marketplace add https://github.com/interjc/subagent-team-skills
codex plugin add subagent-team@subagent-team-skills
```

装完重启 agent。外部 agent 的接入与额度细节见该仓库的 README。

## 参考与致谢

下列开源项目启发了部分做法。所有借鉴都停留在**思路层面**：格式与措辞均为原创，没有复制任何文件，因此不随附 Apache NOTICE。

| 项目 | 许可 | 借鉴的思路 |
|---|---|---|
| [short-drama-factory](https://github.com/lixiaoxiao9888-create/short-drama-factory) | MIT | 单集篇幅与集数配比、分级付费卡点与卡点铁律、冷开场禁忌、单集节奏四挡、OS / VO 使用规则、改编时的砍线与并人；剧本可拍性检查（否定式伪动作、连续纯对白、OS / VO 配额与不得开场） |
| [short-drama](https://github.com/0xsline/short-drama) | MIT | 卡点悬念套路、关键集与强钩子集的占比、免费集要完成的任务 |
| [shuohao-skills](https://github.com/eternityspring/shuohao-skills) | Apache-2.0 | 冷开场要带运动、“剧本管戏，分镜管拍”、一条主线加一条支线、人物分层、分批写集与改稿纪律；分镜“段（一次生成）→ 镜”两级结构与默认时长、台词要装得进镜头、镜头认领剧本原文 |
| [drama-skills](https://github.com/zenstory-ai/drama-skills) | MIT | 只改编自有或已获授权的作品；Markdown 作权威的分阶段文档；视觉资产“本体 / 阶段状态 / 单镜动作”三层边界；连戏锁定词与“已挂参考图则豁免”；提示词方言卡；付费生成前的批次确认；改镜不改号 |
| [screenwriting-skills](https://github.com/jtydhr88/screenwriting-skills) | MIT | 动作行只写看得见、听得见的内容 |
| [awesome-short-drama-skills](https://github.com/UnderleveledBuilder/awesome-short-drama-skills) | CC0-1.0 | 短剧 skill 生态索引，用于调研参考 |
| [inkos](https://github.com/Narcooo/inkos) | AGPL-3.0 | 仅一个想法：一帧静态画面只能捕捉单一瞬间；未复制任何代码或文字 |

## 许可

[MIT](LICENSE)
