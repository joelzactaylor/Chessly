import { readFile, writeFile } from 'node:fs/promises';
const base='scripts/out/course-learning';
const manifest=JSON.parse(await readFile(`${base}/catalog-manifest.json`,'utf8'));
const courses=[];
for(const e of manifest){
 const legacy=e.id==='775a4eea-5a50-47da-b7dd-5790ef829fbe';const dir=legacy?base:`${base}/${e.id}`;
 try {
  const coverage=JSON.parse(await readFile(`${dir}/coverage.json`,'utf8'));
  courses.push({...e,...{studies:coverage.studies,variations:coverage.variations,positions:coverage.positions},pgn:legacy?'vienna.pgn':`${e.id}/course.pgn`,coveragePath:legacy?'coverage.json':`${e.id}/coverage.json`});
 }catch{ /* The status catalog separately lists incomplete downloads. */ }
}
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your chess course library</title>
<style>
:root{font-family:system-ui,sans-serif;color:#e8edf3;background:#101923;color-scheme:dark}body{max-width:1150px;margin:auto;padding:32px 20px}h1{font-size:clamp(28px,5vw,44px);margin-bottom:8px}p{color:#adbbc9;line-height:1.6}header{margin-bottom:26px}.controls{display:flex;gap:12px;flex-wrap:wrap;position:sticky;top:0;background:#101923;padding:14px 0;z-index:1}input,select,button{font:inherit;padding:11px;border:1px solid #425568;border-radius:8px;background:#182635;color:inherit}input[type=search]{flex:1;min-width:220px}button{cursor:pointer;background:#235c50}button:disabled{opacity:.5;cursor:default}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}.card{background:#192735;border:1px solid #34485b;border-radius:12px;padding:20px}.card:has(input:checked){border-color:#75d6b5}.title{font-size:18px;font-weight:650;display:flex;gap:12px;align-items:flex-start}.title input{margin-top:5px;accent-color:#75d6b5}.description{font-size:14px;min-height:60px}.stats{font-size:13px;color:#9edac5}.links{display:flex;gap:18px;flex-wrap:wrap;margin-top:16px}a{color:#9cd8f9}#count{margin:0 0 20px}label:focus-within{outline:2px solid #9cd8f9;outline-offset:4px}
</style><header><h1>Your chess course library</h1><p>${courses.length} opening courses, saved separately. Browse and select courses to consider, then download your selection list.<br>Includes recorded chess lines and written notes. Video-only material is excluded. Selecting a course does not change your repertoire.</p></header>
<div class="controls"><input id="search" type="search" aria-label="Search courses" placeholder="Search titles and descriptions"><select id="side" aria-label="Playing side"><option value="">Both sides</option><option>White</option><option>Black</option></select><button id="export">Download selection</button></div><p id="count" role="status"></p><main class="grid" id="courses"></main>
<script>
const courses=${JSON.stringify(courses).replace(/</g,'\\u003c')};
let selected=new Set();try{selected=new Set(JSON.parse(localStorage.getItem('chessly-library-selection')||'[]'));}catch{}
const grid=document.querySelector('#courses'),search=document.querySelector('#search'),side=document.querySelector('#side'),button=document.querySelector('#export');
function element(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function render(){const q=search.value.toLowerCase();const visible=courses.filter(c=>(!side.value||c.side===side.value)&&(c.title+' '+(c.description||'')).toLowerCase().includes(q));grid.replaceChildren();
for(const c of visible){const card=element('article','','card'),label=element('label','','title'),check=document.createElement('input');check.type='checkbox';check.checked=selected.has(c.id);check.addEventListener('change',()=>{if(check.checked)selected.add(c.id);else selected.delete(c.id);try{localStorage.setItem('chessly-library-selection',JSON.stringify([...selected]));}catch{}update(visible.length);});label.append(check,element('span',c.title));card.append(label,element('p',c.description||'','description'),element('p',c.side+' · '+c.studies+' studies · '+c.variations+' variations','stats'));const links=element('div','','links');for(const [text,href] of [['PGN',c.pgn],['Coverage',c.coveragePath],['Chessly',c.url]]){const a=element('a',text);a.href=href;if(text==='Chessly'){a.target='_blank';a.rel='noopener';}links.append(a);}card.append(links);grid.append(card);}update(visible.length);}
function update(count){const total=courses.filter(c=>selected.has(c.id)).length;document.querySelector('#count').textContent=count+' courses shown · '+total+' selected';button.disabled=!total;}
search.addEventListener('input',render);side.addEventListener('change',render);button.addEventListener('click',()=>{const chosen=courses.filter(c=>selected.has(c.id)).map(({id,title,side,url,pgn})=>({id,title,side,url,pgn}));const blob=new Blob([JSON.stringify({courses:chosen},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='my-course-selection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});render();
</script></html>`;
await writeFile(`${base}/library.html`,html);
console.log(`Built course picker with ${courses.length} saved courses.`);
