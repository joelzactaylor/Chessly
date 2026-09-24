import { readFile, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { lookup, type Knowledge } from './repertoire';

const base = 'scripts/out/course-learning';
const sources = [
  { name: 'Vienna', side: 'w', path: 'repertoire.json' },
  { name: 'Scandinavian Defense', side: 'b', path: 'd37755a0-252e-4925-8c5f-2d2f62d6a2ab/repertoire.json' },
  { name: 'Sicilian (White)', side: 'w', path: '8d12cef8-ec7a-421e-b7f5-19798e4255fc/repertoire.json' },
  { name: 'Other Openings (White)', side: 'w', path: '1c85b58c-c773-42a3-ac19-b4e4afff3aa2/repertoire.json' },
];
const loaded = await Promise.all(sources.map(async s => ({ ...s, model: JSON.parse(await readFile(`${base}/${s.path}`, 'utf8')) as Knowledge })));
function choices(side: string, chess: Chess) {
  return [...new Set(loaded.filter(s => s.side === side).flatMap(s => lookup(s.model, chess.fen()).map(m => m.san)))];
}
function label(path: string[]) { return path.map((san, i) => `${i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''}${san}`).join(' '); }
function openingReplies(side: string, path: string[]) {
  const chess = new Chess(); path.forEach(m => chess.move(m));
  return chess.moves().map(move => {
    const next = new Chess(chess.fen()); next.move(move);
    return { move, responses: choices(side, next) };
  });
}
// Audit legal opponent replies at positions reached through course moves, through move 4.
// The legal-move enumeration is not a popularity ranking or an engine assessment.
function frontier(side: string) {
  const gaps: { line: string; ply: number; fen: string }[] = [];
  const endings: string[] = [];
  const visited = new Map<string, number>();
  function walk(chess: Chess, path: string[]) {
    if (path.length >= 8 || chess.isGameOver()) return;
    const key = chess.fen().split(' ').slice(0,4).join(' ');
    if ((visited.get(key) ?? Infinity) <= path.length) return;
    visited.set(key, path.length);
    const known = choices(side, chess);
    if (!known.length) { endings.push(label(path)); return; }
    if (chess.turn() !== side) {
      for (const move of chess.moves()) {
        const next = new Chess(chess.fen()); next.move(move);
        if (!choices(side, next).length && !next.isGameOver()) {
          if (known.includes(move)) endings.push(label([...path, move]));
          else gaps.push({ line: label([...path, move]), ply: path.length + 1, fen: next.fen() });
        }
      }
    }
    for (const move of known) {
      const next = new Chess(chess.fen()); next.move(move); walk(next, [...path, move]);
    }
  }
  walk(new Chess(), []);
  return { gaps: gaps.sort((a,b) => a.ply-b.ply || a.line.localeCompare(b.line)), courseEndpoints: endings, positionsInspected: visited.size };
}
const report = {
  createdAt: new Date().toISOString(), sources: sources.map(({name,side,path})=>({name,side,path})),
  method: 'Only imported move data. White courses merged separately from the Black Scandinavian course. Legal opponent replies enumerated through ply 8 from course-reached positions; known course endpoints are separate. Absence is not a claim that a move is good or common. Transpositions use normalized FEN without move clocks. Video-only material excluded.',
  whiteFirstReply: openingReplies('w', ['e4']),
  blackFirstReply: openingReplies('b', []),
  viennaSecondReply: openingReplies('w', ['e4','e5','Nc3']),
  sicilianSecondReply: openingReplies('w', ['e4','c5','a3']),
  white: frontier('w'), black: frontier('b'),
};
await writeFile(`${base}/repertoire-audit.json`, JSON.stringify(report,null,2));
console.log(JSON.stringify({whiteFirstReply:report.whiteFirstReply,blackFirstReply:report.blackFirstReply,viennaSecondReply:report.viennaSecondReply,sicilianSecondReply:report.sicilianSecondReply,earlyWhiteGaps:report.white.gaps.filter(g=>g.ply<=4),earlyBlackGaps:report.black.gaps.filter(g=>g.ply<=3),counts:{white:report.white.gaps.length,black:report.black.gaps.length}},null,2));
