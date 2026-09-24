import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { tileSteps, nextTile, tileAvailable, sourceTileUrl, shuffled } from '../../src/pathNavigation';
import { EMPTY, validProgress, type Course } from '../../src/library';
const base = 'scripts/out/course-learning';
const manifest = JSON.parse(await readFile(`${base}/catalog-manifest.json`, 'utf8'));
const content = JSON.parse(await readFile(`${base}/path-content.json`, 'utf8'));
let courses = 0, studies = 0, variations = 0, moves = 0, tiles = 0, verified = 0;
const missing: string[] = [];
for (const entry of manifest) {
  const dir = entry.id === '775a4eea-5a50-47da-b7dd-5790ef829fbe' ? base : `${base}/${entry.id}`;
  const raw = JSON.parse(await readFile(`${dir}/comet-checkpoint.json`, 'utf8'));
  const course: Course = JSON.parse(await readFile(`public/library/${entry.id}.json`, 'utf8'));
  assert.equal(course.lessons.length, raw.studies.length);
  courses++;
  for (const [i, study] of course.lessons.entries()) {
    const source = raw.studies[i]; studies++;
    assert.equal(study.id, source.study.id);
    assert.equal(study.chapterId, source.chapter.id);
    const sourceMoves = Object.values(source.data.studyMoves).flat() as any[];
    const ids = [...new Set(sourceMoves.map(m => m.variationId))];
    assert.deepEqual(new Set(study.lines.map(l => l.id)), new Set(ids));
    for (const line of study.lines) {
      variations++;
      const rawLine = sourceMoves.filter(m => m.variationId === line.id);
      assert.equal(line.sans.length, rawLine.length);
      const chess = new Chess();
      for (const san of line.sans) {
        const matches = rawLine.filter(m => new Chess(m.fen).fen() === chess.fen() && m.san === san);
        assert.equal(matches.length, 1, `${course.id}/${study.id}/${line.id}: disconnected move ${san}`);
        chess.move(san); moves++;
        assert.equal(chess.fen(), new Chess(matches[0].nextFen).fen());
      }
    }
    const expectedNotes: Record<string, unknown[]> = {};
    for (const [fen, notes] of Object.entries(source.data.annotationsByPosition)) {
      const key = new Chess(fen).fen();
      expectedNotes[key] ??= [];
      for (const note of notes as unknown[]) if (!expectedNotes[key].some(n => JSON.stringify(n) === JSON.stringify(note))) expectedNotes[key].push(note);
    }
    assert.deepEqual(study.notes, expectedNotes, `${study.id}: lost annotation`);
    assert.deepEqual(study.tiles.map(t => ({id:t.id,kind:t.kind,index:t.index,required:t.required})), [...source.study.tiles].filter((t:any)=>t.kind!=="video").sort((a:any,b:any)=>a.index-b.index));
    for (const tile of study.tiles) {
      tiles++;
      const original = content[tile.id];
      if (!original || !tile.verified) { missing.push(tile.id); assert.equal(tile.verified, false); continue; }
      verified++;
      assert.equal(tile.verified, true);
      for (const field of ['newVariations', 'reviewVariations', 'videoIds', 'quizIds'] as const) assert.deepEqual(tile[field], original[field]);
      const steps = tileSteps(tile);
      const expected = original.newVariations.length ? original.newVariations.flatMap((id:string)=>[{variationId:id,guided:true},{variationId:id,guided:false}]) : original.reviewVariations.map((id:string)=>({variationId:id,guided:false}));
      assert.deepEqual(steps, expected);
      for (const step of steps) assert(ids.includes(step.variationId));
      assert(sourceTileUrl(course.id, study, tile).includes(`tileId=${tile.id}`));
    }
  }
  const first = nextTile(course, EMPTY)!;
  assert.equal(course.lessons.flatMap(s=>s.tiles).filter(t=>tileAvailable(course,t,EMPTY)).length,course.lessons.length,'Each study starts with its first stage unlocked, matching Chessly');
  if (course.lessons.length>1) assert.equal(tileAvailable(course,course.lessons[1].tiles[0],EMPTY),true);
  assert.equal(nextTile(course,{...EMPTY,last:{course:course.id,study:course.lessons.at(-1)!.id,line:0}})?.tile.id,first.tile.id,'Browsing later studies must not move the unlock frontier');
  assert.equal(first.tile.id, course.lessons[0].tiles.find(t=>t.required)!.id);
  const p = { ...EMPTY, tiles: Object.fromEntries(course.lessons.flatMap(s=>s.tiles.map(t=>[`${course.id}/${t.id}`, new Date().toISOString()]))) };
  assert.equal(nextTile(course,p),null);
  assert(validProgress(p));
}
assert(validProgress(EMPTY));
assert(!validProgress({...EMPTY, tiles: []}));
assert(!validProgress({...EMPTY, tiles: {bad:'not a date'}}));
assert.deepEqual(new Set(shuffled([1,2,3,4])),new Set([1,2,3,4]));
const report = { checkedAt: new Date().toISOString(), courses, studies, variations, moves, tiles, verified, missing: missing.length,
  exclusions: ['videos and their controls', 'leaderboards', 'AI Levi bot and its controls'],
  annotationScope: 'All position annotations exposed by the original study-lines imports; equivalent FEN notes are merged without loss.',
  missingTileIds: missing };
await writeFile('scripts/out/course-learning/path-parity-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({...report, missingTileIds: undefined}, null, 2));
if (process.argv.includes('--complete')) assert.equal(missing.length,0,'Tile capture is incomplete');
