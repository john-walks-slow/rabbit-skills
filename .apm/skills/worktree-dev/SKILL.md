---
name: worktree-dev
description: 基于 Git Worktree 的隔离开发工作流。在 worktree 中开发新功能、修复缺陷或做验证时使用；分支合并回主分支（多 worktree 并发合并无需排队加锁）见文末
user-invocable: true
---

# Git Worktree 开发工作流

基于 Git Worktree 提供完全隔离的独立工作区，支持多任务并发开发、独立服务调试与安全合入。

---

## 一、生命周期速查

```
[1. 创建 Worktree] ──> [2. 环境初始化 & 启动] ──> [3. 独立开发 & 提交] ──> [4. 合入主分支] ──> [5. 收尾清理]
git worktree add       init/dev-worktree.sh        git commit                  merge-to-main.sh      git worktree remove
```

---

## 二、规范约定（命名与路径）

- **分支命名**：`feat/<name>` 或 `fix/<name>`
- **工作区路径**：仓库根目录下的 `.worktrees/<name>`（`<name>` 为分支名末段，**不含斜杠**）
- **Git 忽略**：仓库根目录 `.gitignore` 必须包含 `.worktrees/`

---

## 三、标准执行流程

### 1. 创建工作树

在仓库根目录下切出独立分支与对应 worktree：

```bash
# 从主分支（master / main）创建隔离工作区
git worktree add -b feat/<name> .worktrees/<name> master
cd .worktrees/<name>
```

### 2. 环境初始化与服务启动

worktree 内建议维护两个约定脚本（根据项目实际情况在 `scripts/` 中创建或提炼）：

| 脚本 | 职责与约定 |
|---|---|
| `scripts/init-worktree.sh` | 依赖安装、环境与配置初始化 |
| `scripts/dev-worktree.sh`  | 动态申请端口 → 启动服务 → 输出访问地址（供 E2E 验证及用户体验） |

#### 端口分配原则（严禁硬编码）

worktree 内启动任何监听端口的服务（开发服务器、E2E 实例、Mock 服务等），**必须通过 `acquire-port` 动态申请端口**，禁止硬编码端口号（如 `3000`）：

```bash
# 方式 1：脚本变量捕获（最常用）
PORT=$(acquire-port --wait)
npm run dev -- --port "$PORT"

# 方式 2：包装执行（自动注入 $PORT / $PORTS 环境变量）
acquire-port --wait --exec npm run dev -- --port "$PORT"
```

> **说明**：
> - `acquire-port` 为全局无状态分配器，仅根据物理可用内存余量（$\ge 512\text{MB}$）放行，服务启动自然占用、退出自然释放，无需手动释放。
> - 完整机制、参数及 Windows 用法详见 [acquire-port 参考手册](references/acquire-port.md)。
> - 若项目自带统一的隔离测试实例管理机制（如 `dsh-e2e`），优先遵循其指令。

### 3. 独立开发与验证

- **严格边界**：所有文件编辑、服务运行与测试严格限制在当前 worktree 目录下，严禁向主工作区或线上目录写入未声明产物。
- **独立提交**：worktree 内环境完全隔离，不存在他人修改混入风险，可直接全量提交：
  ```bash
  git add .
  git commit -m "feat(<scope>): <description>"
  ```

### 4. 合入主分支（无锁 CAS）

**必须在获得用户显式同意后，方可合入主分支。**

多 worktree 并行开发时，合入主分支使用本 skill 自带的 `merge-to-main.sh` 脚本：
- **分支历史推进**：基于 `git merge --ff-only`（Compare-And-Swap），仅在本分支真包含目标分支当前提交时才落地；若主分支已被其他任务推进，脚本会自动重新变基并重试，**不需要人为排队加锁**。
- **主工作区保护**：合入需目标分支本地工作区干净（无未提交的已跟踪改动）。若被占用，使用 `--wait` 自动排队等待目标工作区变干净。

```bash
# 常用命令（{skill_dir} 指本 skill 安装目录；Windows 请在 Git Bash 中运行）
{skill_dir}/scripts/merge-to-main.sh                   # 自动探测 master/main，变基后 fast-forward 合入
{skill_dir}/scripts/merge-to-main.sh --into main       # 指定目标分支
{skill_dir}/scripts/merge-to-main.sh --strategy merge  # 保留分支历史（产生 merge commit）
{skill_dir}/scripts/merge-to-main.sh --wait            # 目标工作区有改动时排队等待（默认最多 3600 秒）
{skill_dir}/scripts/merge-to-main.sh --wait=600        # 指定等待上限（如 600 秒，--wait 600 亦可）
```

#### 退出码与对策

| 退出码 | 含义 | 对策 |
|:---:|---|---|
| `0` | 合并成功 | 进入收尾阶段 |
| `1` | 用法或环境错误 | 检查是否在 worktree 内、当前 worktree 是否有未提交的已跟踪改动 |
| `2` | 变基 / 合并冲突 | 脚本会自动 `--abort` 还原现场并打印冲突文件。按下方指引手动解决 |
| `3` | CAS 重试耗尽 | 主分支推进过于频繁，可调大 `--retries` 后重试 |
| `4` | 目标工作区有未提交改动 | 去主工作区处理改动，或追加 `--wait[=秒]` 等待其清空 |

#### 冲突处理流程

脚本仅执行机械合并，不代劳解决冲突。退出码为 `2` 时：

```bash
# 1. 在当前 worktree 中重放变基，复现冲突现场
git rebase master

# 2. 编辑冲突标记文件，标记已解决并继续变基
git add <conflicted-file>
git rebase --continue

# 3. 冲突解决完成后，重新运行合入脚本
{skill_dir}/scripts/merge-to-main.sh
```

> **注意**：各 worktree 仅在本地解决自己的冲突，彼此互不阻塞；仅在最终 CAS 落地那一步按需排队。

### 5. 收尾清理

合并成功后，必须及时清理资源：
1. 停止在当前 worktree 中启动的所有后台服务和测试进程；
2. 切出工作树目录（例如回到仓库根目录），移除工作树及临时分支：

```bash
# 移除工作树目录
git worktree remove .worktrees/<name>

# 删除已合入的本地分支
git branch -d feat/<name>
```

---

## 四、例外说明

若当前 worktree 是由系统宿主或外层调度器（如 Codeg、Kandev 等）自动创建并管理的，优先遵循系统注入的生命周期指令，不强求手动执行移除。
