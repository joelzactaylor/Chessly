import { chromium } from 'playwright';
const base = 'http://localhost:5176';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack?.slice(0, 500)}`));
await page.goto(base + '/#/learn/vienna/gambit-main/0');
await page.waitForSelector('.movelist');
for (let i = 0; i < 30; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(60); }
await page.waitForTimeout(500);
console.log('body text length at end:', (await page.locator('body').innerText()).length);
await page.screenshot({ path: 'scripts/out/shots/20-learn-end.png' });
// click "Next line"
const nl = page.locator('text=Next line');
if (await nl.count()) { await nl.first().click(); await page.waitForTimeout(500); console.log('after next line text length:', (await page.locator('body').innerText()).length); await page.screenshot({ path: 'scripts/out/shots/21-next-line.png' }); }
console.log('errors:', errors.length ? errors.join('\n---\n') : 'none');
await browser.close();
