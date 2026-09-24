import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import type {Course} from '../../src/library';
const base=process.env.CHESS_LIBRARY_URL ?? 'http://127.0.0.1:5173';
const course:Course=JSON.parse(await readFile('public/library/d37755a0-252e-4925-8c5f-2d2f62d6a2ab.json','utf8'));
const line=course.lessons[0].lines[0];
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(base);
 await page.evaluate(({id,line})=>localStorage.setItem('chess-library-progress-v1',JSON.stringify({saved:[],completed:{[`${id}/${line}`]:new Date().toISOString()},reviews:[],last:null})),{id:course.id,line:line.id});
 await page.goto(`${base}/#/review/${course.id}`);await page.reload();await page.locator('.board').waitFor();
 const chess=new Chess();
 for(let i=0;i<line.sans.length;i++){
  await page.waitForFunction(n=>document.querySelector('.board-controls>span')?.textContent?.startsWith(`${n} /`),i);
  const side=chess.turn(),m=chess.move(line.sans[i]);
  if(side==='b'){await page.locator(`[data-sq="${m.from}"]`).click({force:true});await page.locator(`[data-sq="${m.to}"]`).click({force:true});}
 }
 await page.getByRole('heading',{name:'Perfect',exact:true}).waitFor();
 await page.getByRole('button',{name:'End Session',exact:true}).click();
 await page.reload();await page.getByRole('heading',{name:course.title,exact:true}).waitFor();
 const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('chess-library-progress-v1')!));
 assert.equal(progress.reviews.length,1);
 assert.equal(progress.reviews[0].line,line.id);
 assert.equal(Object.keys(progress.tiles??{}).length,0,'Off-path practice must not unlock path tiles');
 console.log('Completed practice survives End Session and reload without requiring Finish or awarding path completion.');
}finally{await browser.close();}
