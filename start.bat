@echo off
chcp 65001 >nul
title PenMods Installer - 本地开发服务器

echo ====================================
echo   PenMods Installer 启动脚本
echo ====================================
echo.

cd /d "%~dp0"

echo [1/2] 检查依赖...
if not exist "node_modules" (
    echo     首次运行，安装依赖中...
    call npm install
)

echo [2/2] 启动开发服务器...
echo.
echo     浏览器打开: http://localhost:5173
echo     按 Ctrl+C 停止服务器
echo.
npm run dev

pause
