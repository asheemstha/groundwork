@echo off
rem Double-click to start Groundwork on Windows. Keep this window open while you use it.
cd /d "%~dp0"
where node >nul 2>nul || (echo Groundwork needs Node.js: https://nodejs.org & pause & exit /b 1)
if exist .git (echo Checking for updates... & git pull --ff-only)
call npm install --no-audit --no-fund
start "" http://localhost:4477
set GW_LAUNCHER=1
:run
node server.js
if %errorlevel%==75 (
  echo Updating Groundwork...
  if exist .git git pull --ff-only
  call npm install --no-audit --no-fund
  set GW_RESTARTED=1
  goto run
)
