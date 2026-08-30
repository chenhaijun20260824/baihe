@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri http://localhost:3000 -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop; if($r.StatusCode -eq 200){ Write-Host '[信息] 服务器已在运行，直接打开浏览器'; exit 0 } } catch { exit 1 }"
if %errorlevel%==0 (goto :open) else (goto :start)
:start
echo 正在启动百合上门服务器...
start "" http://localhost:3000
node server.js
echo 服务器已停止。
goto :end
:open
start "" http://localhost:3000
echo 服务器已在运行，已打开浏览器。
:end
pause