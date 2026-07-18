import { chromium } from 'playwright';

const out = process.argv[2] || '/tmp/shot.png';
const waitMs = Number(process.argv[3] || 8000);

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 750 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(waitMs);
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
