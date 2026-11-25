/*
 * Copyright 2026 Collate
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// Serves a built openmetadata-ui dist in front of a running OpenMetadata
// server: static files from the dist, `/api` (HTTP and websocket) proxied to
// the server. The visual lane uses it to render the regular bundle its
// baselines were captured on while the shared distribution carries the coarse
// one (ADR:2026-10-23-playwright-visual-and-rdf-are-blocking-lanes-on-the-regular-bundle).
//
// Usage: node serve_playwright_ui.cjs <distDir> <port> <serverPort>

const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const [distDir, port, serverPort] = process.argv.slice(2);
if (!distDir || !port || !serverPort) {
  console.error('Usage: node serve_playwright_ui.cjs <distDir> <port> <serverPort>');
  process.exit(2);
}

const root = path.resolve(distDir);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};
// The only per-request substitutions IndexResource makes on these files.
const render = (file) =>
  fs.readFileSync(file, 'utf8').replaceAll('${basePath}', '/').replaceAll('${cspNonce}', '');
const indexHtml = render(path.join(root, 'index.html'));
const silentCallbackPath = path.join(root, 'silent-callback.html');
const silentCallback = fs.existsSync(silentCallbackPath) ? render(silentCallbackPath) : indexHtml;

const proxy = (req, res) => {
  const upstream = http.request(
    { host: '127.0.0.1', port: serverPort, path: req.url, method: req.method, headers: req.headers },
    (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    }
  );
  upstream.on('error', () => {
    res.writeHead(502);
    res.end('OpenMetadata server unavailable');
  });
  req.pipe(upstream);
};

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname.startsWith('/api/')) {
    return proxy(req, res);
  }
  const file = path.join(root, decodeURIComponent(pathname));
  const isHtml = file.endsWith('.html');
  if (file.startsWith(root + path.sep) && !isHtml && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-cache' });
  res.end(pathname === '/silent-callback' || pathname === '/silent-callback.html' ? silentCallback : indexHtml);
});

server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(Number(serverPort), '127.0.0.1', () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(req.headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\r\n') +
        '\r\n\r\n'
    );
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});
server.on('clientError', (_error, socket) => socket.destroy());
server.listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
