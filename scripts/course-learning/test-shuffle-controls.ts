import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import type { Course } from '../../src/library';
const course: Course = JSON.parse(await readFile('public/library/d37755a0-252e-4925-8c5f-2d2f62d6a2ab.json', 'utf8'));
const base = process.env.CHESS_LIBRARY_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/#/drill-shuffle/${course.id}/setup`);
    const filter = page.getByRole('checkbox', { name: /Only learned variations/ });
    await filter.check();
    await page.getByText('No learned variations yet.', { exact: false }).waitFor();
    assert(await page.getByRole('button', { name: /Start Drill Shuffle/ }).isDisabled());
    await page.evaluate(({ id, line }) => localStorage.setItem('chess-library-progress-v1', JSON.stringify({ saved: [], completed: { [`${id}/${line}`]: new Date().toISOString() }, reviews: [], last: null })), { id: course.id, line: course.lessons[0].lines[0].id });
    await page.reload();
    await filter.check();
    await page.getByRole('checkbox', { name: /Select All Chapters/ }).check();
    assert.equal(await page.locator('.shuffle-start p').innerText(), '1 variation selected');
    assert.equal(await page.locator('.shuffle-chapters input:enabled').count(), 2);
    await filter.uncheck();
    assert((await page.locator('.shuffle-start p').innerText()) !== '1 variation selected');
    await filter.check();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `scripts/out/parity/shuffle-updated-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /Start Drill Shuffle/ }).click();
    await page.locator('.board').waitFor();
    assert.match(await page.locator('.study-route-label').innerText(), /1 \/ 1/);
    assert(!/Variation \d/i.test(await page.locator('main').innerText()));
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.close();
  }
  console.log('Shuffle learned filter, counts, empty state, queue and mobile layout passed.');
} finally { await browser.close(); }
