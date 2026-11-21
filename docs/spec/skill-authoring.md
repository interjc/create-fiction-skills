# Skill 写作规范

> 契约文件，已冻结（T1，作者确认 2026-11-21；格式摘录随 skill 发布的规则由 Fable 5.2 设计、总监验收 2026-11-21），外部起草者照此执行。改动须由总监批准，并同步 `tools/validate.mjs`。
> 相关契约：[story-bible.md](story-bible.md)（作者项目的目录与格式）、[scripts.md](scripts.md)（脚本接口）、[debook-terms.txt](debook-terms.txt)（去书专属化词表）。

## 1. 目录

```
skills/<name>/
├── SKILL.md              # 必需
├── references/           # 按需加载的细节文档
│   └── formats/          # 契约摘录，由 sync-shared 生成，禁止手改（scripts.md §8.1）
├── assets/               # 模板（会被复制进作者项目的文件）
└── scripts/              # 只在本 skill 用到脚本时存在
    ├── *.mjs             # 入口脚本
    ├── lib/              # 从 shared/lib/ 同步来的副本，禁止手改
    └── tests/            # node --test 用例与 fixtures
```

- `<name>` 统一 `fiction-` 前缀，kebab-case，≤64 字符。
- 每个 skill 必须能单独安装：用到的脚本、模板、参考文档都放在自己目录里。共用代码只在仓库根 `shared/lib/` 维护，由 `node tools/sync-shared.mjs` 复制进 `scripts/lib/`。
- 引用兄弟 skill 时写 skill 名（如“交给 `fiction-review`”），不写跨 skill 的相对路径。兄弟 skill 未安装时，要写出降级做法。

## 2. Frontmatter

只允许这些键：`name`、`description`、`license`、`compatibility`、`metadata`、`allowed-tools`（一般不用）。

```yaml
---
name: fiction-chapter
description: 网文章节写作闭环：……（中文，先写做什么，再写何时触发）。Web-novel chapter workflow: ... (English, same content, trigger phrases included).
license: MIT
compatibility: Agent Skills standard; tested on Claude Code, also readable by Codex and OpenCode. Scripts need Node.js 22.5+.
metadata:
  version: "0.1.0"
  suite: create-fiction-skills
---
```

- `name` 与目录名一致。
- `description`：
  - 必须中英双语，中文在前，≤1024 字符；不得出现尖括号。
  - 写清“做什么 + 什么时候用”，触发词要具体，并且主动一些（宿主倾向于少触发）。例如“用户要求写新章、续写、产出下一章、改某章正文时使用，即使没说‘章节’两个字”。
  - 写出与相邻 skill 的边界，例如“只审不写：审校请用 fiction-review”。
- `compatibility` ≤500 字符。

## 3. SKILL.md 正文结构

按下面的顺序写，标题可以微调：

1. `# <中文名>`，加一句话说明它负责作者工作流里的哪一步。
2. **何时用 / 不用**：触发场景，以及该转交给哪个兄弟 skill 的情况。
3. **开始前**：固定读三样东西：作者项目的 `AGENTS.md`（尤其“本书口径”一节）、`.fiction/config.json`、`bible/sources.md`。文件不存在时，提示作者先运行 `fiction-init`，或者按默认值继续并说明。
4. **流程**：编号步骤。每一步写清：
   - 读哪些文件，写回哪些文件（路径以 story-bible.md 为准）；
   - 跑什么脚本（`node <本 skill 目录>/scripts/xxx.mjs ...`），以及结果怎么用；
   - 什么情况下停下来问作者。
5. **检查**：清单形式。每条末尾标注由谁保证：`[脚本]`（scripts 能确定判定）、`[模型]`（靠模型阅读判断）、`[作者]`（只有作者能定）。
6. **产出**：生成或修改哪些文件，最后给作者的汇报格式。
7. **参考文档**：表格，列“遇到……时 → 读哪份 reference”。

## 4. 篇幅与分层

- SKILL.md ≤500 行，目标 ≤300 行。超出的细节下沉到 `references/`。
- reference 只从 SKILL.md 直接链接，最多一层，不做 reference 之间的链式跳转。单份 ≤400 行；超过 100 行的在开头加目录。`references/formats/` 下的生成文件不计入“目标 ≤300 行”的篇幅考虑，但同样受单份 ≤400 行的限制（由同步脚本保证）。
- 所有链接都用相对路径，并且必须能打开（validate 会检查）。

## 5. 内容规则

- **方法要具体**：保留来源里能直接照做的操作，比如场景五要素、删除测试、总结句搜索词、准备章六步、钩子分级、伏笔六步生命周期。不要把它们改写成“注意节奏”“保持一致”这类空话。
- **书专属规则不进 skill**：人物口径、书内体系、发布参数、冻结章节范围都属于作者项目。skill 只写“去哪里读”（项目 `AGENTS.md` 的“本书口径”或 `config.json`），以及读不到时的默认做法。优先级：项目规则 > skill 默认。
- **题材差异进题材包**：`fiction-craft/references/genres/<genre>.md`。其他 skill 需要题材知识时，只引用题材包，不各自另写一份。
- **格式只在契约里定义，随 skill 发布的是契约的摘录**：伏笔表的列、钩子标记、分集格式等以 story-bible.md 为准。装好的 skill 读不到 `docs/spec/`，所以 `tools/sync-shared.mjs` 会把相关章节原文生成到本 skill 的 `references/formats/<主题>.md`（章节号不变，主题分配见 `shared/formats.json`）。写法：
  - 正文提到格式时写 “SB §7.3” 并链接到对应的摘录文件，如 `[SB §7.3](references/formats/chapter.md)`；不写 `docs/spec/...` 路径，不写 “见 story-bible.md”。
  - “开始前”一节加一句：要写或要改任何机读文件之前，先打开对应的摘录文件，照里面的格式写，不凭印象。
  - “参考文档”表里列出本 skill 的每份摘录文件，以及写哪类文件时读它。
  - 正文可以放从契约**原样照抄**的短例子（如 outline 的伏笔行），旁边标明出处的章节号；不得增加、改写或省略规则。
  - 需要的章节不在本 skill 的主题里：报总监改 `shared/formats.json`。确实需要新格式：上报总监修改契约。
- **示例必须原创**：不出现 debook-terms.txt 里的任何词，也不复述来源小说的情节。
- **写法**：用祈使句，说明原因（“这样做是为了……”），少用大写的“必须”，多给判断依据。中文术语首次出现时附一句白话解释。
- **宿主中立**：正文不写某个宿主独有的工具名。确实需要时，放到文末“宿主差异”小节。
- **作者主导**：凡是涉及设定拍板、方向选择、对外发布、覆盖作者已有文字的事，都要先问作者。

## 6. 脚本

- 只用 `node:` 内置模块，Node 22.5+，不需要 `package.json` 依赖。
- 接口、输出、退出码以 [scripts.md](scripts.md) 为准。默认输出给人看的文本，`--json` 输出机器可读结果。
- 每个入口脚本至少有一个 `node --test` 用例，fixtures 放在 `scripts/tests/fixtures/`，内容原创。
- 脚本只读写作者项目里的文件，不联网，不调用模型。

## 7. 验收清单（每个 skill）

- [ ] `node tools/validate.mjs` 通过（frontmatter、行数、链接、双语 description、零依赖、词表 grep）
- [ ] skill-creator 的 `quick_validate.py` 通过
- [ ] `node --test skills/<name>/scripts/tests/` 通过（有脚本时）
- [ ] 来源映射（plan.md §4.1）里该 skill 对应的通用方法都有落点，舍弃的写明理由
- [ ] 流程每一步的读写路径都与 story-bible.md 一致
- [ ] 凡是写机读文件的步骤，都链接到了 `references/formats/` 里对应的摘录，并标了 “SB §x”；正文没有指向 `docs/spec/` 的引用
- [ ] 每条检查都标了 `[脚本]`、`[模型]` 或 `[作者]`
- [ ] 没有书专属内容；需要书专属值的地方都指向项目口径或 config
- [ ] description 的触发边界与兄弟 skill 不重叠（T7 用评测验证）
