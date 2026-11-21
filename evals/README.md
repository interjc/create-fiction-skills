# 评测（evals）

对应 `docs/plan.md` 的 T7：每个核心 skill 2–3 个任务用例（对示例书真跑一遍），外加每个 skill 一组触发评测（该不该被唤起）。结果交作者抽查，不自动判定发布。

## 评测什么

| 类别 | 文件 | 覆盖 | 回答的问题 |
|---|---|---|---|
| 任务评测 | `evals/<skill>/evals.json` | 核心插件的 10 个 skill，各 3 例，共 30 例 | 在示例书副本上照作者原话执行，产物、脚本结果和越权行为是否符合 SKILL.md |
| 触发评测 | `evals/<skill>/trigger-eval.json` | 全部 12 个 skill，各 18 条（9 条该触发、9 条近邻不该触发） | 描述能否把请求分给对的兄弟 skill，例如「写下一章」归 `fiction-chapter` 而非 `fiction-workflow`，「帮我改成短剧」归 `fiction-short-drama` 而非 `fiction-storyboard`，「检查这章有没有 AI 味」归 `fiction-review` 而非 `fiction-craft` |

辅助文件：

- `evals/prepare.mjs`：为一个用例准备草稿目录（复制示例书或建空书根，施加前置改动，记基线哈希）。
- `evals/diff.mjs`：列出运行后书根相对基线的新增、修改、删除文件，供「未修改」类断言使用。
- `evals/fixtures/flawed-chapter/`：埋了 16 处问题的第 4 章与答案表 `answer-key.md`，`fiction-review` 第 1、2 例和 `fiction-continuity` 第 2、3 例使用。

两份 JSON 的格式与 skill-creator 的 `references/schemas.md` 一致：`evals.json` 为 `skill_name` + `evals[]`（`id`、`prompt`、`expected_output`、`files`、`expectations`）；`trigger-eval.json` 为 `{"query", "should_trigger"}` 数组。评测放在仓库根的 `evals/` 而不是 skill 目录里，所以 `files` 中的路径**相对仓库根**，不是相对 skill 根。

## 断言的读法

`expectations` 每条开头有标签，评分时按标签区别对待：

| 标签 | 怎么判 |
|---|---|
| `[硬]` | 跑命令或看文件就能判定：脚本退出码与输出、文件是否新增或修改（用 `diff.mjs`）、文件里有没有某段文字。能写脚本判的就写脚本判。 |
| `[硬·答案N]` | 埋雷稿答案表第 N 行，属于脚本能检出的问题；在 agent 的汇报里找对应的行号或规则 ID。 |
| `[召回·答案N]` | 答案表第 N 行，只能靠模型阅读发现；单独统计召回率（命中数 / 9）。 |
| `[修复召回·答案N]` | 审改模式下，答案表第 N 行的问题在修后稿里是否已消失。 |
| `[报告]` | 看执行记录与最终汇报：跑过哪些命令、报了什么、有没有越权或把未跑的检查报成通过。 |

占位符：`<repo>` 是本仓库根目录，`<run>` 是 `prepare.mjs` 用的草稿目录，`<skill-creator>` 是 skill-creator 的安装目录。断言里的命令一律**在书根 `<run>/book` 下运行**。

## 第一步：准备草稿目录（不碰 `examples/`）

所有任务评测都在示例书的**副本**上运行，`examples/demo-book/` 与 `evals/fixtures/` 只读。需要 Node.js 22.5+。

```text
node <repo>/evals/prepare.mjs <skill> <eval-id> <run>
```

- 生成 `<run>/book`（评测时的书根，也是 agent 的工作目录）和 `<run>/baseline.json`（每个文件的 sha256）。
- `<run>/book` 已存在时拒绝运行；`<run>` 落在仓库的 `examples/`、`skills/`、`shared/`、`docs/` 或 `evals/fixtures/` 里也拒绝运行。草稿目录建议放在仓库之外。
- 前置改动写死在 `prepare.mjs` 的 `setups` 表里，输出的 `setup` 字段逐条列出。下表是摘要：

| 用例 | 书根起点 | 前置改动 |
|---|---|---|
| init 1、planner 1 | 空目录 | 无 |
| init 3 | 空目录 | `manuscript/` 放三份旧稿（示例书第 1–3 章正文），无 bible 和配置 |
| chapter 3 | 示例书 | `frozen.ranges` 设为 `["1-3"]` 并运行 `lint.mjs --freeze` |
| review 1、2，continuity 2、3 | 示例书 | 埋雷稿复制到 `chapters/1/4/` |
| review 3 | 示例书 | `publish/blurb.md` 埋入现实地名、精确年份和一句排比升华 |
| planner 3 | 示例书 | 删除 `publish/blurb.md` |
| workflow 3 | 示例书 | 第 3 集剧本状态改为「修改」 |
| short-drama 3 | 示例书 | 第 2 集剧本改回初稿，并埋入 OS 开场、钩子后仍有内容、动作行写心理 |
| storyboard 1 | 示例书 | 删除第 3 集分镜与提示词，删去连戏表第 3 集行 |
| storyboard 2 | 示例书 | 第 2 集剧本改一句江澜台词（分镜随之过期） |
| storyboard 3 | 示例书 | 同 storyboard 1，另把第 3 集剧本改回初稿 |
| visual-prompts 1 | 示例书 | 删除第 3 集帧图与视频提示词 |
| visual-prompts 3 | 示例书 | 第 2 集分镜改一句台词，与剧本对不上 |
| 其余 | 示例书 | 无 |

运行结束后：

```text
node <repo>/evals/diff.mjs <run>                    # 全书根改动
node <repo>/evals/diff.mjs <run> --only bible/      # 只看某个前缀
```

输出里 `unchanged: true` 表示与基线完全一致。需要和原始示例书比内容（例如「其他配置键不变」）时，对照 `<repo>/examples/demo-book/` 里的同名文件。

## 第二步：用 skill-creator 跑任务评测

按 skill-creator `SKILL.md`「Running and evaluating test cases」一节执行，这里只写本仓库需要补充的部分。

1. **建工作区**：放在仓库外，例如 `<workspace>/iteration-1/`。每个用例一个目录，用描述性名字，如 `review-1-flawed-chapter/`，下面分 `with_skill/` 与 `without_skill/`。按 skill-creator 写 `eval_metadata.json`，`assertions` 抄本用例的 `expectations`。
2. **两份独立副本**：with-skill 与 baseline 各准备一次，互不共用书根：

   ```text
   node <repo>/evals/prepare.mjs fiction-review 1 <workspace>/iteration-1/review-1-flawed-chapter/with_skill
   node <repo>/evals/prepare.mjs fiction-review 1 <workspace>/iteration-1/review-1-flawed-chapter/without_skill
   ```

3. **同一轮同时派出两个执行者**。with-skill 的派工内容：

   ```text
   Execute this task:
   - Skill path: <repo>/skills/<skill>
   - Task: <evals.json 中该例的 prompt，原样>
   - Working directory: <run>/book（这是作者的书根，所有命令在这里运行）
   - Input files: <该例的 files，相对 <repo>；没有就写 none>
   - Save outputs to: <run>/outputs/
   - Outputs to save: 最终汇报全文存为 outputs/report.md
   ```

   baseline 去掉 `Skill path` 一行，其余相同。执行者不能看到 `answer-key.md`；`files` 里列出答案表只是给评分者用的，派工时不要把它作为输入。
4. **收集产物**：每个运行结束后在 `<run>` 下执行 `node <repo>/evals/diff.mjs <run> > <run>/outputs/diff.json`，再把新增或修改过的文件复制进 `outputs/`，方便在查看器里直接读。任务通知里的 `total_tokens`、`duration_ms` 立刻写进 `<run>/timing.json`。
5. **评分**：评分者读 `<skill-creator>/agents/grader.md`，逐条判 `expectations`，写 `<run>/grading.json`（字段必须是 `text`、`passed`、`evidence`）。`[硬]` 类用命令判，不凭记录里的自述；`[召回]` 类另外在 `grading.json` 之外记一行召回率（如 `recall: 7/9`）。
6. **汇总与查看**（在 `<skill-creator>` 目录下）：

   ```text
   python -m scripts.aggregate_benchmark <workspace>/iteration-1 --skill-name <skill>
   python eval-viewer/generate_review.py <workspace>/iteration-1 --skill-name <skill> --benchmark <workspace>/iteration-1/benchmark.json
   ```

   无图形界面时给查看器加 `--static <输出路径>.html`。第二轮起加 `--previous-workspace <workspace>/iteration-1`。

## 第三步：跑触发评测

skill-creator 的 `run_eval` 会在项目根的 `.claude/commands/` 里临时登记被测 skill，再用 `claude -p` 逐条发问，看模型是否读取它。为了让近邻样本真正考到「兄弟 skill 抢单」，建议准备一个专用的空项目：

1. 新建目录 `<trigger-project>`，在其中建 `.claude/skills/`，放入**除被测 skill 外**的其余 11 个 `skills/fiction-*`（复制或软链接均可）。
2. 在 `<trigger-project>` 下运行（`PYTHONPATH` 让 `-m scripts` 找到 skill-creator 的脚本，同时项目根仍是 `<trigger-project>`）：

   ```text
   PYTHONPATH=<skill-creator> python -m scripts.run_eval \
     --eval-set <repo>/evals/<skill>/trigger-eval.json \
     --skill-path <repo>/skills/<skill> \
     --runs-per-query 3 --verbose > <workspace>/trigger-<skill>.json
   ```

   每条默认跑 3 次，触发率过 0.5 记为触发；`--model` 可指定与作者日常使用一致的模型。
3. 结果 JSON 里逐条有 `should_trigger`、触发率与是否通过。不该触发却被唤起的样本，记下它本该归哪个兄弟 skill，作为改描述的依据。
4. 想自动优化描述，可按 skill-creator「Description Optimization」一节跑 `scripts.run_loop`。它只产出建议的 `best_description`；改动 SKILL.md 属于最终验收，须作者同意后由总监落盘。

## 第四步：作者抽查

建议的验收线（作者可调）：

| 项目 | 建议线 |
|---|---|
| 任务评测 `[硬]` | with-skill 全部通过；任一不过即列为该 skill 的缺陷 |
| 任务评测 `[报告]` | with-skill 通过率 ≥ 80%，且没有越权（改冻结章、未经确认落盘、代做兄弟 skill 的活） |
| `fiction-review` 第 1 例召回 | 9 条 `[召回]` 命中 ≥ 6 条；7 条 `[硬·答案N]` 全中 |
| 对照组 | with-skill 的通过率应明显高于 baseline；两边都过的断言说明区分度不够，可改 |
| 触发评测 | 每个 skill 18 条中正确 ≥ 15 条，近邻误触发 ≤ 2 条 |

抽查顺序：

1. 在查看器的 Benchmark 页看各 skill 的 with-skill 与 baseline 通过率差距，先挑差距最小或 `[硬]` 未全过的用例。
2. 每个 skill 至少打开 1 例的 Outputs：读 `report.md`、`diff.json` 和新增文件，判断 `[报告]` 的评分是否站得住，在 Feedback 框写意见。
3. 必看三例：`fiction-review` 第 1 例（对照 `fixtures/flawed-chapter/answer-key.md` 逐行核召回）、`fiction-chapter` 第 1 例（通读新写的第 4 章，脚本只能保证字数、格式和回写）、`fiction-short-drama` 第 2 例（原创剧本是否可拍）。
4. 触发评测只看失败条目：判断是样本写得含糊，还是描述确实分不开兄弟 skill。
5. 意见经查看器导出为 `feedback.json`，放回对应 `iteration-N/` 目录，下一轮改进时读取。

## 维护约定

- 示例书内容变了（例如 bible 或剧本改动），先跑一遍各用例的 `prepare.mjs`；替换片段找不到会以退出码 2 停下，按报错更新 `setups` 表与相关断言里的数字（字数、段镜数、块数、秒数）。
- 新增用例：在 `evals.json` 追加，`id` 在本 skill 内唯一；需要前置改动就在 `prepare.mjs` 的 `setups` 表登记 `<skill>/<id>`。
- 所有内容保持原创，只用示例书与埋雷稿里的人物和情节。
