let siteKeyPromise = null;
function getSiteKey() {
  siteKeyPromise ??= fetch('/turnstile-sitekey')
    .then((r) => (r.ok ? r.json() : { siteKey: '' }))
    .then((d) => d.siteKey)
    .catch(() => '');
  return siteKeyPromise;
}

function waitForScript(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (window.turnstile) return resolve();
      if (Date.now() > deadline) return reject(new Error('turnstile script did not load'));
      setTimeout(check, 100);
    };
    check();
  });
}

let widgetId = null;
let readyPromise = null;
const pending = [];

function ensureWidget() {
  readyPromise ??= (async () => {
    const siteKey = await getSiteKey();
    if (!siteKey) return;
    await waitForScript();
    widgetId = window.turnstile.render('#turnstile-container', {
      sitekey: siteKey,
      appearance: 'interaction-only',
      execution: 'execute',
      callback: (token) => pending.shift()?.(token),
      'error-callback': () => pending.shift()?.(null),
    });
  })().catch((err) => { console.warn('turnstile:', err.message); });
  return readyPromise;
}

export async function getTurnstileToken() {
  await ensureWidget();
  if (widgetId === null) return '';

  const container = document.getElementById('turnstile-container');
  container.classList.add('active');
  try {
    return await Promise.race([
      new Promise((resolve) => {
        pending.push((token) => resolve(token || ''));
        window.turnstile.execute(widgetId);
      }),
      new Promise((resolve) => setTimeout(() => resolve(''), 15000)),
    ]);
  } finally {
    container.classList.remove('active');
    window.turnstile.reset(widgetId);
  }
}
