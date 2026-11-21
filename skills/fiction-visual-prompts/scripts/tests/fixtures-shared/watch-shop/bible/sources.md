# 主写入口

| **key** | `信息` | 主写入口 | 锚点 | 何时读 | 何时写回 | 模式 | 简报 |
|---|---|---|---|---|---|---|---|
| canon | 最终设定 | bible/canon.md | - | 查闸门来历 | 拍板后 | owner_only | always |
| characters_static | 人物档案 | bible/characters.md | - | 对话前 | 增加人物后 | owner_only | characters |
| world_rules | 闸房值班规则 | bible/world-rules.md | 灯绳 | 写进闸房前 | 改口径后 | owner_only | kw:闸房\|白绳 |
| chapter_outline | 提纲 | chapters/{vol}/{ch}/outline.md | 第{ch}章 | 写章前 | 改场景时 | secondary | always |
