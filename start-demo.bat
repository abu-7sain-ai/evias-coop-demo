@echo off
rem E-VIAS demo launcher for Windows - double-click in File Explorer.
rem Messages live in scripts\launcher\*.txt (UTF-8) so this file stays plain ASCII.
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)"
if errorlevel 1 goto oldnode

if exist node_modules goto run
type "scripts\launcher\installing.txt"
call npm install --no-audit --no-fund
if errorlevel 1 goto fail

:run
node scripts\demo.mjs
if errorlevel 1 goto fail
exit /b 0

:nonode
type "scripts\launcher\no-node.txt"
goto fail
:oldnode
type "scripts\launcher\old-node.txt"
:fail
echo.
pause
exit /b 1
