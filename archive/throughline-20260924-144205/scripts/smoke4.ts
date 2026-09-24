import { chromium } from 'playwright';
const base = 'http://localhost:5176';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(base + '/#/explore/vienna'); await page.waitForSelector('.evalbar');
for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150); }
await page.waitForTimeout(6000);
console.log('eval label:', await page.locator('.evalbar-label').textContent(), '| title:', await page.locator('.evalbar').getAttribute('title'));
await page.screenshot({ path: 'scripts/out/shots/50-explore-eval.png' });
await page.goto(base + '/#/learn/vienna/gambit-main/0'); await page.waitForTimeout(2500);
await page.screenshot({ path: 'scripts/out/shots/51-learn-eval.png' });
await page.goto(base + '/#/settings'); await page.waitForTimeout(400);
await page.screenshot({ path: 'scripts/out/shots/52-settings.png', fullPage: true });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
