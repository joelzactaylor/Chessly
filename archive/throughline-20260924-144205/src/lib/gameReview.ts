import { Chess } from 'chess.js';
import type { Color, Line, RepNode } from './types';
import { posKey } from './chessUtils';

export interface GameReview {
  matched: number;
  checked: number;
  deviation?: { fen: string; played: string; expected: RepNode; line: Line; moveNumber: number };
  uncovered?: { fen: string; played: string; moveNumber: number };
}

/** Compare only positions actually represented by this learner's repertoire. */
export function reviewGame(pgn: string, side: Color, lines: Line[]): GameReview {
  if (!pgn.trim()) throw new Error('Paste a game in PGN format first.');
  if (pgn.length > 200_000) throw new Error('Please paste one game at a time.');
  const game = new Chess();
  try { game.loadPgn(pgn); } catch { throw new Error('This PGN could not be read. Export one game as PGN and try again.'); }
  const history = game.history({ verbose: true });
  if (!history.length) throw new Error('No moves were found in the PGN.');
  const answers = new Map<string, { expected: RepNode; line: Line }>();
  for (const line of lines) for (const node of line.nodes) {
    if (node.userMove && node.color === side && !answers.has(node.parent!.key)) answers.set(node.parent!.key, { expected: node, line });
  }
  const result: GameReview = { matched: 0, checked: 0 };
  for (const move of history) {
    if (move.color !== side) continue;
    const answer = answers.get(posKey(move.before));
    if (!answer) {
      result.uncovered = { fen: move.before, played: move.san, moveNumber: +move.before.split(' ')[5] };
      break;
    }
    result.checked++;
    const uci = move.from + move.to + (move.promotion ?? '');
    if (answer.expected.uci !== uci) {
      result.deviation = { ...answer, fen: move.before, played: move.san, moveNumber: +move.before.split(' ')[5] };
      break;
    }
    result.matched++;
  }
  return result;
}
