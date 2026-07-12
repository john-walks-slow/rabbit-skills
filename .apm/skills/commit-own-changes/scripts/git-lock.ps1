<#
.SYNOPSIS
    获取/释放 git 操作互斥锁。
    确保同一时间只有一个 agent 在执行 git 操作。
.PARAMETER Action
    acquire: 获取锁（等待最多 -Timeout 秒）
    release: 释放锁
.PARAMETER Timeout
    获取锁的最长等待秒数（默认 120）
#>
param(
    [Parameter(Mandatory)] [ValidateSet('acquire','release')] [string]$Action,
    [int]$Timeout = 120
)

$lockFile = Join-Path (git rev-parse --git-dir) "agent.lock"
$pidFile = "$lockFile.$pid"

function Acquire {
    $deadline = (Get-Date).AddSeconds($Timeout)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path $lockFile) {
            $content = Get-Content $lockFile -Raw
            if ($content -match 'ts=([\d\.]+)') {
                $lockTs = [double]::Parse($matches[1])
                $age = (Get-Date) - (Get-Date -UnixTimeSeconds $lockTs)
                if ($age.TotalMinutes -gt 5) {
                    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
                    Write-Warning "清理过期锁（${age}）"
                }
            }
        }
        try {
            $file = [System.IO.File]::Open($lockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            $writer = [System.IO.StreamWriter]::new($file)
            $writer.WriteLine("pid=$pid")
            $writer.WriteLine("ts=$(Get-Date -UFormat %s)")
            $writer.Close()
            $file.Close()
            Write-Output "acquired:$pid"
            return
        } catch {
            Start-Sleep -Milliseconds 300
        }
    }
    Write-Error "无法获取 git 锁（超时 ${Timeout}s），当前持有者 PID: $(Get-Content $lockFile -Raw)"
    exit 1
}

function Release {
    if (Test-Path $lockFile) {
        $content = Get-Content $lockFile -Raw
        if ($content -match "pid=(\d+)") {
            if ([int]$matches[1] -eq $pid) {
                Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
                Write-Output "released:$pid"
            } else {
                Write-Warning "锁由其他进程持有 (PID $($matches[1]))，跳过释放"
            }
        }
    }
}

switch ($Action) {
    'acquire'  { Acquire }
    'release'  { Release }
}
