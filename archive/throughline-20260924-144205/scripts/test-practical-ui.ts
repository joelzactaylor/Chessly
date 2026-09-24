import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('throughline.data-revision', 'manual-setup-2026-09-20');
    localStorage.setItem('throughline.generated-courses.v2', JSON.stringify({ version: 4, builtAt: Date.now(), courses: [{
      id: 'vienna', title: 'Vienna test', subtitle: '', side: 'w', description: '', ideas: [],
      chapters: [{ id: 'generated', title: 'Practice', summary: '', pgn: '1.e4 e5 2.Nc3 Nf6 3.f4 {Practical continuation: engine example.}' }],
    }] }));
    localStorage.setItem('throughline.progress', JSON.stringify({ state: { lines: {}, moves: {}, learned: {}, sessions: [], settings: { showEval: false, sound: false } }, version: 0 }));
  });
  await page.goto('http://127.0.0.1:5173');
  await page.getByText('Learn one idea. Recall it. Use it.').waitFor();
  await page.getByRole('link', { name: 'Review my latest game' }).click();
  await page.getByLabel('Game PGN').fill('1.e4 e5 2.Nf3 Nc6');
  await page.getByRole('button', { name: 'Find my study target' }).click();
  await page.getByRole('heading', { name: 'Your next study target' }).waitFor();
  await page.getByRole('link', { name: 'Study this line' }).click();
  await page.getByTitle('End', { exact: true }).click();
  await page.getByText('Practice beyond the database', { exact: true }).waitFor();
  await page.getByText('Take this into your next game', { exact: true }).waitFor();
  await page.goto('http://127.0.0.1:5173/#/game-review');
  await page.getByLabel('Game PGN').fill('1.e4 c5 2.Nf3');
  await page.getByRole('button', { name: 'Find my study target' }).click();
  await page.getByRole('heading', { name: 'You reached the edge of your repertoire' }).waitFor();
  await page.goto('http://127.0.0.1:5173/#/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export course build' }).click();
  assert.equal((await download).suggestedFilename(), 'throughline-course-build.json');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5173/#/game-review');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('Study → game review → lesson, coverage gap, build export and mobile layout passed.');
} finally { await browser.close(); }
