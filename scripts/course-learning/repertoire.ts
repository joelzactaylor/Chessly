import { Chess } from 'chess.js';
import { makeRoot, parseMovetext, tokenize } from '../../src/lib/pgn';
import { posKey } from '../../src/lib/chessUtils';
import type { RepNode } from '../../src/lib/types';

export interface Knowledge {
  version: 1;
  source: string;
  games: number;
  lines: number;
  positions: Record<string, { san: string; uci: string; notes: string[]; lessons: string[] }[]>;
}

export function learn(pgn: string, source: string): Knowledge {
  const result: Knowledge = { version: 1, source, games: 0, lines: 0, positions: {} };
  // Separate games at a new header block or a top-level result; comments may contain either.
  const games: { title: string; moves: string }[] = [];
  let headers: Record<string, string> = {}, moves = '', braces = false, depth = 0;
  function finish() {
    if (moves.trim()) {
      if (headers.FEN) throw new Error('PGNs with a custom FEN are not supported; export full lines from the starting position.');
      games.push({ title: headers.Event || headers.Chapter || `Lesson ${games.length + 1}`, moves });
    }
    headers = {}; moves = '';
  }
  const input = pgn.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < input.length;) {
    const rest = input.slice(i);
    if (!braces && depth === 0 && input[i] === '[') {
      const tag = rest.match(/^\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\s*\]/);
      if (!tag) throw new Error('Invalid PGN header.');
      if (moves.trim()) finish();
      headers[tag[1]] = tag[2]; i += tag[0].length; continue;
    }
    if (!braces && input[i] === ';') {
      const end = input.indexOf('\n', i); i = end < 0 ? input.length : end;
      moves += '\n'; continue;
    }
    if (!braces && depth === 0) {
      const end = rest.match(/^(1-0|0-1|1\/2-1\/2|\*)(?=\s|$|\[)/);
      if (end) { moves += end[0]; i += end[0].length; finish(); continue; }
    }
    const ch = input[i++]; moves += ch;
    if (ch === '{' && !braces) braces = true;
    else if (ch === '}' && braces) braces = false;
    else if (!braces && ch === '(') depth++;
    else if (!braces && ch === ')' && --depth < 0) throw new Error('Unbalanced PGN variation.');
  }
  if (braces || depth) throw new Error('Unterminated PGN comment or variation.');
  finish();
  for (const game of games) {
    if (!tokenize(game.moves).some(t => t.t === 'move')) continue;
    const root = makeRoot();
    const { errors } = parseMovetext(game.moves, root, 'w');
    if (errors.length) throw new Error(`${game.title}: ${errors.join('; ')}`);
    result.games++;
    function visit(node: RepNode) {
      if (!node.children.length && node.parent) result.lines++;
      for (const child of node.children) {
        const choices = result.positions[posKey(node.fen)] ??= [];
        let move = choices.find(m => m.uci === child.uci);
        if (!move) { move = { san: child.san, uci: child.uci, notes: [], lessons: [] }; choices.push(move); }
        if (child.comment && !move.notes.includes(child.comment)) move.notes.push(child.comment);
        if (!move.lessons.includes(game.title)) move.lessons.push(game.title);
        visit(child);
      }
    }
    visit(root);
  }
  if (!result.games) throw new Error('No chess moves found. Supply a PGN export or captured PGN file.');
  return result;
}

export function lookup(knowledge: Knowledge, fen: string) {
  const chess = new Chess(fen);
  return knowledge.positions[posKey(chess.fen())] ?? [];
}
