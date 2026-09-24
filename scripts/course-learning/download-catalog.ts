import { spawn } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { comet } from './comet';
const base='scripts/out/course-learning';
interface Entry {id:string;title:string;url:string;side:string}
const entries:Entry[]=JSON.parse(await readFile(`${base}/catalog-manifest.json`,'utf8'));
const status:Record<string,{status:string;error?:string}>= {};
const original=comet('return location.href;') as string;
async function locationFor(e:Entry){
 if(e.id==='775a4eea-5a50-47da-b7dd-5790ef829fbe')return base;
 return `${base}/${e.id}`;
}
async function complete(e:Entry){
 const dir=await locationFor(e);
 try {for(const file of ['coverage.json','repertoire.json','comet-checkpoint.json',dir===base?'vienna.pgn':'course.pgn'])await access(`${dir}/${file}`);return true;}catch{return false;}
}
async function catalog(){
 const rows=['# Chessly opening course library','','Downloaded move variations and written position annotations. Video-only material is excluded. Courses remain separate; none is automatically added to the active repertoire.','','| Course | Side | Studies | Variations | Files |','|---|---|---:|---:|---|'];
 let done=0,variations=0;
 for(const e of entries){
  if(await complete(e)){
   const dir=await locationFor(e),c=JSON.parse(await readFile(`${dir}/coverage.json`,'utf8'));
   const pgn=dir===base?'vienna.pgn':'course.pgn';done++;variations+=c.variations;
   rows.push(`| [${e.title}](${e.url}) | ${e.side} | ${c.studies} | ${c.variations} | [PGN](${resolve(dir,pgn)}) · [Coverage](${resolve(dir,'coverage.json')}) |`);
   status[e.id]={status:'complete'};
  }else rows.push(`| [${e.title}](${e.url}) | ${e.side} | — | — | ${status[e.id]?.status??'pending'} |`);
 }
 rows.splice(3,0,`**${done}/${entries.length} courses saved; ${variations} variations.**`,'');
 await writeFile(`${base}/CATALOG.md`,rows.join('\n')+'\n');
 await writeFile(`${base}/catalog-status.json`,JSON.stringify(status,null,2));
 return done;
}
try{
 console.log(`Starting with ${await catalog()}/${entries.length} courses already saved.`);
 for(const e of entries){
  if(await complete(e))continue;
  console.log(`Downloading: ${e.title}`);
  try{
   comet(`window.next.router.push(${JSON.stringify(`/courses/${e.id}`)});return true;`);
   await new Promise(r=>setTimeout(r,1800));
   const result=await new Promise<{code:number|null;output:string}>((resolve,reject)=>{
    let output='';const child=spawn('node_modules/.bin/tsx',['scripts/course-learning/learn-comet.ts',e.id]);
    child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
    child.on('error',reject);child.on('close',code=>resolve({code,output}));
   });
   await writeFile(`${base}/${e.id}-import.log`,result.output,{mode:0o600});
   if(result.code!==0)throw Error(result.output.trim().split('\n').slice(-2).join(' '));
   status[e.id]={status:'complete'};
  }catch(error){status[e.id]={status:'failed',error:String(error)};console.log(`Failed: ${e.title}: ${error}`);}
  console.log(`Saved ${await catalog()}/${entries.length} courses.`);
 }
}finally{
 await catalog();
 comet(`window.next.router.push(${JSON.stringify(original)});return true;`);
}
