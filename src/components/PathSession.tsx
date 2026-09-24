import MoveControls from "./MoveControls";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Board, { type Arrow, type SquareMark } from './Board/Board';
import { lineKey, type Course, type Lesson, type PathTile, type Progress } from '../library';
import { shuffled, sourceTileUrl, tileSteps, tileUrl, type SessionStep } from '../pathNavigation';
import { lessonUrl } from '../studyNavigation';

type Update = (fn: (p: Progress) => Progress) => void;
export default function PathSession({ course, study, tile, update }: {
  course: Course; study: Lesson; tile: PathTile; update: Update;
}) {
  const steps = useMemo(() => {
    const steps = tileSteps(tile);
    return tile.newVariations.length ? steps : shuffled(steps);
  }, [tile]);
  const [index, setIndex] = useState(0);
  const acceptedStep = useRef(-1);
  const recordedReviews = useRef(new Set<number>());
  const [results, setResults] = useState<{ mistakes: number; hints: number }[]>([]);
  const [finished, setFinished] = useState(false);
  const [nextHref, setNextHref] = useState(`#/courses/${course.id}`);
  const source = sourceTileUrl(course.id, study, tile);
  useEffect(() => {
    const line = Math.max(0, study.lines.findIndex(l => l.id === steps[index]?.variationId));
    update(p => ({ ...p, last: { course: course.id, study: study.id, line, ply: 0 } }));
  }, [course.id, study.id, tile.id, index]);
  if (!tile.verified || !steps.length || tile.quizIds.length) return (
    <main className="page">
      <a className="back-link" href={`#/courses/${course.id}`}>← {course.title}</a>
      <h1>Original lesson</h1>
      <h2>{study.title}</h2>
      <p>This tile’s content is not available in the local download. Open the original lesson on Chessly.</p>
      <a className="button primary" href={source} target="_blank" rel="noreferrer">Open on Chessly</a>
      <a className="button secondary" href={lessonUrl('explore', course.id, study.id, 0)}>Explore study lines</a>
    </main>
  );
  function recordReview(result: { mistakes: number; hints: number }) {
    const step = steps[index];
    if (step.guided || recordedReviews.current.has(index)) return;
    recordedReviews.current.add(index);
    const at = new Date().toISOString();
    update(p => ({ ...p,
      completed: { ...p.completed, [lineKey(course.id, step.variationId)]: at },
      reviews: [...p.reviews, { course: course.id, line: step.variationId, at, mistakes: result.mistakes + result.hints }],
    }));
  }
  function advance(result: { mistakes: number; hints: number }) {
    if (acceptedStep.current === index) return;
    acceptedStep.current = index;
    const all = [...results, result];
    setResults(all);
    const at = new Date().toISOString();
    recordReview(result);
    const isLast = index === steps.length - 1;
    update(p => ({
      ...p,
      tiles: isLast ? { ...p.tiles, [lineKey(course.id, tile.id)]: at } : p.tiles,
    }));
    if (!isLast) { setIndex(index + 1); return; }
    const flat = course.lessons.flatMap(s => s.tiles.filter(t => t.required).map(t => ({ study: s, tile: t })));
    const next = flat[flat.findIndex(x => x.tile.id === tile.id) + 1];
    if (next) setNextHref(tileUrl(course.id, next.study.id, next.tile.id));
    setFinished(true);
  }
  if (finished) return <main className="page"><div className="panel lesson-success">
    <h1>{tile.kind === 'graduate' ? 'Study graduated!' : 'Lesson complete!'}</h1>
    <p>{steps.filter(s => !s.guided).length} variations reviewed · {results.reduce((sum, r) => sum + r.mistakes, 0)} retries · {results.reduce((sum, r) => sum + r.hints, 0)} hints</p>
    <a className="button primary" href={nextHref}>Next lesson →</a>
    <a className="button secondary" href={`#/courses/${course.id}`}>Back to course</a>
  </div></main>;
  return <SessionBoard key={`${tile.id}/${index}`} course={course} study={study} step={steps[index]}
    label={tile.kind === 'graduate' ? 'GRADUATION' : tile.kind === 'review' ? 'PRACTICE' : 'LEARN'}
    index={index} count={steps.length} nextLabel={index === steps.length - 1 ? 'Finish' : steps[index].guided ? 'Next: Review' : tile.kind === 'learn' ? 'Next Variation' : 'Next Drill'} onNext={advance} onCompleted={recordReview} />;
}

export function SessionBoard({ course, study, step, label, index, count, nextLabel, onNext, onCompleted }: {
  course: Course; study: Lesson; step: SessionStep; label: string; index: number; count: number;
  nextLabel: string; onNext: (result: { mistakes: number; hints: number }) => void;
  onCompleted?: (result: { mistakes: number; hints: number }) => void;
}) {
  const line = study.lines.find(l => l.id === step.variationId)!;
  const [frontier, setFrontier] = useState(0);
  const [ply, setPly] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [hint, setHint] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [positionErrors, setPositionErrors] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const history = useMemo(() => {
    const chess = new Chess(); const positions = [chess.fen()];
    for (const san of line.sans) { chess.move(san); positions.push(chess.fen()); }
    return positions;
  }, [line]);
  const learner = course.side === 'White' ? 'w' : 'b';
  const current = new Chess(history[ply]);
  const complete = frontier === line.sans.length;
  const old = ply < frontier;
  const recordedCompletion = useRef(false);
  useEffect(() => {
    if (!complete || recordedCompletion.current) return;
    recordedCompletion.current = true;
    onCompleted?.({ mistakes, hints });
  }, [complete, onCompleted, mistakes, hints]);
  useEffect(() => {
    if (complete || old || current.turn() === learner) return;
    const timer = setTimeout(() => { setFrontier(n => n + 1); setPly(n => n + 1); setHint(0); }, 500);
    return () => clearTimeout(timer);
  }, [ply, frontier, learner, complete, old]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft') setPly(n => Math.max(0, n - 1));
      if (e.key === 'ArrowRight') setPly(n => Math.min(frontier, n + 1));
      if (e.key === 'Home') setPly(0);
      if (e.key === 'End') setPly(frontier);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [frontier]);
  const showNotes = step.guided || complete || hint >= 2 || positionErrors >= 2;
  const notes = showNotes ? study.notes[current.fen()] ?? [] : [];
  const arrows: Arrow[] = notes.flatMap(n => [
    ...(n.arrows?.opportunities ?? []).map(s => ({ s, color: 'rgba(59,155,103,.8)' })),
    ...(n.arrows?.threats ?? []).map(s => ({ s, color: 'rgba(233,105,96,.8)' })),
  ]).filter(a => /^[a-h][1-8]-[a-h][1-8]$/.test(a.s)).map(a => ({ from: a.s.slice(0, 2), to: a.s.slice(3), color: a.color }));
  const marks: Record<string, SquareMark> = {};
  for (const note of notes) {
    for (const sq of note.highlights?.opportunities ?? []) marks[sq] = 'right';
    for (const sq of note.highlights?.threats ?? []) marks[sq] = 'wrong';
  }
  if (!complete && !old && current.turn() === learner && (step.guided || hint)) {
    const m = new Chess(current.fen()).move(line.sans[ply]);
    if (step.guided) arrows.push({ from: m.from, to: m.to, color: 'rgba(37,99,235,.9)' });
    if (hint) marks[m.from] = 'hint';
    if (hint >= 2) marks[m.to] = 'hint';
  }
  const previous = ply ? new Chess(history[ply - 1]).move(line.sans[ply - 1]) : null;
  return <main className="lesson-page improved-lesson">
    <div className="study-course-header"><a className="study-course-link" href={`#/courses/${course.id}`}>
      <img src={course.image} alt="" /><span><b>{course.title}</b><small>Chapter {[...new Set(course.lessons.map(s => s.chapterId))].indexOf(study.chapterId) + 1} · {study.chapter}</small></span>
    </a><div className="study-route-label"><span>{label} · {index + 1} / {count}</span><b>{study.title}</b></div></div>
    <div className="lesson-breadcrumb"><button className="button outline small" onClick={() => { location.hash = `/courses/${course.id}`; }}>End Session</button>
      <button className="button outline small" onClick={() => { location.hash = lessonUrl('explore', course.id, study.id, study.lines.indexOf(line), ply); }}>Explore this variation</button>
    </div>
    <div className="lesson-layout"><div className="board-column">
      <div className="board-label"><div className="lesson-stage-context"><span className="lesson-stage-mode">{step.guided ? 'LEARN' : 'REVIEW'}</span>{!/^\s*\**variation\s+\d+(?:\s+of\s+\d+)?\**\s*$/i.test(line.title) && <strong>{line.title}</strong>}<span className="lesson-stage-side">{course.side} · {ply} / {line.sans.length}</span></div>
        <button className="icon-button" aria-label="Flip board" onClick={() => setFlipped(!flipped)}>↔</button></div>
      <Board fen={current.fen()} orientation={flipped ? learner === 'w' ? 'b' : 'w' : learner} theme="walnut" animate arrows={arrows} marks={marks}
        lastMove={previous && { from: previous.from, to: previous.to }} movable={!complete && !old && current.turn() === learner ? learner : undefined}
        onMove={(from, to, promotion) => {
          const m = new Chess(current.fen()).move({ from, to, promotion });
          if (m.san !== line.sans[ply]) {
            setMistakes(n => n + 1); setPositionErrors(n => n + 1);
            if (!step.guided && positionErrors >= 1 && hint === 0) { setHint(1); setHints(n => n + 1); }
            setFeedback('That’s a legal move, but not the move in this lesson. Try again.'); return false;
          }
          setFeedback(''); setHint(0); setPositionErrors(0); setFrontier(n => n + 1); setPly(n => n + 1); return true;
        }} />
    </div><aside className="lesson-panel">
      <MoveControls ply={ply} total={line.sans.length} first={ply > 0} previous={ply > 0} next={ply < frontier} last={ply < frontier}
        onFirst={() => setPly(0)} onPrevious={() => setPly(ply - 1)} onNext={() => setPly(ply + 1)} onLast={() => setPly(frontier)} />
      <div className="lesson-notes">
        {complete ? <><h2>{!step.guided && !mistakes && !hints ? 'Perfect' : 'Completed'}</h2>
          <div className="button-row"><button className="button secondary" onClick={() => { setFrontier(0); setPly(0); setHint(0); setPositionErrors(0); setFeedback(''); }}>Redo</button>
          <button className="button primary" onClick={() => onNext({ mistakes, hints })}>{nextLabel}</button></div></> : old ? <p>Viewing Old Moves</p> : <>
          <div className="lesson-status-row"><span className="eyebrow">{current.turn() === learner ? 'YOUR TURN' : 'OPPONENT’S TURN'}</span>
          <button className="button secondary" disabled={current.turn() !== learner || hint >= 2} onClick={() => { setHint(n => n + 1); setHints(n => n + 1); }}>{hint ? 'Solution' : 'Hint'}</button></div>
          {feedback && <p className="lesson-feedback" role="status">{feedback}</p>}
        </>}
        <div className="course-annotations" aria-label="Course notes">{notes.filter(n => n.text.trim()).map((n, i) => <p key={i}>{n.text}</p>)}</div>
      </div>
    </aside></div>
  </main>;
}
