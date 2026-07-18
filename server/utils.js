let nextUid = 1;
export function uid() { return nextUid++; }

export function damp(k, dt) { return 1 - Math.exp(-k * dt); }

export const clientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0].trim()
  || req.socket.remoteAddress;
