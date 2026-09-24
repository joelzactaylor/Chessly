export default function MoveControls({ ply, total, first, previous, next, last, onFirst, onPrevious, onNext, onLast }: {
  ply: number; total: number; first: boolean; previous: boolean; next: boolean; last: boolean;
  onFirst: () => void; onPrevious: () => void; onNext: () => void; onLast: () => void;
}) {
  const icon = (end: boolean, forward: boolean) => <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={forward ? { transform: 'rotate(180deg)' } : undefined}>
    {end && <path d="M4 4v12" />}<path d={end ? 'm14 5-5 5 5 5' : 'm12 5-5 5 5 5'} />
  </svg>;
  return <div className="board-controls" role="group" aria-label="Move navigation">
    <button className="button outline" disabled={!first} onClick={onFirst} aria-label="First position" title="First position">{icon(true,false)}</button>
    <button className="button outline" disabled={!previous} onClick={onPrevious} aria-label="Previous move" title="Previous move">{icon(false,false)}</button>
    <span aria-label="Move progress">{ply} / {total} moves</span>
    <button className="button outline" disabled={!next} onClick={onNext} aria-label="Next move" title="Next move">{icon(false,true)}</button>
    <button className="button outline" disabled={!last} onClick={onLast} aria-label="Last position" title="Last position">{icon(true,true)}</button>
  </div>;
}
