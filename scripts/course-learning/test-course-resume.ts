import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import type { Course } from '../../src/library';
const base = process.env.CHESS_LIBRARY_URL ?? 'http://127.0.0.1:5173';
const course: Course = JSON.parse(await readFile('public/library/d37755a0-252e-4925-8c5f-2d2f62d6a2ab.json', 'utf8'));
const study = course.lessons.find(s => s.chapterId !== course.lessons[0].chapterId)!;
const tile = study.tiles[1];
const stages = course.lessons.flatMap(s => s.tiles);
const tiles = Object.fromEntries(stages.slice(0, stages.indexOf(tile)).map(t => [`${course.id}/${t.id}`, new Date().toISOString()]));
const browser = await chromium.launch();
try {
 for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await page.addInitScript(({ tiles }) => localStorage.setItem('chess-library-progress-v1', JSON.stringify({ saved: [], completed: {}, reviews: [], tiles, last: {course:'another-course',study:'another-study',line:0} })), { tiles });
  await page.goto(`${base}/#/courses/${course.id}`);
  const current = page.locator(`[data-tile-id="${tile.id}"]`);
  await current.waitFor();
  await page.waitForTimeout(550);
  assert.equal(await page.locator(`[data-study-id="${study.id}"] [aria-pressed]`).getAttribute('aria-pressed'), 'true');
  assert.equal(await current.getAttribute('aria-disabled'), 'false');
  assert(await current.locator('xpath=../..').evaluate(el => el.classList.contains('OpeningPath_currentLessonTile')));
  const bounds = await current.boundingBox();
  assert(bounds && bounds.y > 0 && bounds.y + bounds.height < 844, 'Current tile must be in the viewport after opening the course');
  const chapter = page.locator('.chapter').filter({has: current}).getByRole('button', {name:/CHAPTER/});
  assert.equal(await chapter.getAttribute('aria-expanded'), 'true');
  await chapter.click();
  assert.equal(await chapter.getAttribute('aria-expanded'), 'false', 'Manual collapsing must remain possible');
  await page.close();
 }
 console.log('Course resume passed on desktop and mobile: opens current chapter/study and scrolls to current tile even after visiting another course.');
} finally { await browser.close(); }
