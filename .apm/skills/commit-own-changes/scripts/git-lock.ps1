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

$gitDir = git rev-parse --git-dir 2>$null
if (-not $gitDir) {
    Write-Error "not in a git repository"
    exit 1
}
$lockDir = Join-Path $gitDir "agent.lock"
$taskFile = Join-Path $lockDir "task"
$tsFile = Join-Path $lockDir "ts"
$lockAgeLimit = 300  # seconds — steal locks with a stale timestamp
$writeGrace = 3      # seconds — allow holder to finish writing task/ts after mkdir

function Get-Timestamp {
    return [int][double]::Parse((Get-Date -UFormat %s))
}

function Read-TaskId {
    if (-not (Test-Path -LiteralPath $taskFile)) { return $null }
    try {
        $raw = (Get-Content -LiteralPath $taskFile -Raw -ErrorAction Stop)
    } catch {
        return $null
    }
    if (-not $raw) { return $null }
    $raw = $raw.Trim()
    if ($raw.StartsWith('task=') -and $raw.Length -gt 5) {
        return $raw.Substring(5)
    }
    return $null
}

function Read-LockTs {
    if (-not (Test-Path -LiteralPath $tsFile)) { return $null }
    try {
        $raw = (Get-Content -LiteralPath $tsFile -Raw -ErrorAction Stop)
    } catch {
        return $null
    }
    if (-not $raw) { return $null }
    $raw = $raw.Trim()
    if ($raw -match 'ts=(\d+)') {
        return [int]$Matches[1]
    }
    return $null
}

function Get-DirAgeSeconds {
    if (-not (Test-Path -LiteralPath $lockDir)) { return $null }
    try {
        $created = (Get-Item -LiteralPath $lockDir -ErrorAction Stop).CreationTimeUtc
    } catch {
        return $null
    }
    return [int]((Get-Date).ToUniversalTime() - $created).TotalSeconds
}

function Remove-LockDir {
    if (-not (Test-Path -LiteralPath $lockDir)) { return }
    try {
        Remove-Item -LiteralPath $lockDir -Recurse -Force -ErrorAction Stop
    } catch {
        # concurrent remover or already gone
    }
}

function Write-LockIdentity {
    $now = Get-Timestamp
    # Stop on failure so we never report "acquired" without durable identity.
    Set-Content -LiteralPath $taskFile -Value "task=$TaskId" -NoNewline -ErrorAction Stop
    Set-Content -LiteralPath $tsFile -Value "ts=$now" -NoNewline -ErrorAction Stop
    if ((Read-TaskId) -ne $TaskId) {
        throw "lost ownership after write"
    }
}

function Remove-OwnIncompleteClaim {
    # Only drop the dir if it is still ours / unowned. Never delete a foreign holder's lock.
    $owner = Read-TaskId
    if (-not $owner -or $owner -eq $TaskId) {
        Remove-LockDir
    }
}

function Try-StealStale {
    # Complete lock (has ts): steal only after lockAgeLimit.
    $lockTs = Read-LockTs
    if ($null -ne $lockTs) {
        $now = Get-Timestamp
        if (($now - $lockTs) -gt $lockAgeLimit) {
            Remove-LockDir
            return $true
        }
        return $false
    }

    # Incomplete lock (mkdir without task/ts): reclaim after writeGrace so a
    # crashed acquirer does not block forever, but never during the write window.
    $dirAge = Get-DirAgeSeconds
    if ($null -ne $dirAge -and $dirAge -ge $writeGrace) {
        Remove-LockDir
        return $true
    }
    return $false
}

switch ($Action) {
    'acquire' {
        $waited = $false

        while ($true) {
            $created = $false
            try {
                $null = New-Item -ItemType Directory -Path $lockDir -ErrorAction Stop
                $created = $true
            } catch {
                $created = $false
            }

            if ($created) {
                try {
                    Write-LockIdentity
                    if ($waited) {
                        Write-Output "acquired after wait:$TaskId"
                    } else {
                        Write-Output "acquired:$TaskId"
                    }
                    exit 0
                } catch {
                    Remove-OwnIncompleteClaim
                    Start-Sleep -Milliseconds 200
                    continue
                }
            }

            $existingTask = Read-TaskId

            if ($existingTask -and $existingTask -eq $TaskId) {
                try {
                    $now = Get-Timestamp
                    Set-Content -LiteralPath $tsFile -Value "ts=$now" -NoNewline -ErrorAction Stop
                    if ((Read-TaskId) -eq $TaskId) {
                        Write-Output "reacquired:$TaskId"
                        exit 0
                    }
                } catch {
                    # fall through
                }
            }

            if (-not $waited) {
                $lockTaskId = if ($existingTask) { $existingTask } else { 'unknown' }
                Write-Warning "waiting:$lockTaskId"
            }
            $waited = $true

            if (Try-StealStale) {
                continue
            }

            Start-Sleep -Milliseconds 350
        }
    }

    'release' {
        if (-not (Test-Path -LiteralPath $lockDir)) {
            exit 0
        }

        $lockTask = Read-TaskId

        if (-not $lockTask) {
            # Incomplete lock: only reclaim after grace so we do not yank the
            # directory out from under a concurrent acquirer mid-write.
            $dirAge = Get-DirAgeSeconds
            if ($null -ne $dirAge -and $dirAge -ge $writeGrace) {
                Remove-LockDir
                Write-Output "released (orphaned):$TaskId"
            }
            exit 0
        }

        if ($lockTask -eq $TaskId) {
            Remove-LockDir
            Write-Output "released:$TaskId"
            exit 0
        }

        Write-Warning "Lock held by another task ($lockTask), skip release"
        exit 0
    }
}
