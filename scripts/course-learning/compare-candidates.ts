import { readFile, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { lookup, type Knowledge } from './repertoire';
const base = 'scripts/out/course-learning';
const specs = [
 ['Kings Indian','5ce335b2-22e1-434e-a2f4-de67b83d4807'],
 ['d4 Sidelines','5a2a0988-2a87-4d59-8360-7228ded553de'],
 ['QGD','68814342-f681-4b82-bb08-acf239720df8'],
 ['Owen','b094bf9e-a914-4a41-a3b1-d0c921636166'],
 ['Modern','49d71d72-7d0e-4b55-bb66-5f257e37b4fc'],
];
const loaded = await Promise.all(specs.map(async ([name,id]) => ({name,id,model:JSON.parse(await readFile(`${base}/${id}/repertoire.json`,'utf8')) as Knowledge,coverage:JSON.parse(await readFile(`${base}/${id}/coverage.json`,'utf8'))})));
function moves(models: Knowledge[], path: string[]) {
 const c = new Chess(); for (const m of path)c.move(m);
 return [...new Set(models.flatMap(k=>lookup(k,c.fen()).map(m=>m.san)))];
}
const models = Object.fromEntries(loaded.map(c=>[c.name,c.model]));
const selected = [models['Kings Indian'],models['d4 Sidelines']];
const firstMoves = new Chess().moves();
const profiles = loaded.map(c=>({name:c.name,id:c.id,studies:c.coverage.studies,variations:c.coverage.variations,firstMoveResponses:firstMoves.map(m=>({white:m,black:moves([c.model],[m])})).filter(x=>x.black.length)}));
const secondMoves: Record<string,unknown> = {};
for(const [name,ms] of [['KID + sidelines',selected],['QGD',[models.QGD]],['Owen',[models.Owen]],['Modern',[models.Modern]]] as [string,Knowledge[]][]){
 secondMoves[name]=[];
 for (const white of ['d4','c4','Nf3','f4','b3','g3','Nc3']) for(const black of moves(ms,[white])){
  const c=new Chess();c.move(white);c.move(black);
  (secondMoves[name] as unknown[]).push({first: `${white} ${black}`,covered:c.moves().map(m=>({white:m,black:moves(ms,[white,black,m])})).filter(x=>x.black.length)});
 }
}
// Only positions with Black to move count as competing Black repertoire choices.
const conflicts=[];
for(const [fen,a] of Object.entries(models['Kings Indian'].positions)){
 if(fen.split(' ')[1]!=='b')continue;
 const b=models['d4 Sidelines'].positions[fen];
 if(b && new Set([...a,...b].map(m=>m.san)).size>1)conflicts.push({fen,kid:a.map(m=>m.san),sidelines:b.map(m=>m.san),lessons:[...new Set([...a,...b].flatMap(m=>m.lessons))]});
}
const report={profiles,secondMoves,kidSidelineAlternativePositions:conflicts};
await writeFile(`${base}/candidate-comparison.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
