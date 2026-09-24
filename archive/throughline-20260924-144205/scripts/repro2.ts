import { chromium } from 'playwright';
const base = 'http://localhost:5176';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack?.slice(0, 600)}`));
const len = async () => (await page.locator('#root').innerText()).length;
await page.goto(base + '/#/learn/vienna/gambit-main/0');
await page.waitForSelector('.movelist');
// click the Next button until disabled
for (let i = 0; i < 30; i++) { const b = page.locator('button:has-text("Next")'); if (await b.isDisabled()) break; await b.click(); await page.waitForTimeout(60); }
console.log('A end via button:', await len());
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
console.log('B after Enter (drill):', await len(), page.url());
await page.goto(base + '/#/learn/vienna/gambit-main/8'); await page.waitForTimeout(300);
for (let i = 0; i < 30; i++) await page.keyboard.press('End');
await page.waitForTimeout(300);
console.log('C last line end:', await len());
await page.locator('text=Practice chapter').first().click(); await page.waitForTimeout(800);
console.log('D practice chapter:', await len(), page.url());
// learn -> drill this line -> finish
await page.goto(base + '/#/learn/scandinavian/main/0'); await page.waitForTimeout(300);
await page.keyboard.press('End'); await page.waitForTimeout(300);
await page.locator('text=Drill this line').first().click(); await page.waitForTimeout(800);
console.log('E drill from learn:', await len(), page.url());
await page.screenshot({ path: 'scripts/out/shots/22-e.png' });
console.log('errors:', errors.length ? errors.join('\n---\n') : 'none');
await browser.close();
