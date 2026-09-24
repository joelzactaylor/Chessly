import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board, { type Arrow, type SquareMark } from '../components/Board/Board';
import EvalBar from '../components/EvalBar';
import { GradeFace, MoveList, formatDue } from '../components/shared';
import { START_FEN, moveLabel } from '../lib/chessUtils';
import { buildQueue, mixedQueue, type QueueMode } from '../lib/drill';
import { saveMissed, type MissedRef } from './Quiz';
import { lineFrequencyLabel } from '../lib/frequency';
import { sound } from '../lib/sound';
import { type Grade } from '../lib/srs';
import type { Line, RepNode } from '../lib/types';
import { allLines, getChapter, getCourse, stats } from '../state/courses';
import { href } from '../state/router';
import { useProgress } from '../state/store';
import { studyPicks } from '../lib/studyPlan';
import PositionBrief from '../components/PositionBrief';

interface Props { mode: QueueMode; courseId?: string; chapterId?: string; lineIndex?: number; study?: boolean }

type Phase = 'user' | 'opp' | 'done' | 'session-done';

export default function Drill({ mode, courseId, chapterId, lineIndex, study }: Props) {
  const settings = useProgress((s) => s.settings);
  const states = useProgress((s) => s.lines);
  const learned = useProgress((s) => s.learned);
  const movesStats = useProgress((s) => s.moves);
  const recordLineResult = useProgress((s) => s.recordLineResult);
  const recordMove = useProgress((s) => s.recordMove);
  const setLastCourse = useProgress((s) => s.setLastCourse);

  // Build the queue once per mounted session. Progress updates during practice
  // must not reshuffle the lines underneath the current index.
  const [queue] = useState<Line[]>(() => {
    let pool: Line[] = allLines;
    if ((mode === 'course' || mode === 'mixed-course') && courseId) pool = getCourse(courseId)?.lines ?? [];
    if ((mode === 'chapter' || mode === 'mixed-chapter') && courseId && chapterId) pool = getChapter(courseId, chapterId)?.lines ?? [];
    // Drills reinforce lines that have been introduced, while Learn is the only
    // flow allowed to present a genuinely new line.
    pool = pool.filter((line) => learned[line.id] || states[line.id]);
    if (mode.startsWith('mixed')) return mixedQueue(pool, states, stats, Math.max(1, settings.mixedSize));
    if (mode === 'line' && courseId && chapterId) {
      const l = getChapter(courseId, chapterId)?.lines[lineIndex ?? 0];
      pool = l ? [l] : [];
    }
    return buildQueue(mode, pool, states, movesStats);
  });

  const [qi, setQi] = useState(0);
  const [retry, setRetry] = useState<Line[]>([]);
  const line: Line | undefined = qi < queue.length ? queue[qi] : retry[qi - queue.length];
  const lineInstance = line ? `${qi}:${line.id}` : `done:${qi}`;
  const course = line ? getCourse(line.courseId)! : undefined;
  const side = course?.course.side ?? 'w';

  const [ply, setPly] = useState(0);
  const [phase, setPhase] = useState<Phase>('user');
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [wrongTries, setWrongTries] = useState(0);
  const [marks, setMarks] = useState<Record<string, SquareMark>>({});
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad' | 'hint' | 'neutral'; text: string } | null>(null);
  const [lastComment, setLastComment] = useState<RepNode | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [shake, setShake] = useState(0);
  const [jump, setJump] = useState(true);
  const [linesDone, setLinesDone] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(Date.now());
  const missed = useRef<MissedRef[]>([]);
  const [missedCount, setMissedCount] = useState(0);

  useEffect(() => { if (course) setLastCourse(course.course.id); }, [course, setLastCourse]);

  const courseLines = course?.lines ?? [];
  // Generated branches already have evaluated endpoints. Never truncate them
  // using the product of reply frequencies along the path.
  const nodes = useMemo(() => line?.nodes ?? [], [line]);
  const odds = line ? lineFrequencyLabel(line, courseLines) : '';
  const fen = ply > 0 ? nodes[ply - 1].fen : START_FEN;
  const expected: RepNode | undefined = nodes[ply];
  const lastMove = ply > 0 ? { from: nodes[ply - 1].from!, to: nodes[ply - 1].to! } : null;

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const total = queue.length + retry.length;
  const isMixed = mode.startsWith('mixed');
  const modeLabel = mode === 'due' ? 'Due lines' : mode === 'weak' ? 'Weak lines' : mode === 'all' ? 'Whole repertoire' : isMixed ? 'Mixed practice' : mode === 'line' ? (study ? 'From memory' : 'Single line') : mode === 'chapter' ? 'Chapter practice' : 'Course practice';
  const chapterOf = (l: Line) => getChapter(l.courseId, l.chapterId)!;
  const lineIdx = (l: Line) => chapterOf(l).lines.indexOf(l);
  const nextLearnHref = (() => {
    if (!study || !line) return null;
    const chp = chapterOf(line);
    const pick = studyPicks(chp.lines, { ...learned, [line.id]: 1 }, states, 1)[0];
    return pick ? href.learn(line.courseId, line.chapterId, chp.lines.indexOf(pick)) : null;
  })();

  // Reset when the line changes.
  useEffect(() => {
    clearTimer();
    setPly(0); setMistakes(0); setHints(0); setWrongTries(0); setMarks({}); setArrows([]); setMessage(null); setLastComment(null); setGrade(null); setJump(true);
    startedAt.current = Date.now();
    if (!line) { setPhase('session-done'); return; }
    const first = line.nodes[0];
    setPhase(first.userMove ? 'user' : 'opp');
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineInstance]);

  // Opponent replies after a delay.
  useEffect(() => {
    if (phase !== 'opp' || !line) return;
    const node = nodes[ply];
    if (!node) { finishLine(); return; }
    timer.current = window.setTimeout(() => {
      setJump(false);
      setPly(ply + 1);
      node.san.includes('x') ? sound.capture() : sound.move();
      setLastComment(node);
      setMarks({});
      setArrows([]);
      const next = nodes[ply + 1];
      if (!next) finishLine(ply + 1);
      else setPhase('user');
    }, ply === 0 ? Math.min(settings.opponentDelayMs, 300) : settings.opponentDelayMs);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ply, line?.id]);

  function finishLine(finalPly?: number) {
    if (!line) return;
    clearTimer();
    setPhase('done');
    const g = recordLineResult(line.id, mistakes, hints, nodes.filter((n) => n.userMove).length);
    setGrade(g);
    setLinesDone((n) => n + 1);
    if (g === 3) setPerfectCount((n) => n + 1);
    if (g >= 2) sound.lineDone(); else sound.hint();
    if (g < 2 && mode !== 'line') setRetry((r) => (r.includes(line) ? r : [...r, line]));
    if (finalPly !== undefined) setPly(finalPly);
    if (settings.autoAdvanceMs > 0 && g >= 2 && !study) {
      timer.current = window.setTimeout(() => nextLine(), settings.autoAdvanceMs + 600);
    }
  }

  const nextLine = useCallback(() => {
    clearTimer();
    setQi((i) => i + 1);
  }, []);

  const showHint = useCallback((counted: boolean) => {
    if (!expected || phase !== 'user') return;
    setArrows([{ from: expected.from!, to: expected.to! }]);
    setMarks({ [expected.from!]: 'hint' });
    setMessage({ kind: 'hint', text: `Hint: ${moveLabel(expected.moveNumber, expected.color!)}${expected.san}${expected.comment ? ' — ' + expected.comment : ''}` });
    if (counted) { setHints((h) => h + 1); sound.hint(); }
  }, [expected, phase]);

  function onMove(from: string, to: string, promotion?: string): boolean {
    if (phase !== 'user' || !expected || !line) return false;
    const ok = expected.from === from && expected.to === to && (expected.promotion ?? 'q') === (promotion ?? expected.promotion ?? 'q');
    recordMove(expected.parent!.key, ok, ok ? undefined : `${from}${to}`);
    if (ok) {
      setJump(false);
      setPly(ply + 1);
      expected.san.includes('x') ? sound.capture() : sound.move();
      setMarks({ [to]: 'right' });
      setArrows([]);
      setWrongTries(0);
      setMessage(wrongTries > 0 || hints > 0 ? null : { kind: 'ok', text: 'Correct.' });
      setLastComment(expected);
      const next = nodes[ply + 1];
      if (!next) finishLine(ply + 1);
      else setPhase('opp');
      return true;
    }
    setMistakes((m) => m + 1);
    setWrongTries((w) => w + 1);
    if (wrongTries === 0) { missed.current.push({ lineId: line.id, ply: expected.ply }); setMissedCount(missed.current.length); }
    setShake((s) => s + 1);
    sound.wrong();
    setMarks({ [from]: 'wrong', [to]: 'wrong' });
    const tries = wrongTries + 1;
    if (tries >= settings.hintAfterMistakes) {
      setArrows([{ from: expected.from!, to: expected.to! }]);
      setMessage({ kind: 'hint', text: `Not that one. The repertoire move is ${moveLabel(expected.moveNumber, expected.color!)}${expected.san}${expected.comment ? ' — ' + expected.comment : ''}` });
    } else {
      setMessage({ kind: 'bad', text: 'Not the repertoire move. Try again.' });
    }
    return false;
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'h' && phase === 'user') showHint(true);
      if ((e.key === 'Enter' || e.key === ' ') && phase === 'done') {
        e.preventDefault();
        if (study && line) {
          if ((grade ?? 0) < 2) location.hash = href.learn(line.courseId, line.chapterId, lineIdx(line));
          else if (nextLearnHref) location.hash = nextLearnHref;
          else location.hash = href.mixedChapter(line.courseId, line.chapterId);
        } else nextLine();
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [phase, showHint, nextLine, study, grade, line, nextLearnHref]);


  if (!queue.length) {
    return (
      <div className="page narrow fade-in">
        <div className="card summary">
          <div className="big">{mode === 'due' ? 'Nothing is due right now.' : mode === 'weak' ? 'No weak lines found.' : 'Nothing to practise here.'}</div>
          <p className="muted">{mode === 'due' ? 'Come back later, or practise a course to keep the lines fresh.' : 'Drill some lines first and this will fill up with anything you get wrong.'}</p>
          <div className="btn-row" style={{ marginTop: 10 }}><a className="btn primary" href={href.home()}>Back home</a></div>
        </div>
      </div>
    );
  }

  if (phase === 'session-done' || !line || !course) {
    return (
      <div className="page narrow fade-in">
        <div className="card summary">
          <div className="grade">{perfectCount === linesDone ? '★' : '✓'}</div>
          <div className="big">Session complete</div>
          <p className="muted">{linesDone} {linesDone === 1 ? 'line' : 'lines'} · {perfectCount} perfect · {missedCount} {missedCount === 1 ? 'position' : 'positions'} missed · {Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))} min</p>
          {missed.current.length > 0 && (
            <div className="list" style={{ width: '100%', textAlign: 'left', marginTop: 8 }}>
              <div className="eyebrow" style={{ padding: '4px 12px' }}>Positions you missed</div>
              {missed.current.slice(0, 12).map((m, k) => {
                const l = allLines.find((x) => x.id === m.lineId)!;
                const n = l.nodes[m.ply - 1];
                return (
                  <a key={k} className="row clickable" href={href.learn(l.courseId, l.chapterId, lineIdx(l))} style={{ padding: '8px 12px' }}>
                    <span className="move-tag user" style={{ fontSize: 13 }}>{moveLabel(n.moveNumber, n.color!)}{n.san}</span>
                    <div className="grow s">after {n.parent!.parent ? `${moveLabel(n.parent!.moveNumber, n.parent!.color!)}${n.parent!.san}` : 'the start'} · {l.title}</div>
                    <span className="faint" style={{ fontSize: 12 }}>learn →</span>
                  </a>
                );
              })}
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 12 }}>
            {missed.current.length > 0 && <button className="btn primary" onClick={() => { saveMissed(missed.current); location.hash = href.quiz('missed'); }}>Quiz the missed positions</button>}
            {isMixed && <a className="btn" href={location.hash} onClick={() => setTimeout(() => location.reload(), 0)}>Another mixed round</a>}
            <a className={`btn ${missed.current.length ? '' : 'primary'}`} href={courseId ? href.course(courseId) : href.home()}>{courseId ? 'Course page' : 'Back home'}</a>
          </div>
        </div>
      </div>
    );
  }

  const st = states[line.id];
  const c = course.course;
  const progressPct = Math.round((100 * ply) / nodes.length);

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <a className="btn sm ghost" href={courseId ? href.course(courseId) : href.home()}>← {courseId ? c.title : 'Home'}</a>
        <span className="faint">/</span>
        <span className="muted" style={{ fontSize: 14 }}>{modeLabel}</span>
        <span className="faint" style={{ fontSize: 13 }}>· {Math.min(qi + 1, total)} of {total}</span>
        <div className="spacer" style={{ flex: 1 }} />
        <span className="faint" style={{ fontSize: 13 }}>{isMixed ? `${c.title} · line hidden until the end` : `${c.title} · ${chapterOf(line).chapter.title}`}</span>
        {!isMixed && <span className="chip">{odds}</span>}
      </div>

      <div className="trainer">
        <div>
          <div className={settings.showEval ? 'board-with-eval' : ''}>
            <EvalBar fen={fen} orientation={side} enabled={settings.showEval} />
            <Board
              fen={fen}
              orientation={side}
              lastMove={lastMove}
              marks={marks}
              arrows={arrows}
              movable={phase === 'user' ? side : undefined}
              onMove={onMove}
              theme={settings.boardTheme}
              showCoordinates={settings.showCoordinates}
              showLegalMoves={settings.showLegalMoves}
              animate={!jump}
              shakeKey={shake}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 }}>
            <div className="bar" style={{ flex: 1, maxWidth: 260 }}><span className="familiar" style={{ width: `${progressPct}%` }} /></div>
            <div className="btn-row">
              {phase === 'user' && <button className="btn sm" onClick={() => showHint(true)}>Hint <kbd>h</kbd></button>}
              {phase === 'done' && !study && <button className="btn sm primary" onClick={nextLine}>Next <kbd>↵</kbd></button>}
              {mode !== 'line' && phase !== 'done' && <button className="btn sm ghost" onClick={nextLine}>Skip</button>}
            </div>
          </div>
        </div>

        <div className="panel">
          {phase === 'done' && <PositionBrief fen={fen} side={side} />}
          {phase === 'done' && grade !== null ? (
            <div className="card summary fade-in" style={{ borderColor: grade >= 2 ? 'rgba(127,183,126,.5)' : 'rgba(224,108,92,.5)' }}>
              <GradeFace grade={grade} />
              <div className="big">{grade === 3 ? 'Perfect' : grade === 2 ? 'Good' : grade === 1 ? 'Shaky' : 'Needs work'}</div>
              <div className="muted" style={{ fontSize: 14 }}>
                {line.title} · {mistakes} {mistakes === 1 ? 'mistake' : 'mistakes'} · {hints} {hints === 1 ? 'hint' : 'hints'}
              </div>
              <div className="faint" style={{ fontSize: 13 }}>
                {st ? `Next review ${formatDue(st.due)}` : ''}{grade < 2 && mode !== 'line' ? ' · queued again this session' : ''}
              </div>
              <div className="btn-row" style={{ marginTop: 8 }}>
                {study && grade < 2 ? (
                  <a className="btn primary" href={href.learn(line.courseId, line.chapterId, lineIdx(line))}>Learn it again</a>
                ) : study && nextLearnHref ? (
                  <a className="btn primary" href={nextLearnHref}>Learn the next line →</a>
                ) : study ? (
                  <a className="btn primary" href={href.mixedChapter(line.courseId, line.chapterId)}>Chapter done — mixed practice</a>
                ) : (
                  <button className="btn primary" onClick={nextLine}>{qi + 1 < total ? 'Next line' : 'Finish'} <kbd>↵</kbd></button>
                )}
                {study && grade >= 2 && <button className="btn" onClick={() => { setPly(0); setPhase(line.nodes[0].userMove ? 'user' : 'opp'); setMistakes(0); setHints(0); setWrongTries(0); setGrade(null); setMarks({}); setArrows([]); setMessage(null); setLastComment(null); setJump(true); }}>Play it again</button>}
                {!study && <a className="btn" href={href.learn(line.courseId, line.chapterId, lineIdx(line))}>Review the notes</a>}
              </div>
            </div>
          ) : (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`move-tag ${phase === 'user' ? 'user' : 'opp'}`}>{phase === 'user' ? 'Your move' : 'Opponent thinking…'}</span>
                <span className="faint" style={{ fontSize: 13 }}>{side === 'w' ? 'You are White' : 'You are Black'}</span>
              </div>
              {message && <div className={`feedback ${message.kind}`}>{message.text}</div>}
              {!message && lastComment && (
                <div className="comment small">
                  <span className="mono" style={{ color: lastComment.userMove ? 'var(--accent-2)' : 'var(--blue)', fontWeight: 600 }}>{moveLabel(lastComment.moveNumber, lastComment.color!)}{lastComment.san} </span>
                  {lastComment.comment}
                </div>
              )}
              {!message && !lastComment && <div className="comment small">{side === 'w' ? 'Play your first move.' : 'Wait for White\'s move, then answer.'}</div>}
            </div>
          )}

          <div className="card">
            <div className="eyebrow">Moves so far</div>
            <MoveList nodes={nodes.slice(0, ply)} current={ply} />
            {ply === 0 && <div className="faint" style={{ fontSize: 13 }}>—</div>}
          </div>

          <div className="card pad-s">
            <div className="eyebrow">This session</div>
            <div style={{ display: 'flex', gap: 22 }}>
              <div className="stat"><span className="v" style={{ fontSize: 22 }}>{linesDone}</span><span className="l">lines</span></div>
              <div className="stat"><span className="v green" style={{ fontSize: 22 }}>{perfectCount}</span><span className="l">perfect</span></div>
              <div className="stat"><span className="v" style={{ fontSize: 22 }}>{total - qi - 1 < 0 ? 0 : total - qi - 1}</span><span className="l">remaining</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
