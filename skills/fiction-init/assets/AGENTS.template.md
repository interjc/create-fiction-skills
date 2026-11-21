# {{working_title}} · 写作指南

> 新任务先读本文件；书名以 `.fiction/config.json` 为准，本页抬头只是显示。

## 项目概览

- 一句话梗概：{{one_line_pitch}}
- 时代（正文口径）：{{era}}
- 叙述基调：{{tone}}
- 所选题材包见 `.fiction/config.json`；全书阶段和揭示节奏见 `bible/plot-outline.md`，这里不复制。

## 本书口径

| 项目 | 本书写法 |
|---|---|
| 主角规范名 | {{protagonist_name}} |
| 年龄措辞 | {{protagonist_age_wording}} |
| 核心性格与可见表现 | {{protagonist_traits}} |
| 行为底线（绝不会做的事） | {{protagonist_never_does}} |
| 其他本书禁区 | {{book_specific_boundaries}} |

- 视角及切换边界：{{pov}}
- 叙述距离：{{narrative_distance}}
- 正文及对外文案的脱敏尺度：{{public_desensitization}}
- 目标发布平台（仅意向）：{{target_platform}}
- 本次产出终点：{{pipeline_endpoint}}

完整人物档案和人物秘密在 `bible/characters.md`；已裁定的设定在 `bible/canon.md`。精确时间记入 `bible/timeline.md`，现实原型留在对应内部档案；正文与外宣按本书口径使用泛称、虚构名和相对时间，机器词表与年份开关查 `.fiction/config.json`。

## 目录与文件职责

| 路径 | 用途 |
|---|---|
| `.fiction/config.json` | 机器规则覆盖项：章长、日更、脱敏、公开章范围等 |
| `bible/sources.md` | 主写入口：按信息类别查何时读、往哪写 |
| `bible/` | 权威结论、跟踪表、可选专题索引与讨论稿 |
| `chapters/{vol}/{ch}/` | `resources.md`、`outline.md` 和各稿次 `v{n}.md`，章号全书唯一、不补零 |
| `chapters/{vol}/vol-info.md` / `summary.md` | 卷摘要 / 已写内容复盘，不替代 `bible/volumes/{vol}.md` 的详细规划 |
| `drama/`、`publish/` | 做到对应阶段才建：短剧材料、发布材料 |

## 创作规则

1. 按本书的视角边界逐场写：限知场景只写视角人物能看到、推测或感受到的事。秘密分开记「读者已知」与「作者真相」；回收前先让线索在当下场景有用。
2. 信息只说一遍：对白已经讲清，不用旁白再讲；后一次提到时补新信息或后果。能用动作、对白、当事人的判断或决定呈现的，不再替主角总结一句。
3. 每场写出地点、时间感、至少两种感官细节、人物当下想要什么及结尾有什么改变。对白默认每 2–3 句穿插一个有用的动作或神态；连续解释约 5–6 行就用动作或环境打断。本书明确的写法优先。
4. 顺利赶路、例行准备和闲聊若没有信息增量、情绪变化或风险升级，就压缩。先让人物判断和行动体现性格与能力，不靠自夸或旁人盖章。

## 工作流

1. 先查 `bible/sources.md`，每类信息只在一份主写文件更新，别处最多留摘要和指向。按任务读必要文件：先查设定与校时的权威层，再看规划/人物/伏笔等追踪文件，缺信息才查专题索引；讨论稿和早期原材只作参考。
2. `fiction-planner` 定全书及卷级规划，交付卷表、节奏、钩子、日更分组；区域卷另在卷纲自由正文注明每章的区域循环步次、新增的区域理解和结算收益。改卷规划先写 `bible/volumes/{vol}.md`，再更新 `bible/plot-outline.md` 与卷摘要。`fiction-chapter` 读卷摘要、卷规划、设定、简报及上章结尾，备资料 → 写单章 `outline.md` → 写正文 → 检查。
3. `fiction-chapter` 写完按事件回写：出场每章记，伏笔和支线按实际推进更新，时间、关系、物品或规则变化写各自入口，卷完结补复盘；细则找 `fiction-continuity`。技法找 `fiction-craft`，编辑审校找 `fiction-review`；初稿未回写时标「待回写」，完稿或返修后回写再验收。章后衔接点记在交付汇报或下章 `resources.md`，不在支线文件另起标题块。冻结正文不改，矛盾记入 `bible/canon.md` 或留给后续章节解释。
4. 文案由 `fiction-planner` 拟 `publish/blurb.md`、`fiction-review` 审校、`fiction-publish` 确认参数后提交；改书名时核对 `book.title`。新增章节实际公开后，交 `fiction-init` 的「更新冻结清单」模式。
5. 需要改编时按所选终点找 `fiction-short-drama` → `fiction-storyboard` → `fiction-visual-prompts`，到目标就停；用 `fiction-workflow` 路由。未安装相应 skill 时交接文件、待办和未运行的检查，不代做。

Markdown 是故事内容的唯一权威。若用可选的 `fiction-story-db`，`.fiction/story.db` 只存定位和状态，可重建；查到结果仍读 Markdown，变更先写 Markdown 再更新索引。没装也可直接查注册表和源文件。

## 章后复核

- [ ] 标题、有效字符数、钩子标记、已配置的脱敏词与冻结哈希按套件检查。[脚本]
- [ ] 核对主角称谓、年龄写法、视角、前章时间衔接与末章在日更中的位置。[模型]
- [ ] 逐段尝试删除：少掉的信息、情绪或风险是什么；核查重复解释与替人物总结。[模型]
- [ ] 按实际正文登记出场、伏笔、支线及其他变化，检查是否提前泄露读者不该知道的真相。[模型]
- [ ] 冲突设定、对外脱敏例外或发布参数由作者拍板。[作者]
- [ ] 旧材未推翻已确认档案。[模型]
