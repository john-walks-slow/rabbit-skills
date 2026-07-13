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
2. 创建备份：

```bash
git stash push -u -m "backup:<file-path>" -- <file-path>
```

> `-u` 会把文件从工作区移走（等价于 `git clean`），得到一个干净的起点开始编辑。

3. 执行修改
4. 如果结果满意，继续工作。
5. 如果需要回滚：

```bash
git stash list
git restore --source='stash@{0}' -- <file-path>
```

## 约束

- 保持操作路径限定。只备份要求的文件，不将无关文件带入 stash
- 不执行破坏性 git 命令

若项目不是 git 仓库，告知用户无法执行。
