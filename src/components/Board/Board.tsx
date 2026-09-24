import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  FILES,
  checkedKingSquare,
  frToSquare,
  squareToFR,
} from "../../lib/chessUtils";
import type { Color } from "../../lib/types";
import "./board.css";

export type SquareMark = "hint" | "wrong" | "right";
export interface Arrow {
  from: string;
  to: string;
  color?: string;
}

export interface BoardProps {
  fen: string;
  orientation: Color;
  lastMove?: { from: string; to: string } | null;
  marks?: Record<string, SquareMark>;
  arrows?: Arrow[];
  /** Which colour the user may move; undefined = board is view-only. */
  movable?: Color;
  /** Called with the attempted move. Return false to reject it (piece snaps back). */
  onMove?: (from: string, to: string, promotion?: string) => boolean | void;
  showCoordinates?: boolean;
  showLegalMoves?: boolean;
  theme?: string;
  /** Disable the sliding animation for the next render (e.g. when jumping between positions). */
  animate?: boolean;
  shakeKey?: number;
}

interface PieceEl {
  id: number;
  type: string;
  color: Color;
  square: string;
  fading?: boolean;
  animationFrom?: string;
}

interface AnimationMove {
  from: string;
  to: string;
}

let nextId = 1;

function pieceMap(fen: string): Map<string, { type: string; color: Color }> {
  const c = new Chess(fen);
  const out = new Map<string, { type: string; color: Color }>();
  for (const row of c.board())
    for (const p of row)
      if (p) out.set(p.square, { type: p.type, color: p.color });
  return out;
}

/** Reconcile the piece elements so that moved pieces keep their id (and therefore animate). */
function reconcile(
  prev: PieceEl[],
  fen: string,
  moves: AnimationMove[] = [],
): PieceEl[] {
  const next = pieceMap(fen);
  const used = new Set<number>();
  const out: PieceEl[] = [];
  const prevBySquare = new Map(
    prev.filter((p) => !p.fading).map((p) => [p.square, p]),
  );
  const vacated: PieceEl[] = [];
  for (const p of prev) {
    if (p.fading) continue;
    const n = next.get(p.square);
    if (!n || n.type !== p.type || n.color !== p.color) vacated.push(p);
  }
  for (const [sq, n] of next) {
    const same = prevBySquare.get(sq);
    if (same && same.type === n.type && same.color === n.color) {
      out.push(same);
      used.add(same.id);
      continue;
    }
    // Prefer an explicitly moved piece, then fall back to a same-kind piece.
    let match = vacated.find((v) =>
      moves.some(
        (move) =>
          !used.has(v.id) &&
          v.type === n.type &&
          v.color === n.color &&
          v.square === move.from &&
          sq === move.to,
      ),
    );
    if (!match)
      match = vacated.find(
        (v) => !used.has(v.id) && v.type === n.type && v.color === n.color,
      );
    // Promotion: pawn from lastMove.from becomes a new piece type on lastMove.to.
    const promotionMove = moves.find((move) => move.to === sq);
    if (!match && promotionMove)
      match = vacated.find(
        (v) =>
          !used.has(v.id) &&
          v.type === "p" &&
          v.color === n.color &&
          v.square === promotionMove.from,
      );
    if (match) {
      used.add(match.id);
      out.push({
        ...match,
        type: n.type,
        square: sq,
        animationFrom: match.square !== sq ? match.square : undefined,
      });
    } else {
      out.push({ id: nextId++, type: n.type, color: n.color, square: sq });
    }
  }
  // Pieces that vanished (captures) linger briefly and fade out in place.
  for (const v of vacated)
    if (!used.has(v.id)) out.push({ ...v, fading: true });
  return out;
}

export default function Board({
  fen,
  orientation,
  lastMove,
  marks,
  arrows,
  movable,
  onMove,
  showCoordinates = true,
  showLegalMoves = true,
  theme = "walnut",
  animate = true,
  shakeKey,
}: BoardProps) {
  const [pieces, setPieces] = useState<PieceEl[]>(() => reconcile([], fen));
  const [noAnim, setNoAnim] = useState(!animate);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: number;
    from: string;
    x: number;
    y: number;
  } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastFen = useRef(fen);

  useEffect(() => {
    if (fen === lastFen.current) return;
    const previousPosition = new Chess(lastFen.current);
    lastFen.current = fen;
    setNoAnim(!animate);
    const wasDragging = drag !== null;
    const animationMoves: AnimationMove[] = lastMove ? [lastMove] : [];
    const movingPiece = lastMove
      ? previousPosition.get(lastMove.from as Square)
      : null;
    if (
      movingPiece?.type === "k" &&
      lastMove &&
      Math.abs(lastMove.from.charCodeAt(0) - lastMove.to.charCodeAt(0)) === 2
    ) {
      const rank = lastMove.from[1];
      animationMoves.push(
        lastMove.to[0] === "g"
          ? { from: `h${rank}`, to: `f${rank}` }
          : { from: `a${rank}`, to: `d${rank}` },
      );
    }
    setPieces((prev) => {
      const next = reconcile(prev, fen, animationMoves);
      return animate
        ? next.map((piece) =>
          wasDragging ? { ...piece, animationFrom: undefined } : piece,
        )
        : next.map((piece) => ({ ...piece, animationFrom: undefined }));
    });
    setSelected(null);
    setPromo(null);
    setHover(null);
    const releaseFrame = window.requestAnimationFrame(() => {
      setDrag(null);
      if (animate && !wasDragging) {
        window.requestAnimationFrame(() =>
          setPieces((prev) =>
            prev.map((piece) =>
              piece.animationFrom
                ? { ...piece, animationFrom: undefined }
                : piece,
            ),
          ),
        );
      }
    });
    const t = window.setTimeout(
      () => setPieces((prev) => prev.filter((p) => !p.fading)),
      120,
    );
    return () => {
      window.cancelAnimationFrame(releaseFrame);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  useEffect(() => {
    if (noAnim) {
      const t = requestAnimationFrame(() => setNoAnim(false));
      return () => cancelAnimationFrame(t);
    }
  }, [noAnim]);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const turn = chess.turn();
  const checkSq = useMemo(() => checkedKingSquare(fen), [fen]);
  const canMove = !!movable && movable === turn && !!onMove;

  const legalTargets = useMemo(() => {
    if (!selected || !canMove) return new Map<string, boolean>();
    const out = new Map<string, boolean>();
    for (const m of chess.moves({ square: selected as Square, verbose: true }))
      out.set(m.to, !!m.captured);
    return out;
  }, [selected, chess, canMove]);

  function squareAt(clientX: number, clientY: number): string | null {
    const el = wrapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top) / r.height;
    if (x < 0 || x >= 1 || y < 0 || y >= 1) return null;
    let file = Math.floor(x * 8);
    let rank = 7 - Math.floor(y * 8);
    if (orientation === "b") {
      file = 7 - file;
      rank = 7 - rank;
    }
    return frToSquare(file, rank);
  }

  function tryMove(from: string, to: string) {
    if (!canMove || !onMove) return false;
    const moves = chess.moves({ square: from as Square, verbose: true });
    const candidates = moves.filter((m) => m.to === to);
    if (!candidates.length) return false;
    if (candidates.some((m) => m.promotion)) {
      setPromo({ from, to });
      return true;
    }
    const ok = onMove(from, to);
    if (ok === false) setSelected(null);
    return ok !== false;
  }

  function ownPieceAt(sq: string): boolean {
    const p = chess.get(sq as Square);
    return !!p && p.color === turn && canMove;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (promo) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (selected && sq !== selected && legalTargets.has(sq)) {
      tryMove(selected, sq);
      setSelected(null);
      return;
    }
    if (ownPieceAt(sq)) {
      const piece = pieces.find((p) => p.square === sq && !p.fading);
      if (!piece) return;
      setSelected(sq);
      setDrag({ id: piece.id, from: sq, x: e.clientX, y: e.clientY });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    } else {
      setSelected(null);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    setHover(squareAt(e.clientX, e.clientY));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const to = squareAt(e.clientX, e.clientY);
    const from = drag.from;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    setHover(null);
    if (to && to !== from) {
      const moved = tryMove(from, to);
      if (moved) {
        setSelected(null);
        // Keep the piece at the release point until the parent supplies the new FEN.
      } else {
        setDrag(null);
        if (legalTargets.has(to))
          setSelected(null); // legal but rejected by the trainer
        else setSelected(from);
      }
    } else {
      setDrag(null);
      // A click without drag keeps the selection so the user can click the target.
      setSelected(from);
    }
  }

  // Layout helpers
  const rect = wrapRef.current?.getBoundingClientRect();
  function pieceTransform(p: PieceEl): string {
    if (drag && drag.id === p.id && rect) {
      const size = rect.width / 8;
      const x = drag.x - rect.left - size / 2;
      const y = drag.y - rect.top - size / 2;
      return `translate(${x}px, ${y}px) scale(1.08)`;
    }
    const { file, rank } = squareToFR(p.animationFrom ?? p.square);
    const col = orientation === "w" ? file : 7 - file;
    const row = orientation === "w" ? 7 - rank : rank;
    return `translate(${col * 100}%, ${row * 100}%)`;
  }

  const squares: JSX.Element[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const file = orientation === "w" ? col : 7 - col;
      const rank = orientation === "w" ? 7 - row : row;
      const sq = frToSquare(file, rank);
      const light = (file + rank) % 2 === 1;
      const cls = ["sq", light ? "light" : "dark"];
      if (lastMove && (sq === lastMove.from || sq === lastMove.to))
        cls.push("last");
      if (selected === sq) cls.push("selected");
      if (checkSq === sq) cls.push("check");
      const mark = marks?.[sq];
      if (mark) cls.push(mark);
      if (showLegalMoves && legalTargets.has(sq)) {
        cls.push("dot");
        if (legalTargets.get(sq)) cls.push("capture");
      }
      if (drag && hover === sq) cls.push("hover");
      squares.push(
        <div
          key={sq + (mark ? "-" + mark : "")}
          className={cls.join(" ")}
          data-sq={sq}
        >
          {showCoordinates && col === 7 && (
            <span className="coord rank">{rank + 1}</span>
          )}
          {showCoordinates && row === 7 && (
            <span className="coord file">{FILES[file]}</span>
          )}
        </div>,
      );
    }
  }

  function center(sq: string): { x: number; y: number } {
    const { file, rank } = squareToFR(sq);
    const col = orientation === "w" ? file : 7 - file;
    const row = orientation === "w" ? 7 - rank : rank;
    return { x: col * 12.5 + 6.25, y: row * 12.5 + 6.25 };
  }

  const promoColor: Color = turn;

  return (
    <div className={`board-wrap${shakeKey ? " shake" : ""}`} key={shakeKey}>
      <div
        ref={wrapRef}
        className={`board theme-${theme}${canMove ? "" : " locked"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          setDrag(null);
          setHover(null);
        }}
      >
        <div className="squares">{squares}</div>
        <div className="pieces">
          {pieces.map((p) => (
            <div
              key={p.id}
              className={`piece${noAnim ? " no-anim" : ""}${drag?.id === p.id ? " dragging" : ""}${p.fading ? " fading" : ""}`}
              style={{
                transform: pieceTransform(p),
                backgroundImage: `url(${import.meta.env.BASE_URL}pieces/neo/${p.color}${p.type}.png)`,
                transition:
                  p.fading || drag?.id === p.id
                    ? "none"
                    : animate && !noAnim
                      ? "transform .34s cubic-bezier(.25,.8,.25,1)"
                      : "none",
              }}
            />
          ))}
        </div>
        {arrows && arrows.length > 0 && (
          <svg className="arrows" viewBox="0 0 100 100">
            {arrows.map((a) => {
              const f = center(a.from);
              const t = center(a.to);
              const dx = t.x - f.x;
              const dy = t.y - f.y;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const px = -uy;
              const py = ux;
              const shaftStart = 5;
              const headStart = Math.max(shaftStart + 3, len - 3.5);
              const shaftHalf = 1.1;
              const headHalf = 2.5;
              const point = (distance: number, offset: number) =>
                `${f.x + ux * distance + px * offset},${f.y + uy * distance + py * offset}`;
              return (
                <polygon
                  key={`${a.from}${a.to}`}
                  className="arrow"
                  points={[
                    point(shaftStart, -shaftHalf),
                    point(headStart, -shaftHalf),
                    point(headStart, -headHalf),
                    point(len, 0),
                    point(headStart, headHalf),
                    point(headStart, shaftHalf),
                    point(shaftStart, shaftHalf),
                  ].join(" ")}
                  fill={a.color ?? "rgba(232,163,61,.9)"}
                />
              );
            })}
          </svg>
        )}
        {promo && (
          <div className="promo">
            {["q", "r", "b", "n"].map((t) => (
              <button
                key={t}
                aria-label={`Promote to ${{ q: "queen", r: "rook", b: "bishop", n: "knight" }[t]}`}
                style={{
                  backgroundImage: `url(${import.meta.env.BASE_URL}pieces/neo/${promoColor}${t}.png)`,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const p = promo;
                  setPromo(null);
                  const moved = onMove?.(p.from, p.to, t);
                  if (moved === false) {
                    setDrag(null);
                    setSelected(null);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
