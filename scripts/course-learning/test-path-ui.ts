import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Chess} from 'chess.js';
import {tileSteps, tileUrl} from '../../src/pathNavigation';
import type {Course} from '../../src/library';
const base=process.env.CHESS_LIBRARY_URL ?? 'http://127.0.0.1:5173';
const course:Course=JSON.parse(await readFile('public/library/775a4eea-5a50-47da-b7dd-5790ef829fbe.json','utf8'));
const study=course.lessons[0], tile=study.tiles.find(t=>t.kind==='learn')!;
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/#/courses/${course.id}`);
 await page.getByRole('link',{name:'Start Learning',exact:true}).first().click();
 await page.waitForURL(`**/${tile.id}`);
 await page.locator('.board').waitFor();
 assert(await page.getByRole('button',{name:'Last position',exact:true}).isDisabled(),'A new path lesson must not permit skipping unseen moves');
 async function clickSquare(sq:string){const b=await page.locator(`.board .sq[data-sq="${sq}"]`).boundingBox();assert(b);await page.mouse.click(b.x+b.width/2,b.y+b.height/2);}
 const steps=tileSteps(tile);
 for(const [index,step] of steps.entries()){
   const line=study.lines.find(l=>l.id===step.variationId)!;
   assert.equal(await page.locator('.lesson-stage-mode').innerText(),step.guided?'LEARN':'REVIEW');
   const chess=new Chess();
   const expectedNotes = step.guided ? (study.notes[chess.fen()] ?? []).filter(n=>n.text.trim()).map(n=>n.text) : [];
   assert.deepEqual(await page.locator('.course-annotations p').allTextContents(),expectedNotes,'Learn displays imported annotations; recall starts without revealing them');
   const panel=await page.locator('.lesson-panel').boundingBox();
   assert(panel && panel.width>300 && panel.x+panel.width<=1440,'Right panel must remain within the viewport');
   if(index===1){
     await clickSquare('d2');await clickSquare('d4');
     await page.getByRole('status').filter({hasText:'Try again'}).waitFor();
     await page.getByRole('button',{name:'Hint',exact:true}).click();
     await page.getByRole('button',{name:'Solution',exact:true}).click();
   }
   for(let i=0;i<line.sans.length;i++){
     await page.waitForFunction(n=>document.querySelector('.board-controls>span')?.textContent?.startsWith(`${n} /`),i);
     const side=chess.turn(),m=chess.move(line.sans[i]);
     if(side==='w'){await clickSquare(m.from);await clickSquare(m.to);}
   }
   await page.getByRole('heading',{name:/^(Completed|Perfect)$/}).waitFor();
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-library-progress-v1')!));
   assert(!before.tiles?.[`${course.id}/${tile.id}`],'Tile must not complete before its final step is accepted');
   if(!step.guided) assert(before.completed[`${course.id}/${step.variationId}`],'A successful review is saved even before Next or Finish is clicked');
   if(index===2) {
     assert(before.completed[`${course.id}/${steps[1].variationId}`],'Completed reviews must persist before the whole tile finishes');
     assert.equal(before.reviews.length,1);
   }
   await page.getByRole('button',{name:index===steps.length-1?'Finish':step.guided?'Next: Review':'Next Variation',exact:true}).click();
 }
 await page.getByRole('heading',{name:'Lesson complete!'}).waitFor();
 const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-library-progress-v1')!));
 assert(progress.tiles[`${course.id}/${tile.id}`]);
 assert.equal(progress.reviews.length,tile.newVariations.length);
 assert.equal(progress.reviews[0].mistakes,3,'Hints must prevent a perfect recall result');
 assert.equal(Object.keys(progress.completed).length,tile.newVariations.length);
 await page.getByRole('link',{name:'Next lesson →'}).click();
 await page.waitForURL(`**/${study.tiles.find(t=>t.kind==='review')!.id}`);
 await page.getByRole('button',{name:'End Session',exact:true}).click();
 await page.locator('[data-tile-id]').first().waitFor();
 assert.equal(await page.locator('[data-tile-id]').count(),study.tiles.length);
 for(const [i,t] of study.tiles.entries()) {
   const link=page.locator(`[data-tile-id="${t.id}"]`);
   assert.equal(await link.getAttribute('href'), i<2 ? tileUrl(course.id,study.id,t.id) : null);
   assert.equal(await link.getAttribute('aria-disabled'),i<2?'false':'true');
 }
 await page.evaluate(({id,tiles})=>{
   const p=JSON.parse(localStorage.getItem('chess-library-progress-v1')!);
   p.tiles=Object.fromEntries(tiles.filter(t=>t.kind!=='graduate').map(t=>[`${id}/${t.id}`,new Date().toISOString()]));
   localStorage.setItem('chess-library-progress-v1',JSON.stringify(p));
 },{id:course.id,tiles:study.tiles});
 await page.reload();await page.locator('[data-tile-id]').first().waitFor();
 const graduation=study.tiles.find(t=>t.kind==='graduate')!;
 assert.equal(graduation.reviewVariations.length,study.lines.length);
 await page.locator(`[data-tile-id="${graduation.id}"]`).click();
 await page.locator('.board').waitFor();
 assert.match(await page.locator('.study-route-label').innerText(),/GRADUATION/);
 assert.equal(await page.getByRole('link',{name:/video|leaderboard|levi/i}).count(),0);
 assert.equal(await page.getByRole('button',{name:/video|leaderboard|levi/i}).count(),0);
 // Shuffle must offer chapter selection and include every variation in that chapter.
 await page.goto(`${base}/#/drill-shuffle/${course.id}/setup`);
 await page.getByRole('heading',{name:'Drill Shuffle',exact:true}).waitFor();
 await page.getByRole('checkbox').nth(1).check();
 const chapterCount=course.lessons.filter(s=>s.chapterId===study.chapterId).reduce((sum,s)=>sum+s.lines.length,0);
 await page.getByRole('button',{name:`Start Drill Shuffle · ${chapterCount} variations`,exact:true}).click();
 await page.locator('.board').waitFor();
 assert.match(await page.locator('.study-route-label').innerText(),new RegExp(`DRILL SHUFFLE · 1 / ${chapterCount}`));
 // Direct off-path practice must use the selected variation, including the final index.
 await page.goto(`${base}/#/drill/${course.id}/${study.id}/${study.lines.length-1}`);
 await page.locator('.board').waitFor();
 assert.match(await page.locator('.board-controls>span').innerText(),new RegExp(`0 / ${study.lines.at(-1)!.sans.length}`));
 await page.goto(base+'/'+tileUrl(course.id,study.id,tile.id));
 await page.setViewportSize({width:390,height:844});await page.locator('.board').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 await page.screenshot({path:'scripts/out/parity/path-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Path UI passed: exact tile routing, guided/review sequence, no skipped moves, hints, completion, next tile, graduation, excluded video/leaderboard/bot controls, off-path final variation, mobile.');
}finally{await browser.close();}
