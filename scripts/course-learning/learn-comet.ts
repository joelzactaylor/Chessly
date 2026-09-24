import { mkdir, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { comet } from './comet';
import { learn, lookup } from './repertoire';

const argument = process.argv[2] ?? '775a4eea-5a50-47da-b7dd-5790ef829fbe';
const id = argument.match(/^(?:https:\/\/chessly\.com\/courses\/)?([a-f0-9-]{36})\/?$/)?.[1];
if (!id) throw new Error('Supply a Chessly course URL or UUID.');
const source = `https://chessly.com/courses/${id}`;
const directory = `scripts/out/course-learning/${id}`;
const pause = () => new Promise(resolve => setTimeout(resolve, 500));
interface Study { id: string; name: string }
interface Chapter { id: string; name: string; studies: Study[] }
interface Move { fen: string; san: string; nextFen: string; variationId: string; variationIndex: number }
interface StudyData { studyId: string; studyName: string; studyMoves: Record<string, Move[]>; annotationsByPosition: Record<string, { text: string }[]> }

async function main() {
  const original = comet('return location.href;') as string;
  const originalPage = new URL(original);
  if (originalPage.origin !== 'https://chessly.com' || (originalPage.pathname !== `/courses/${id}` && !originalPage.pathname.startsWith(`/courses/${id}/`))) throw new Error('Open the requested course in the active Comet tab first.');
  // Use the site's own read-only fetcher so authentication stays inside the browser.
  comet(`
    let el=document.querySelector('a')||document.querySelector('button');
    if(!el)throw new Error('Course page is still loading. Wait for it to load, then retry.');
    let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];
    for(;f;f=f.return)if(f.memoizedProps?.value?.fetcher)window.__courseFetcher=f.memoizedProps.value.fetcher;
    if(!window.__courseFetcher)throw new Error('Course data client unavailable. Open the main course page.');
    window.__courseRead={pending:true};
    Promise.resolve(window.__courseFetcher(${JSON.stringify(`https://cag.chessly.com/beta/openings/courses/${id}/tree`)})).then(data=>window.__courseRead={data},()=>window.__courseRead={error:'Course request failed'});
    return true;
  `);
  let tree: { chapters: Chapter[] } | undefined;
  for (let i = 0; i < 60; i++) {
    const response = comet('return window.__courseRead;') as { data?: typeof tree; error?: string };
    if (response.error) throw new Error(response.error);
    if (response.data) { tree = response.data; break; }
    await pause();
  }
  if (!tree?.chapters?.length) throw new Error('Course syllabus did not load.');
  await mkdir(directory, { recursive: true });
  const games: string[] = [], studies: unknown[] = [], coverage: unknown[] = [];
  const expected: { fen: string; san: string }[] = [];
  try {
    for (const chapter of tree.chapters) for (const study of chapter.studies) {
      const url = `${source}/chapters/${chapter.id}/studies/${study.id}/lines`;
      comet(`window.next.router.push(${JSON.stringify(url)});return true;`);
      let data: StudyData | undefined;
      for (let i = 0; i < 60; i++) {
        const found = comet(`
          if(location.pathname!==${JSON.stringify(new URL(url).pathname)})return null;
          let el=document.querySelector('a')||document.querySelector('button');if(!el)return null;
          let root=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(root?.return)root=root.return;
          let result=null;const seen=new Set();
          function walk(n){if(!n||seen.has(n)||result)return;seen.add(n);const p=n.memoizedProps;
            if(p?.studyId===${JSON.stringify(study.id)}&&p.studyMoves&&Object.keys(p.studyMoves).length){result={studyId:p.studyId,studyName:p.studyName,studyMoves:p.studyMoves,annotationsByPosition:p.annotationsByPosition||{}};return;}
            walk(n.child);walk(n.sibling);
          }walk(root);return result;
        `) as StudyData | null;
        if (found) { data = found; break; }
        await pause();
      }
      if (!data) throw new Error(`Study did not load: ${study.name}`);
      const moves = Object.values(data.studyMoves).flat();
      const variations = [...new Set(moves.map(m => m.variationId))];
      if (!variations.length) throw new Error(`No variations in ${study.name}`);
      for (const variation of variations) {
        const line = moves.filter(m => m.variationId === variation);
        const chess = new Chess(); const visited = new Set<Move>(); const text: string[] = [];
        // Compare normalized positions to account for the site's uncapturable en-passant square.
        const normalized = (fen: string) => new Chess(fen).fen();
        while (visited.size < line.length) {
          const next = line.filter(m => !visited.has(m) && normalized(m.fen) === chess.fen());
          if (next.length !== 1) throw new Error(`Disconnected or ambiguous variation ${variation} in ${study.name}`);
          const m = next[0]; const before = chess.fen();
          text.push(`${chess.moveNumber()}${chess.turn() === 'w' ? '.' : '...'}${m.san}`);
          chess.move(m.san);
          if (chess.fen() !== normalized(m.nextFen)) throw new Error(`Position mismatch in ${variation}: ${m.san}`);
          const notes = data.annotationsByPosition[m.nextFen] ?? [];
          for (const note of notes) if (note.text) text.push(`{${note.text.replace(/[{}]/g, '').replace(/\s+/g, ' ')}}`);
          expected.push({ fen: before, san: m.san }); visited.add(m);
        }
        const title = `${chapter.name} / ${study.name} / Variation ${line[0].variationIndex}`.replace(/["\\]/g, '');
        games.push(`[Event "${title}"]\n[Site "${url}"]\n\n${text.join(' ')} *`);
      }
      studies.push({ chapter, study, data });
      coverage.push({ chapter: chapter.name, study: study.name, studyId: study.id, variations: variations.length, moves: moves.length });
      console.log(`${chapter.name}: ${study.name}: ${variations.length} variations`);
      await writeFile(`${directory}/comet-checkpoint.json`, JSON.stringify({ source, studies, coverage }, null, 2), { mode: 0o600 });
    }
    const pgn = games.join('\n\n'); const model = learn(pgn, source);
    for (const move of expected) if (!lookup(model, move.fen).some(m => m.san === move.san)) throw new Error('Imported move missing from model.');
    const report = { source, capturedAt: new Date().toISOString(), chapters: tree.chapters.length, studies: coverage.length, variations: games.length, positions: Object.keys(model.positions).length, verifiedMoveOccurrences: expected.length, scope: 'All study move variations and position annotations exposed by the course lines pages. Video-only material is not included.', coverage };
    await writeFile(`${directory}/course.pgn`, pgn, { mode: 0o600 });
    await writeFile(`${directory}/repertoire.json`, JSON.stringify(model, null, 2), { mode: 0o600 });
    await writeFile(`${directory}/coverage.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ ...report, coverage: undefined }, null, 2));
  } finally {
    comet(`delete window.__courseRead;delete window.__courseFetcher;window.next.router.push(${JSON.stringify(original)});return true;`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
