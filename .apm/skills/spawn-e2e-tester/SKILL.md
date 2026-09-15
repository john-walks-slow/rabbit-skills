---
name: spawn-e2e-tester
description: 使用 e2e-tester 子代理进行端到端测试。拉起 e2e-tester 子代理前必须阅读。
user-invocable: true
---

使用 `e2e-tester` 子代理进行端到端测试。你提供的输入指令必须遵循如下格式：

```
---
output_to_file: 报告写入路径或 false。无显式要求时建议给 false（由子代理按默认位置写入对应 feature/issue 目录）。
---

## Context

<任务背景：被测功能/修复、相关计划与变更摘要、可用的测试环境与凭据、项目级测试规范引用（如有）>

## Test Items

<测试项清单：每项含场景描述与预期结果>
```

注意：

- 不要附带额外的系统指令（如工作流程、限制事项、输出格式等。此子代理自带完备的指令）。
- 禁止 hand-holding。不要限定具体测试步骤、不要预设具体工具——除非项目级文档有明确指定，此时在 Context 说明即可。
- 若 Test Items 未由用户明确给出，由你（主 Agent）根据需求/计划自行梳理核心场景后填入。
- 派发时在 Context 传足量信息：被测对象、变更摘要、可用的测试环境与凭据。
