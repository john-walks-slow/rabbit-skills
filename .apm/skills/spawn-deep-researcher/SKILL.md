---
name: spawn-deep-researcher
description: 使用 deep-researcher 子代理对特定主题进行深度、广泛、准确的网络调研。当需要对特定主题进行高质量调研时优先使用。拉起 deep-researcher 子代理前必须阅读。
user-invocable: true
---

使用 `deep-researcher` 子代理进行深度网络调研。
你提供的输入指令必须遵循如下格式：

```
---
output_to_file: 报告写入路径或 false。无显式要求时建议输出到 /docs/freeform/yymmdd-<topic>.research.md。
---

## Context

<任务背景>

## Topic

<调研主题>
```

注意：

- 不要附带额外的系统指令（如工作流程、限制事项、输出格式等。此子代理自带完备的指令）。
- 禁止 hand-holding。禁止提供预设的调研方向或具体搜索关键词。防止既有认知影响 research 的全面性。
