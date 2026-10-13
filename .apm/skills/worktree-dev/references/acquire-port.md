# acquire-port 端口分配器参考手册

`acquire-port` 是全局无状态动态端口与资源放行分配器。在本地启动任何网络服务（开发服务器、E2E 实例、Worktree 实例、Mock 进程等）前，**必须通过 `acquire-port` 动态申请端口，严禁硬编码端口号**。

---

## 一、平台与脚本路径

| 平台 | 脚本位置 | 依赖与环境 |
|---|---|---|
| **Linux** | `{skill_dir}/scripts/acquire-port` | Bash 4+（依赖 `python3`、`ss`、`flock`、`shuf`，内存读取 `/proc/meminfo`） |
| **Windows** | `{skill_dir}/scripts/acquire-port.ps1` | PowerShell 5.1+ / 7+（支持 Windows 10/11 / Server） |

> **提示**：若已将脚本加入全局 PATH（例如安装至 `/usr/local/bin/acquire-port`），可直接在终端中通过 `acquire-port` 执行。

---

## 二、核心机制与设计原则

1. **无状态与无租约**：
   - 即分即用，不写租约文件、不登记进程 PID、不依赖心跳，**无需调用释放命令**。
   - 端口状态完全交由内核判定：服务启动自然占用端口，进程退出内核自动回收端口。
2. **物理内存余量门禁**：
   - 放行条件：当前物理可用内存（`MemAvailable` / `AvailableMBytes`）$\ge 512\text{ MB}$（固定余量门禁，不随申请端口数量倍增）。
   - 可用内存不足时拒绝放行（退出码 1），防止多服务并发耗尽单机内存。
3. **动态端口池与随机遍历**：
   - 默认端口范围：`25000` ～ `65000`（属于 IANA 动态与私有端口范围）。
   - 分配时对候选端口随机打乱探测，降低多进程并发分配时的碰撞概率。
4. **并发互斥探测（防撞车）**：
   - 分配过程中持有临时文件锁（Linux：`flock /tmp/acquire-port.lock`；Windows：独占打开临时锁文件），保证探测与分配过程原子化。锁随进程退出自动消除。
   - 探测时不设 `SO_REUSEADDR`（Windows 开启 `ExclusiveAddressUse`），处于 `TIME_WAIT` 的端口亦判为占用，杜绝服务真实启动时 bind 失败。

---

## 三、常用命令与调用范式

### 1. 变量捕获（最常用）

#### Linux (Bash)
```bash
# 申请 1 个端口（资源不足时默认阻塞等待最多 300 秒）
PORT=$(acquire-port --wait)

# 指定等待上限（如 60 秒）
PORT=$(acquire-port --wait=60)

# 申请多个端口（输出为空格分隔的端口号）
read -r HTTP_PORT WS_PORT <<< "$(acquire-port --wait 2)"
# 显式写法（推荐）：
read -r HTTP_PORT WS_PORT <<< "$(acquire-port --wait=60 --count 2)"
```

#### Windows (PowerShell)
```powershell
# 申请 1 个端口
$PORT = & acquire-port.ps1 -Wait

# 指定等待上限（秒）
$PORT = & acquire-port.ps1 -Wait -WaitSeconds 60

# 申请多个端口（支持位置参数或 -Count，返回数组或空格分隔）
$ports = & acquire-port.ps1 -Wait -Count 2
$HTTP_PORT = $ports[0]
$WS_PORT   = $ports[1]
```

### 2. `--exec` 包装执行模式

自动申请端口并注入环境变量，直接启动后续命令（首个端口注入 `$PORT`，所有端口空格分隔注入 `$PORTS`）：

#### Linux (Bash)
```bash
# 申请 1 个端口并执行启动命令
acquire-port --wait --exec npm run dev -- --port "$PORT"

# 申请 2 个端口并执行命令（在 --exec 前指定 --count 2）
acquire-port --wait --count 2 --exec ./start-cluster.sh
```

#### Windows (PowerShell)
```powershell
# 申请 1 个端口并执行命令（-Exec 后面直接跟命令，无需 --）
& acquire-port.ps1 -Wait -Exec npm run dev --port $env:PORT

# 申请 2 个端口并执行命令
& acquire-port.ps1 -Wait -Count 2 -Exec ./start-cluster.ps1
```

### 3. 查看端口池当前占用（只读诊断）

```bash
acquire-port --list           # Linux
& acquire-port.ps1 -List      # Windows
```

输出当前池范围内已被系统监听的端口列表及当前可用内存，不产生任何副作用。

---

## 四、CLI 参数对照表

| Linux (Bash) | Windows (PowerShell) | 默认值 | 说明 |
|---|---|:---:|---|
| `[N]` 或 `--count N` | `[N]` 或 `-Count N` | `1` | 申请端口数量（正整数） |
| `--wait` | `-Wait` | 关闭 | 内存不足时阻塞轮询，等待资源释放 |
| `--wait=SECS` | `-WaitSeconds SECS` | `300` | 等待超时时间（秒） |
| `--list` / `-l` | `-List` | — | 查看端口池当前占用情况与可用内存 |
| `--exec CMD...` | `-Exec CMD...` | — | 自动注入 `$PORT`/`$PORTS` 环境变量并执行命令 |
| `-h` / `--help` | — | — | 显示帮助信息 |

> **注意：`--wait` 传参与防坑提示**：
> - 在 Bash 中，`--wait` 默认等待 300 秒；若需自定义秒数，**请务必写为 `--wait=60`**。
> - 若写 `acquire-port --wait 2`，末尾的 `2` 会被解析为申请端口数（即：等待 300s，申请 2 个端口）。推荐在申请多个端口时显式写 `--count 2`，语义更清晰。

---

## 五、退出码与排查对策

| 退出码 | 含义 | 原因与处理对策 |
|:---:|---|---|
| `0` | **成功** | 端口分配成功，stdout 输出端口号（空格分隔）。 |
| `1` | **资源不足** | 系统当前物理可用内存低于 512 MB 阈值。<br>• 应对：检查并停止空闲的服务进程；或在命令中追加 `--wait` 等待其他任务释放内存。 |
| `2` | **端口不足** | 申请端口数超过端口池容量，或池内所有端口均已被占用。<br>• 应对：检查外部占用；或通过环境变量扩大端口池范围。 |
| `1` | **参数用法错误** | 参数格式不合法或 `--exec` 缺少命令参数。<br>• 应对：按帮助信息检查命令行调用格式。 |

---

## 六、环境变量配置

| 环境变量 | 默认值 | 说明 |
|---|:---:|---|
| `ACQUIRE_PORT_BASE` | `25000` | 动态端口池起始端口 |
| `ACQUIRE_PORT_END` | `65000` | 动态端口池结束端口 |

---

## 七、已知边界与使用建议

1. **分配与绑定的时间窗口**：
   分配端口后，到目标服务真正 `listen()` 之间存在极短时间窗口（毫秒级）。为尽可能缩短该窗口，推荐使用 `--exec` 模式在分配后立即执行启动命令。
2. **内存余量判据**：
   Linux 读取 `/proc/meminfo` 的 `MemAvailable`（含可回收的 Page Cache / Buffer，不含 Swap）。在 Android / Termux 宿主环境中，`MemFree` 常年偏低，因此必须依赖 `MemAvailable` 保证评估准确。
