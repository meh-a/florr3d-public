const SECRET = process.env.TURNSTILE_SECRET_KEY;
export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || '';

if (!SECRET) {
  console.warn('turnstile: TURNSTILE_SECRET_KEY not set — human check disabled (fine for dev, not for prod)');
}

export const turnstileConfigured = () => !!SECRET;

export async function verifyTurnstile(token, ip) {
  if (!SECRET) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: SECRET, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('turnstile: siteverify request failed —', err.message);
    return false;
  }
}
