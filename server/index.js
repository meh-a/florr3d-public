import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachGameServer } from './ws.js';
import { handleAuth, parseCookies, sessionFromCookie } from './auth.js';
import { mapPayload } from './map.js';
import { mintJoinToken } from './jointoken.js';
import { verifyTurnstile, turnstileConfigured, TURNSTILE_SITE_KEY } from './turnstile.js';
import { makeHumanCookie, verifyHumanCookie, HUMAN_TTL_MS } from './human.js';
import { clientIp } from './utils.js';

process.on('uncaughtException', (err) => console.error('uncaught exception —', err));
process.on('unhandledRejection', (err) => console.error('unhandled rejection —', err));

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg',
};

const port = Number(process.env.PORT) || 8081;
const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (err) {
    console.error('request handler error —', err.message);
    if (!res.headersSent) { res.writeHead(400); res.end(); }
  }
});

async function handleRequest(req, res) {
  if (await handleAuth(req, res)) return;
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/map.json') {
    if (!mapPayload) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' });
    res.end(JSON.stringify(mapPayload));
    return;
  }
  if (pathname === '/turnstile-sitekey') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ siteKey: TURNSTILE_SITE_KEY }));
    return;
  }
  if (pathname === '/join-token') {
    const ip = clientIp(req);
    const loggedIn = sessionFromCookie(req.headers.cookie) != null;
    if (!loggedIn && turnstileConfigured() && !verifyHumanCookie(parseCookies(req.headers.cookie).human, ip)) {
      const url = new URL(req.url, 'http://localhost');
      const ok = await verifyTurnstile(url.searchParams.get('turnstile'), ip);
      if (!ok) { res.writeHead(403, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'human-check-required' })); return; }
      res.setHeader('Set-Cookie',
        `human=${makeHumanCookie(ip)}; Path=/; Max-Age=${HUMAN_TTL_MS / 1000}; HttpOnly; Secure; SameSite=Lax`);
    }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ token: mintJoinToken(ip) }));
    return;
  }
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const file = join(DIST, rel === '/' || rel === '\\' ? 'index.html' : rel);
  const cache = rel.startsWith('/assets/') || rel.startsWith('\\assets\\')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': cache,
    });
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(DIST, 'index.html'));
      res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(503, { 'content-type': 'text/plain' });
      res.end('client not built — run `npm run build` first\n');
    }
  }
}

attachGameServer(server);
server.listen(port, () => {
  console.log(`florr3d listening on http://localhost:${port} (game endpoint /ws)`);
});
