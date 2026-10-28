---
name: spawn-deep-researcher
description: 仅在需要穷尽式、多角度交叉验证的重度全景调研时，使用 deep-researcher 子代理。常规查询、简单事实验证或基础搜索直接在当前会话完成，切勿拉起本代理。拉起前必须阅读。
user-invocable: true
---

基础信息检索、单点事实确认或常规查阅资料直接在当前会话使用搜索工具；仅在需要对未知/复杂主题进行全面、深度、多源交叉验证的穷尽式重度调研时才调用 `deep-researcher`。

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
