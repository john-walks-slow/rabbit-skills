#Requires -Version 5.1
<#
acquire-port.ps1 — worktree-dev 配套的端口分配器（Windows / PowerShell 版）
语义与同目录的 acquire-port（bash）一致：一次调用取一组端口，无登记、不用释放，
放行以可用内存余量为准。详见 ../references/acquire-port.md。

用法：
  acquire-port.ps1 [-Count N]               取 N 个端口（默认 1）
  acquire-port.ps1 -Wait [-WaitSeconds S] [-Count N]
  acquire-port.ps1 -List
  acquire-port.ps1 -Exec CMD [ARGS...]      取 1 个端口，注入 $env:PORT / $env:PORTS 后执行
  acquire-port.ps1 -Count N -Exec CMD ...    取 N 个端口后执行

注意：不要传裸 `--`（PowerShell 会把它当参数名），-Exec 后直接跟命令即可。

输出：端口号（空格分隔）到 stdout，诊断信息到 stderr。
退出码：0 成功 / 1 资源不足（内存不足，可等待）/ 2 端口不足 / 1 用法错误
#>
[CmdletBinding(PositionalBinding = $false)]
param(
    [int]$Count = 1,
    [switch]$Wait,
    [int]$WaitSeconds = 300,
    [switch]$List,
    [switch]$Exec,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$Command
)

$ErrorActionPreference = 'Stop'

$PoolBegin    = if ($env:ACQUIRE_PORT_BASE) { [int]$env:ACQUIRE_PORT_BASE } else { 25000 }
$PoolEnd      = if ($env:ACQUIRE_PORT_END)  { [int]$env:ACQUIRE_PORT_END }  else { 65000 }
$PoolSize     = $PoolEnd - $PoolBegin + 1
$MemReserveMB = 512
$ReservedPorts = 4175, 4180, 4325
$LockPath     = Join-Path ([System.IO.Path]::GetTempPath()) 'acquire-port.lock'

function Write-Diag([string]$Message) {
    [Console]::Error.WriteLine("acquire-port: $Message")
}

function Get-AvailableMemMB {
    try {
        $perf = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Memory -ErrorAction Stop
        if ($null -ne $perf -and $perf.AvailableMBytes) { return [int]$perf.AvailableMBytes }
    } catch { }
    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
        return [int]($os.FreePhysicalMemory / 1KB)
    } catch { }
    return [int]::MaxValue
}

function Test-PortFree([int]$Port) {
    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
    try {
        $listener.ExclusiveAddressUse = $true
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        try { $listener.Stop() } catch { }
    }
}

function Get-ListeningPorts {
    try {
        return @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Select-Object -ExpandProperty LocalPort)
    } catch {
        return @(
            (netstat -an -p tcp) | ForEach-Object {
                if ($_ -match '^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING') { [int]$Matches[1] }
            }
        )
    }
}

function Lock-PortPool {
    $deadline = (Get-Date).AddSeconds(30)
    while ($true) {
        try {
            return [System.IO.File]::Open($LockPath, 'OpenOrCreate', 'ReadWrite', 'None')
        } catch {
            if ((Get-Date) -ge $deadline) { throw "无法获得分配锁（$LockPath）" }
            Start-Sleep -Milliseconds 50
        }
    }
}

function Invoke-AcquireOnce {
    $availMb = Get-AvailableMemMB
    if ($availMb -lt $MemReserveMB) {
        Write-Diag "内存不足拒绝放行（可用 $availMb MB / 需 $MemReserveMB MB 余量）。加 -Wait 等待或先释放部分服务。"
        return @{ Code = 1; Ports = '' }
    }

    $granted = New-Object System.Collections.Generic.List[int]
    $tried = New-Object 'System.Collections.Generic.HashSet[int]'
    $lock = Lock-PortPool
    try {
        # 先随机取样（与 bash 版的 shuf 遍历同效：避免连续端口被成片占走），
        # 取样预算用尽后再从随机起点顺序扫一遍，保证不因为取样运气差而漏掉空闲端口。
        $budget = [Math]::Min($PoolSize, [Math]::Max(200, $Count * 50))
        $attempts = 0
        while ($granted.Count -lt $Count -and $attempts -lt $budget) {
            $attempts++
            $candidate = Get-Random -Minimum $PoolBegin -Maximum ($PoolEnd + 1)
            if ($ReservedPorts -contains $candidate) { continue }
            if (-not $tried.Add($candidate)) { continue }
            if (Test-PortFree -Port $candidate) { $granted.Add($candidate) }
        }

        $origin = Get-Random -Minimum $PoolBegin -Maximum ($PoolEnd + 1)
        for ($i = 0; $i -lt $PoolSize -and $granted.Count -lt $Count; $i++) {
            $port = $PoolBegin + (($origin - $PoolBegin + $i) % $PoolSize)
            if ($ReservedPorts -contains $port) { continue }
            if (-not $tried.Add($port)) { continue }
            if (Test-PortFree -Port $port) { $granted.Add($port) }
        }
    } finally {
        $lock.Dispose()
    }

    if ($granted.Count -lt $Count) {
        Write-Diag "端口池 $PoolBegin-$PoolEnd 内空闲端口不足（需要 $Count，实得 $($granted.Count)）"
        return @{ Code = 2; Ports = '' }
    }
    return @{ Code = 0; Ports = ($granted -join ' ') }
}

$execArgs = @()
if ($Command -and $Command.Count -gt 0) {
    $execArgs = $Command
    if ($execArgs[0] -eq '--') {
        $execArgs = if ($execArgs.Count -gt 1) { $execArgs[1..($execArgs.Count - 1)] } else { @() }
    }
}

if ($Count -lt 1) { Write-Diag "端口数量必须为正整数: $Count"; exit 1 }
if ($Count -gt $PoolSize) { Write-Diag "申请 $Count 个端口超过池容量 $PoolSize（$PoolBegin-$PoolEnd）"; exit 2 }
if ($Exec -and $execArgs.Count -eq 0) { Write-Diag '-Exec 需要指定命令'; exit 1 }
if ((-not $Exec) -and $execArgs.Count -gt 0) { Write-Diag "未知参数: $($execArgs -join ' ')（取端口数量请用 -Count N）"; exit 1 }

if ($List) {
    Write-Output "端口池: $PoolBegin-$PoolEnd"
    $used = Get-ListeningPorts | Where-Object { $_ -ge $PoolBegin -and $_ -le $PoolEnd } | Sort-Object -Unique
    if ($used) { $used | ForEach-Object { Write-Output "  占用: $_" } } else { Write-Output '  （池内无人监听）' }
    Write-Output "可用内存: $(Get-AvailableMemMB) MB"
    exit 0
}

$result = $null
if ($Wait) {
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ($true) {
        $result = Invoke-AcquireOnce
        if ($result.Code -eq 0) { break }
        if ($result.Code -eq 2) { exit 2 }
        if ((Get-Date) -ge $deadline) {
            Write-Diag "等待资源超时 ${WaitSeconds}s"
            exit 1
        }
        Start-Sleep -Seconds 2
    }
} else {
    $result = Invoke-AcquireOnce
    if ($result.Code -ne 0) { exit $result.Code }
}

if (-not $Exec) {
    Write-Output $result.Ports
    exit 0
}

$ports = $result.Ports -split '\s+'
$env:PORT = $ports[0]
$env:PORTS = $result.Ports
if ($execArgs.Count -gt 1) {
    & $execArgs[0] @($execArgs[1..($execArgs.Count - 1)])
} else {
    & $execArgs[0]
}
exit $LASTEXITCODE
