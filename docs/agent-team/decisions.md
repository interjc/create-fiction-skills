# Decisions

Back to the [board](README.md). Append new decisions at the end. Never rewrite one: when it is overturned, add an "Overturned (YYYY-MM-DD)" note under its heading.

<!--
### D-01: <title> (<YYYY-MM-DD>)
- Decision: <...>
- Decided by: <user / director / L2 expert>; user's words: "<verbatim quote>"
- Motivation and evidence: <...>
- Rejected options: <...>
- Overturn if: <...>
- Status: <planned | landed in <commit>>
-->

### D-01: 一期范围与形态 (2026-11-21)
- Decision: 见 [docs/plan.md](../plan.md) §2 的 D1–D13（grill 三轮，作者逐项选择）
- Decided by: user
- Status: planned

### D-02: fiction-chapter 与 fiction-review 也带 foreshadow-scan (2026-11-21)
- Decision: 清单（scripts.md §8）给 `fiction-chapter`、`fiction-review` 加入 `foreshadow-scan`，章后回写与审校时可直接跑 `--only writeback`，不依赖 `fiction-continuity` 是否安装。
- Decided by: director
- Motivation and evidence: T4.c 草稿指出本章回写机检只能借道 fiction-continuity；T4.d brief 也要求审校跑 `--only writeback,invalid`。入口是同一份 shared 代码，多复制一份成本为零。
- Rejected options: 维持原清单、缺 continuity 时只做人工核对（会让“本章完工”的判定依赖另一个 skill 是否安装）。
- Overturn if: 包体积或 validate 规则要求每个入口只属于一个 skill。
- Status: spec §8 已改（随 T1.b 冻结提交）；shared/manifest.json 待 T2.a 验收后同步，再请 T4.c/T4.d 改调用

### D-03: T1.b 契约扩展按 Fable 5.2 草案冻结 (2026-11-21)
- Decision: 采纳 `.agent-team/drafts/T1b.md` 全部 16 条设计与 H 节默认答案：`spec_version` 不升；OS/VO 与连续对白默认值保留且只给 suggest；`pr-lock` 为 suggest；资产库唯一主写文件不变，`fiction-storyboard` 建最小条目与连戏表，`fiction-visual-prompts` 补全外观、锁定词与参考图；validate 加 `dialect-card`（T2.c）；`status` 只给 `fiction-workflow`；三个新 skill 进核心插件。另把示例人物外观对齐示例书，validate 的 frontmatter 规则加“不带引号的纯量含 `: ` 报错”（D-02 同批的教训）。
- Decided by: L2 expert (Fable 5.2) 设计，director 验收；依据作者 2026-11-21 的授权："如果有比较困难的问题可以先尝试给 fable 5.2 评估后继续 除非实在无法解决的再问我"
- Motivation and evidence: T9 调研报告；草案 F 节列出不采纳的建议及理由；厂商限制未核实，全部不进契约，改由作者确认后写入 `prompts.dialects`。
- Rejected options: 见草案 F 节（JSON 主源、LOCK 编号、IMG/PLAN/REF 三态、行号溯源、指纹过期、厂商数字内置等）。
- Overturn if: T2.c 实现或 T5.b 手写分镜时发现格式写不出来或规则误报过多。
- Status: landed in docs/spec（本次提交）；plan.md 的插件与两 skill 分工描述同步

### D-04: 冻结（`lint.mjs --freeze`）统一归 fiction-init (2026-11-21)
- Decision: 首次导入的冻结和此后“新章节进入公开范围”的追加冻结都由 `fiction-init` 负责：它有一个独立的“更新冻结清单”模式（改 `frozen.ranges` → `lint.mjs --freeze` → 报告）。`fiction-publish`、`fiction-continuity`、`fiction-review` 遇到这一事件一律交给 `fiction-init`；未安装时给出两步命令请作者执行。
- Decided by: director（agy 交叉审查 R-gpt 跨 skill 第 2 条）
- Motivation and evidence: 草稿里 publish 交 init、continuity 交 review，而 init 拒绝对既有项目重冻、review 没有冻结流程，形成断链。init 在核心插件里且已带 `lint`，不用改清单；publish 在 extras 插件里，不能当唯一入口。
- Rejected options: 归 fiction-publish（extras 插件，很多作者不装）；归 fiction-continuity（需加 lint 入口，且它管事实不管发布状态）。
- Status: planned（随 wave 1 返工落地）

### D-05: 契约格式以原文摘录随 skill 发布 (2026-11-21)
- Decision: 采纳 Fable 5.2 方案 A：`tools/sync-shared.mjs` 按 `shared/formats.json`（8 个主题、12 个 skill 的分配）把 story-bible.md 指定章节原文摘进 `skills/<s>/references/formats/<topic>.md`，保留章节号；validate 新增 `spec-ref`（skill 里不得出现 `docs/spec` / 契约文件名；`SB §x` 必须落在本 skill 的主题内）。scripts.md 新增 §8.1，skill-authoring.md 第 5 节“格式只在契约里定义”一条改写。
- Decided by: L2 expert (Fable 5.2) 设计，director 验收（agy 交叉审查指出单独安装时格式无处可查）
- Motivation and evidence: 契约 1061 行无法整份放进单个 reference；手写摘要会漂移；把格式写进书里依赖 fiction-init。摘录与 `scripts/lib/` 副本同步更新，`shared-drift` 拦漏同步。草案：`.agent-team/drafts/formats-shipping.md`。
- Rejected options: 每个 skill 手写精简示例（B）；fiction-init 往书里写格式摘要（C）。
- Status: spec landed（本次提交）；实现排进 T2.c 的第一个子任务（T2.b 验收后立即派）；`shared/formats.json` 在 T2.a 交付后由总监建

### D-06: 未埋即弃的伏笔，埋设章可写 `?` (2026-11-21)
- Decision: SB §6.2 `埋设章` 在状态为放弃且从未埋下时也允许 `?`。由 T2.c2 改 `bible.mjs` 与测试。
- Decided by: director（示例书 F009 在真实脚本下报 invalid；这是作者常见的合法情况，不是示例书写错）
- Status: spec landed; parser pending (T2.c2)

### D-07: fiction-short-drama 设计里的三个口径 (2026-11-21)
- Decision: (1) `shared/formats.json` 给 `fiction-short-drama` 加 `chapter` 主题（需要 §7.1 定稿、§7.2 钩子级别、§7.3 伏笔动作）。(2) `drama.paywall.first_at` 可为 `null`，表示本剧不设付费卡点；`paywall-missing`、`paywall-ratio` 不查，`paywall-position` 在仍有卡点时降为 suggest。(3) 原创短剧（无小说）保留空的 `foreshadows.md` 表，悬念的埋与收记在 `series.md` 自由小节 `## 悬念账`，不为短剧新开伏笔表。
- Decided by: director（L2 设计 T4.g 提出的三个开放问题）
- Motivation and evidence: 设计方的默认做法是把 `first_at` 设成 `[总集数+1, 总集数+1]` 绕过检查，可用但难懂；`null` 是纯新增配置。伏笔表是小说的唯一主写入口（SB §9.2 禁止短剧改它的状态），短剧另开表会形成双头。
- Rejected options: 新增 `drama.paywall.enabled` 开关（多一个键，与 `first_at` 语义重叠）；允许 `foreshadows.md` 写 `范围：短剧` 行。
- Status: spec landed（本次提交）；`drama-check.mjs` 与 `config.mjs` 的改动排进 T2.c 返工轮

### D-08: 手部特写的缺锁建议照留；地点不加锁定词；收尾转场由末镜认领 (2026-11-21)
- Decision: (1) 只露手的特写照常写 `人物`；连戏解析到服装变体后 `pr-lock` 给的建议是预期结果，在汇报里写明保留理由，不删 `人物`、不加 `备注` 躲建议。(2) 地点靠 `锚点` 与参考图保持一致，不加锁定词。(3) `【黑屏切出】` 这类收尾镜头行由本集末镜的 `依据` 认领。三条都是方法，不改契约与脚本。
- Decided by: director（T5.b 作者反馈的三点，经内部内容审查评估）
- Motivation and evidence: T1.b 草案 H.3 已预见特写的外套不入画，故 `pr-lock` 定为 suggest；`备注` 会连带关掉 `sb-people` 与 `sb-continuity`；§9.7 按段派生地点，给地点加锁会让每个特写都报。
- Rejected options: 允许 `X@本体` 键（以后若作者反馈频繁再议）；给特写 / 大特写免检地点锁（多一条例外，收益小）。
- Status: fiction-storyboard references 已改（本次提交）；fiction-visual-prompts 待其返工完成后补同样两句

### D-09: 跨 skill 的四条归属口径 (2026-11-21)
- Decision: (1) 流水线终点只存在 `.fiction/config.json` 的 `workflow.target`：`fiction-init` 在问答中拿到就写；`fiction-workflow` 只在仍为 `null` 或作者明确要求切换时写；`AGENTS.md ## 本书口径` 不再复制终点。(2) `bible/canon.md`：任一 skill 只可写入作者在本流程明确确认且无冲突的裁决，按 SB §3 冲突优先级；未确认或有冲突的交 `fiction-continuity`。(3) `bible/style-guide.md` 归 `fiction-craft`，`chapters/{vol}/summary.md` 归 `fiction-continuity`；`fiction-chapter` 只转交。(4) 小说章节的「定稿」是选用稿件（SB §7.1），剧本 / 分镜的 `状态：定稿` 才是作者确认；下游入口门槛：分镜要求 `lint --series` 通过报告，提示词要求分镜 `final`。
- Decided by: director（T8 集成审查 11 项 + T7 评测设计者 8 条反馈）
- Motivation and evidence: 审查发现 init 把终点写进 AGENTS.md、workflow 却只读配置，demo 书上 `status.mjs` 显示「未设定」；canon 有五个 skill 各写各的规则；分镜与提示词入口门槛比上游交接条件松。
- Rejected options: 终点同时写 AGENTS.md 与配置（双头）；canon 只许 continuity 写（会让 planner / review 在作者当场拍板后还要再转一手）。
- Status: 已落地（Codex 修复 + 内部验收，本次提交）

### D-10: 看板公开；fiction-init 推荐 subagent-team-skills；解禁 `interjc` (2026-11-22)
- Decision: (1) `docs/agent-team/` 随公开仓库提交，README 中英「开发」节给出 subagent-team-skills 的安装方式。(2) `fiction-init` 新建或导入完成后，若宿主能派子代理或外部 agent 且项目未用 subagent-team-skills，在交接汇报末尾推荐一次，只推荐不代装，拒绝或已装不再提。(3) `debook-terms.txt` 的 `[book]` 去掉 `interjc`（公开 GitHub 账号，用于安装指引）。
- Decided by: user（"docs/agent-team/ 可以放进去，并且告知应该怎么安装这个对应的 skills"；"这个 skill 初始化的时候就可以推荐安装 subagent-team-skills"）
- Motivation and evidence: 推荐安装必须写出 `interjc/subagent-team-skills`；把整份 init SKILL.md 放进 allow-paths 会让其余书专属词也失检，只解禁这一个词更窄。
- Rejected options: 给 `skills/fiction-init/SKILL.md` 加 allow-path。
- Status: 已落地（本次提交）

### D-11: 按开场类型放宽开场；映射表可选列「集末状态」 (2026-11-23)
- Decision: (1) 短剧开场按「开场类型」分：动作冲突（默认）/ 异常静止 / 反差旁白 / 生活切片，规则表放 `fiction-short-drama/references/episode-writing.md`；通则保留起床拉窗帘、超 2 秒赶路、灌输式旁白、无冲突闲聊、人物扎堆报名，新增“首拍立住一个具体的不对劲”“开场 VO 至多一条且下一条是反差动作”。`series.md` 自由小节 `## 开场类型` 记录选择（不机读）；题材包各加一行推荐开场类型。`voiceover-open` 在对应 `drama.voiceover.*_max` 为 null 时不报（SB §8、scripts §drama-check）。(2) `adaptation-map.md` 加可选列 `集末状态`（SB §9.2），写集后回写；新规则 `map-handoff`（suggest）只在有此列的项目对定稿非末集空格报；与 `visual/continuity.md` 分工：剧情 / 信息差 / 筹码 vs 视觉净变化。
- Decided by: director, on Fable 5.2's consult (T11); author approved the direction ("就按你说的来", 2026-11-23)
- Motivation and evidence: `voiceover-open` 不受任何配置控制，旁白主导剧每集一条必留建议；`episode-writing.md` §二禁 OS/VO 开场与 §七允许“开篇一句立人设”自相矛盾。分批写集不带上一批全文，接续只靠「剧情点」列。`parseAdaptationMap` 按列名取值、多余列忽略，加可选列不破坏旧项目。
- Rejected options: 规则主体放题材包（fiction-craft 可选、混搭题材无法裁决）；`drama.open_type` 配置键或机读字段（脚本判不了“克制、反差”）；完全不动脚本；VO 占比上限 0.3（来源自注未实测）；集末状态必填 / 写进分集文件 / 并入 continuity.md；完全不机检。
- Status: 契约已改（本次提交）；脚本、正文、题材包、示例书由 T12 落地

### D-12: 许可改为 MIT with Commons Clause v1.0 (2026-11-23)
- Decision: 根 `LICENSE` 改为 MIT with Commons Clause v1.0，格式与 interjc/subagent-team-skills 一致（Software: Create Fiction Skills，Licensor 不变）；`tools/sync-shared.mjs` 把它复制成每个 skill 的 `LICENSE`；SKILL.md frontmatter 写 `MIT with Commons Clause v1.0 (see LICENSE)`，`package.json` 写 `SEE LICENSE IN LICENSE`，marketplace 两个插件写 `MIT with Commons Clause v1.0`；README 中英「许可」节照该仓库写法，另加“用 skill 写出的作品归用户”一条。不写联系方式（与该仓库一致）。
- Decided by: user（“可以随便使用，但是不可以拿去转卖或者原样包装以后不署名就商用”；选方案 A；“联系方式可以跟 interjc/subagent-team-skills 使用一样的”；“你也可以参考他的协议”）
- Motivation and evidence: MIT 已要求署名但允许转卖；Commons Clause 只禁“出售”，不限制商用写作与产出。条款原文核对自该仓库 LICENSE 与 n8n 早期 LICENSE（commonsclause.com 在本会话不可达）。
- Rejected options: CC BY-NC-SA 4.0（禁一切商用，比作者要的严）；PolyForm Noncommercial / Shield；MIT + 自写中文附加条款（效力模糊）。
- Status: 已落地（本次提交）。此前以 MIT 发布的提交仍适用 MIT。
