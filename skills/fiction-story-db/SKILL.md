---
name: fiction-story-db
description: >-
  为三百章以上的长篇建立可重建的本地 SQLite 故事索引。遇到“上次出场是哪章”“这条设定去哪份文件查”等跨章问题时使用，也可查章集映射。章节写作交给 fiction-chapter，连贯性核对、回写及“哪些伏笔该收了”等判断交给 fiction-continuity；只有索引已建且作者明确问索引结果时，才查索引中的到期伏笔。短篇优先直接读 Markdown。 Build a rebuildable SQLite story index for long serials. Use it for cross-chapter lookups such as “When did this character last appear?” and “Where is the authoritative record?”, or for chapter-to-episode lookups. Use fiction-chapter for drafting and fiction-continuity for continuity checks, updates, and payoff decisions. Query due setups only when the index exists and the author asks for its results. Read Markdown directly for short books.
license: MIT with Commons Clause v1.0 (see LICENSE)
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---

# 故事索引

先用本地索引找到相关记录，再打开对应的 Markdown 读具体内容。

## 何时用

- 长篇连载有三百章以上，或者需要重复跨卷查人物出场、关系变化、伏笔期限、主写文件和章集映射时，用索引减少翻找。
- 短篇直接读主写文件。写章前的完整简报用 `fiction-chapter` 的 `brief.mjs`，检查伏笔到期、逾期与章节回写用 `fiction-continuity` 的 `foreshadow-scan.mjs`。兄弟 skill 未安装时，逐项打开卷规划、提纲及对应的追踪表手查。

## 开始前

依次读书根 `AGENTS.md` 的「本书口径」、`.fiction/config.json` 和 `bible/sources.md`。缺配置时说明脚本按默认值继续。缺项目口径或主写入口注册表时，提示作者先用 `fiction-init` 补齐，或者直接读已知的来源文件；遇到归属不明的资料，先请作者确认主写入口。写或改任何机读文件前，打开对应的格式摘录核对。 [SB §1–§5](references/formats/project.md)

## 流程

1. **先同步，再查。** 从书根运行 `status`。索引缺失或有改动、新增、移除的来源时，先跑 `index`，让脚本按来源哈希更新。需要重建整库时跑 `index --full`。脚本需要 Node.js 22.5 或更新版本及内置 SQLite；早期 Node.js 22 小版本需在脚本路径前加 `--experimental-sqlite`。 [SB §10](references/formats/story-db.md)

   ```bash
   node <本 skill 目录>/scripts/story-db.mjs status
   node <本 skill 目录>/scripts/story-db.mjs index
   node <本 skill 目录>/scripts/story-db.mjs index --full
   ```

2. **选查询，读来源。** `sources` 返回注册表全表，可按精确键或用途子串筛选；沿 `owner_file` 和 `owner_anchor` 找主写位置。其他查询沿 `source_file` 和一基 `source_line` 回到原文，读该行及所属小节。章规划合并了卷规划与提纲，需要核对具体字段时同时看这两份文件；人物常驻的派生出场定位到人物档案。 [SB §5](references/formats/project.md) · [SB §6](references/formats/bible.md) · [SB §7](references/formats/chapter.md) · [SB §9.2–§9.3](references/formats/drama.md)

   ```bash
   node <本 skill 目录>/scripts/story-db.mjs sources
   node <本 skill 目录>/scripts/story-db.mjs sources timeline
   node <本 skill 目录>/scripts/story-db.mjs sources 人物
   node <本 skill 目录>/scripts/story-db.mjs query character 唐七
   node <本 skill 目录>/scripts/story-db.mjs query chapter 2
   node <本 skill 目录>/scripts/story-db.mjs query foreshadows --status planted,partial --due 3
   node <本 skill 目录>/scripts/story-db.mjs query foreshadows --character 唐七 --subplot B2
   node <本 skill 目录>/scripts/story-db.mjs query subplots --status active --level B
   node <本 skill 目录>/scripts/story-db.mjs query appearances --from 1 --to 3 --character 唐七
   node <本 skill 目录>/scripts/story-db.mjs query absent 唐七 --since 4
   node <本 skill 目录>/scripts/story-db.mjs query settings 闸房
   node <本 skill 目录>/scripts/story-db.mjs query inventory --holder 唐七
   node <本 skill 目录>/scripts/story-db.mjs query timeline --from 1 --to 4
   node <本 skill 目录>/scripts/story-db.mjs query episodes stopped-clock
   node <本 skill 目录>/scripts/story-db.mjs query chapter 2 --root /path/to/book --json
   node <本 skill 目录>/scripts/story-db.mjs --help
   ```

   - `foreshadows --due` 沿用扫描脚本的到期区间，查已埋设和部分揭示的伏笔。要判断逾期、沉睡或回收质量，按上面的连贯性流程处理。
   - `absent --since` 的章号是计算截止章，结果用该章减去最近一次实际在场章。只被提及的人物可能没有在场章可供计算。
   - 退出码 0 表示命令成功。1 表示 `status` 发现缺失或过期，或 `index` 报出阻断性解析问题。索引会保留可解析记录，按 `findings` 定位并核对原文。2 表示用法、配置、运行环境或读取错误，查询时缺库也用 2。看到过期警告或 `stale: true` 时，先更新再将查询结果用于写作。

3. **先写 Markdown，再更新索引。** 作者要求记录实际出场或调整伏笔状态时，用 `sources` 和注册表定位主写入口，再交给 `fiction-continuity` 回写；它未安装时，照对应格式摘录只改主写文件。出现冲突、需要覆盖作者文字或拍板新设定时，先请作者确认。写回后跑 `index` 并重查受影响记录。 [SB §4.2–§5](references/formats/project.md) · [SB §6](references/formats/bible.md)

## 检查

- 用 `status` 确认来源已同步，查看 `index` 报告的解析发现。[脚本]
- 打开返回的来源行，核对出场是实际在场还是提及，伏笔是否真能在目标章回收。[模型]
- 确认设定冲突的裁决和是否将索引提交到 git。[作者]

## 产出

`.fiction/story.db` 是可随时重建的派生索引。Markdown 是唯一权威；索引命令只更新数据库。`fiction-init` 默认把该数据库加入作者项目的 `.gitignore`，是否纳入版本管理由作者决定。汇报索引状态、尚待处理的解析发现，以及所问结果的 Markdown 路径和行号。 [SB §10](references/formats/story-db.md)

## 参考文档

| 遇到的任务 | 打开的格式摘录 |
|---|---|
| 确认书根、主写入口和写回顺序 | [SB §1–§5](references/formats/project.md) |
| 核对人物、支线、伏笔、设定与其他追踪表 | [SB §6](references/formats/bible.md) |
| 核对卷规划、提纲、定稿或冻结章 | [SB §7](references/formats/chapter.md) |
| 核对短剧映射和分集剧本 | [SB §9.1–§9.3](references/formats/drama.md) |
| 核对索引覆盖范围和表字段 | [SB §10](references/formats/story-db.md) |
