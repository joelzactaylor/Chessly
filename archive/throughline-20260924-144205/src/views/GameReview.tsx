import { useState } from 'react';
import { allLines, lineIndexInChapter } from '../state/courses';
import { reviewGame, type GameReview as Review } from '../lib/gameReview';
import { explainMove } from '../lib/coaching';
import { href } from '../state/router';
import { useProgress } from '../state/store';
import type { Color } from '../lib/types';
import Board from '../components/Board/Board';
import PositionBrief from '../components/PositionBrief';

export default function GameReview() {
  const [pgn, setPgn] = useState('');
  const [side, setSide] = useState<Color>('w');
  const [result, setResult] = useState<Review | null>(null);
  const [error, setError] = useState('');
  const settings = useProgress((s) => s.settings);
  const point = result?.deviation ?? result?.uncovered;
  const deviation = result?.deviation;
  return <div className="page narrow fade-in">
    <h1 className="title-l">Review my game</h1>
    <p className="muted" style={{ marginTop: 8 }}>Find the first opening decision to revisit, then study it before your next game. This checks repertoire recall, not whether a different move was bad.</p>
    <form className="card" style={{ marginTop: 18, display: 'grid', gap: 12 }} onSubmit={(event) => {
      event.preventDefault(); setError(''); setResult(null);
      try { setResult(reviewGame(pgn, side, allLines)); } catch (e) { setError((e as Error).message); }
    }}>
      <label htmlFor="review-side">I played</label>
      <select id="review-side" value={side} onChange={(e) => { setSide(e.target.value as Color); setResult(null); }} style={{ background: 'var(--surface-2)', padding: 8 }}><option value="w">White</option><option value="b">Black</option></select>
      <label htmlFor="review-pgn">Game PGN</label>
      <textarea id="review-pgn" rows={7} value={pgn} onChange={(e) => { setPgn(e.target.value); setResult(null); }} placeholder="1. e4 e5 2. Nc3 ..." style={{ width: '100%', resize: 'vertical', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 8, padding: 12 }} />
      <div className="btn-row"><button className="btn primary" disabled={!allLines.length}>Find my study target</button><span className="faint">Your PGN stays in this page; it is not uploaded.</span></div>
      {!allLines.length && <p className="muted">Generate courses in Settings first so there is a repertoire to compare against.</p>}
      {error && <p role="alert" style={{ color: 'var(--red-2)' }}>{error}</p>}
    </form>
    {result && <div className="card" style={{ marginTop: 18 }}>
      <h2 className="title-m">{deviation ? 'Your next study target' : result.uncovered ? 'You reached the edge of your repertoire' : 'You followed your repertoire throughout this game'}</h2>
      <p className="muted" style={{ marginTop: 8 }}>{result.matched} consecutive repertoire decisions recalled before this point. This measures familiarity, not your playing strength or the opening evaluation.</p>
      {point && <div className="grid cols-2" style={{ marginTop: 18, alignItems: 'start' }}>
        <Board fen={point.fen} orientation={side} theme={settings.boardTheme} showCoordinates={settings.showCoordinates} />
        <div className="panel">
          <div className="card">
            <p>You played {point.moveNumber}{side === 'w' ? '.' : '...'}{point.played}.</p>
            {deviation ? <>
              <p>Your repertoire move: <span className="move-tag user">{deviation.expected.san}</span></p>
              <p>{explainMove(point.fen, deviation.expected.san)}</p>
              <div className="btn-row"><a className="btn primary" href={href.learn(deviation.line.courseId, deviation.line.chapterId, lineIndexInChapter(deviation.line))}>Study this line</a><a className="btn" href={href.drillLine(deviation.line.courseId, deviation.line.chapterId, lineIndexInChapter(deviation.line))}>Test from memory</a></div>
            </> : <p className="muted">No stored answer here. This is a coverage gap or the end of a lesson, not a mistake by you.</p>}
          </div>
          <PositionBrief fen={point.fen} side={side} />
        </div>
      </div>}
    </div>}
  </div>;
}
