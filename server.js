/**
 * 地理课件本地数据服务器
 * 提供静态文件服务 + JSON 数据读写 API
 * 用法: node server.js
 * 访问: http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJSON(res, status, obj) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
}

function serveStatic(req, res) {
    let pathname = req.url === '/' ? 'index.html' : req.url;
    // 去掉 query string
    pathname = pathname.split('?')[0];
    const filePath = path.join(ROOT, decodeURIComponent(pathname));

    // 安全检查：确保文件在 ROOT 目录下
    const relative = path.relative(ROOT, filePath);
    if (relative.startsWith('..') || relative.startsWith('\\..')) {
        sendJSON(res, 403, { error: 'Forbidden' });
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                sendJSON(res, 404, { error: 'Not found' });
            } else {
                sendJSON(res, 500, { error: err.message });
            }
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
        });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    setCORS(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API: Save JSON data
    if (req.url === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { filename, data } = JSON.parse(body);
                if (!filename || typeof filename !== 'string' || !Array.isArray(data)) {
                    sendJSON(res, 400, { error: 'Invalid request: filename and data array required' });
                    return;
                }
                // 安全检查：只允许 .json 文件，且必须在 data/ 目录下
                if (!filename.endsWith('.json')) {
                    sendJSON(res, 400, { error: 'Only .json files are allowed' });
                    return;
                }
                const dataDir = path.join(ROOT, 'data');
                const filePath = path.join(dataDir, filename);
                const relative = path.relative(dataDir, filePath);
                if (relative.startsWith('..') || relative.startsWith('\\..') || path.isAbsolute(relative)) {
                    sendJSON(res, 403, { error: 'Forbidden path' });
                    return;
                }
                fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
                    if (err) {
                        sendJSON(res, 500, { error: err.message });
                        return;
                    }
                    sendJSON(res, 200, { success: true });
                });
            } catch (e) {
                sendJSON(res, 400, { error: 'Invalid JSON: ' + e.message });
            }
        });
        return;
    }

    // Static files
    serveStatic(req, res);
});

server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`  地理课件本地服务器已启动`);
    console.log(`  访问地址: http://localhost:${PORT}`);
    console.log(`  数据目录: ${path.join(ROOT, 'data')}`);
    console.log(`  按 Ctrl+C 停止服务`);
    console.log(`==================================================`);
});
