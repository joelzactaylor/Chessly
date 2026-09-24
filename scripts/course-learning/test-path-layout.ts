import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.CHESS_LIBRARY_URL ?? 'http://127.0.0.1:5173';
const browser=await chromium.launch();
try {
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.goto(`${base}/#/courses/d37755a0-252e-4925-8c5f-2d2f62d6a2ab`);
  const chapter = page.getByRole('button',{name:/CHAPTER 1 /});
  if (await chapter.getAttribute('aria-expanded') !== 'true') await chapter.click();
  await page.getByRole('button',{name:/Study 1 White Plays 6.Bd2/}).click();
  await page.locator('[data-tile-id]').first().waitFor();await page.waitForTimeout(450);
  assert.equal(await page.locator('[data-tile-id]').count(),7);
  assert.equal(await page.locator('[data-tile-id][href]').count(),1);
  assert.equal(await page.locator('[data-tile-id][aria-disabled="true"]').count(),6);
  const locked=await page.locator('.OpeningPath_lockedLessonTile').first().evaluate(el=>Number(getComputedStyle(el).opacity));
  const available=await page.locator('.OpeningPath_unlockedLessonTile').first().evaluate(el=>Number(getComputedStyle(el).opacity));
  assert(locked<available,'Locked stages must visibly fade');
  const badge=await page.locator('.OpeningPath_currentTileText__LSpNc').boundingBox();
  const study=await page.locator('.OpeningPath_studyName__9vqLG').first().boundingBox();
  assert(badge&&study&&badge.y>=study.y+study.height,'Badge must not overlap the study heading');
  const heading=await page.locator('.chapter-heading').first().boundingBox();
  const title=await page.locator('.chapter-heading>div').first().boundingBox();
  assert(heading&&title&&Math.abs(heading.x+heading.width/2-title.x-title.width/2)<1,'Chapter heading must be centered across its container');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  assert.equal(await page.locator('.study-counter,.avatar,.header-right').count(),0);
  assert.equal(await page.getByRole('button',{name:'Export progress',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Import progress',exact:true}).count(),1);
  assert.equal(await page.getByRole('link',{name:/video|leaderboard|levi/i}).count(),0);
  assert.equal(await page.getByRole('button',{name:/video|leaderboard|levi/i}).count(),0);
  await page.screenshot({path:`scripts/out/parity/path-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:/Study 2 White Plays 6.Bc4/}).click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-tile-id][href]').count(),1,'First stage of every study is available, matching Chessly');
  await page.close();
 }
 console.log('Desktop and mobile path checks passed: badge clearance, centered chapter headings, faded locked stages, disabled links, no excluded controls or horizontal overflow.');
}finally{await browser.close();}
