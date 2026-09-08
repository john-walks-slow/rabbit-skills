---
name: worktree
description: 基于 git worktree 的并行开发约定。何时用 worktree（大实验、多任务并行、需物理隔离），如何创建、命名与清理；与 try（小改动原地备份）、commit-own-changes（共享工作树提交纪律）的分工；以及文档合并回主树的约定。
user-invocable: true
---

# worktree

用 git worktree 为并行与实验性工作建立物理隔离。可逆性越强，可自主推进的空间越大。

## 何时用

- 大规模实验性修改（可能整体推翻重来）
- 多任务 / 多子代理并行开发——每个 worktree 承载一个任务，天然互不干扰
- 修改主线的同时需要保持主线可运行

**何时不用**（用 /try）：小范围、几分钟能完成、改完即回滚的修改——原地备份更轻。

## 约定

- **创建**：`git worktree add ../<repo>-<task-slug> -b <task-slug>`，分支名与目录后缀一致。
- **worktree 内**：正常走工作流。你独占该工作树，无需 /commit-own-changes 的 hunk 筛选纪律；共享工作树的协作红线（stash / checkout / reset 等）在此天然解除。
- **文档**：worktree 内照常产出工作流文档（plan / troubleshoot / validation / summary）。涉及 docs/ 共享目录的内容，在分支合并回主线前统一整理，避免多 worktree 并行时的文档冲突。
- **清理**：任务合并回主线后 `git worktree remove` 并删除对应分支。
