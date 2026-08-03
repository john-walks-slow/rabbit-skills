#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Acquire or release a git-based agent lock file.

.DESCRIPTION
  Prevents multiple agents from running git operations simultaneously.
  Pure mutual exclusion: the first acquirer wins, holders must release.
  Lock is a single file .git/agent.lock (same format as git-lock.sh).
  No stale-steal / timeout reclaim — a crashed holder requires manual
  removal of the lock file.
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
$lockFile = Join-Path $gitDir "agent.lock"

function Read-TaskFrom([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    } catch {
        return $null
    }
    if (-not $raw) { return $null }
    foreach ($line in ($raw -split "`r?`n")) {
        if ($line.StartsWith('task=') -and $line.Length -gt 5) {
            return $line.Substring(5).Trim()
        }
    }
    return $null
}

function Read-Owner([string]$Path) {
    $target = if (Test-Path -LiteralPath $Path -PathType Container) {
        Join-Path $Path 'task'
    } else {
        $Path
    }
    return Read-TaskFrom $target
}

function Get-UniqueSidePath([string]$Prefix) {
    return "$Prefix.$PID.$([guid]::NewGuid().ToString('N').Substring(0, 8))"
}

function Try-CreateLockFile {
    $content = "task=$TaskId`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
    try {
        $fs = [System.IO.File]::Open(
            $lockFile,
            [System.IO.FileMode]::CreateNew,
            [System.IO.FileAccess]::Write,
            [System.IO.FileShare]::None
        )
        try {
            $fs.Write($bytes, 0, $bytes.Length)
        } finally {
            $fs.Dispose()
        }
        return $true
    } catch [System.IO.IOException] {
        return $false
    } catch {
        return $false
    }
}

function Restore-OrDrop([string]$Tmp, [string]$ExpectedTask) {
    $still = Read-Owner $Tmp
    if ($still -eq $ExpectedTask) {
        Remove-Item -LiteralPath $Tmp -Recurse -Force -ErrorAction SilentlyContinue
        return $true
    }
    if (-not (Test-Path -LiteralPath $lockFile)) {
        try {
            Move-Item -LiteralPath $Tmp -Destination $lockFile -ErrorAction Stop
        } catch {
            Remove-Item -LiteralPath $Tmp -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        Remove-Item -LiteralPath $Tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
    return $false
}

switch ($Action) {
    'acquire' {
        $waited = $false

        while ($true) {
            if (Test-Path -LiteralPath $lockFile) {
                $existingTask = Read-Owner $lockFile
                if ($existingTask -eq $TaskId) {
                    Write-Output "reacquired:$TaskId"
                    exit 0
                }
                if (-not $waited) {
                    $label = if ($existingTask) { $existingTask } else { 'unknown' }
                    Write-Warning "waiting:$label"
                }
                $waited = $true
                Start-Sleep -Milliseconds 350
                continue
            }

            if (Try-CreateLockFile) {
                if ((Read-Owner $lockFile) -eq $TaskId) {
                    if ($waited) {
                        Write-Output "acquired after wait:$TaskId"
                    } else {
                        Write-Output "acquired:$TaskId"
                    }
                    exit 0
                }
                $tmp = Get-UniqueSidePath "$lockFile.abort"
                try {
                    Move-Item -LiteralPath $lockFile -Destination $tmp -ErrorAction Stop
                    [void](Restore-OrDrop $tmp $TaskId)
                } catch {
                    # ignore
                }
            }

            Start-Sleep -Milliseconds 200
        }
    }

    'release' {
        if (-not (Test-Path -LiteralPath $lockFile)) {
            exit 0
        }

        $lockTask = Read-Owner $lockFile
        if (-not $lockTask) {
            Write-Warning "Lock has no owner (crash remnant?), manual removal required"
            exit 0
        }
        if ($lockTask -ne $TaskId) {
            Write-Warning "Lock held by another task ($lockTask), skip release"
            exit 0
        }

        $tmp = Get-UniqueSidePath "$lockFile.releasing"
        try {
            Move-Item -LiteralPath $lockFile -Destination $tmp -ErrorAction Stop
        } catch {
            exit 0
        }

        if ((Read-Owner $tmp) -eq $TaskId) {
            Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
            Write-Output "released:$TaskId"
            exit 0
        }

        if (-not (Test-Path -LiteralPath $lockFile)) {
            try {
                Move-Item -LiteralPath $tmp -Destination $lockFile -ErrorAction Stop
            } catch {
                Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
            }
        } else {
            Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
        }
        exit 0
    }
}
