import { Chess } from 'chess.js';
import { posKey, START_FEN } from './chessUtils';
import type { Color, RepNode } from './types';

type Token =
  | { t: 'move'; v: string; nag?: string; line: number; num?: number; black?: boolean }
  | { t: 'comment'; v: string; line: number }
  | { t: 'open'; line: number }
  | { t: 'close'; line: number }
  | { t: 'result'; line: number };

const MOVE_RE = /^(O-O-O|O-O|0-0-0|0-0|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x?[a-h]?[1-8](=[QRBN])?|[a-h][1-8](=[QRBN])?)[+#]?/;
const RESULT_RE = /^(1-0|0-1|1\/2-1\/2|\*)(?=\s|$|\))/;
const MOVENUM_RE = /^(\d+)\.(\.\.)?\s*/;

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let pendingNum: { num: number; black: boolean } | undefined;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') { line++; i++; continue; }
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '{') {
      const end = src.indexOf('}', i);
      if (end < 0) throw new Error(`Unterminated comment at line ${line}`);
      const raw = src.slice(i + 1, end);
      line += (raw.match(/\n/g) ?? []).length;
      tokens.push({ t: 'comment', v: raw.replace(/\s+/g, ' ').trim(), line });
      i = end + 1;
      continue;
    }
    if (ch === '(') { tokens.push({ t: 'open', line }); i++; continue; }
    if (ch === ')') { tokens.push({ t: 'close', line }); i++; continue; }
    if (ch === ';') { // line comment
      const end = src.indexOf('\n', i);
      i = end < 0 ? src.length : end;
      continue;
    }
    if (ch === '$') { // numeric NAG: skip
      i++;
      while (i < src.length && /\d/.test(src[i])) i++;
      continue;
    }
    const rest = src.slice(i);
    const rm = rest.match(RESULT_RE);
    if (rm) { tokens.push({ t: 'result', line }); i += rm[0].length; continue; }
    const nm = rest.match(MOVENUM_RE);
    if (nm) { pendingNum = { num: parseInt(nm[1], 10), black: !!nm[2] }; i += nm[0].length; continue; }
    const mm = rest.match(MOVE_RE);
    if (mm) {
      let v = mm[0].replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
      i += mm[0].length;
      // quality suffix
      const sm = src.slice(i).match(/^[!?]{1,2}/);
      let nag: string | undefined;
      if (sm) { nag = sm[0]; i += sm[0].length; }
      tokens.push({ t: 'move', v, nag, line, num: pendingNum?.num, black: pendingNum?.black });
      pendingNum = undefined;
      continue;
    }
    throw new Error(`Unexpected text at line ${line}: "${rest.slice(0, 20)}"`);
  }
  return tokens;
}

export function makeRoot(): RepNode {
  return {
    key: posKey(START_FEN),
    fen: START_FEN,
    san: '',
    uci: '',
    ply: 0,
    moveNumber: 0,
    children: [],
    parent: null,
    userMove: false,
  };
}

/**
 * Parse PGN movetext into a tree hanging off `root`. Existing children are reused
 * (so several chapters or several PGN strings can be merged into one tree).
 * `side` is the learner's colour, used to mark user moves.
 */
export function parseMovetext(src: string, root: RepNode, side: Color): { errors: string[] } {
  const errors: string[] = [];
  let tokens: Token[];
  try {
    tokens = tokenize(src);
  } catch (e) {
    return { errors: [(e as Error).message] };
  }
  let pos = 0;

  function applyMove(node: RepNode, tok: Extract<Token, { t: 'move' }>): RepNode | null {
    const existing = node.children.find((c) => c.san === tok.v || c.san.replace(/[+#]/g, '') === tok.v.replace(/[+#]/g, ''));
    if (existing) {
      if (tok.nag && !existing.nag) existing.nag = tok.nag;
      return existing;
    }
    const chess = new Chess();
    chess.load(node.fen);
    let mv;
    try {
      mv = chess.move(tok.v);
    } catch {
      mv = null;
    }
    if (!mv) {
      errors.push(`Illegal move "${tok.v}" at line ${tok.line} after ${describePath(node)}`);
      return null;
    }
    const fen = chess.fen();
    const color: Color = mv.color;
    const child: RepNode = {
      key: posKey(fen),
      fen,
      san: mv.san,
      uci: mv.from + mv.to + (mv.promotion ?? ''),
      from: mv.from,
      to: mv.to,
      promotion: mv.promotion,
      ply: node.ply + 1,
      moveNumber: Math.floor(node.ply / 2) + 1,
      color,
      nag: tok.nag,
      children: [],
      parent: node,
      userMove: color === side,
    };
    node.children.push(child);
    return child;
  }

  // Parses a sequence until ')' or end. `start` is the node before the first move.
  function parseSeq(start: RepNode): void {
    let current = start;
    let lastMove: RepNode | null = null;
    while (pos < tokens.length) {
      const tok = tokens[pos];
      if (tok.t === 'close') { pos++; return; }
      if (tok.t === 'result') { pos++; continue; }
      if (tok.t === 'comment') {
        pos++;
        if (current.comment && current.comment !== tok.v) current.comment = current.comment + ' ' + tok.v;
        else current.comment = tok.v;
        continue;
      }
      if (tok.t === 'open') {
        pos++;
        // A variation whose first move carries a move number ("5...f5" or "7.Nxe4") is an
        // alternative at that point of the current path, wherever it is written. Without a
        // number it is a standard PGN variation: an alternative to the last move played.
        const first = tokens[pos];
        let branchFrom: RepNode;
        if (first && first.t === 'move' && first.num !== undefined) {
          const targetPly = (first.num - 1) * 2 + (first.black ? 1 : 0);
          let n: RepNode | null = current;
          while (n && n.ply > targetPly) n = n.parent;
          if (!n || n.ply !== targetPly) {
            errors.push(`Variation "${first.v}" at line ${first.line}: move ${first.num}${first.black ? '...' : '.'} is not on the current path (${describePath(current)})`);
            skipToClose();
            continue;
          }
          branchFrom = n;
        } else {
          branchFrom = lastMove ? lastMove.parent! : current;
        }
        parseSeq(branchFrom);
        continue;
      }
      // move
      pos++;
      // Sanity check: a numbered move must match the position's move number and colour.
      if (tok.num !== undefined) {
        const expectPly = (tok.num - 1) * 2 + (tok.black ? 1 : 0);
        if (expectPly !== current.ply) {
          errors.push(`Move "${tok.num}${tok.black ? '...' : '.'}${tok.v}" at line ${tok.line} is numbered wrongly: the position after ${describePath(current)} is ply ${current.ply}`);
        }
      }
      const next = applyMove(current, tok);
      if (!next) {
        skipToClose();
        return;
      }
      current = next;
      lastMove = next;
    }
  }

  // Skip the rest of the current sequence up to and including its closing paren.
  function skipToClose(): void {
    let depth = 0;
    while (pos < tokens.length) {
      const t = tokens[pos];
      if (t.t === 'open') depth++;
      if (t.t === 'close') { if (depth === 0) { pos++; return; } depth--; }
      pos++;
    }
  }

  parseSeq(root);
  if (pos < tokens.length) {
    const t = tokens[pos - 1];
    errors.push(`Unbalanced ')' at line ${t?.line ?? '?'}: ${tokens.length - pos} tokens after it were ignored`);
  }
  return { errors };
}

export function describePath(node: RepNode): string {
  const parts: string[] = [];
  let n: RepNode | null = node;
  while (n && n.parent) {
    parts.unshift(n.color === 'w' ? `${n.moveNumber}.${n.san}` : n.san);
    n = n.parent;
  }
  return parts.length ? parts.join(' ') : '(start)';
}
