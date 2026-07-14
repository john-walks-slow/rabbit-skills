<#
.SYNOPSIS
    获取/释放 git 操作互斥锁。
    确保同一时间只有一个 agent 在执行 git 操作。
.PARAMETER Action
    acquire: 获取锁（一直等到上一个 lock 释放）
    release: 释放锁
.PARAMETER TaskId
    当前任务的唯一 ID（如 UUID），用于标识锁持有者。
#>
param(
    [Parameter(Mandatory)] [ValidateSet('acquire','release')] [string]$Action,
    [Parameter(Mandatory)] [string]$TaskId
)

$lockFile = Join-Path (git rev-parse --git-dir) "agent.lock"

function Acquire {
    $waited = $false
    while ($true) {
        if (Test-Path $lockFile) {
            $waited = $true
            $content = Get-Content $lockFile -Raw -ErrorAction SilentlyContinue
            if ($content -match 'ts=([\d\.]+)') {
                $lockTs = [double]::Parse($matches[1])
                $age = (Get-Date) - (Get-Date -UnixTimeSeconds $lockTs)
                if ($age.TotalMinutes -gt 5) {
                    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
                    Write-Warning "Cleaned up expired lock (age: $($age.TotalMinutes.ToString('F1'))m)"
                    continue
                }
            }
        }
        try {
            $file = [System.IO.File]::Open($lockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            try {
                $writer = [System.IO.StreamWriter]::new($file)
                $writer.WriteLine("task=$TaskId")
                $writer.WriteLine("ts=$(Get-Date -UFormat %s)")
            } finally {
                if ($writer) { $writer.Dispose() } else { $file.Dispose() }
            }
            if ($waited) {
                Write-Output "acquired after wait:$TaskId"
            } else {
                Write-Output "acquired:$TaskId"
            }
            return
        } catch {
            Start-Sleep -Milliseconds (Get-Random -Minimum 200 -Maximum 400)
        }
    }
}

function Release {
    if (Test-Path $lockFile) {
        $content = Get-Content $lockFile -Raw -ErrorAction SilentlyContinue
        if ($content -match "task=(.+)") {
            if ($matches[1] -eq $TaskId) {
                Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
                if ($?) { Write-Output "released:$TaskId" }
                else { Write-Warning "释放锁文件失败: $lockFile" }
            } else {
                Write-Warning "锁由其他任务持有 (Task $($matches[1]))，跳过释放"
            }
        } else {
            Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
            Write-Output "released (orphaned):$TaskId"
        }
    }
}

switch ($Action) {
    'acquire'  { Acquire }
    'release'  { Release }
}
