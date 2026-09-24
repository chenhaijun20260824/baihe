/**
 * cloud-config.js — 云端配置（仓库 / 分支 / 路径固定不变）
 *
 * 云端数据仓库：https://github.com/chenhaijun20260824/baihe-data  （数据在 data/ 目录）
 *
 * 【读取】匿名 raw 读取：任何设备打开网页即可查看云端数据，完全无需设置。
 * 【写入】注册 / 审核等写操作需要 Token。Token 保存在浏览器 localStorage
 *        （键名 '百合_cloud_cfg'），不写进本文件。
 *
 * 每台设备一次性连接（任选其一）：
 *   A) 打开「一键连接链接」：cloud-setup.html#token=<你的Token>&auto=1
 *      打开即自动保存并启用；Token 只留在本设备浏览器，不进仓库。
 *   B) 首页右上角「☁️ 云端」按钮 → 粘贴 Token → 连接。
 *   C) 打开 cloud-setup.html 手动填写并保存。
 *
 * hardcode / version（可选）：
 *   若确实想把 Token 固化进程序：把 token 填上、hardcode 设为 true、递增 version。
 *   cloud-api.js 会让固化 Token 优先，并自动覆盖设备上残留的旧 Token。
 *   ⚠️ 实测提醒：GitHub 的 Secret 扫描会拦截公开仓库中的真实 Token
 *      （报 409 Secret detected in content），所以本文件当前 token 留空。
 */
window.BAIHE_CLOUD = {
  owner: 'chenhaijun20260824',
  repo: 'baihe-data',
  branch: 'main',
  path: 'data',
  token: '',         // 留空：Token 由每台设备保存在 localStorage
  hardcode: false,   // true = 上面的 token 优先于设备本地 Token
  version: '20260924a'
};
