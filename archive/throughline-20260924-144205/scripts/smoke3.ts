import { chromium } from 'playwright';
const base = 'http://localhost:5176';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
async function sq(name: string) { const b = (await page.locator(`[data-sq="${name}"]`).first().boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function drag(from: string, to: string) { const a = await sq(from); const b = await sq(to); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); }
const text = async () => (await page.locator('.page').innerText()).replace(/\n/g, ' | ');
// Study flow: drill line 0 of Scandinavian sidelines? use Vienna accepted line 4 (short): 1.e4 e5 2.Nc3 Nf6 3.f4 exf4 4.e5 Ne4 5.Nxe4
await page.goto(base + '/#/drill/line/vienna/gambit-accepted/4/study'); await page.waitForSelector('.board'); await page.waitForTimeout(400);
await drag('e2', 'e4'); await page.waitForTimeout(900);
await drag('b1', 'c3'); await page.waitForTimeout(900);
await drag('d2', 'd4'); await page.waitForTimeout(300); // mistake
await drag('f2', 'f4'); await page.waitForTimeout(900);
await drag('e4', 'e5'); await page.waitForTimeout(900);
await drag('c3', 'e4'); await page.waitForTimeout(1200);
const t1 = await text();
console.log('study summary has next-line button:', t1.includes('Learn the next line'), '| grade text:', t1.match(/(Perfect|Good|Shaky|Needs work)/)?.[0]);
await page.screenshot({ path: 'scripts/out/shots/40-study-summary.png' });
// Mixed session of 1 line: set mixedSize via localStorage? Use chapter with few lines instead: run mixed on Scandinavian sidelines and just skip through to the end.
await page.goto(base + '/#/drill/mixed-chapter/vienna/gambit-accepted'); await page.waitForTimeout(500);
for (let i = 0; i < 14; i++) { const s = page.locator('button:has-text("Skip")'); if (!(await s.count())) break; await s.click(); await page.waitForTimeout(250); }
await page.waitForTimeout(400);
const t2 = await text();
console.log('mixed done:', t2.includes('Session complete'), '| has another-round:', t2.includes('Another mixed round'));
await page.screenshot({ path: 'scripts/out/shots/41-mixed-summary.png' });
await page.goto(base + '/#/'); await page.waitForTimeout(400);
await page.screenshot({ path: 'scripts/out/shots/42-home.png' });
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
