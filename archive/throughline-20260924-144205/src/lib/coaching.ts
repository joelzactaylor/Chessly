import { Chess, type Color, type PieceSymbol } from 'chess.js';

const names: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const values: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Describe observable effects, never invent an engine's strategic reasoning. */
export function explainMove(fen: string, san: string): string {
  const board = new Chess(fen);
  const wasCheck = board.isCheck();
  const move = board.move(san);
  const facts: string[] = [];
  if (board.isCheckmate()) return `${move.san} delivers checkmate.`;
  if (wasCheck) facts.push('Get out of check first.');
  if (move.san.startsWith('O-O')) facts.push('Castle: move the king away from the centre and bring the rook into play.');
  else if (move.captured) facts.push(`Capture the ${names[move.captured]} on ${move.to}${move.flags.includes('e') ? ' en passant' : ''}.`);
  else if (move.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(move.to)) facts.push(`Put a pawn on ${move.to} to occupy the centre.`);
  else if (['n', 'b'].includes(move.piece) && move.from.endsWith(move.color === 'w' ? '1' : '8')) facts.push(`Develop the ${names[move.piece]} from ${move.from} to ${move.to}.`);
  else facts.push(`Move the ${names[move.piece]} to ${move.to}.`);
  if (move.promotion) facts.push(`Promote to a ${names[move.promotion]}.`);
  if (board.isCheck()) facts.push('This gives check, so the opponent must respond to it.');
  const targets = board.board().flat().filter((p) => p && p.color !== move.color && p.type !== 'k' && board.attackers(p.square, move.color).includes(move.to));
  if (targets.length) facts.push(`From ${move.to}, the ${names[move.promotion ?? move.piece]} attacks ${targets.map((p) => `the ${names[p!.type]} on ${p!.square}`).join(' and ')}. Check the defenders before exchanging.`);
  if (facts.length === 1) facts.push('Before playing it in a game, check the opponent’s checks, captures and threats.');
  return facts.join(' ');
}

export function positionBrief(fen: string, side: Color) {
  const board = new Chess(fen);
  const pieces = board.board().flat().filter((p) => p !== null);
  const other = side === 'w' ? 'b' : 'w';
  const home = side === 'w' ? '1' : '8';
  const own = pieces.filter((p) => p.color === side);
  const loose = own.filter((p) => p.type !== 'k' && board.isAttacked(p.square, other) && !board.isAttacked(p.square, side));
  const undeveloped = own.filter((p) => ['n', 'b'].includes(p.type) && p.square.endsWith(home));
  const king = own.find((p) => p.type === 'k')!;
  const queens = pieces.some((p) => p.type === 'q');
  const kingFile = king.square.charCodeAt(0) - 97;
  const shieldRank = side === 'w' ? '2' : '7';
  const shield = own.filter((p) => p.type === 'p' && p.square.endsWith(shieldRank) && Math.abs(p.square.charCodeAt(0) - 97 - kingFile) <= 1).length;
  const sheltered = !queens || (['b', 'c', 'g', 'h'].some((f) => king.square === f + home) && shield >= 2);
  const material = pieces.reduce((sum, p) => sum + values[p.type] * (p.color === side ? 1 : -1), 0);
  const priorities: string[] = [];
  if (board.turn() === side && board.isCheck()) priorities.push('Your king is in check: find a legal escape before considering a plan.');
  if (loose.length) priorities.push(`Check the attacked, undefended ${loose.map((p) => `${names[p.type]} on ${p.square}`).join(', ')}. Tactical compensation may exist; do not assume these pieces are safe.`);
  if (queens && !sheltered) priorities.push(`King safety first: your king on ${king.square} does not have a clear pawn shelter. Check whether castling, exchanging queens or defending the king is feasible.`);
  if (undeveloped.length) priorities.push(`Improve the ${undeveloped.map((p) => `${names[p.type]} on ${p.square}`).join(' and ')} before starting a new attack, unless tactics require otherwise.`);
  const central = own.filter((p) => p.type === 'p' && ['c', 'd', 'e', 'f'].includes(p.square[0]));
  if (central.length) priorities.push(`Before moving your central pawns (${central.map((p) => p.square).join(', ')}), check which squares and pieces they currently defend.`);
  if (material >= 2) priorities.push(`You are roughly ${material} pawns ahead in material. Consider safe piece trades; verify the resulting position before trading or grabbing more pawns.`);
  if (!priorities.length) priorities.push('Identify your least active piece, check the opponent’s forcing moves, then look for a safe improvement.');
  return { priorities: priorities.slice(0, 4), material, loose, sheltered, undeveloped };
}

export function endpointLabel(comment = ''): string {
  if (/Practical continuation|Insufficient frequency data/i.test(comment)) return 'Practice beyond the database';
  if (/Unresolved:/i.test(comment)) return 'Needs further analysis';
  if (/Stable advantage:/i.test(comment)) return 'Advantage to convert';
  if (/Settled middlegame:/i.test(comment)) return 'Middlegame handoff';
  if (/Checkmate\./i.test(comment)) return 'Checkmate';
  if (/Drawn position\./i.test(comment)) return 'Drawn position';
  return 'Study endpoint';
}
