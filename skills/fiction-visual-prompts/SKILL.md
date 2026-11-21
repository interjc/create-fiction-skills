---
name: fiction-visual-prompts
description: >-
  把短剧分镜写成资产参考图、首尾帧和分段视频提示词。补全视觉资产与连戏锁，生成前列清单请作者确认。用户说“按分镜写生图词”“出首帧提示词”“写图生视频 prompt”“换提示词方言”或“确认这一批出图出片”时就用，即使没说 skill 名。改镜头交给 fiction-storyboard。本 skill 不调用生成接口。
  Turn short drama storyboards into asset references, first and last frame prompts, and video prompts with continuity locks and author approval before generation. Use for image prompts, video prompts, dialect changes, or batch approval. Send shot changes to fiction-storyboard. This skill never calls generation APIs.
license: MIT
compatibility: Agent Skills standard. Scripts need Node.js 22.5+.
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---

# 短剧图片与视频提示词

把分镜上已经定好的画面和声音写成可逐块核对、可交给生成模型的提示词。

## 何时用 / 不用

有分镜，要补固定外观、参考图槽位、逐镜帧图、逐段视频提示词，或复核和登记生成批次时使用。剧本管戏，分镜管拍法：这里不改台词、段镜、镜号、时长、走位、运镜或连戏表。`fiction-storyboard` 建资产最小条目、维护分镜与连戏。本 skill 补全 `visual/assets.md`，负责 `prompts/` 下的文件。发现画面设计有问题，交回 `fiction-storyboard`。改戏或台词先交 `fiction-short-drama`，再更新分镜，不在提示词里另写一版。[SB §3](references/formats/project.md)

## 开始前

先读作者项目的 `AGENTS.md`「本书口径」、`.fiction/config.json` 和 `bible/sources.md`。缺项目骨架或主写入口表时请作者先用 `fiction-init`，未安装则按 [SB §2](references/formats/project.md)、[SB §5](references/formats/project.md) 手工补齐。仅缺 config 时可按 [SB §8](references/formats/config.md) 用默认值起草，说明采用了哪些默认值。不要把默认提示线当成厂商上限。要写或要改任何机读文件之前，先打开对应的摘录文件，照里面的格式写，不凭印象。

按 [SB §4.1](references/formats/project.md) 读本集分镜、`visual/assets.md`、`prompts/assets-image.md`（如已有）、`prompts.*` 和所用方言卡，按需补读本集剧本、章集映射与 `visual/continuity.md`。`series.md`、`adaptation-map.md`、`episodes/`、`visual/`、`storyboards/`、`prompts/` 均相对 `drama/{series}/`。`bible/` 和 `.fiction/` 相对书根。命令在书根运行，把 `<series>` 换成剧目录名、`N` 换成集号。

## 流程

1. **分镜定稿且无阻断才开工。** 先确认 `storyboards/ep{NNN}.md` 存在，再运行两条命令（参数见 `storyboard-check.mjs --help`）：

   ```sh
   node <本 skill 目录>/scripts/storyboard-check.mjs <series> --ep N --json
   node <本 skill 目录>/scripts/storyboard-check.mjs <series> --ep N --brief
   ```

   确认普通检查零 `block`，且 `episodes[]` 中目标集的 `status` 为 `final`（分镜为 `状态：定稿`，[SB §9.6](references/formats/storyboard.md)）。用 `--brief` 汇总的「本集不得画出的真相」「人物秘密」「尚不可用的资产」「连戏现状」逐镜标出可见范围、连戏造型和道具状态，同集揭示也要守到剧本指定的镜头。[SB §9.5](references/formats/storyboard.md)、[SB §9.9](references/formats/storyboard.md)

   分镜未定稿、有阻断、缺失或报 `va-missing`（缺资产库，部分检查没运行）时，交给 `fiction-storyboard`，附剧本和分镜路径、场次／段镜、问题及未跑的提示词检查。没装该 skill 时，请作者按 [SB §9.4–§9.6](references/formats/storyboard.md) 用本集剧本手工建修分镜、补最小资产条目和必要的连戏记录，定稿后再跑普通检查至零阻断。若剧本也缺失或需修改且未装 `fiction-short-drama`，请作者先按 [SB §9.1–§9.3](references/formats/drama.md) 补正系列资料、映射和本集剧本。

2. **定方言再起草。** 方言是目标模型接收提示词的写法。未选厂商时用 `generic`，无需写入 `prompts.dialects` 或登记 `confirmed_at`。一块可用 `方言` 单独指定。同一部剧的默认值写在 `visual/assets.md` 的 `图片方言`／`视频方言`，整个项目的默认值写在 `.fiction/config.json` 的 `prompts.image.dialect`／`prompts.video.dialect`。按块、剧、项目的顺序取第一个有值的设置。[SB §9.4](references/formats/storyboard.md)、[SB §9.7](references/formats/prompts.md)、[SB §8](references/formats/config.md)

   首次使用厂商方言时，展示卡上的参考值和官方链接，请作者按实际入口、版本、模式对照当前文档。作者确认后，在 `.fiction/config.json` 的 `prompts.dialects.<id>` 写入核实值和作者确认当天的 `confirmed_at`。没有卡或核对不了时，可继续起草 `generic`。新增方言卡须在起草当天读到官方文档。卡内无法核实的细项标「未核对」，配置留空。[SB §9.8](references/formats/prompts.md)

3. **补资产，先定锚图。** 依次读 `series.md`、`bible/characters.md` 的主要人物、`visual/assets.md` 和已写剧本里涉及的地点与道具。道具涉及物品或伏笔时补读 `bible/inventory.md`、`bible/foreshadows.md`，年代或器物制式影响出图时补读 `bible/timeline.md`、`bible/world-rules.md`。[SB §4.1](references/formats/project.md)

   在 `visual/assets.md` 补可见的 `外观`、人物 `提示词称呼` 和必要的 `锁定词`。锁定词选少量稳定可见的名词短语，同一把锁的双语写法用 `=` 连接。临时动作写入相应提示词。按连戏解析本体和变体，变化发生的那一集按分镜核对变化前后的造型。外观、画风、揭示时机或有意打破连戏尚未拍板时，交作者确认。[SB §9.4–§9.5](references/formats/storyboard.md)

   在 `prompts/assets-image.md` 补实际需要的参考图槽位：每名角色先定一张正面全身锚图，再派生大头和独立的侧／背视图。地点出无人空景。道具出白底、带尺度参照、无手的单物图。参考图提示词沿用已定的 `画风` 整句。作者自有图片登记 `来源：外部`，不为它编造一段生成词。块按 [SB §9.7](references/formats/prompts.md) 写。参考图要核对实际文件、造型和本集可见信息，脚本的按名豁免不等于图中真的画对了。

4. **逐镜写帧图。** 从分镜的镜号、景别、画面、入画资产和段地点推导 `prompts/ep{NNN}-image.md`。按「画幅与景别 → 固定外观或实挂参考图 → 本帧造型、姿态、位置 → 空间与尺度 → 光和 `画风` → 定向负面词」写。首帧只写起点的一个瞬间。需要尾帧时另写终点的一瞬。不挂该角色图就用 `提示词称呼`。实挂图才能按需用姓名。字迹必须可读时不写「无文字」。画幅、画风取 [SB §9.4](references/formats/storyboard.md) 和 [SB §8](references/formats/config.md) 的项目口径。帧图块见 [SB §9.7](references/formats/prompts.md)。

5. **逐段写视频。** 读段内各镜及其台词和选定的帧图，在 `prompts/ep{NNN}-video.md` 按实际切点写起点、动作因果和终点。每镜只给一条运镜路径。写人声（谁开口、口型与声线）、环境及动作音效、配乐三层。改动作也改声音，因为声音本身会暗示模型要做什么。叙述用 `提示词称呼`，姓名只在原台词需要时保留。已实挂图锁住的外观省去重复描述，其余锁按 [SB §9.7](references/formats/prompts.md) 原字带入。段内对白用引号原样写。OS、VO 和旁白只分配到相应声源，被拍到却没有发声的角色保持闭口。字幕交给后期。走后期配音且 `prompts.dialogue_check` 为 `false` 时，按方案留口型与节拍。

   按方言卡和作者确认的实际入口选首帧或首尾帧。字段里 `SH001` 指首帧，`SH001尾` 指尾帧。按 `参考图` 的列出顺序上传，首尾分别对应本段起点和终点。只将画面和声音指令放进围栏。[SB §9.6](references/formats/storyboard.md)、[SB §9.7–§9.8](references/formats/prompts.md)

6. **检查提示词。** 若改过资产，先重跑第 1 步的检查与简报，再复核受影响的图和提示词。运行 `node <本 skill 目录>/scripts/prompt-check.mjs <series> --ep N`（用法见 `prompt-check.mjs --help`）。`--ep` 限定分集文件，共用的 `assets-image.md` 始终检查。按文件和行号修 `block`，逐条处置 `suggest`，记录保留理由。

   | 检查项 | 下一步 |
   |---|---|
   | `pr-target` | 核对最新分镜。误写的目标号改正。上游删除或改写镜段、旧块已失效时，将旧块标 `状态：作废`，并更新或作废引用它的下游块。目标仍有效时按新版分镜重写受影响的内容，待重新确认。先改上游，再改提示词。[SB §4.2](references/formats/project.md)、[SB §9.7](references/formats/prompts.md) |
   | `pr-ref-not-ready` | 先让作者生成上游图，再核实文件并登记图片块为已出。将尚不能执行的下游块从当前生成批次撤出，实际挂图变更时退回草稿。草稿也要手查所需图片是否就绪。 |
   | `pr-dialect-unknown`、`pr-forbid` | 未登记的方言回第 2 步，请作者核对并登记，或先改用 `generic`。命中该方言的禁用写法时删掉别家的标记，用当前已核对的写法表达同一效果。 |
   | `pr-seconds` | 按第 2 步请作者选可容纳这段的方言，或退回 `fiction-storyboard` 重新分段。时长由镜头相加，删提示词里的字不会改变段时长。[SB §9.6](references/formats/storyboard.md)、[SB §9.8](references/formats/prompts.md) |
   | `pr-length`、`pr-refs-max` | 先删重复修饰、画外陈设或重复挂图，保留动作因果、逐字台词、必要的锁和选定的首尾帧。减图后重查锁与画面。仍超可用范围时请作者选合适方言，需要改拍法时交回分镜。 |
   | `pr-lock` | 对可见却没挂图的特征补原字，或挂同一造型的可用图。表盘特写裁掉了角色袖口时，保留建议并说明画面为何看不到它。 |

   对照分镜核对计划中的镜与段是否齐全。`--json` 的 `segments_covered` 统计有未作废视频块的段，未覆盖的段只进计数，另列待办。

7. **付费生成前确认。** 套件只写提示词，不调用生成接口，不代点生成。当前批次写好且无 `block` 后，用 `node <本 skill 目录>/scripts/prompt-check.mjs <series> --ep N --json` 的 `blocks` 列预览：每块的键、种类、方言、视频时长、参考图张数、长度、涉及资产。合计图片张数、视频段数和总秒数。不估价，提醒作者自行查平台计费。等作者明确确认这一批，才把清单里的草稿标成 `状态：已确认`。针对别的事说「继续」「好的」不算。已确认批次有内容变更（包括正文、负面词、挂图或次序等），受影响的块退回草稿，重检、重列、重确认。建议本集从参考图、帧图做到视频，再开下一集。作者当场决定是否自行生成或另用宿主提供的生成工具，本 skill 只交付已确认的块供生成。作者生成后告知文件位置，再按 [SB §9.7](references/formats/prompts.md) 回填 `文件` 与 `状态：已出`，重跑 `prompt-check` 验路径。作者提供的外部图不是付费生成项，验实后按实际文件登记。

## 检查

- 普通分镜检查确认目标集分镜为 `final`，且分镜检查与提示词检查均无阻断。结构、引用、有效块的唯一性与已出文件的存在性通过检查。[脚本]
- 模型围栏未命中内部编号、禁用词、脱敏词或禁画锁定词。启用台词检查时，视频围栏逐字包含需检查的台词。[脚本]
- 核对锁定词字面出现及挂图豁免，比较长度提示线与已登记的方言时长、参考图张数和禁用写法，提示未登记的厂商方言。检查已确认或已出块引用的图是否已出。[脚本]
- 逐条结合画面、实际入口和作者方案处置全部 `suggest`。记录已修项、暂缓项及保留理由。生成前手查实际挂图、可选时长档位和首尾帧角色。[模型]
- 逐镜扫提示词正负两栏与实挂图片：不以换说法泄露身份、字迹或道具结构。本集揭示也只在剧本允许的镜头露出。[模型]
- 人物姿态单一。道具持有、造型、视线、位置与上镜衔接。动作和台词塞得进实际秒数。声音跟得上画面。没有为消除 `pr-lock` 而误加画外物件。[模型]
- 作者核定画风、方言与限制、生成批次和实际成品。脚本不看画面，文件存在不是脸型、字迹、动作、声音或口型验收。[作者]

## 产出

- 补全 `visual/assets.md`。按需写 `prompts/assets-image.md`、`prompts/ep{NNN}-image.md` 和 `prompts/ep{NNN}-video.md`，生成后按 [SB §4.2](references/formats/project.md) 回填。方言参数仅在作者对照官方文档确认后改写 `.fiction/config.json`。
- 汇报「剧与集／文件及块数／阻断与建议的处置／未覆盖的镜段或未就绪的图／待作者拍板／本批预览或已回填文件」。上游退回时另列交接文件、待办和未跑的检查。

## 参考文档

| 遇到什么 | 读哪份 |
|---|---|
| 确定项目路径、冲突裁决、主写入口和回填 | [SB §1–§5](references/formats/project.md) |
| 复核系列、章集映射、剧本场次或逐字台词 | [SB §9–§9.3](references/formats/drama.md) |
| 写资产库、读连戏与分镜、判断揭示边界 | [SB §9.4–§9.6、§9.9](references/formats/storyboard.md) |
| 写任何提示词块、引用、状态或方言卡 | [SB §9.7–§9.8](references/formats/prompts.md) |
| 改画幅、方言、长度提示线或后期配音配置前 | [SB §8](references/formats/config.md) |
| 写资产参考图与首尾帧，处理字迹与负面词 | [图片提示词](references/image-prompts.md) |
| 写段内时间、镜头、动作与声音 | [视频提示词](references/video-prompts.md) |
| 不指定厂商、先写自然语言底稿 | [`generic` 基线](references/dialects/generic.md) |
| 火山方舟 Seedance 2.5 首／首尾帧 | [Seedance 2.5 方言卡](references/dialects/seedance-2.5-frames.md) |
| MiniMax 海螺 2.3 首帧 | [海螺 2.3 方言卡](references/dialects/hailuo-2.3-i2v.md) |
| 阿里云百炼万相 2.7 首／首尾帧 | [Wan 2.7 方言卡](references/dialects/wan-2.7-i2v.md) |
| OpenAI GPT-Image-2.6 Sunburst 参考图编辑 | [GPT Image 方言卡](references/dialects/gpt-image-2.6-sunburst-edit.md) |
| 列清单、等待确认、登记产物 | [生成前确认](references/generation-checkpoint.md) |
| 排查多生人、漏约束、乱增道具 | [常见翻车](references/failure-modes.md) |
| 创建三类文件：复制后让文件名和标题都与本集集号相符，替换示例资产、镜号、段号及挂图 | [资产图模板](assets/assets-image.md) · [帧图模板](assets/ep001-image.md) · [视频模板](assets/ep001-video.md) |
