import { readFile, writeFile, rename } from 'node:fs/promises';
import { comet } from './comet';
const base = 'scripts/out/course-learning';
const manifest = JSON.parse(await readFile(`${base}/catalog-manifest.json`, 'utf8'));
const destination = `${base}/path-content.json`;
let saved: Record<string, any> = {};
try { saved = JSON.parse(await readFile(destination, 'utf8')); } catch {}
const tiles: string[] = [];
for (const entry of manifest) {
  const dir = entry.id === '775a4eea-5a50-47da-b7dd-5790ef829fbe' ? base : `${base}/${entry.id}`;
  const checkpoint = JSON.parse(await readFile(`${dir}/comet-checkpoint.json`, 'utf8'));
  for (const s of checkpoint.studies) for (const t of s.study.tiles) if (t.kind !== "video" && !saved[t.id]) tiles.push(t.id);
}
comet(`let el=document.querySelector('a')||document.querySelector('button');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)if(f.memoizedProps?.value?.fetcher)window.__parityFetcher=f.memoizedProps.value.fetcher;if(!window.__parityFetcher)throw Error('Open a Chessly course first');return true;`);
let failures = 0;
try {
  for (let offset = 0; offset < tiles.length; offset += 48) {
    const batch = tiles.slice(offset, offset + 48).filter(id => !saved[id]);
    if (!batch.length) continue;
    const requestId = `${Date.now()}-${offset}`;
    comet(`window.__parityBatch={pending:true,requestId:${JSON.stringify(requestId)}};(async()=>{const ids=${JSON.stringify(batch)},data={},errors={};let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<ids.length){const id=ids[cursor++];try{await new Promise(r=>setTimeout(r,450));data[id]=await window.__parityFetcher('https://cag.chessly.com/beta/openings/tiles/'+id)}catch(e){errors[id]=String(e)}}}));if(window.__parityBatch?.requestId===${JSON.stringify(requestId)})window.__parityBatch={data,errors,requestId:${JSON.stringify(requestId)}};})();return true;`);
    let result: any;
    for (let poll = 0; poll < 240; poll++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      result = comet('return window.__parityBatch;');
      if (!result) throw Error("The Chessly tab changed while capturing. Reopen the course and rerun this command.");
      if (!result.pending && result.requestId === requestId) break;
    }
    if (result.pending || result.requestId !== requestId) throw Error('Timed out capturing tile content');
    for (const [id, tile] of Object.entries(result.data) as [string, any][]) {
      if (!batch.includes(id) || tile.tileId !== id || !Array.isArray(tile.newVariations) || !Array.isArray(tile.reviewVariations)) throw Error(`Unexpected tile response: ${id}`);
      saved[id] = tile;
    }
    await writeFile(`${destination}.tmp`, JSON.stringify(saved));
    await rename(`${destination}.tmp`, destination);
    console.log(`Captured ${Object.keys(saved).length} tiles; ${Object.keys(result.errors).length} errors in batch`);
    if (Object.keys(result.errors).length) { if (++failures >= 3) throw Error('Three tile capture batches failed. Completed responses are saved; rerun to resume.'); console.log('Backing off for 30 seconds before retrying this batch'); await new Promise(resolve => setTimeout(resolve, 30000)); offset -= 48; } else { failures = 0; await new Promise(resolve => setTimeout(resolve, 10000)); }
  }
} finally { comet('delete window.__parityBatch;delete window.__parityRead;delete window.__parityFetcher;return true;'); }
