/**
 * local-api.js — 百合上门本地数据库适配器
 * 
 * 使用方法：
 * 1. 确保 server.js 在运行（node server.js）
 * 2. 本机浏览器直接访问 HTML 文件即可（自动连 127.0.0.1:3000）
 * 3. 局域网其他设备：先在 console 执行 百合_setServer('http://本机IP:3000')
 * 
 * 数据流：前端 <-> localStorage（永远可用）<-> 本机 server.js（多设备同步）
 */

(function () {
  // 服务器地址
  var API_BASE = (function () {
    var stored = null;
    try { stored = localStorage.getItem('百合_api_base'); } catch(e) {}
    if (stored) return stored;
    return 'http://127.0.0.1:3000';
  })();

  window.百合_setServer = function (url) {
    try { localStorage.setItem('百合_api_base', url); } catch(e) {}
    API_BASE = url;
    console.log('百合上门服务器已切换为: ' + url);
    // 重新注册 adapter
    if (window.RoseSyncAdapter) {
      window.RoseSyncAdapter = null;
    }
  };

  function api(path, method, body) {
    return new Promise(function (resolve, reject) {
      var url = API_BASE + '/' + path;
      var opts = {
        method: method || 'GET',
        headers: { 'Content-Type': 'application/json' }
      };
      if (body) opts.body = JSON.stringify(body);
      fetch(url, opts)
        .then(function (res) {
          if (!res.ok) { resolve({ ok: false, status: res.status }); return; }
          return res.json().catch(function () { resolve({ ok: true, data: null }); });
        })
        .then(function (data) { resolve({ ok: true, data: data }); })
        .catch(function (e) { reject(e); });
    });
  }

  var adapter = {
    pull: function (binKey, cb) {
      var localData = [];
      try {
        var raw = localStorage.getItem('rose_' + binKey);
        if (raw) localData = JSON.parse(raw);
      } catch(e) {}

      api(binKey, 'GET').then(function (ret) {
        if (ret.ok && ret.data && Array.isArray(ret.data)) {
          var merged = mergeLists(localData, ret.data, binKey);
          try { localStorage.setItem('rose_' + binKey, JSON.stringify(merged)); } catch(e) {}
          cb(merged, true, ret.data);
        } else {
          cb(localData, false, localData);
        }
      }).catch(function () {
        cb(localData, false, localData);
      });
    },

    push: function (binKey, data, cb) {
      try { localStorage.setItem('rose_' + binKey, JSON.stringify(data)); } catch(e) {}
      api(binKey, 'POST', data).then(function (ret) {
        cb(ret && ret.ok !== false);
      }).catch(function () {
        cb(false);
      });
    },

    status: function (cb) {
      api('', 'GET').then(function (ret) {
        cb(true, ret.ok, API_BASE);
      }).catch(function () {
        cb(false, false, API_BASE);
      });
    }
  };

  // 合并两条列表（binKey 决定墓碑集合）
  function mergeLists(localArr, cloudArr, binKey) {
    var delSet = {};
    try {
      var delRaw = localStorage.getItem('rose_deleted_' + binKey) || '[]';
      delSet = {};
      JSON.parse(delRaw).forEach(function (x) { delSet[x] = true; });
    } catch(e) {}

    var map = {};
    function ts(it) { return (it && (it.updateTime || it.registerTime || 0)); }
    function keyOf(it) { return it && (it.id || it.account || it.accountId); }

    function addItem(it) {
      if (!it || typeof it !== 'object') return;
      var k = keyOf(it);
      if (!k || delSet[k]) return;
      var old = map[k];
      if (!old || ts(it) > ts(old)) map[k] = it;
    }

    (Array.isArray(cloudArr) ? cloudArr : []).forEach(addItem);
    (Array.isArray(localArr) ? localArr : []).forEach(addItem);
    return Object.values(map);
  }

  window.RoseSyncAdapter = adapter;

  // 检测服务器状态
  setTimeout(function () {
    adapter.status(function (ok) {
      try {
        if (ok) localStorage.setItem('百合_server_online', '1');
        else localStorage.removeItem('百合_server_online');
      } catch(e) {}
    });
  }, 1500);

  console.log('[百合上门] local-api.js 已加载，服务器: ' + API_BASE);
})();
