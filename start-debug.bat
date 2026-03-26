@echo off
cd /d "%~dp0"

echo [INFO] 正在构建...
call npm run build
if errorlevel 1 (
    echo [ERROR] 构建失败
    pause
    exit /b 1
)

echo Starting Prompt Manager...
echo.
.electron-extracted\electron.exe out/main/index.js --enable-logging
pause
