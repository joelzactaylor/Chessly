/** Browser smoke test: drives the app through home → course → learn → drill and saves screenshots. */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5176';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

async function shot(name: string) { await page.screenshot({ path: `scripts/out/shots/${name}.png` }); console.log('shot', name); }
async function sq(name: string) {
  const el = page.locator(`[data-sq="${name}"]`).first();
  const b = (await el.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function drag(from: string, to: string) {
  const a = await sq(from); const b = await sq(to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
}
async function click(from: string, to: string) {
  const a = await sq(from); const b = await sq(to);
  await page.mouse.click(a.x, a.y); await page.waitForTimeout(80); await page.mouse.click(b.x, b.y);
}

await page.goto(base + '/#/');
await page.waitForSelector('.course-card');
await shot('01-home');
await page.goto(base + '/#/course/vienna');
await page.waitForSelector('.row');
await shot('02-course');
await page.goto(base + '/#/learn/vienna/gambit-main/0');
await page.waitForSelector('.movelist');
for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120); }
await shot('03-learn');
await page.goto(base + '/#/drill/line/vienna/gambit-main/0');
await page.waitForSelector('.board');
await page.waitForTimeout(300);
await drag('e2', 'e4'); await page.waitForTimeout(900);
await click('b1', 'c3'); await page.waitForTimeout(900);
await shot('04-drill-after-2-moves');
await drag('d2', 'd4'); await page.waitForTimeout(400); // wrong on purpose
await shot('05-drill-wrong');
await drag('f2', 'f4'); await page.waitForTimeout(900);
await drag('f4', 'e5'); await page.waitForTimeout(900);
await drag('d1', 'f3'); await page.waitForTimeout(900);
await drag('f1', 'b5'); await page.waitForTimeout(900);
await drag('d2', 'c3'); await page.waitForTimeout(900);
await drag('g2', 'g3'); await page.waitForTimeout(900);
await drag('f3', 'e4'); await page.waitForTimeout(900);
await drag('g1', 'e2'); await page.waitForTimeout(900);
await drag('b5', 'c6'); await page.waitForTimeout(900);
await drag('h1', 'f1'); await page.waitForTimeout(1200);
await shot('06-drill-done');
const summary = await page.locator('.summary').textContent().catch(() => '');
console.log('summary:', summary?.slice(0, 120));
await page.goto(base + '/#/explore/vienna');
await page.waitForSelector('.tree');
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
await shot('07-explore');
await page.goto(base + '/#/');
await page.waitForTimeout(300);
await shot('08-home-after');
await page.goto(base + '/#/settings');
await page.waitForTimeout(300);
await shot('09-settings');
console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
