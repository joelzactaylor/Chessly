import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { assessEndpoint, type BuildEval } from '../src/lib/courseStopping';
import { pathsToPgn } from '../src/lib/courseGenerator';
import { parseCourse } from '../src/lib/tree';

// Both kings sheltered, a quiet rook ending. UCI evaluation is from Black's side.
const fen = '5rk1/pp3ppp/8/8/8/8/PP3PPP/5RK1 b - - 0 12';
const position = new Chess(fen);
const quiet: BuildEval = { move: 'f8e8', cp: -240, mate: null, pv: ['f8e8', 'f1e1', 'e8d8', 'e1d1'] };
assert.equal(assessEndpoint(position, 'w', quiet, 12, 0).reason, null, 'one favourable score is not a stable advantage');
assert.match(assessEndpoint(position, 'w', quiet, 12, 2).reason!, /Stable advantage/);
assert.equal(assessEndpoint(position, 'b', quiet, 12, 2).stable, 0, 'a negative score for Black must not count as an advantage');
assert.equal(assessEndpoint(position, 'w', { ...quiet, cp: 80 }, 30, 2).reason, null, 'a losing position is not settled');
assert.equal(assessEndpoint(position, 'w', { ...quiet, cp: 0 }, 12, 0).reason, null, 'balanced openings do not stop after six moves');
assert.match(assessEndpoint(position, 'w', { ...quiet, cp: 0 }, 24, 0).reason!, /Settled middlegame/);
assert.equal(assessEndpoint(position, 'w', { ...quiet, pv: ['f8e8'] }, 24, 2).reason, null, 'short PV is not evidence of a quiet continuation');
assert.equal(assessEndpoint(position, 'w', { ...quiet, cp: null, mate: -5 }, 24, 2).reason, null, 'a mating attack is played out rather than skipped');
const paths = ['e4 e5 Nf3 Nc6 Bb5', 'e4 e5 Nf3 Nf6 Nxe5'].map((path) => path.split(' ').map((san) => ({ san })));
const parsed = parseCourse({ id: 'test', title: 'test', subtitle: '', side: 'w', description: '', ideas: [], chapters: [{ id: 'g', title: 'g', summary: '', pgn: pathsToPgn(paths) }] });
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.lines.length, 2);
console.log('Endpoint decisions and generated variation serialization passed.');
