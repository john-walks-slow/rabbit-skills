---
name: try
description: 为目标文件创建可回退的备份。要对特定文件做不确定的破坏性修改或用户希望可以轻松回退时必须使用。
user-invocable: true
---

# try

## 目标

编辑文件前，为目标文件创建可回退的备份。

## 工作流程

1. 确认文件存在且是目标文件
2. 创建备份（默认不改动当前工作区；如需清桌编辑，将下方的 `git stash create` 换为 `git stash push`）：

```bash
BACKUP_HASH=$(git stash create -u)
git stash store -m "backup:<file-path>" "$BACKUP_HASH"
```

> `-u`（`--include-untracked`）将未跟踪的文件也纳入备份。

3. 执行修改
4. 如果结果满意，继续工作。
5. 如果需要回滚：

```bash
git restore --source="$BACKUP_HASH" -- <file-path> 2>/dev/null \
  || git restore --source="${BACKUP_HASH}^3" -- <file-path>
```

## 约束

- 恢复时只操作目标文件，不影响其他已 stash 的内容
- 不执行破坏性 git 命令
- 默认不包含 `.gitignore` 中的文件（需备份时用 `-a`/`--all` 替代 `-u`）

若项目不是 git 仓库，告知用户无法执行。
