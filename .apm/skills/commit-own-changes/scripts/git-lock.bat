@echo off
setlocal enabledelayedexpansion

if "%~1"=="" goto :usage
if "%~2"=="" goto :usage

set "Action=%~1"
set "TaskId=%~2"
set "LOCK_AGE_LIMIT=300"
set "WRITE_GRACE=3"

for /f "usebackq delims=" %%i in (`git rev-parse --git-dir 2^>nul`) do set "gitDir=%%i"
if not defined gitDir (
    1>&2 echo Error: not in a git repository
    exit /b 1
)

set "lockDir=%gitDir%\agent.lock"

if /i "%Action%"=="acquire" goto :acquire
if /i "%Action%"=="release" goto :release

:usage
1>&2 echo Usage: %~nx0 acquire TaskId
1>&2 echo        %~nx0 release TaskId
exit /b 1

:getTs
set "vbs=%TEMP%\gts-%RANDOM%.vbs"
>%vbs% echo WScript.Echo DateDiff("s", "01/01/1970", Now())
for /f %%i in ('cscript //nologo %vbs% 2^>nul') do set "ts=%%i"
if exist %vbs% del %vbs% 2>nul
if not defined ts set "ts=0"
goto :eof

:readTask
set "readVal="
if exist "%lockDir%\task" (
    for /f "usebackq delims=" %%x in ("%lockDir%\task") do set "readVal=%%x"
)
goto :eof

:readTs
set "readVal="
if exist "%lockDir%\ts" (
    for /f "usebackq delims=" %%x in ("%lockDir%\ts") do set "readVal=%%x"
)
goto :eof

:dirAge
set "dirAgeSec="
for /f %%i in ('powershell -NoProfile -Command "if (Test-Path -LiteralPath '%lockDir%') { [int]((Get-Date).ToUniversalTime() - (Get-Item -LiteralPath '%lockDir%').CreationTimeUtc).TotalSeconds }" 2^>nul') do set "dirAgeSec=%%i"
goto :eof

:writeIdentity
call :getTs
>%lockDir%\task echo task=%TaskId%
if errorlevel 1 exit /b 1
>%lockDir%\ts echo ts=%ts%
if errorlevel 1 exit /b 1
call :readTask
set "owner=!readVal!"
if "!owner:~0,5!"=="task=" set "owner=!owner:~5!"
if not "!owner!"=="%TaskId%" exit /b 1
exit /b 0

:acquire
set "waited=0"

:acquireLoop
md "%lockDir%" 2>nul
if not errorlevel 1 (
    call :writeIdentity
    if errorlevel 1 (
        rmdir /s /q "%lockDir%" 2>nul
        >nul ping 127.0.0.1 -n 1 -w 200
        goto :acquireLoop
    )
    if "%waited%"=="1" (
        echo acquired after wait:%TaskId%
    ) else (
        echo acquired:%TaskId%
    )
    exit /b 0
)

call :readTask
set "lockTask=!readVal!"
if defined lockTask if "!lockTask:~0,5!"=="task=" set "lockTask=!lockTask:~5!"

if defined lockTask if "!lockTask!"=="%TaskId%" (
    call :getTs
    >%lockDir%\ts echo ts=%ts%
    call :readTask
    set "owner=!readVal!"
    if "!owner:~0,5!"=="task=" set "owner=!owner:~5!"
    if "!owner!"=="%TaskId%" (
        echo reacquired:%TaskId%
        exit /b 0
    )
)

if "%waited%"=="0" (
    if "!lockTask!"=="" (
        1>&2 echo waiting:unknown
    ) else (
        1>&2 echo waiting:!lockTask!
    )
)
set "waited=1"

call :readTs
if defined readVal (
    set "lockTs=!readVal!"
    if "!lockTs:~0,3!"=="ts=" set "lockTs=!lockTs:~3!"
    call :getTs
    set /a "age=ts-!lockTs!"
    if !age! gtr %LOCK_AGE_LIMIT% (
        rmdir /s /q "%lockDir%" 2>nul
        goto :acquireLoop
    )
) else (
    rem Incomplete lock: reclaim after write grace
    call :dirAge
    if defined dirAgeSec if !dirAgeSec! geq %WRITE_GRACE% (
        rmdir /s /q "%lockDir%" 2>nul
        goto :acquireLoop
    )
)

>nul ping 127.0.0.1 -n 1 -w 350
goto :acquireLoop

:release
if not exist "%lockDir%" exit /b 0

call :readTask
if not defined readVal (
    call :dirAge
    if defined dirAgeSec if !dirAgeSec! geq %WRITE_GRACE% (
        rmdir /s /q "%lockDir%" 2>nul
        echo released (orphaned):%TaskId%
    )
    exit /b 0
)

set "lockTask=!readVal!"
if "!lockTask:~0,5!"=="task=" set "lockTask=!lockTask:~5!"
if "!lockTask!"=="%TaskId%" (
    rmdir /s /q "%lockDir%" 2>nul
    echo released:%TaskId%
    exit /b 0
)

1>&2 echo Warning: Lock held by another task (!lockTask!), skip release
exit /b 0
