import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { learn, lookup } from './repertoire';

const pgn = `[Event "First lesson"]
1. e4 {Centre control} e5 (1... c5 {Sicilian}) 2. Nf3 *
[Event "Second lesson"]
1. d4 d5 2. c4 *`;
const k = learn(pgn, 'test');
assert.equal(k.games, 2);
assert.equal(k.lines, 3);
assert.deepEqual(lookup(k, new Chess().fen()).map(m => m.san), ['e4', 'd4']);
assert.deepEqual(lookup(k, new Chess().fen())[0].notes, ['Centre control']);
const board = new Chess(); board.move('e4');
assert.deepEqual(lookup(k, board.fen()).map(m => m.san), ['e5', 'c5']);
assert.equal(lookup(k, board.fen().replace('0 1', '9 15')).length, 2);
assert.equal(learn('1.e4 e5 *\n1.d4 d5 *', 'test').games, 2);
assert.equal(learn('[Event "A"]\n1.e4 e5\n[Event "B"]\n1.d4 d5', 'test').games, 2);
assert.equal(learn('1.e4 {Comment with [text] and 1-0} e5 *', 'test').games, 1);
assert.throws(() => learn('1.e4 (1.d4', 'test'), /Unterminated/);
assert.throws(() => learn('1.e4 )', 'test'), /Unbalanced/);
assert.throws(() => learn('1.e5', 'test'), /Illegal/);
assert.throws(() => learn('[FEN "custom"]\n1.e4', 'test'), /custom FEN/);
assert.throws(() => learn('no chess here', 'test'));
// Every stored answer is legal at its indexed position.
for (const [position, choices] of Object.entries(k.positions)) {
  for (const choice of choices) assert.doesNotThrow(() => new Chess(`${position} 0 1`).move(choice.san));
}
console.log('Course learning: all checks passed.');
