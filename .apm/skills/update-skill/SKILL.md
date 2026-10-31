---
name: update-skill
description: 当编写新技能、编辑已有技能，或询问 SKILL.md 结构时使用。
---

# 创建技能

技能是 markdown 文件，教会 agent 如何执行特定任务：使用团队标准审查 PR、以偏好格式生成提交消息、查询数据库 schema，或任何专门的工作流。
本技能指导你创建有效的 Agent Skills。

## 开始之前：收集需求

创建技能之前，从上下文中或用户口中收集以下关键信息：

1. **目的和范围**：这个技能应该帮助完成什么特定任务或工作流？
2. **目标位置**：新技能放在与本技能相同的目录中（即同级的 `skills/<name>/` 目录）。如果不确定，直接问。
3. **触发场景**：agent 何时应自动应用这个技能？
4. **关键领域知识**：agent 需要哪些它本身不会知道的专门信息？
5. **输出格式偏好**：是否有特定的模板、格式或样式要求？
6. **既有模式**：是否有现成的示例或约定可以遵循？

### 用户的逐字文本

如果用户提供了要在技能中使用的确切措辞，请尊重并**逐字**使用在 `SKILL.md` 中（相同用词、相同顺序）。不要改写、弱化或扩展他们的原文，也不要在周围添加未经请求的标题或评论。

### 从上下文推断

如果你有之前的对话上下文，从讨论过的内容中推断技能。你可以基于对话中涌现的工作流、模式或领域知识来创建技能。

---

## 技能文件结构

### 目录布局

技能以目录形式存储，包含一个 `SKILL.md` 文件：

```
skill-name/
├── SKILL.md              # Required - main instructions
├── references/            # Optional - detailed docs loaded as needed
│   ├── dependencies.md   #   Environment dependencies (if any)
│   ├── standards.md      #   Detailed reference material
│   └── examples.md       #   Usage examples
├── scripts/              # Optional - utility scripts
│   ├── validate.py
│   └── helper.sh
└── evals/                # Optional - test cases
    └── evals.json
```

### 存储位置 — 两级目录结构

技能组织在 `skills/` 下的**两级目录结构**中：

```
skills/
├── harmonyos/               # Category: HarmonyOS 鸿蒙设备相关
│   ├── view-hilog/          # Skill: 鸿蒙日志
│   └── hvigor-build/        # Skill: 编译构建
├── integration/             # Category: 外部平台集成
│   ├── huashan-log/          # Skill: 华山平台
│   └── codehub-multi-mr/      # Skill: CodeHub 多重挑单 MR
├── knowledge/               # Category: 纯知识参考
│   ├── accessibility/        # Skill: 无障碍规则
│   └── i18n-tips/            # Skill: i18n 避坑
├── meta/                    # Category: 元技能（skill/rule 管理）
│   ├── create-celia-skill/  # This skill
│   └── contribute-celia-suite/
├── tool/                    # Category: 本地工具
│   └── everything-search/
└── workflow/                # Category: 工作方式
    ├── workflow-troubleshoot/
    └── spawn-reviewer/
```

### SKILL.md 结构

每个技能需要一个 `SKILL.md` 文件，包含 YAML frontmatter 和 markdown 正文：

```markdown
---
name: your-skill-name
description: Brief description of what this skill does and when to use it
---

# Your Skill Name

## Instructions
Clear, step-by-step guidance for the agent.

## Examples
Concrete examples of using this skill.
```

### 必填 Metadata 字段

| 字段 | 要求 | 用途 |
|-------|--------------|---------|
| `name` | 最多 64 字符，仅限小写字母/数字/连字符 | 技能的唯一标识符 |
| `description` | 最多 1024 字符，非空 | 帮助 agent 决定何时应用该技能 |

---

## 编写有效的描述

描述对于技能发现**至关重要**。agent 使用它来决定何时应用你的技能。

### 描述最佳实践

1. **使用第三人称**（描述会被注入系统提示词）：
   - ✅ 好的："Processes Excel files and generates reports"
   - ❌ 避免："I can help you process Excel files"
   - ❌ 避免："You can use this to process Excel files"

2. **具体且包含触发词**：
   - ✅ 好的："Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction."
   - ❌ 模糊的："Helps with documents"

3. **同时包含 WHAT 和 WHEN**：
   - WHAT：技能做什么（具体能力）
   - WHEN：agent 何时应使用它（触发场景）

### 描述示例

```yaml
# PDF Processing
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# Excel Analysis
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.

# Git Commit Helper
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.

# Code Review
description: Review code for quality, security, and best practices following team standards. Use when reviewing pull requests, code changes, or when the user asks for a code review.
```

---

## 核心编写原则

### 1. 简洁是关键

上下文窗口与对话历史、其他技能和请求共享。每个 token 都在争夺空间。

**默认假设**：agent 已经非常聪明。只添加它不具备的上下文。

对每条信息提出质疑：
- "agent 真的需要这个解释吗？"
- "我能假设 agent 已经知道这个吗？"
- "这段文字值得它消耗的 token 吗？"

**好的（简洁）**：
```markdown
## Extract PDF text

Use pdfplumber for text extraction:

\`\`\`python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
\`\`\`
```

**坏的（冗长）**：
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but we
recommend pdfplumber because it's easy to use and handles most cases well...
```

### 2. 保持 SKILL.md 在 500 行以内

为获得最佳性能，主 SKILL.md 文件应保持简洁。对详细内容使用渐进式披露。

### 3. 渐进式披露

将关键信息放在 SKILL.md 中；详细参考资料放在单独的文件中，agent 仅在需要时读取。

```markdown
# PDF Processing

## Quick start
[Essential instructions here]

## Additional resources
- For complete API details, see [references/standards.md](references/standards.md)
- For usage examples, see [references/examples.md](references/examples.md)
```

**保持引用文件只有一级深度** — 从 SKILL.md 直接链接到引用文件。深层嵌套的引用可能导致部分读取。

### 4. 设定适当的自由度

将具体程度与任务的脆弱性相匹配：

| 自由度 | 何时使用 | 示例 |
|---------------|-------------|---------|
| **高**（文本指令） | 多种有效方法，视上下文而定 | 代码审查指南 |
| **中**（伪代码/模板） | 有偏好的模式，可接受变体 | 报告生成 |
| **低**（特定脚本） | 脆弱操作，一致性至关重要 | 数据库迁移 |

---

## 常见模式

### 模板模式

提供输出格式模板：

```markdown
## Report structure

Use this template:

\`\`\`markdown
# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
\`\`\`
```

### 示例模式

适用于输出质量依赖于看到示例的技能：

```markdown
## Commit message format

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
\`\`\`
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
\`\`\`

**Example 2:**
Input: Fixed bug where dates displayed incorrectly
Output:
\`\`\`
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
\`\`\`
```

### 工作流模式

将复杂操作分解为带有清单的清晰步骤：

```markdown
## Form filling workflow

Copy this checklist and track progress:

\`\`\`
Task Progress:
- [ ] Step 1: Analyze the form
- [ ] Step 2: Create field mapping
- [ ] Step 3: Validate mapping
- [ ] Step 4: Fill the form
- [ ] Step 5: Verify output
\`\`\`

**Step 1: Analyze the form**
Run: \`python scripts/analyze_form.py input.pdf\`
...
```

### 条件工作流模式

引导通过决策点：

```markdown
## Document modification workflow

1. Determine the modification type:

   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below

2. Creation workflow:
   - Use docx-js library
   - Build document from scratch
   ...
```

### 反馈循环模式

对于质量至关重要的任务，实施验证循环：

```markdown
## Document editing process

1. Make your edits
2. **Validate immediately**: \`python scripts/validate.py output/\`
3. If validation fails:
   - Review the error message
   - Fix the issues
   - Run validation again
4. **Only proceed when validation passes**
```

---

## 工具脚本

预制脚本相比生成的代码具有优势：
- 比生成的代码更可靠
- 节省 token（上下文中没有代码）
- 节省时间（无需生成代码）
- 确保多次使用的一致性

```markdown
## Utility scripts

**analyze_form.py**: Extract all form fields from PDF
\`\`\`bash
python scripts/analyze_form.py input.pdf > fields.json
\`\`\`

**validate.py**: Check for errors
\`\`\`bash
python scripts/validate.py fields.json
# Returns: "OK" or lists conflicts
\`\`\`
```

明确说明 agent 应该**执行**脚本（最常见）还是**阅读**它作为参考。

---

## 应避免的反模式

### 1. Windows 风格路径
- ✅ 使用：`scripts/helper.py`
- ❌ 避免：`scripts\helper.py`

### 2. 过多选项
```markdown
# Bad - confusing
"You can use pypdf, or pdfplumber, or PyMuPDF, or..."

# Good - provide a default with escape hatch
"Use pdfplumber for text extraction.
For scanned PDFs requiring OCR, use pdf2image with pytesseract instead."
```

### 3. 时间敏感信息
```markdown
# Bad - will become outdated
"If you're doing this before August 2025, use the old API."

# Good - use an "old patterns" section
## Current method
Use the v2 API endpoint.

## Old patterns (deprecated)
<details>
<summary>Legacy v1 API</summary>
...
</details>
```

### 4. 不一致的术语
选择一个术语并在全文中使用：
- ✅ 始终使用 "API endpoint"（不要混用 "URL"、"route"、"path"）
- ✅ 始终使用 "field"（不要混用 "box"、"element"、"control"）

### 5. 模糊的技能名称
- ✅ 好的：`processing-pdfs`、`analyzing-spreadsheets`
- ❌ 避免：`helper`、`utils`、`tools`

---

## 技能创建工作流

帮助用户创建技能时，遵循以下流程：

### 阶段 1：发现

收集以下信息：
1. 技能的目的和主要用例
2. 存储位置（个人还是项目）
3. 触发场景
4. 任何特定需求或约束
5. 现有的示例或模式可遵循

如果你可以使用 AskQuestion 工具，用它进行高效的结构化收集。否则，以对话方式询问。

### 阶段 2：设计

1. 起草技能名称（小写、连字符、最多 64 字符）
2. 编写具体、第三人称的描述
3. 概述需要的主要章节
4. 确定是否需要支持文件或脚本

### 阶段 3：实现

1. 创建目录结构
2. 编写 SKILL.md 文件，包含 frontmatter
3. 创建任何支持引用文件
4. 创建任何工具脚本（如需要）

### 阶段 4：验证

1. 验证 SKILL.md 在 500 行以内
2. 检查描述是否具体且包含触发词
3. 确保全文术语一致
4. 验证所有文件引用只有一级深度
5. 测试技能能否被发现和应用

---

## Evals（可选）

编写技能草稿后，创建一个简单的 `evals/evals.json`，包含 2-3 个真实的测试提示词 — 即真实用户实际会说的话。

```json
{
  "skill_name": "your-skill-name",
  "evals": [
    {
      "id": 1,
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result"
    }
  ]
}
```

保持简单：只需 `prompt` 和 `expected_output`。如需可稍后编写断言 — 对于主观性技能它们是可选的。

好的提示词是具体且明确的 — 包含文件路径、列名、背景上下文。坏的提示词是抽象的，如 "Process this data"。

保存到技能目录中的 `evals/evals.json`。

---

## 依赖（可选）

依赖**不是必需的**。许多技能（尤其是 `knowledge` 和 `workflow` 类别）没有外部依赖，完全不需要声明。

只有当技能确实需要外部工具、包或环境设置时才声明依赖。如果技能是纯指令或参考知识，完全跳过此部分。

当技能确实有依赖时，考虑它需要在同事的机器上运行什么 — 而不仅仅是你的。逐项检查：

- [ ] 外部工具/二进制文件？（如 `adb`、`hdc`、`jq`、`python`）
- [ ] 需要特定版本？说明最低版本。
- [ ] 需要 Python/Node 包？列出它们。
- [ ] 需要网络访问？记录代理/防火墙注意事项。
- [ ] 期望环境变量？列出并附带默认值。
- [ ] 特定操作系统或 shell 环境？（如 Windows 上的 Git Bash）

### 如何声明

| 有依赖？ | 怎么做 |
|---|---|
| 无外部依赖 | **完全跳过。** 无需声明。 |
| 简单（一两个工具） | 添加 `compatibility` frontmatter 行：`compatibility: Requires Python 3.8+ and pandas` |
| 复杂（多个组件、版本约束、环境变量、网络） | 添加 `compatibility` frontmatter 行 + 创建 `references/dependencies.md` 附详细文档 |

`references/dependencies.md` 模板：

```markdown
# Dependencies — <skill-name>

## Required

### 1. <Component name>
- Version: <minimum version>
- Verify: `<command>`
- Install: <steps>

## Optional

### <Component name>
- Used for: <description>
- When needed: <condition>
```

---

## 完整示例

以下是一个结构良好的技能的完整示例：

**目录结构：**
```
code-review/
├── SKILL.md
├── references/
│   ├── standards.md
│   └── examples.md
└── evals/
    └── evals.json
```

**SKILL.md：**
```markdown
---
name: code-review
description: Review code for quality, security, and maintainability following team standards. Use when reviewing pull requests, examining code changes, or when the user asks for a code review.
metadata:
  category: tool
---

# Code Review

## Quick Start

When reviewing code:

1. Check for correctness and potential bugs
2. Verify security best practices
3. Assess code readability and maintainability
4. Ensure tests are adequate

## Review Checklist

- [ ] Logic is correct and handles edge cases
- [ ] No security vulnerabilities (SQL injection, XSS, etc.)
- [ ] Code follows project style conventions
- [ ] Functions are appropriately sized and focused
- [ ] Error handling is comprehensive
- [ ] Tests cover the changes

## Providing Feedback

Format feedback as:
- 🔴 **Critical**: Must fix before merge
- 🟡 **Suggestion**: Consider improving
- 🟢 **Nice to have**: Optional enhancement

## Additional Resources

- For detailed coding standards, see [references/standards.md](references/standards.md)
- For example reviews, see [references/examples.md](references/examples.md)
```

---

## 总结清单

在最终确定技能之前，验证以下内容：

### 核心质量
- [ ] 描述具体且包含关键术语
- [ ] 描述同时包含 WHAT 和 WHEN
- [ ] 使用第三人称编写
- [ ] SKILL.md 正文在 500 行以内
- [ ] 全文术语一致
- [ ] 示例具体，不抽象

### 结构
- [ ] 文件引用只有一级深度
- [ ] 适当使用渐进式披露
- [ ] 工作流有清晰的步骤
- [ ] 没有时间敏感信息

### 如果包含脚本
- [ ] 脚本解决问题而非推诿
- [ ] 所需包已记录
- [ ] 错误处理明确且有用
- [ ] 没有 Windows 风格路径
