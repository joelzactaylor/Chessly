import { masteryOf, type LineState, type Mastery } from '../lib/srs';
import type { Line } from '../lib/types';
import { moveLabel } from '../lib/chessUtils';
import type { RepNode } from '../lib/types';

export const MASTERY_LABEL: Record<Mastery, string> = { new: 'New', learning: 'Learning', familiar: 'Familiar', mastered: 'Mastered' };

export function MasteryChip({ state, due }: { state?: LineState; due?: boolean }) {
  const m = masteryOf(state);
  if (due) return <span className="chip due">Due</span>;
  return <span className={`chip ${m}`}>{MASTERY_LABEL[m]}</span>;
}

export function SideChip({ side }: { side: 'w' | 'b' }) {
  return <span className={`chip side-${side}`}><span className="dot" />{side === 'w' ? 'White' : 'Black'}</span>;
}

export function MasteryBar({ lines, states }: { lines: Line[]; states: Record<string, LineState> }) {
  const n = lines.length || 1;
  const counts = { learning: 0, familiar: 0, mastered: 0 };
  for (const l of lines) {
    const m = masteryOf(states[l.id]);
    if (m !== 'new') counts[m]++;
  }
  return (
    <div className="bar" title={`${counts.mastered} mastered · ${counts.familiar} familiar · ${counts.learning} learning`}>
      <span className="mastered" style={{ width: `${(100 * counts.mastered) / n}%` }} />
      <span className="familiar" style={{ width: `${(100 * counts.familiar) / n}%` }} />
      <span className="learning" style={{ width: `${(100 * counts.learning) / n}%` }} />
    </div>
  );
}

export function MoveList({ nodes, current, onSelect, futureFrom }: { nodes: RepNode[]; current: number; onSelect?: (i: number) => void; futureFrom?: number }) {
  const items: JSX.Element[] = [];
  nodes.forEach((n, i) => {
    if (n.color === 'w' || i === 0) items.push(<span key={`n${i}`} className="num">{moveLabel(n.moveNumber, n.color!)}</span>);
    const cls = ['mv'];
    if (n.userMove) cls.push('user');
    if (i === current - 1) cls.push('current');
    if (futureFrom !== undefined && i >= futureFrom) cls.push('future');
    items.push(
      <span key={i} className={cls.join(' ')} onClick={() => onSelect?.(i + 1)}>
        {n.san}{n.nag && <span className="nag">{n.nag}</span>}
      </span>,
    );
  });
  return <div className="movelist">{items}</div>;
}

export function GradeFace({ grade }: { grade: number }) {
  return <span className="grade">{grade === 3 ? '★' : grade === 2 ? '✓' : grade === 1 ? '~' : '✗'}</span>;
}

export function formatDue(due: number, now = Date.now()): string {
  const d = Math.ceil((due - now) / 86_400_000);
  if (due <= now) return 'due now';
  if (d <= 1) return 'tomorrow';
  if (d < 30) return `in ${d} days`;
  return `in ${Math.round(d / 30)} mo`;
}
