import { Chess } from 'chess.js';
import type { Color } from './types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Board + turn + castling + en-passant. Ignores the clocks so transpositions match. */
export function posKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function turnOf(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/** 0-based file/rank of a square name, rank 0 = rank 1. */
export function squareToFR(sq: string): { file: number; rank: number } {
  return { file: sq.charCodeAt(0) - 97, rank: parseInt(sq[1], 10) - 1 };
}

export function frToSquare(file: number, rank: number): string {
  return FILES[file] + (rank + 1);
}

/** "12." for white moves, "12..." for black moves. */
export function moveLabel(moveNumber: number, color: Color): string {
  return color === 'w' ? `${moveNumber}.` : `${moveNumber}...`;
}

export function safeChess(fen: string): Chess {
  const c = new Chess();
  c.load(fen);
  return c;
}

/** Returns the king square of the side to move if it is in check, else null. */
export function checkedKingSquare(fen: string): string | null {
  const c = safeChess(fen);
  if (!c.inCheck()) return null;
  const turn = c.turn();
  const board = c.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p && p.type === 'k' && p.color === turn) return p.square;
    }
  }
  return null;
}

/** Rook from/to squares for a castling move, given the king's move. */
export function castlingRookMove(from: string, to: string, san: string): { from: string; to: string } | null {
  if (!san.startsWith('O-O')) return null;
  const rank = from[1];
  if (to[0] === 'g') return { from: `h${rank}`, to: `f${rank}` };
  if (to[0] === 'c') return { from: `a${rank}`, to: `d${rank}` };
  return null;
}
