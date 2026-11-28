import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaultReport = join(root, '..', 'Star Wars CCG Premiere - Drucktexte lokal', 'premiere-drucktexte-lokal.json');
const contentTypes = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  css: 'text/css; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml',
};

export function startLocalV2Server({port = 8000, reportPath = defaultReport, siteRoot = root} = {}) {
  const server = createServer(async (request, response) => {
    const listenPort = server.address().port;
    if (!['127.0.0.1:' + listenPort, 'localhost:' + listenPort].includes(request.headers.host)) {
      response.writeHead(403).end();
      return;
    }
    if (request.method !== 'GET') {
      response.writeHead(405, {Allow: 'GET'}).end();
      return;
    }
    const route = request.url.split('?')[0];
    const privateReport = siteRoot === root && route === '/local-print-texts.json';
    if (privateReport && reportPath === null) {
      response.writeHead(404).end();
      return;
    }
    if (privateReport && request.headers['sec-fetch-site'] &&
        request.headers['sec-fetch-site'] !== 'same-origin') {
      response.writeHead(403).end();
      return;
    }
    const asset = route === '/' ? '/index.html' : route === '/anleitungen/' ? '/anleitungen/index.html' : route;
    if (!privateReport && !/^\/(?:v[23]\.html|index\.html|editionen\.html|release\.json|anleitungen\/(?:index|schnellstart|spielzug|kampf|a-new-hope|hoth|dagobah|cloud-city|jabbas-palace)\.html|assets\/(?:site|collectors|edition-banners|playfield-views|starter-covers|home-covers|version-picker)(?:\.[a-f0-9]{12})?\.(?:css|js)|assets\/favicon(?:\.[a-f0-9]{12})?\.svg|assets\/faction-card-backs(?:\.[a-f0-9]{12})?\.svg|assets\/edition-banners\/[a-z0-9-]+(?:\.[a-f0-9]{12})?\.svg|(?:v3\/)?engine\/[\w-]+(?:\.[a-f0-9]{12})?\.js|(?:v3\/)?data\/[\w-]+(?:\.[a-f0-9]{12})?\.json|v3\/assets\/playfield-views(?:\.[a-f0-9]{12})?\.js|data\/SWCCGPC-LICENSE\.txt)$/.test(asset)||asset==='/v3/v2-baseline.json') {
      response.writeHead(404).end();
      return;
    }
    const file = privateReport ? reportPath : join(siteRoot, asset.slice(1));
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': contentTypes[asset.split('.').at(-1)],
        'Cache-Control': 'no-store',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Content-Type-Options': 'nosniff',
      }).end(body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
    }
  });
  return server.listen(port, '127.0.0.1');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const server = startLocalV2Server({reportPath: process.argv[2] ? resolve(process.argv[2]) : defaultReport});
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
      ? 'Port 8000 ist belegt. Beende den laufenden lokalen Server und starte V2 erneut.'
      : error.message);
    process.exitCode = 1;
  });
  server.on('listening', () => {
    console.log('V2 läuft unter http://127.0.0.1:8000/v2.html. Beenden mit Strg+C.');
  });
}
