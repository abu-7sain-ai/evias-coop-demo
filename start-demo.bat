@echo off
rem E-VIAS demo launcher for Windows - double-click in File Explorer.
rem Console messages are English only: the Windows console cannot be relied on to show Arabic.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)"
if errorlevel 1 goto oldnode

if exist node_modules goto run
echo Installing packages (first run, needs internet once)...
call npm install --no-audit --no-fund
if errorlevel 1 goto fail

:run
set EVIAS_CONSOLE_LANG=en
node scripts\demo.mjs
if errorlevel 1 goto fail
exit /b 0

:nonode
echo Node.js is not installed on this computer.
echo Download the LTS version (22 or newer) from https://nodejs.org, then run this file again.
goto fail
:oldnode
echo The Node.js version on this computer is too old.
echo Install version 22 or newer from https://nodejs.org, then run this file again.
:fail
echo.
pause
exit /b 1
