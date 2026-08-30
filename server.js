/**
 * 百合上门 - 本地数据库服务器 + 静态文件托管
 * 
 * 启动方式：node server.js
 * 然后浏览器打开：http://localhost:3000
 * 
 * 数据存在本地 data/ 目录下的 JSON 文件，多设备可通过局域网 IP 访问同一数据库：
 *   http://<本机局域网IP>:3000
 * 
 * 局域网其他设备使用前，在其浏览器控制台执行一次：
 *   百合_setServer('http://<本机IP>:3000')
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = __dirname;

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// 四个数据桶
const BINS = ['accounts', 'technicians', 'notices', 'audit_log'];
const binFiles = {};
BINS.forEach(b => { binFiles[b] = path.join(DATA_DIR, b + '.json'); });
BINS.forEach(b => {
  if (!fs.existsSync(binFiles[b])) fs.writeFileSync(binFiles[b], JSON.stringify([]), 'utf8');
});

// 读/写数据文件
function readBin(bin) {
  try { return JSON.parse(fs.readFileSync(binFiles[bin] || '', 'utf8') || '[]'); }
  catch (e) { return []; }
}
function writeBin(bin, data) {
  fs.writeFileSync(binFiles[bin], JSON.stringify(data, null, 2), 'utf8');
}
function readTomb(bin) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'rose_deleted_' + bin + '.json'), 'utf8') || '[]'); }
  catch (e) { return []; }
}
function writeTomb(bin, set) {
  fs.writeFileSync(path.join(DATA_DIR, 'rose_deleted_' + bin + '.json'), JSON.stringify([...set]), 'utf8');
}

const ts = () => Date.now();

// CORS 头（允许浏览器从任意源访问）
function setHeaders(res, contentType) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (contentType) res.setHeader('Content-Type', contentType);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve(null);
      try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// 静态文件 MIME
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

async function handle(req, res) {
  const parsed = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  // 根路径信息
  if (pathname === '' || pathname === '/') {
    setHeaders(res, 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ name: '百合上门', version: '1.0', bins: BINS, note: '打开 http://localhost:' + PORT + '/ 使用' }));
    return;
  }

  const parts = pathname.slice(1).split('/');
  const first = parts[0];

  // API 路由：/accounts /technicians /notices /audit_log
  if (BINS.includes(first)) {
    setHeaders(res, 'application/json');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    try {
      // 批量读所有桶
      if (first && parts[1] === 'all') {
        const result = {};
        BINS.forEach(b => result[b] = readBin(b));
        res.writeHead(200); res.end(JSON.stringify(result)); return;
      }
      if (req.method === 'GET') {
        const id = parts[1];
        const data = readBin(first);
        if (id) {
          const item = data.find(x => x.id === id || x.accountId === id);
          res.writeHead(200); res.end(JSON.stringify(item || null)); return;
        }
        res.writeHead(200); res.end(JSON.stringify(data)); return;
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        let data = readBin(first);
        if (Array.isArray(body)) {
          const delSet = new Set(readTomb(first));
          const map = {};
          data.forEach(item => { const k = item.id || item.account || item.accountId; if (k && !delSet.has(k)) map[k] = item; });
          body.forEach(item => {
            if (!item || typeof item !== 'object') return;
            const k = item.id || item.account || item.accountId;
            if (!k) return;
            if (item.__deleted) { delSet.add(k); delete map[k]; return; }
            delSet.delete(k);
            const old = map[k];
            if (!old || (item.updateTime || item.registerTime || 0) >= (old.updateTime || old.registerTime || 0)) map[k] = item;
          });
          data = Object.values(map);
          writeBin(first, data);
          writeTomb(first, delSet);
        } else if (body && typeof body === 'object') {
          if (!body.id) body.id = ts().toString(36) + Math.random().toString(36).slice(2);
          const idx = data.findIndex(x => (x.id && x.id === body.id) || (x.account && x.account === body.account));
          if (idx >= 0) data[idx] = { ...data[idx], ...body, updateTime: ts() };
          else { body.registerTime = body.registerTime || ts(); data.push(body); }
          writeBin(first, data);
        }
        res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
      }
      if (req.method === 'PUT' && parts[1]) {
        const body = await parseBody(req);
        let data = readBin(first);
        const idx = data.findIndex(x => x.id === parts[1] || x.accountId === parts[1]);
        if (idx >= 0) data[idx] = { ...data[idx], ...body, updateTime: ts() };
        else data.push({ ...body, id: parts[1], updateTime: ts() });
        writeBin(first, data);
        res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
      }
      if (req.method === 'DELETE' && parts[1]) {
        let data = readBin(first);
        data = data.filter(x => x.id !== parts[1] && x.accountId !== parts[1]);
        writeBin(first, data);
        const delSet = new Set(readTomb(first)); delSet.add(parts[1]); writeTomb(first, delSet);
        res.writeHead(200); res.end(JSON.stringify({ success: true })); return;
      }
      res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); return;
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message })); return;
    }
  }

  // 静态文件托管
  if (req.method === 'GET' || req.method === 'HEAD') {
    // 阻止目录穿越
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(PUBLIC_DIR, safePath);
    if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        // 尝试 .html 后缀
        if (!path.extname(filePath)) {
          filePath = filePath + '.html';
          fs.stat(filePath, (e2, s2) => {
            if (e2 || !s2.isFile()) { res.writeHead(404); res.end('Not Found'); return; }
            serveFile(filePath, res);
          });
          return;
        }
        res.writeHead(404); res.end('Not Found'); return;
      }
      serveFile(filePath, res);
    });
    return;
  }

  res.writeHead(404); res.end('Not Found');
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  setHeaders(res, MIME[ext] || 'application/octet-stream');
  res.writeHead(200);
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => { setHeaders(res, 'application/json'); res.writeHead(500); res.end(JSON.stringify({ error: e.message })); });
});

const LOG_FILE = path.join(DATA_DIR, 'server.log');
function logMsg(m) {
  var line = '[' + new Date().toISOString() + '] ' + m;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n', 'utf8'); } catch (e) {}
}
server.on('error', function (e) {
  if (e && e.code === 'EADDRINUSE') {
    logMsg('端口 ' + PORT + ' 已被占用（服务可能已在运行），本实例自动退出');
    process.exit(0);
  } else {
    logMsg('服务器启动失败: ' + (e && e.message));
    process.exit(1);
  }
});
server.listen(PORT, () => {
  logMsg('========================================');
  logMsg('  百合上门服务器 已启动');
  logMsg('  本机访问: http://localhost:' + PORT);
  logMsg('  局域网:   http://<本机IP>:' + PORT);
  logMsg('  数据目录: ' + DATA_DIR);
  logMsg('  按 Ctrl+C 停止（或关闭窗口）');
  logMsg('========================================');
});
