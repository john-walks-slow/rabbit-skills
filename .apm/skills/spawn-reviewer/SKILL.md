---
name: spawn-reviewer
description: 使用 reviewer 子代理进行高质量的代码审查。调用 reviewer 子代理前必须阅读。
user-invocable: true
---

使用 `reviewer` 子代理（而不是使用 `bugbot` 或其他子代理）进行代码审查。
你提供的输入指令必须是 json 字符串，遵循如下 schema：

```json
{
  "type": "object",
  "properties": {
    "context": {
      "type": "string",
      "description": "任务背景，需求计划/问题描述"
    },
    "changes": { "type": "string", "description": "变更文件及描述" },
    "output_to_file": { "type": "string", "description": "可选。报告写入路径" }
  },
  "required": ["changes"]
}
```

注意：

- 不要附带额外的系统指令（如工作流程、限制事项、输出格式等。此子代理自带完备的指令）。
- 禁止 hand-holding。禁止限制检视方向。防止既有认知影响 review 的全面性。
