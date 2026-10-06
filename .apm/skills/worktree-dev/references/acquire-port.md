# acquire-port（worktree 专用端口分配器）

`worktree-dev` 自带的小工具：在 worktree 内启动任何监听端口的进程前，用它动态取端口，避免多 worktree、多服务并发时撞端口。

| 平台 | 脚本 |
|---|---|
| Linux | `{skill_dir}/scripts/acquire-port`（bash 4+；依赖 `python3`、`ss`、`flock`、`shuf`，可用内存读 `/proc/meminfo`） |
| Windows | `{skill_dir}/scripts/acquire-port.ps1`（PowerShell 5.1+ / 7+） |

macOS 不适用 bash 版（没有 `/proc`、`ss`、`flock`、`shuf`，且自带 bash 3.2）。

装到 PATH 上更好用（可选）：

```bash
install -m 755 {skill_dir}/scripts/acquire-port /usr/local/bin/acquire-port
```

```powershell
Copy-Item "{skill_dir}\scripts\acquire-port.ps1" "$env:USERPROFILE\bin\acquire-port.ps1"
```

## 核心机制与语义

- **无状态**：不留租约文件、不记 owner、不用心跳、**没有释放命令**。分配就返回，剩下的交给内核。服务起来端口自然被占着，服务停了端口自然空出来，判定标准只有一条：这个端口现在 bind 得上来吗。
- **内存余量放行**：可用内存（bash 读 `MemAvailable`，Windows 读 `AvailableMBytes`）`>= 512MB` 才放行，否则拒绝（退出码 1）。
  - 余量是**固定的一份**，与存续实例数、本次申请端口数都无关。存续实例占的内存已经体现在可用量里了，按实例数再乘一遍是重复收费。
  - **没有并发槽位上限**：想要几个端口要几个。
- **端口池范围**：默认 `25000-65000`，用 `ACQUIRE_PORT_BASE` / `ACQUIRE_PORT_END` 可改。
- **防撞车**：分配过程串行化（bash 用 `flock /tmp/acquire-port.lock`，Windows 用独占打开 `%TEMP%\acquire-port.lock`）。这是把手上的锁不是登记——进程退出锁自动消失，不需要谁去解。
  - 探测**不设**地址复用：bash 不设 `SO_REUSEADDR`，Windows 设 `SO_EXCLUSIVEADDRUSE`。TIME_WAIT 的端口也判占用——宁可少给一个，也不要给出去一个等服务真起来才 bind 失败的端口。
- **遍历顺序**：bash 先把端口池 `shuf` 打乱再逐个试探；Windows 先从池中随机取样，取样预算用尽后再从随机起点顺序扫一遍。两者都只是改变遍历顺序，临界区行为一致。

## Windows 版的参数差异

- 取 N 个端口用 `-Count N`（没有 bash 那样的裸位置参数 `acquire-port 3`）。
- `-Exec` 后面**不要写裸 `--`**（PowerShell 会把它当参数名报错），直接跟命令：`-Exec npm run dev --port 3000` 即可。
- 脚本带 UTF-8 BOM：Windows PowerShell 5.1 对无 BOM 的非 ASCII 脚本会按 ANSI 码页解析，中文诊断信息会直接把语法搞坏。改脚本时请保留 BOM。

## 常用命令与模式

变量捕获：

```bash
PORT=$({skill_dir}/scripts/acquire-port --wait)
LINT_PORT=$({skill_dir}/scripts/acquire-port --wait 2 | cut -d' ' -f2)
```

```powershell
$PORT = & "{skill_dir}\scripts\acquire-port.ps1" -Wait
$ports = & "{skill_dir}\scripts\acquire-port.ps1" -Wait -Count 2
```

包装执行（自动注入 `$PORT` / `$PORTS`）：

```bash
{skill_dir}/scripts/acquire-port --wait --exec npm run dev -- --port "$PORT"
{skill_dir}/scripts/acquire-port --wait --exec -- 2 ./start-cluster.sh
```

```powershell
& "{skill_dir}\scripts\acquire-port.ps1" -Wait -Exec npm run dev
```

查看池内当前占用（只读，不留痕）：

```bash
{skill_dir}/scripts/acquire-port --list
```

```powershell
& "{skill_dir}\scripts\acquire-port.ps1" -List
```

## 退出码

| 退出码 | 含义 | 对策 |
|---|---|---|
| `0` | 成功 | stdout 返回端口号（空格分隔） |
| `1` | 资源不足 | 可用内存低于 512MB 余量。加 `--wait` / `-Wait` 等内存回升，或先停掉一些服务 |
| `2` | 端口不足 | 池内 bind 得上的端口不够。通常是池范围太小或外部进程大面积占用，等待无解 |

## 已知边界

- 分配到服务真正 bind 之间有个百毫秒级窗口，期间同一端口可能被另一次分配选中。要严格独占，用 `--exec` / `-Exec` 让分配与启动在同一条命令里，窗口压到最小。
- 默认 4 万端口池的遍历开销约 20-50ms（bash 的 `shuf`）/ 数十毫秒（Windows 的随机起点扫描），可接受。

## 环境变量

- `ACQUIRE_PORT_BASE`：起始端口。
- `ACQUIRE_PORT_END`：结束端口。
