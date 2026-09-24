import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board, { type Arrow, type SquareMark } from '../components/Board/Board';
import EvalBar from '../components/EvalBar';
import { MasteryChip, MoveList } from '../components/shared';
import { START_FEN, moveLabel } from '../lib/chessUtils';
import { isDue } from '../lib/srs';
import { linesThrough } from '../lib/tree';
import { getChapter } from '../state/courses';
import { href, navigate } from '../state/router';
import { useProgress } from '../state/store';
import { sound } from '../lib/sound';
import { lineFrequencyLabel } from '../lib/frequency';
import { getCourse } from '../state/courses';
import { explainMove, endpointLabel } from '../lib/coaching';
import PositionBrief from '../components/PositionBrief';
import { studyPicks } from '../lib/studyPlan';

/**
 * Learn a line by playing it. Your moves are shown with an arrow and explained before you
 * play them; the opponent's moves play themselves. ← steps back into a read-only view,
 * → plays the next move for you.
 */
export default function Learn({ courseId, chapterId, lineIndex }: { courseId: string; chapterId: string; lineIndex: number }) {
  const ch = getChapter(courseId, chapterId);
  const settings = useProgress((s) => s.settings);
  const states = useProgress((s) => s.lines);
  const learned = useProgress((s) => s.learned);
  const markLearned = useProgress((s) => s.markLearned);
  const safeIndex = Math.max(0, Math.min(lineIndex, (ch?.lines.length ?? 1) - 1));
  const line = ch?.lines[safeIndex];
  const nodes = useMemo(() => line?.nodes ?? [], [line]);

  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [jump, setJump] = useState(true);
  const [slip, setSlip] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const timer = useRef<number | null>(null);
  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  useEffect(() => { clearTimer(); setStep(0); setMaxStep(0); setJump(true); setSlip(null); return clearTimer; }, [line?.id]);
  useEffect(() => { if (line && step >= nodes.length) markLearned(line.id); }, [step, line, nodes.length, markLearned]);

  const node = step > 0 ? nodes[step - 1] : null;
  const next = nodes[step];
  const fen = node ? node.fen : START_FEN;
  const atEnd = step >= nodes.length;
  const guided = settings.learnGuided && step >= maxStep;
  const yourTurn = guided && !!next && next.userMove;

  const play = useCallback((animate = true) => {
    const n = nodes[step];
    if (!n) return;
    clearTimer();
    setJump(!animate);
    if (animate) n.san.includes('x') ? sound.capture() : sound.move();
    setSlip(null);
    setStep(step + 1);
    setMaxStep((m) => Math.max(m, step + 1));
  }, [nodes, step]);

  // Opponent moves play themselves in guided mode.
  useEffect(() => {
    if (!guided || !next || next.userMove) return;
    timer.current = window.setTimeout(() => play(true), step === 0 ? 500 : 750);
    return clearTimer;
  }, [guided, next, step, play]);

  function goTo(n: number) {
    const clamped = Math.max(0, Math.min(nodes.length, n));
    if (clamped === step) return;
    clearTimer();
    setJump(Math.abs(clamped - step) !== 1);
    if (clamped === step + 1) { play(true); return; }
    setSlip(null);
    setStep(clamped);
  }

  function onMove(from: string, to: string, promotion?: string): boolean {
    if (!yourTurn || !next) return false;
    if (next.from === from && next.to === to && (next.promotion ?? 'q') === (promotion ?? next.promotion ?? 'q')) { play(true); return true; }
    setShake((s) => s + 1);
    sound.wrong();
    setSlip(`Not this one — the line continues with ${moveLabel(next.moveNumber, next.color!)}${next.san}. Follow the arrow.`);
    return false;
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(step + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(step - 1); }
      else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(nodes.length);
      else if (e.key === 'Enter' && atEnd && line) navigate(href.drillLine(courseId, chapterId, safeIndex, true));
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });

  const branch = useMemo(() => {
    if (!node || !ch) return null;
    const parent = node.parent!;
    if (parent.children.length <= 1) return null;
    return parent.children.filter((c) => c !== node).map((c) => ({ node: c, line: linesThrough(ch.lines, c)[0] }));
  }, [node, ch]);

  if (!ch || !line) return <div className="page"><div className="empty">Chapter not found.</div></div>;
  const course = ch.course;
  const lastMove = node ? { from: node.from!, to: node.to! } : null;
  const nextPick = studyPicks(ch.lines, { ...learned, [line.id]: 1 }, states, 1)[0];
  const nextLineIndex = nextPick ? ch.lines.indexOf(nextPick) : -1;
  const arrows: Arrow[] = next && !atEnd && next.userMove ? [{ from: next.from!, to: next.to! }] : [];
  const marks: Record<string, SquareMark> = yourTurn && next ? { [next.from!]: 'hint' } : {};
  const learnedCount = ch.lines.filter((l) => learned[l.id]).length;

  // What to explain: while it is your turn we explain the move you are about to play; otherwise the move just played.
  const explain = yourTurn && next ? next : node;
  const explainKind = yourTurn ? 'upcoming' : 'played';

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <a className="btn sm ghost" href={href.course(courseId)}>← {course.title}</a>
        <span className="faint">/</span>
        <span className="muted" style={{ fontSize: 14 }}>{ch.chapter.title}</span>
        <span className="faint">/</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Line {safeIndex + 1} of {ch.lines.length}: {line.title}</span>
        <MasteryChip state={states[line.id]} due={isDue(states[line.id])} />
        <span className="chip">{lineFrequencyLabel(line, getCourse(courseId)?.lines ?? [])}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="faint" style={{ fontSize: 13 }}>{learnedCount}/{ch.lines.length} lines read</span>
      </div>

      <div className="trainer">
        <div>
          <div className={settings.showEval ? 'board-with-eval' : ''}>
          <EvalBar fen={fen} orientation={course.side} enabled={settings.showEval} />
          <Board
            fen={fen}
            orientation={course.side}
            lastMove={lastMove}
            arrows={arrows}
            marks={marks}
            movable={yourTurn ? course.side : undefined}
            onMove={onMove}
            theme={settings.boardTheme}
            showCoordinates={settings.showCoordinates}
            showLegalMoves={settings.showLegalMoves}
            animate={!jump}
            shakeKey={shake}
          />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
            <div className="btn-row">
              <button className="btn sm" onClick={() => goTo(0)} disabled={step === 0} title="Start">⇤</button>
              <button className="btn sm" onClick={() => goTo(step - 1)} disabled={step === 0}>← Back</button>
              <button className={`btn sm ${yourTurn ? '' : 'primary'}`} onClick={() => goTo(step + 1)} disabled={atEnd}>{yourTurn ? 'Play it for me' : 'Next'} →</button>
              <button className="btn sm" onClick={() => goTo(nodes.length)} disabled={atEnd} title="End">⇥</button>
            </div>
            <span className="kbd-hint">{yourTurn ? 'Play the arrowed move on the board' : <><kbd>←</kbd> <kbd>→</kbd> to step</>}</span>
          </div>
        </div>

        <div className="panel">
          <div className="card">
            {explain ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className={`move-tag ${explain.userMove ? 'user' : 'opp'}`}>{moveLabel(explain.moveNumber, explain.color!)}{explain.san}{explain.nag ?? ''}</span>
                  <span className="faint" style={{ fontSize: 13 }}>
                    {explainKind === 'upcoming' ? 'Your move — play it' : explain.userMove ? 'Your move' : 'Opponent'}
                  </span>
                </div>
                {explain.userMove && <div className="comment">{explainMove(explain.parent!.fen, explain.san)}</div>}
                {explain.comment && <div className={explain.userMove ? 'comment small' : 'comment'}>{explain.userMove ? explain.comment.replace(explainMove(explain.parent!.fen, explain.san), '').trim() : explain.comment}</div>}
                {slip && <div className="feedback bad" style={{ fontSize: 14 }}>{slip}</div>}
                {!guided && settings.learnGuided && !atEnd && <div className="faint" style={{ fontSize: 13 }}>Reviewing earlier moves. Step forward to move {Math.ceil((maxStep + 1) / 2)} to keep playing the line yourself.</div>}
              </>
            ) : (
              <>
                <div className="eyebrow">Starting position</div>
                <div className="comment">{ch.chapter.summary}</div>
                <div className="faint" style={{ fontSize: 13 }}>{course.side === 'w' ? 'Play the arrowed move to begin.' : 'White moves first; then play the arrowed moves.'}</div>
              </>
            )}
          </div>

          {branch && branch.length > 0 && (
            <div className="card pad-s">
              <div className="eyebrow">Other {node?.userMove ? 'moves' : 'replies'} here</div>
              <div className="list">
                {branch.map(({ node: alt, line: altLine }) => {
                  const idx = altLine ? ch.lines.indexOf(altLine) : -1;
                  return (
                    <div key={alt.san} className="row clickable" onClick={() => idx >= 0 && navigate(href.learn(courseId, chapterId, idx))} style={{ padding: '8px 12px' }}>
                      <span className="move-tag opp" style={{ fontSize: 13 }}>{moveLabel(alt.moveNumber, alt.color!)}{alt.san}</span>
                      <div className="grow s">{alt.comment ? alt.comment.slice(0, 90) + (alt.comment.length > 90 ? '…' : '') : ''}</div>
                      {idx >= 0 && <span className="faint" style={{ fontSize: 12 }}>line {idx + 1} →</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {atEnd && (
            <div className="card fade-in" style={{ borderColor: 'rgba(232,163,61,.4)' }}>
              <div className="title-m">{endpointLabel(node?.comment)}</div>
              <p className="muted" style={{ fontSize: 14 }}>You have played it once with the arrows. Now play it from memory — that is what makes it stick.</p>
              <div className="btn-row">
                <a className="btn primary" href={href.drillLine(courseId, chapterId, safeIndex, true)}>Play it from memory <kbd>↵</kbd></a>
                {nextLineIndex >= 0 ? <a className="btn" href={href.learn(courseId, chapterId, nextLineIndex)}>Next recommended line →</a> : <a className="btn" href={href.mixedChapter(courseId, chapterId)}>Mixed practice</a>}
              </div>
            </div>
          )}

          {atEnd && <PositionBrief fen={fen} side={course.side} />}

          <div className="card">
            <div className="eyebrow">Moves</div>
            <MoveList nodes={nodes} current={step} onSelect={(i) => goTo(i)} futureFrom={step} />
          </div>

          <div className="card pad-s">
            <div className="eyebrow">Lines in this chapter</div>
            <div className="list">
              {ch.lines.map((l, i) => (
                <a key={l.id} className="row clickable" href={href.learn(courseId, chapterId, i)} style={{ padding: '7px 12px', background: i === safeIndex ? 'var(--surface-2)' : undefined }}>
                  <span className="faint mono" style={{ fontSize: 12, width: 20 }}>{i + 1}</span>
                  <div className="grow s" style={{ color: i === safeIndex ? 'var(--text)' : undefined }}>{l.title}{learned[l.id] && !states[l.id] ? <span className="faint"> · read</span> : ''}</div>
                  <MasteryChip state={states[l.id]} due={isDue(states[l.id])} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
