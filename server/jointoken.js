import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TTL_MS = 45_000;
const secret = randomBytes(32).toString('hex');
const sign = (payload) => createHmac('sha256', secret).update(payload).digest('base64url');

const used = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of used) if (now > exp) used.delete(t);
}, 60_000).unref();

export function mintJoinToken(ip) {
  const payload = `${ip}.${Date.now() + TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyJoinToken(token, ip) {
  if (typeof token !== 'string' || used.has(token)) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const macBuf = Buffer.from(token.slice(i + 1));
  const expected = Buffer.from(sign(payload));
  if (macBuf.length !== expected.length || !timingSafeEqual(macBuf, expected)) return false;
  const j = payload.lastIndexOf('.');
  const tokenIp = payload.slice(0, j);
  const expiry = Number(payload.slice(j + 1));
  if (tokenIp !== ip || Date.now() > expiry) return false;
  used.set(token, expiry);
  return true;
}
