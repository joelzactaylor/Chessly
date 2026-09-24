import { Chess } from 'chess.js';
import type { Color } from './types';
import { STOP_RULES } from '../data/rules';
import { positionBrief } from './coaching';

export interface BuildEval {
  move: string;
  /** Score from the side to move, as returned by UCI. */
  cp: number | null;
  mate: number | null;
  pv: string[];
}

export function learnerScore(chess: Chess, side: Color, evaluation: BuildEval): number | null {
  return evaluation.cp === null ? null : evaluation.cp * (chess.turn() === side ? 1 : -1);
}

/** Conservative heuristic, not a promise that a position is easy or won. */
export function assessEndpoint(chess: Chess, side: Color, evaluation: BuildEval, ply: number, streak: number) {
  const cp = learnerScore(chess, side, evaluation);
  const stable = cp !== null && cp >= STOP_RULES.advantageCp ? streak + 1 : 0;
  const probe = new Chess(chess.fen());
  let quiet = evaluation.pv.length >= 4;
  for (const uci of evaluation.pv.slice(0, 4)) {
    try {
      const move = probe.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (move.captured || move.promotion || probe.isCheck()) quiet = false;
    } catch { quiet = false; break; }
  }
  const own = chess.board().flat().filter((p) => p?.color === side);
  const home = side === 'w' ? '1' : '8';
  const undeveloped = own.filter((p) => p && ['b', 'n'].includes(p.type) && p.square.endsWith(home)).length;
  const king = own.find((p) => p?.type === 'k');
  const queens = chess.board().flat().filter((p) => p?.type === 'q').length;
  const sheltered = !!king && (queens === 0 || ['b', 'c', 'g', 'h'].some((f) => king.square === f + home));
  const brief = positionBrief(chess.fen(), side);
  const safe = !chess.isCheck() && quiet && sheltered && brief.sheltered && !brief.loose.some((piece) => piece.type !== 'p');
  let reason: string | null = null;
  if (safe && stable >= STOP_RULES.stableAssessments && ply >= STOP_RULES.settledMinPly) {
    reason = `Stable advantage: at least +${(STOP_RULES.advantageCp / 100).toFixed(1)} for you over ${STOP_RULES.stableAssessments} assessments, with a quiet engine continuation. Convert by keeping your king safe, improving your least active piece, and trading when it preserves the advantage. This is not a forced win.`;
  } else if (safe && evaluation.mate === null && cp !== null && cp >= -30 && ply >= STOP_RULES.settledMinPly && undeveloped <= 1) {
    reason = 'Settled middlegame: development is mostly complete, your king is sheltered, the engine sees no disadvantage beyond 0.3 pawns, and its next four plies are quiet. Continue by improving your least active piece and checking pawn breaks. This is a practical handoff, not a guaranteed easy game.';
  }
  return { stable, reason };
}
