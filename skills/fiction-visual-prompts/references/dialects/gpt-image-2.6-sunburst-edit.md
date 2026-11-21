# OpenAI GPT-Image-2.6 Sunburst：参考图编辑

- 方言：gpt-image-2.6-sunburst-edit
- 适用：图片
- 核对日期：2026-11-21
- 官方文档：https://developers.openai.com/api/reference/resources/images/methods/edit

以下限制以官方当前文档为准。只覆盖 Image API 对 `gpt-image-2.6-sunburst` 的参考图编辑，不外推到从零生图、对话产品或其他模型。另核对了该版本的[官方模型页](https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst)。[SB §9.8](../formats/prompts.md)

| 项 | 本次核对 |
|---|---|
| `max_chars` | `32000`，来自编辑接口的 `prompt` 长度上限，不是建议写这么长。 |
| `max_refs` | `16`，接口要求至少有一张输入图；本地上限提示不会检查最少张数。 |
| `max_seconds` | 不适用。 |
| `forbid` | 未核对，不预填。 |

按自然语言写「用哪张图、要保留什么、这次只改什么」。例如保留锚图的人脸与衣服，只改成朝右的侧面头像；不把组内编号写进正文。该编辑接口没有单独的 `negative_prompt` 字段，可将必要限制自然写入 `prompt`。该版本的专用图片指代符、任意尺寸支持和精确 9:16 出图未核对；需要竖屏时，作者先核对入口可选尺寸，并为实际裁切留余量。
