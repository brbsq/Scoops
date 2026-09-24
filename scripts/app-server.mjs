import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { attachPvp } from './pvp-server.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8' };

export function createAppServer({ root, production = false, port = 5173 }) {
  root = path.resolve(root);
  const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/api/network') {
      const urls = Object.values(networkInterfaces()).flat().filter(n => n.family === 'IPv4' && !n.internal).map(n => `http://${n.address}:${server.address()?.port || port}/#pvp`);
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ urls })); return;
    }
    const isPublicAsset = pathname.startsWith('/assets/') || pathname.startsWith('/fonts/');
    const relative = pathname === '/' ? 'index.html' : isPublicAsset && !production ? `public${pathname}` : pathname.slice(1);
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || (!isPublicAsset && !pathname.startsWith('/src/') && pathname !== '/' && pathname !== '/index.html')) {
      response.writeHead(404).end('Not found'); return;
    }
    const info = await stat(file);
    if (!info.isFile()) { response.writeHead(404).end('Not found'); return; }
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
    headers['Content-Length'] = end - start + 1;
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD') response.end();
    else createReadStream(file, { start, end }).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
});
  const pvp = attachPvp(server);
  return { server, pvp };
}
