import { chromium } from 'playwright';
const base = 'http://localhost:5176';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
async function sq(name: string) { const b = (await page.locator(`[data-sq="${name}"]`).first().boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function drag(from: string, to: string) { const a = await sq(from); const b = await sq(to); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); }
const shot = (n: string) => page.screenshot({ path: `scripts/out/shots/${n}.png` });
// Guided learn: Vienna main line, play our moves following the arrows
await page.goto(base + '/#/learn/vienna/gambit-main/0');
await page.waitForSelector('.board'); await page.waitForTimeout(300);
await shot('30-learn-start');
await drag('e2', 'e4'); await page.waitForTimeout(1000);
await drag('b1', 'c3'); await page.waitForTimeout(1000);
await drag('d2', 'd4'); await page.waitForTimeout(300); // wrong on purpose
await shot('31-learn-slip');
await drag('f2', 'f4'); await page.waitForTimeout(1000);
await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(200);
await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(200);
await shot('32-learn-back');
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1000);
for (let i = 0; i < 20; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150); }
await page.waitForTimeout(400);
await shot('33-learn-end');
console.log('learn end has "Play it from memory":', await page.locator('text=Play it from memory').count());
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
console.log('study url:', page.url());
// Mixed practice
await page.goto(base + '/#/drill/mixed-chapter/vienna/gambit-main'); await page.waitForTimeout(500);
await shot('34-mixed');
console.log('mixed label:', (await page.locator('.page').innerText()).includes('Mixed practice'));
// Quiz (needs learned lines: the learn above marked one)
await page.goto(base + '/#/quiz/all'); await page.waitForTimeout(500);
await shot('35-quiz');
console.log('quiz text:', (await page.locator('.page').innerText()).slice(0, 120).replace(/\n/g, ' | '));
await page.goto(base + '/#/'); await page.waitForTimeout(400);
await shot('36-home');
await page.goto(base + '/#/course/vienna'); await page.waitForTimeout(400);
await shot('37-course');
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
