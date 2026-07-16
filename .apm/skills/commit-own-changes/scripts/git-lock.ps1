#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Acquire or release a git-based agent lock file.

.DESCRIPTION
  Prevents multiple agents from running git operations simultaneously.
  Lock is stored in .git/agent.lock/ with task and timestamp files.

.PARAMETER Action
  "acquire" or "release"

.PARAMETER TaskId
  Unique identifier for this task (e.g. "fix-login-crash")
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('acquire', 'release')]
    [string]$Action,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$TaskId
)

# Find git dir
$gitDir = git rev-parse --git-dir 2>$null
if (-not $gitDir) {
    Write-Error "not in a git repository"
    exit 1
}
$lockDir = Join-Path $gitDir "agent.lock"
$taskFile = Join-Path $lockDir "task"
$tsFile = Join-Path $lockDir "ts"

function Get-Timestamp {
    return [int][double]::Parse((Get-Date -UFormat %s))
}

function Read-Task {
    if (Test-Path $taskFile) {
        return (Get-Content $taskFile -Raw).Trim()
    }
    return $null
}

switch ($Action) {
    'acquire' {
        $waited = $false
        $lockAgeLimit = 300  # 5 minutes

        while ($true) {
            try {
                $null = New-Item -ItemType Directory -Path $lockDir -ErrorAction Stop
                break  # acquired
            } catch {
                # Check if the lock belongs to us (same TaskId) — silently reacquire
                $existingTask = Read-Task
                if ($existingTask -and $existingTask -eq "task=$TaskId") {
                    $now = Get-Timestamp
                    Set-Content -Path $tsFile -Value "ts=$now" -NoNewline
                    Write-Output "reacquired:$TaskId"
                    exit 0
                }

                # Lock held by another agent, wait and retry
                if (-not $waited) {
                    Write-Warning "waiting:$TaskId"
                }
                $waited = $true

                # Check lock age
                if (Test-Path $tsFile) {
                    $tsContent = (Get-Content $tsFile -Raw).Trim()
                    if ($tsContent -match 'ts=(\d+)') {
                        $lockTs = [int]$Matches[1]
                        $now = Get-Timestamp
                        if (($now - $lockTs) -gt $lockAgeLimit) {
                            Remove-Item -Path $lockDir -Recurse -Force -ErrorAction SilentlyContinue
                            continue  # retry immediately after cleanup
                        }
                    }
                }
                Start-Sleep -Milliseconds 350
            }
        }

        $now = Get-Timestamp
        Set-Content -Path $taskFile -Value "task=$TaskId" -NoNewline
        Set-Content -Path $tsFile -Value "ts=$now" -NoNewline

        if ($waited) {
            Write-Output "acquired after wait:$TaskId"
        } else {
            Write-Output "acquired:$TaskId"
        }
        exit 0
    }

    'release' {
        if (-not (Test-Path $lockDir)) {
            exit 0
        }

        $readTask = Read-Task
        if (-not $readTask) {
            Remove-Item -Path $lockDir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Output "released (orphaned):$TaskId"
            exit 0
        }

        # Strip "task=" prefix
        $lockTask = $readTask
        if ($lockTask.StartsWith('task=')) {
            $lockTask = $lockTask.Substring(5)
        }

        if ($lockTask -eq $TaskId) {
            Remove-Item -Path $lockDir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Output "released:$TaskId"
            exit 0
        }

        Write-Warning "Lock held by another task ($lockTask), skip release"
        exit 0
    }
}
