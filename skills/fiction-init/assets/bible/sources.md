# 主写入口

<!-- 每类信息只维护一个主入口；其他文件引用或写短摘要。专题索引新建时在此登记。 -->

| key | 信息 | 主写入口 | 锚点 | 何时读 | 何时写回 | 模式 | 简报 |
|---|---|---|---|---|---|---|---|
| canon | 最终设定 | bible/canon.md | - | 写章、改设定前 | 设定拍板时 | owner_only | always |
| timeline | 时间锚点 | bible/timeline.md | - | 涉及时间推进 | 新锚点 / 期限 | owner_only | always |
| world_rules | 体系与规则 | bible/world-rules.md | - | 写体系类场景 | 规则变化 | owner_only | kw:规则\|能力\|战斗 |
| style_guide | 本书风格 | bible/style-guide.md | - | 写章、审校 | 新写法规则定下 | owner_only | always |
| characters_static | 人物档案 | bible/characters.md | - | 有人物出场 | 新人物 | owner_only | characters |
| characters_dynamic | 关系变化 | bible/character-dynamics.md | - | 有人物出场 | 关系变化 | owner_only | characters |
| appearances | 出场记录 | bible/appearances.md | - | 查上次出场 | 每章写完 | owner_only | - |
| global_plot | 全书节奏 | bible/plot-outline.md | - | 规划 | 结构变动 | owner_only | always |
| volume_plan | 卷详细规划 | bible/volumes/{vol}.md | 章节规划 | 写章、规划 | 规划变动 | owner_only | always |
| volume_summary | 卷摘要 | chapters/{vol}/vol-info.md | - | 写章 | 规划变动后同步 | secondary | always |
| volume_review | 卷复盘 | chapters/{vol}/summary.md | - | review | 卷完结 | secondary | - |
| storylines | 主线 / 暗线进展 | bible/storylines.md | - | 写章 | 实际推进 | owner_only | always |
| subplots | 支线生命周期 | bible/subplots.md | - | 写章 | 支线步骤推进 | owner_only | always |
| foreshadows | 伏笔 | bible/foreshadows.md | - | 写章 | 埋 / 触 / 收 / 放弃 | owner_only | always |
| inventory | 物品资源 | bible/inventory.md | - | 涉及物品 | 获得 / 消耗 / 损坏 | owner_only | kw:物品\|道具\|资源 |
| drafts | 讨论稿 | bible/drafts/ | - | 讨论方向 | 不作依据 | draft_only | - |
| drama_series | 短剧总设定 | drama/{series}/series.md | - | 写短剧 | 设定变化 | owner_only | - |
| drama_map | 章→集映射 | drama/{series}/adaptation-map.md | - | 改编 | 每集写完 | owner_only | - |
| drama_visual_assets | 视觉资产与锁定词 | drama/{series}/visual/assets.md | - | 画分镜、写提示词 | 新资产入画、外观改动 | owner_only | - |
| drama_continuity | 跨集连戏状态 | drama/{series}/visual/continuity.md | - | 画分镜 | 分镜写完一集且有状态变化 | owner_only | - |
| drama_storyboard | 分镜 | drama/{series}/storyboards/ | - | 写提示词 | 剧本定稿或改动后 | owner_only | - |
| drama_ref_images | 资产参考图 | drama/{series}/prompts/assets-image.md | - | 写提示词 | 出图、选定、作废 | owner_only | - |
| drama_image_prompts | 分镜帧图提示词 | drama/{series}/prompts/ | - | 写视频提示词 | 分镜改动后、确认或出图后 | owner_only | - |
| drama_video_prompts | 视频提示词 | drama/{series}/prompts/ | - | 生成前确认 | 分镜改动后、确认或出片后 | owner_only | - |
