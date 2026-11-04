import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import endpoint from '../api/convert.js';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const base = 'http://' + host + ':' + port;
const assets = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
};
createServer(async (req, res) => {
  try {
    if (req.headers.host !== host + ':' + port) return res.writeHead(403).end();
    const url = new URL(base + req.url);
    if (url.pathname === '/api/convert') {
      const response = await endpoint.fetch(new Request(url, {
        method: req.method, headers: req.headers,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Readable.toWeb(req), duplex: 'half' }),
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
    } else if (Object.hasOwn(assets, url.pathname)) {
      const [file, contentType] = assets[url.pathname];
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' })
        .end(await readFile(new URL('../public/' + file, import.meta.url)));
    } else res.writeHead(404).end();
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(port, host, () => console.log('allToan: ' + base));
