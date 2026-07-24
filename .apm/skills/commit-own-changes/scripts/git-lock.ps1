#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Acquire or release a git-based agent lock file.

.DESCRIPTION
  Prevents multiple agents from running git operations simultaneously.
  Lock is a single file .git/agent.lock (same format as git-lock.sh).
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
$lockAgeLimit = 300
$writeGrace = 3

function Get-Timestamp {
    return [int][double]::Parse((Get-Date -UFormat %s))
}

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

function Read-TsFrom([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    } catch {
        return $null
    }
    if (-not $raw) { return $null }
    foreach ($line in ($raw -split "`r?`n")) {
        if ($line -match '^ts=(\d+)') {
            return [int]$Matches[1]
        }
    }
    return $null
}

function Get-PathAgeSeconds([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $item = Get-Item -LiteralPath $Path -ErrorAction Stop
        $mtime = $item.LastWriteTimeUtc
        return [int]((Get-Date).ToUniversalTime() - $mtime).TotalSeconds
    } catch {
        return $null
    }
}

function Test-StaleFile([string]$Path) {
    $lockTs = Read-TsFrom $Path
    if ($null -ne $lockTs) {
        return ((Get-Timestamp) - $lockTs) -gt $lockAgeLimit
    }
    $age = Get-PathAgeSeconds $Path
    return ($null -ne $age -and $age -ge $writeGrace)
}

function Get-UniqueSidePath([string]$Prefix) {
    return "$Prefix.$PID.$([guid]::NewGuid().ToString('N').Substring(0, 8))"
}

function Remove-StalePath {
    if (-not (Test-Path -LiteralPath $lockFile)) { return $false }

    $tmp = Get-UniqueSidePath "$lockFile.steal"
    try {
        Move-Item -LiteralPath $lockFile -Destination $tmp -ErrorAction Stop
    } catch {
        return $false
    }

    if (Test-Path -LiteralPath $tmp -PathType Container) {
        # Legacy directory lock
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
        return $true
    }

    if (Test-StaleFile $tmp) {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        return $true
    }

    if (-not (Test-Path -LiteralPath $lockFile)) {
        try {
            Move-Item -LiteralPath $tmp -Destination $lockFile -ErrorAction Stop
        } catch {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        }
    } else {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
    return $false
}

function Try-StealStale {
    if (-not (Test-Path -LiteralPath $lockFile)) { return $false }

    if (Test-Path -LiteralPath $lockFile -PathType Container) {
        $tsPath = Join-Path $lockFile 'ts'
        $legacyTs = Read-TsFrom $tsPath
        if ($null -ne $legacyTs) {
            if (((Get-Timestamp) - $legacyTs) -gt $lockAgeLimit) {
                return Remove-StalePath
            }
            return $false
        }
        $age = Get-PathAgeSeconds $lockFile
        if ($null -ne $age -and $age -ge $writeGrace) {
            return Remove-StalePath
        }
        return $false
    }

    if (Test-StaleFile $lockFile) {
        return Remove-StalePath
    }
    return $false
}

function Try-CreateLockFile {
    $content = "task=$TaskId`nts=$(Get-Timestamp)`n"
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
    $still = Read-TaskFrom $Tmp
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
            if (Test-Path -LiteralPath $lockFile -PathType Container) {
                if (-not $waited) {
                    $legacyTask = Read-TaskFrom (Join-Path $lockFile 'task')
                    $label = if ($legacyTask) { $legacyTask } else { 'legacy-dir' }
                    Write-Warning "waiting:$label"
                }
                $waited = $true
                if (Try-StealStale) { continue }
                Start-Sleep -Milliseconds 350
                continue
            }

            if (Test-Path -LiteralPath $lockFile -PathType Leaf) {
                $existingTask = Read-TaskFrom $lockFile

                if ($existingTask -and $existingTask -eq $TaskId) {
                    try {
                        $content = "task=$TaskId`nts=$(Get-Timestamp)`n"
                        [System.IO.File]::WriteAllText($lockFile, $content)
                        if ((Read-TaskFrom $lockFile) -eq $TaskId) {
                            Write-Output "reacquired:$TaskId"
                            exit 0
                        }
                    } catch {
                        # fall through
                    }
                } else {
                    if (-not $waited) {
                        $label = if ($existingTask) { $existingTask } else { 'unknown' }
                        Write-Warning "waiting:$label"
                    }
                    $waited = $true
                    if (Try-StealStale) { continue }
                    Start-Sleep -Milliseconds 350
                    continue
                }
            }

            if (Try-CreateLockFile) {
                if ((Read-TaskFrom $lockFile) -eq $TaskId) {
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

        if (Test-Path -LiteralPath $lockFile -PathType Container) {
            $legacyTask = Read-TaskFrom (Join-Path $lockFile 'task')
            if (-not $legacyTask) {
                $age = Get-PathAgeSeconds $lockFile
                if ($null -ne $age -and $age -ge $writeGrace) {
                    $tmp = Get-UniqueSidePath "$lockFile.releasing"
                    try {
                        Move-Item -LiteralPath $lockFile -Destination $tmp -ErrorAction Stop
                        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
                        Write-Output "released (orphaned):$TaskId"
                    } catch {}
                }
                exit 0
            }
            if ($legacyTask -ne $TaskId) {
                Write-Warning "Lock held by another task ($legacyTask), skip release"
                exit 0
            }
            $tmp = Get-UniqueSidePath "$lockFile.releasing"
            try {
                Move-Item -LiteralPath $lockFile -Destination $tmp -ErrorAction Stop
            } catch {
                exit 0
            }
            $still = Read-TaskFrom (Join-Path $tmp 'task')
            if ($still -eq $TaskId) {
                Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
                Write-Output "released:$TaskId"
            } elseif (-not (Test-Path -LiteralPath $lockFile)) {
                try { Move-Item -LiteralPath $tmp -Destination $lockFile -ErrorAction Stop } catch {
                    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
                }
            } else {
                Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
            }
            exit 0
        }

        $lockTask = Read-TaskFrom $lockFile

        if (-not $lockTask) {
            $age = Get-PathAgeSeconds $lockFile
            if ($null -ne $age -and $age -ge $writeGrace) {
                $tmp = Get-UniqueSidePath "$lockFile.releasing"
                try {
                    Move-Item -LiteralPath $lockFile -Destination $tmp -ErrorAction Stop
                } catch {
                    exit 0
                }
                if (-not (Read-TaskFrom $tmp)) {
                    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
                    Write-Output "released (orphaned):$TaskId"
                } elseif (-not (Test-Path -LiteralPath $lockFile)) {
                    try { Move-Item -LiteralPath $tmp -Destination $lockFile -ErrorAction Stop } catch {
                        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
                    }
                } else {
                    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
                }
            }
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

        if ((Read-TaskFrom $tmp) -eq $TaskId) {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
            Write-Output "released:$TaskId"
            exit 0
        }

        if (-not (Test-Path -LiteralPath $lockFile)) {
            try {
                Move-Item -LiteralPath $tmp -Destination $lockFile -ErrorAction Stop
            } catch {
                Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
            }
        } else {
            Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
        }
        exit 0
    }
}
