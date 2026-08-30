# 百合上门 - 本地数据库版

## 运行方式

1. 双击 `start.bat`（或命令行 `node server.js`）
2. 浏览器打开 http://localhost:3000
3. 按 `打开网页.bat` 可直接打开首页

## 数据存放

所有数据存在 `data/` 目录下的 JSON 文件：
- accounts.json 账号
- technicians.json 技师资料
- notices.json 公告
- audit_log.json 审核日志

## 多设备共享

同一台电脑上所有浏览器标签共享同一份数据（服务器在 3000 端口）。

其他设备（手机/另一台电脑）想看同一份数据：
1. 本机运行 server.js
2. 查本机局域网 IP（如 192.168.1.100）
3. 在其他设备浏览器打开 http://192.168.1.100:3000
4. 若自动连不上，在该设备浏览器控制台执行：
   百合_setServer('http://192.168.1.100:3000')

## 部署到新仓库（用户验证后）

验证无误后，把整个 `百合上门` 文件夹上传到新 GitHub 仓库，开启 Pages 即可。
注意：server.js 需在能运行 Node.js 的环境启动（如本机、或支持 Node 的托管）。
纯静态托管（如 GitHub Pages）只能跑前端，后端 server.js 需另行部署 Node 服务。


## 一键启动 / 开机自启（新增）

- **启动服务.bat**：一键启动服务器并自动打开浏览器（若已在运行则直接开浏览器）
- **设置开机自启.bat**：在「启动」文件夹创建快捷方式，下次登录 Windows 自动后台启动服务器
- **取消开机自启**：手动删除 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\百合上门服务器.lnk`
- **停止服务**：关闭启动服务.bat 窗口，或在任务管理器结束 node.exe
- 服务器日志写在 `data/server.log`，便于排查
- 端口被占用时（如开机自启已在跑）手动启动会自动退出，不会冲突

## 文件说明

- index.html 首页（技师展示 + 搜索）
- register.html 登录页
- register_v2.html 注册页（技师填资料）
- profile.html 我的资料/修改
- admin.html 管理员后台（审核技师）
- technician-detail.html 技师详情
- server.js 本地数据库服务器（Node.js）
- local-api.js 前端适配器（连接本机服务器）
