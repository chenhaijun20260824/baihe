@echo off
cd /d "%~dp0"
echo 正在启动百合上门服务器...
echo 浏览器打开: http://localhost:3000
echo 按 Ctrl+C 停止
node server.js
pause
