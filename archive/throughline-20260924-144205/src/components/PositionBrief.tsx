import { positionBrief } from '../lib/coaching';
import type { Color } from '../lib/types';

export default function PositionBrief({ fen, side }: { fen: string; side: Color }) {
  const brief = positionBrief(fen, side);
  return <div className="card">
    <div className="eyebrow">Take this into your next game</div>
    <p className="muted" style={{ fontSize: 13 }}>Board-based checkpoints, not a promise that the position is easy.</p>
    <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
      {brief.priorities.map((text) => <li key={text}>{text}</li>)}
    </ul>
  </div>;
}
