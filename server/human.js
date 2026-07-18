import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const HUMAN_TTL_MS = 6 * 60 * 60 * 1000;
const secret = randomBytes(32).toString('hex');
const sign = (payload) => createHmac('sha256', secret).update(payload).digest('base64url');

export function makeHumanCookie(ip) {
  const payload = `${ip}.${Date.now() + HUMAN_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyHumanCookie(cookie, ip) {
  if (typeof cookie !== 'string') return false;
  const i = cookie.lastIndexOf('.');
  if (i < 0) return false;
  const payload = cookie.slice(0, i);
  const macBuf = Buffer.from(cookie.slice(i + 1));
  const expected = Buffer.from(sign(payload));
  if (macBuf.length !== expected.length || !timingSafeEqual(macBuf, expected)) return false;
  const j = payload.lastIndexOf('.');
  const tokenIp = payload.slice(0, j);
  const expiry = Number(payload.slice(j + 1));
  return tokenIp === ip && Date.now() <= expiry;
}
