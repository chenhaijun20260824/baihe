/**
 * cloud-config.js — 云端配置（部署前可预填；也可在 cloud-setup.html 中填写并存入 localStorage）
 * 留空则应用启动时引导用户到 cloud-setup.html 填写（不会报错，自动回退本地模式）。
 *
 * 四个值都来自 MongoDB Atlas Data API：
 *   apiUrl      : Data API endpoint，形如 https://data.mongodb-api.com/app/<APP_ID>/endpoint
 *   apiKey      : Data API Key（Atlas → App Services → Data API → API Keys 创建）
 *   dataSource  : 集群名，默认 Cluster0
 *   database    : 数据库名，例如 baihe
 */
window.BAIHE_CLOUD = {
  apiUrl: '',
  apiKey: '',
  dataSource: 'Cluster0',
  database: 'baihe'
};
