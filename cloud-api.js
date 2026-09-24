/**
 * cloud-api.js — 百合网络 云端适配器（GitHub Repo as DB）
 * 实现 window.RoseSyncAdapter 接口（pull / push / status）。
 *
 * 配置来源（优先级）：
 *   1) window.BAIHE_CLOUD 中 hardcode:true 的固化 Token（cloud-config.js，最高优先）
 *   2) localStorage 键 '百合_cloud_cfg'（设备本地保存）
 *   3) window.BAIHE_CLOUD 中未固化的 Token
 * 字段：{ token, owner, repo, branch='main', path='data' }
 *
 * 读取：anonymous raw.githubusercontent.com，无截断（不受 Gist 4MB 限制）。
 * 写入：Contents API（GET sha → PUT），需要 token。
 * 数据布局：{path}/{binKey}.json，每个文件是 JSON 数组。
 */
(function () {
  'use strict';
  var LS_KEY = '百合_cloud_cfg';

  // 仓库/分支/路径固定不变，每台设备只需填 Token
  var DEFAULTS = { owner: 'chenhaijun20260824', repo: 'baihe-data', branch: 'main', path: 'data' };
  function norm(c) {
    c = c || {};
    return {
      token: c.token,
      owner: c.owner || DEFAULTS.owner,
      repo: c.repo || DEFAULTS.repo,
      branch: c.branch || DEFAULTS.branch,
      path: (c.path || DEFAULTS.path).replace(/\/+$/, '').replace(/^\/+/, '')
    };
  }
  function loadCfg() {
    var hc = null;
    try { hc = window.BAIHE_CLOUD || null; } catch (e) {}

    // 【优先级 1】程序内固化的 Token（cloud-config.js 里 hardcode:true）
    // 目的：每台设备打开即自动连云端；并自动覆盖设备上残留的旧 Token，
    //       避免“旧 Token 盖掉新 Token”导致连接失败（这是之前失败的原因）。
    if (hc && hc.token && hc.hardcode) {
      try {
        var raw0 = localStorage.getItem(LS_KEY);
        var old0 = raw0 ? JSON.parse(raw0) : null;
        var ver = hc.version || '';
        if (!old0 || old0.token !== hc.token || old0._ver !== ver) {
          var merged = norm(hc);
          merged._ver = ver;
          localStorage.setItem(LS_KEY, JSON.stringify(merged));
          try { localStorage.removeItem('百合_connect_code'); } catch (e2) {}
        }
      } catch (e3) {}
      return norm(hc);
    }

    // 【优先级 2】设备本地已保存的配置
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) { var c = JSON.parse(raw); if (c && (c.token || c.owner)) return norm(c); }
    } catch (e) {}

    // 【优先级 3】cloud-config.js 中的配置（未固化）
    try {
      if (window.BAIHE_CLOUD) return norm(window.BAIHE_CLOUD);
    } catch (e) {}
    return norm(DEFAULTS);
  }

  var cfg = loadCfg();

  function filePath(binKey) {
    var p = cfg.path;
    return (p ? p + '/' : '') + binKey + '.json';
  }
  function rawUrl(binKey) {
    return 'https://raw.githubusercontent.com/' + cfg.owner + '/' + cfg.repo + '/' + cfg.branch + '/' + filePath(binKey);
  }
  function apiUrl(binKey) {
    return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + filePath(binKey) + '?ref=' + encodeURIComponent(cfg.branch);
  }
  function putUrl() {
    return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + filePath('%BIN%');
  }

  function pull(binKey, cb) {
    fetch(rawUrl(binKey))
      .then(function (r) {
        if (r.status === 200) return r.text();
        if (r.status === 404) return '[]'; // 桶不存在 → 空数组
        throw new Error('raw HTTP ' + r.status);
      })
      .then(function (txt) {
        try { var a = JSON.parse(txt); cb(Array.isArray(a) ? a : [], true); }
        catch (e) { cb([], true); }
      })
      .catch(function () { cb([], false); });
  }

  function getSha(binKey) {
    return fetch(apiUrl(binKey), {
      headers: { 'Authorization': 'token ' + cfg.token, 'Accept': 'application/vnd.github+json' }
    })
    .then(function (r) {
      if (r.status === 200) return r.json().then(function (j) { return j.sha; });
      if (r.status === 404) return null;
      throw new Error('sha HTTP ' + r.status);
    });
  }

  function push(binKey, data, cb) {
    if (!Array.isArray(data)) data = [];
    var jsonStr = JSON.stringify(data);
    // GitHub Contents API 要求 content 是 base64 编码。UTF-8 安全（技师姓名/地址可能含中文）。
    var bytes = new TextEncoder().encode(jsonStr);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var content = btoa(bin);
    var size = bytes.length;
    // 5MB 硬上限（raw 支持更大，但 PUT 请求体过大易失败/超时）
    if (size > 5 * 1024 * 1024) {
      console.warn('[cloud] ' + binKey + ' 超过 5MB (' + size + ' bytes)，跳过同步');
      cb(false);
      return;
    }
    if (size > 500 * 1024) console.warn('[cloud] ' + binKey + ' 较大: ' + (size / 1024).toFixed(0) + 'KB');

    function doPut(sha) {
      var body = { message: 'sync ' + binKey + ' @ ' + new Date().toISOString(), content: content, branch: cfg.branch };
      if (sha) body.sha = sha;
      fetch('https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + filePath(binKey), {
        method: 'PUT',
        headers: {
          'Authorization': 'token ' + cfg.token,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      .then(function (r) {
        if (r.ok) { console.log('[cloud] push ' + binKey + ' ✓ (' + size + ' bytes)'); cb(true); }
        else {
          r.text().then(function (txt) {
            console.warn('[cloud] push ' + binKey + ' FAIL HTTP ' + r.status + ':', txt.substring(0, 200));
          });
          cb(false);
        }
      })
      .catch(function (e) { console.warn('[cloud] push ' + binKey + ' NETWORK ERR:', e && e.message); cb(false); });
    }
    getSha(binKey)
      .then(doPut)
      .catch(function (e) { console.warn('[cloud] getSha ' + binKey + ' ERR:', e && e.message); cb(false); });
  }

  function status(cb) {
    if (!cfg) { cb(false, false, ''); return; }
    fetch('https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo, {
      headers: { 'Authorization': 'token ' + cfg.token, 'Accept': 'application/vnd.github+json' }
    })
    .then(function (r) { cb(true, r.ok, cfg.owner + '/' + cfg.repo); })
    .catch(function () { cb(true, false, cfg.owner + '/' + cfg.repo); });
  }

  // 上传一张图片到 {repo}/images/{filename}，返回 raw.githubusercontent.com 的 CDN 链接
  function uploadImage(filename, blob, cb) {
    if (!cfg || !blob) { cb(null); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = reader.result;
      var comma = dataUrl.indexOf(',');
      var b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      var imgPath = 'images/' + filename;
      fetch('https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + imgPath, {
        method: 'PUT',
        headers: {
          'Authorization': 'token ' + cfg.token,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'img ' + filename, content: b64, branch: cfg.branch })
      })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.content && j.content.path) {
          cb('https://raw.githubusercontent.com/' + cfg.owner + '/' + cfg.repo + '/' + cfg.branch + '/' + imgPath);
        } else {
          console.warn('[cloud] image upload failed:', j && j.message);
          cb(null);
        }
      })
      .catch(function () { cb(null); });
    };
    reader.readAsDataURL(blob);
  }

  if (cfg) {
    window.RoseSyncAdapter = { pull: pull, push: push, status: status, uploadImage: uploadImage };
    try { localStorage.setItem('百合_server_online', '1'); } catch (e) {}
  } else {
    window.百合_openCloudSetup = function () { location.href = 'cloud-setup.html'; };
  }

  console.log('[百合网络] cloud-api.js (GitHub Repo) loaded — ' + (cfg ? cfg.owner + '/' + cfg.repo + ' / ' + cfg.path : 'not configured → local mode'));
})();