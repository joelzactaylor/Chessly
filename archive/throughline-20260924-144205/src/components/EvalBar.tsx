import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { analyse, stopAnalysis, type EngineEval } from '../lib/engine';
import type { Color } from '../lib/types';

/** Vertical evaluation bar. White's share grows from the bottom when the board is White-oriented. */
export default function EvalBar({ fen, orientation, enabled = true }: { fen: string; orientation: Color; enabled?: boolean }) {
  const [ev, setEv] = useState<EngineEval | null>(null);
  const [forFen, setForFen] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    // Debounce so rapid stepping through a line does not thrash the engine.
    timer.current = window.setTimeout(() => {
      analyse(fen, (e) => { setEv(e); setForFen(fen); });
    }, 180);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [fen, enabled]);

  useEffect(() => () => stopAnalysis(), []);

  if (!enabled) return null;

  const stale = forFen !== fen;
  let whitePct = 50;
  let label = '…';
  if (ev) {
    if (ev.mate !== null) {
      whitePct = ev.mate > 0 ? 100 : 0;
      label = `M${Math.abs(ev.mate)}`;
    } else if (ev.cp !== null) {
      // Logistic squash: ±400cp ≈ 90%.
      whitePct = 100 / (1 + Math.exp(-ev.cp / 180));
      const v = ev.cp / 100;
      label = (v > 0 ? '+' : '') + v.toFixed(1);
    }
  }
  // Game over positions
  const c = new Chess(fen);
  if (c.isCheckmate()) { whitePct = c.turn() === 'w' ? 0 : 100; label = '#'; }
  else if (c.isDraw()) { whitePct = 50; label = '½'; }

  const flipped = orientation === 'b';
  const whiteOnTop = flipped;
  const topPct = whiteOnTop ? whitePct : 100 - whitePct;
  const labelOnWhite = whitePct >= 50;

  return (
    <div className={`evalbar${stale ? ' stale' : ''}`} title={ev ? `depth ${ev.depth}` : 'engine loading'}>
      <div className="evalbar-fill" style={{ height: `${topPct}%`, background: whiteOnTop ? 'var(--eval-white)' : 'var(--eval-black)' }} />
      <div className="evalbar-rest" style={{ background: whiteOnTop ? 'var(--eval-black)' : 'var(--eval-white)' }} />
      <span className={`evalbar-label ${labelOnWhite === !whiteOnTop ? 'bottom' : 'top'} ${labelOnWhite ? 'on-white' : 'on-black'}`}>{label}</span>
    </div>
  );
}
