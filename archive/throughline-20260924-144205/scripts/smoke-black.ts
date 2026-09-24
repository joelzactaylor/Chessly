import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5176';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
async function sq(name: string) { const b = (await page.locator(`[data-sq="${name}"]`).first().boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function drag(from: string, to: string) { const a = await sq(from); const b = await sq(to); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); }
// Scandinavian main line, Black to play after White's moves.
await page.goto(base + '/#/drill/line/scandinavian/main/0');
await page.waitForSelector('.board');
await page.waitForTimeout(700); // White plays 1.e4
await page.screenshot({ path: 'scripts/out/shots/10-black-start.png' });
const seq = [['d7','d5'],['d5','d5'],['d8','d5'],['d5','d8'],['g8','f6'],['c8','f5'],['e7','e6'],['f8','e7'],['e8','g8'],['c7','c6'],['b8','d7']];
for (const [f, t] of seq) { if (f === t) continue; await drag(f, t); await page.waitForTimeout(950); }
await page.screenshot({ path: 'scripts/out/shots/11-black-done.png' });
console.log('summary:', (await page.locator('.summary').textContent().catch(() => 'NO SUMMARY'))?.slice(0, 140));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
