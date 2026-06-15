@echo off
cd /d "%~dp0"

echo [INFO] Building...
call pnpm build
if errorlevel 1 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

echo Starting Prompt Manager...
echo.
call npx electron out/main/index.js --enable-logging
pause
