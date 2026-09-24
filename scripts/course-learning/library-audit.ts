import { readFile, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { lookup, type Knowledge } from './repertoire';
const base='scripts/out/course-learning';
const entries: {id:string;title:string;url:string;side:string}[]=JSON.parse(await readFile(`${base}/catalog-manifest.json`,'utf8'));
const loaded: ((typeof entries)[number] & {model:Knowledge;coverage:{variations:number;positions:number;verifiedMoveOccurrences:number}})[]=[];
for(const e of entries){
 const path=e.id==='775a4eea-5a50-47da-b7dd-5790ef829fbe'?base:`${base}/${e.id}`;
 try {
  const model:Knowledge=JSON.parse(await readFile(`${path}/repertoire.json`,'utf8'));
  const coverage=JSON.parse(await readFile(`${path}/coverage.json`,'utf8'));
  if(model.games!==coverage.variations || Object.keys(model.positions).length!==coverage.positions)throw Error(`Coverage mismatch: ${e.title}`);
  for(const [fen,choices] of Object.entries(model.positions))for(const m of choices){
   const chess=new Chess(`${fen} 0 1`);const actual=chess.move(m.san);
   if(actual.from+actual.to+(actual.promotion??'')!==m.uci)throw Error(`Move mismatch in ${e.title}`);
  }
  loaded.push({...e,model,coverage});
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
function responders(side:string,path:string[]){
 const board=new Chess();path.forEach(m=>board.move(m));
 return loaded.filter(c=>c.side===side).map(c=>({title:c.title,url:c.url,moves:lookup(c.model,board.fen()).map(m=>m.san)})).filter(c=>c.moves.length);
}
const targeted:[string,string[],string][]=[
 ['White',['e4','e5','Nc3','d5'],'Vienna: 2...d5'],
 ['White',['e4','e5','Nc3','f5'],'Vienna: 2...f5'],
 ['White',['e4','c5','a3','a6'],'a3 Sicilian: 2...a6'],
 ['White',['e4','c5','a3','Qc7'],'a3 Sicilian: 2...Qc7'],
 ['White',['e4','e6','Nf3','c5'],'French/Sicilian move order'],
 ['White',['e4','d6','d4','e5'],'Immediate Philidor move order'],
 ['White',['e4','d6','d4','g6'],'Pirc/Modern move order'],
 ['White',['e4','g6','d4','d6'],'Modern: delayed Bg7'],
 ['Black',['e4','d5','Bc4'],'Scandinavian: 2.Bc4'],
];
const gaps=targeted.map(([side,path,label])=>({side,path,label,courses:responders(side,path)}));
const whiteFirst=new Chess();whiteFirst.move('e4');
const firstMoves={black:new Chess().moves().map(m=>({move:m,courses:responders('Black',[m])})),white:whiteFirst.moves().map(m=>({move:m,courses:responders('White',['e4',m])}))};
const report={validatedCourses:loaded.length,variations:loaded.reduce((n,c)=>n+c.coverage.variations,0),verifiedMoveOccurrences:loaded.reduce((n,c)=>n+c.coverage.verifiedMoveOccurrences,0),targetedGaps:gaps,firstMoves,scope:'Exact stored next moves, with colors kept separate. Course presence is not a recommendation to combine all alternatives; video-only content excluded.'};
await writeFile(`${base}/library-coverage.json`,JSON.stringify(report,null,2));
const md=['# Library coverage comparison','','All saved course models checked for legal moves and matching PGN/coverage counts. This compares exact recorded responses, not engine quality or popularity.','','## Responses to the original specific gaps','','| Side | Position | Courses with a recorded next move |','|---|---|---|',...gaps.map(g=>`| ${g.side} | ${g.path.join(' ')} | ${g.courses.map(c=>`[${c.title}](${c.url}): ${c.moves.join(', ')}`).join('; ')||'None found'} |`),'','## Black: first-move coverage','','| White starts | Courses with a response |','|---|---|',...firstMoves.black.map(r=>`| 1.${r.move} | ${r.courses.map(c=>`[${c.title}](${c.url}) (${c.moves.join(', ')})`).join('; ')||'None found'} |`),'','## White: first-move coverage after 1.e4','','| Black replies | Courses with a response |','|---|---|',...firstMoves.white.map(r=>`| 1...${r.move} | ${r.courses.map(c=>`[${c.title}](${c.url}) (${c.moves.join(', ')})`).join('; ')||'None found'} |`),'',`Validated ${report.validatedCourses} courses, ${report.variations} variations and ${report.verifiedMoveOccurrences} source move occurrences.`,''];
await writeFile(`${base}/library-coverage.md`,md.join('\n'));
console.log(JSON.stringify({...report,firstMoves:undefined},null,2));
