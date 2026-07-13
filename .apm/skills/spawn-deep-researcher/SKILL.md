---
name: spawn-deep-researcher
description: 使用 deep-researcher 子代理进行深度、准确的网络调研。调用 deep-researcher 子代理前必须阅读。
user-invocable: true
---

使用 `deep-researcher` 子代理进行深度网络调研。
你提供的输入指令必须是 json 字符串，遵循如下 schema：

```json
{
  "type": "object",
  "properties": {
    "context": { "type": "string", "description": "任务背景" },
    "topic": { "type": "string", "description": "调研主题" },
    "output_to_file": { "type": "string", "description": "可选。报告写入路径" }
  },
  "required": ["topic"]
}
```

注意：

- 不要附带额外的系统指令（如工作流程、限制事项、输出格式等。此子代理自带完备的指令）。
- 禁止 hand-holding。禁止提供预设的调研方向或具体关键词。防止既有认知影响 research 的全面性。
