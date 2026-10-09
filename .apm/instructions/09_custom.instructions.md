---
description: 约定与通例：多 Agent 协作、Shell/Git 使用规则、子代理使用、测试范围、敏感信息防护
---

# 约定与通例

## 多 Agent 协作

本工程同时由多个 Agent 修改，总是假定有其他 Agent 或人类在同时工作。不要处理你的改动范围之外的变化。
除非你用 git diff 确认过，不要认为一个文件里只包含你自己的修改！
未经用户书面同意，禁止使用以下命令（它们可能破坏他人的工作）：

- `git stash`
- `git checkout`
- `git restore`
- `git reset`。

> 特例：当你在独立 worktree 中工作时不受此限。

## Shell 使用规则

执行任何会修改文件内容（例如批量替换）的批处理脚本/命令前，**必须** 先 dry run。
如果在运行必要命令时权限遭到拒绝，可告知用户需要执行的命令，请他手动执行。

## 版本管理规则

- 新建项目时，总是使用 Git 进行版本管理
- 提交消息默认模板：

```
# head: <type>(<scope>): <subject>
# - type: feat, fix, docs, style, refactor, test, chore
# - scope: can be empty (eg. if the change is a global or difficult to assign to a single component)
# - subject: start with verb (such as 'change'), 50-character line
#
# body: 72-character wrapped. This should answer:
# * Why was this change necessary?
# * How does it address the problem?
# * Are there any side effects?
#
# footer: 
# - Include a link to the ticket, if any.
# - BREAKING CHANGE
#
```

## 子代理使用规则

- 发挥子代理的自主性，明确说明任务背景、你的需求、产物要求，无需微管理子代理的具体行事方式。
- 当输入或输出信息超过 1000 字时，必须以文件引用的形式传递。

正例：将计划文件链接提供给子代理
反例：向子代理复述计划全文

正例：要求子代理将报告以文件形式输出到指定路径，并仅回复输出文件的链接
反例：不做要求，子代理直接回复2000字的报告文本

## 默认测试范围

简单修改默认无需测试。

当修改复杂，工作流中要求测试时，必须注意控制测试的范围和粒度：
- 写什么：为核心真实场景和容易出错的逻辑添加测试用例。用例要有意义、能真正减少问题，不要写过于显而易见的、仅为提高 coverage 数字的用例。
- 跑什么：**先划定范围再跑**。严格按本次改动的业务影响面决定执行哪些用例（含端到端测试），只跑受影响的模块；严禁无差别全量跑历史用例。能分模块执行就不要全量执行。
- 用不用真 API：涉及真实外部 API（LLM / TTS / ASR / 生图 / 视频等）的测试默认**不执行**，优先 Mock、假流注入、缓存或会话复用。确需真跑（无法 Mock 的契约、最终验收）时单点单测，**不批量反复重跑**。

## 敏感信息与安全防护规范（重要）

在任何工程项目中，严禁将真实敏感凭据直接硬编码或提交至版本控制。

1. 凭证隔离与环境变量注入：
   - 真实 API Key、Token、密码、私钥、Webhook 密钥等必须且只能通过环境变量（如 `.env`，并在 `.gitignore` 中排除）或运行时外部凭据管理器注入。
   - 严禁在源码或构建产物中硬编码真实密钥，禁止将包含有效凭据的文件加入 Git 追踪。

2. 文档与 Issue 记录脱敏：
   - 项目文档（包括 `README.md`、`docs/features/`、`docs/issues/`、排障记录、验证计划等）中的所有示例与回放记录，一律使用标准占位符（如 `<your-api-key>`、`demo-token`、`<your-domain.com>`、`127.0.0.1`）。
   - 禁止在公开/归档文档中记录真实的公网隧道域名、内网拓扑细节、个人手机号或真实凭证排查线索。

3. 测试脚本与 Mock 数据安全：
   - 单元测试、E2E 测试和调测脚本中，严禁为了「方便跑通」而直接使用真实 Key 或生产账号。
   - 测试夹具与 Mock 必须使用显而易见的虚构占位符（例如 RFC 5737 测试 IP、555 保留号段、公开 JWT 示例、`mock-token`、`test-key`）。

4. 例外范围：
   - 本规范约束进入版本控制或对外交付的内容。未被 Git 跟踪的本地文件（本地 skill、临时脚本、本机环境记录）不在此限。
