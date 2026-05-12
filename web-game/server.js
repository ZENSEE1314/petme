// ============================================================
// server.js — zero-dependency static file server.
// Used by Railway to serve the browser game in production.
// Run locally: `node web-game/server.js` (defaults to port 5173)
// In production Railway sets PORT.
// ============================================================

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.txt':   'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  // Strip query string + decode
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Resolve and prevent directory traversal
  const filePath = path.resolve(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Try directory index
      if (!err && stat.isDirectory()) {
        return res.writeHead(302, { Location: path.join(urlPath, '/').replace(/\\/g, '/') }).end();
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    // index.html — never cache (so updates show immediately)
    // everything else — short cache
    const cache = (urlPath === '/index.html')
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=300';

    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[smooth-giraffe] serving ${ROOT} on port ${PORT}`);
});

// Graceful shutdown for Railway redeploys
function shutdown(signal) {
  console.log(`[smooth-giraffe] ${signal} received, shutting down…`);
  server.close(() => process.exit(0));
  // hard-kill after 10s if connections linger
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
