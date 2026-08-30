/**
 * cloud-api.js — 百合上门 云端适配器（MongoDB Atlas Data API）
 * 实现 window.RoseSyncAdapter 接口（pull / push / status），与 local-api.js 完全兼容。
 *
 * 配置来源（优先级）：
 *   1) localStorage 键 '百合_cloud_cfg'         —— 通过 cloud-setup.html 运行时填写（推荐）
 *   2) window.BAIHE_CLOUD（cloud-config.js）   —— 部署前预填
 *
 * 未配置时 RoseSyncAdapter 保持 null，应用自动回退到纯本地模式（localStorage），功能不受影响。
 */
(function () {
  'use strict';
  var LS_KEY = '百合_cloud_cfg';

  function loadCfg() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) { var c = JSON.parse(raw); if (c && c.apiUrl) return c; }
    } catch (e) {}
    try { if (window.BAIHE_CLOUD && window.BAIHE_CLOUD.apiUrl) return window.BAIHE_CLOUD; } catch (e) {}
    return null;
  }

  var cfg = loadCfg();

  // 记录主键：优先 id，其次 account / accountId
  function keyOf(it) {
    if (!it || typeof it !== 'object') return null;
    return it.id || it.account || it.accountId || null;
  }

  // 调用 Atlas Data API 的单个 action
  // URL: {apiUrl}/data/v1/action/{action}  —— apiUrl 为 Atlas App Services 显示的"基础 URL"（如 https://data.mongodb-api.com/app/{AppID}/endpoint），不含 /data/v1/action/...
  // Body 包含 dataSource / database / collection 以及 action 专属参数；action 名称在 URL 路径里，不要放进 body
  function atlas(action, collection, payload) {
    return new Promise(function (resolve, reject) {
      if (!cfg) { reject(new Error('cloud not configured')); return; }
      var body = {
        dataSource: cfg.dataSource,
        database: cfg.database,
        collection: collection
      };
      for (var k in payload) { if (payload.hasOwnProperty(k)) body[k] = payload[k]; }
      var baseUrl = cfg.apiUrl.replace(/\/+$/, '');
      var url = baseUrl + '/data/v1/action/' + action;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apiKey': cfg.apiKey },
        body: JSON.stringify(body)
      })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); })
      .then(function (res) {
        if (res.status >= 200 && res.status < 300) resolve(res.json);
        else reject(new Error((res.json && (res.json.error || res.json.message)) || ('HTTP ' + res.status)));
      })
      .catch(function (e) { reject(e); });
    });
  }

  // 去掉 Atlas 自动生成的 _id，避免 ObjectId 对象污染业务数据
  function clean(doc) {
    if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
      var c = {}; for (var k in doc) { if (k !== '_id') c[k] = doc[k]; }
      return c;
    }
    return doc;
  }

  function pull(binKey, cb) {
    atlas('find', binKey, { filter: {}, sort: { updateTime: -1 } })
      .then(function (res) {
        var docs = (res && res.documents) || [];
        var arr = docs.map(clean).filter(Boolean);
        cb(arr, true);
      })
      .catch(function () { cb([], false); });
  }

  function push(binKey, data, cb) {
    if (!cfg) { cb(false); return; }
    if (!Array.isArray(data)) data = [];

    // 1) 墓碑：本地已删除、且不在当前列表中的记录 → 云端也要删
    var tomb = [];
    try { tomb = JSON.parse(localStorage.getItem('rose_deleted_' + binKey) || '[]'); } catch (e) {}
    var liveKeys = {};
    data.forEach(function (it) { var k = keyOf(it); if (k) liveKeys[k] = true; });
    var delIds = tomb.filter(function (id) { return id && !liveKeys[id]; });

    var ops = [];
    // 2) 每个存活记录 upsert（按主键定位，没有就插入）
    data.forEach(function (it) {
      var k = keyOf(it);
      if (!k) return;
      var filter;
      if (it.id) filter = { id: it.id };
      else if (it.account) filter = { account: it.account };
      else filter = { accountId: it.accountId };
      var doc = clean(it);
      doc.id = doc.id || k; // 确保云端文档也带字符串主键，便于后续定位
      ops.push(atlas('updateOne', binKey, { filter: filter, update: { $set: doc }, upsert: true }));
    });
    // 3) 删除墓碑
    delIds.forEach(function (id) {
      ops.push(atlas('deleteOne', binKey, { filter: { id: id } }));
    });

    if (ops.length === 0) { cb(true); return; }
    Promise.all(ops.map(function (p) {
      return p.then(function () { return true; }).catch(function () { return false; });
    })).then(function (results) {
      var ok = results.indexOf(false) === -1;
      cb(ok);
    });
  }

  function status(cb) {
    if (!cfg) { cb(false, false, ''); return; }
    atlas('find', 'notices', { filter: {}, limit: 1 })
      .then(function () { cb(true, true, cfg.apiUrl); })
      .catch(function () { cb(true, false, cfg.apiUrl); });
  }

  if (cfg) {
    window.RoseSyncAdapter = { pull: pull, push: push, status: status };
    try { localStorage.setItem('百合_server_online', '1'); } catch (e) {}
  } else {
    window.百合_openCloudSetup = function () { location.href = 'cloud-setup.html'; };
  }

  console.log('[百合上门] cloud-api.js 已加载，' + (cfg ? '已连接云端(MongoDB Atlas)' : '未配置云端 → 纯本地模式'));
})();
