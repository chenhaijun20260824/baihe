@echo off
chcp 65001 >nul
set "DIR=%~dp0"
powershell -NoProfile -Command "$WshShell=New-Object -ComObject WScript.Shell; $lnkPath=[System.IO.Path]::Combine($env:APPDATA,'Microsoft\Windows\Start Menu\Programs\Startup\百合上门服务器.lnk'); $lnk=$WshShell.CreateShortcut($lnkPath); $lnk.TargetPath='%DIR%launch.vbs'; $lnk.WorkingDirectory='%DIR%'; $lnk.Description='百合上门本地数据库服务器'; $lnk.WindowStyle=7; $lnk.Save(); Write-Host ('[完成] 已设置开机自启：'+$lnkPath)"
echo 设置完成！下次登录 Windows 会自动启动服务器。
pause