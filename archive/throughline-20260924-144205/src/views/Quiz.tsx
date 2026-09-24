import { useEffect, useMemo, useRef, useState } from 'react';
import Board, { type Arrow, type SquareMark } from '../components/Board/Board';
import EvalBar from '../components/EvalBar';
import { MoveList } from '../components/shared';
import { moveLabel } from '../lib/chessUtils';
import { quizItems, quizItemsForKeys, type QuizItem } from '../lib/drill';
import { weakPositions } from '../state/selectors';
import type { QuizScope } from '../state/router';
import { sound } from '../lib/sound';
import { isDue } from '../lib/srs';
import { allLines, getCourse, lineById } from '../state/courses';
import { href } from '../state/router';
import { useProgress } from '../state/store';

export interface MissedRef { lineId: string; ply: number }
export const MISSED_KEY = 'throughline.missed';

export function saveMissed(items: MissedRef[]) {
  try { sessionStorage.setItem(MISSED_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}
function loadMissed(): QuizItem[] {
  try {
    const raw = sessionStorage.getItem(MISSED_KEY);
    if (!raw) return [];
    const refs = JSON.parse(raw) as MissedRef[];
    const out: QuizItem[] = [];
    const seen = new Set<string>();
    for (const r of refs) {
      const line = lineById(r.lineId);
      const node = line?.nodes[r.ply - 1];
      if (!line || !node || !node.userMove) continue;
      if (seen.has(node.parent!.key)) continue;
      seen.add(node.parent!.key);
      out.push({ node, line });
    }
    return out;
  } catch { return []; }
}

/**
 * Quick-fire position quiz: a random position from your repertoire, you play the one move.
 * Positions come from lines you have already started, so it never tests what you have not learned.
 */
export default function Quiz({ scope, courseId }: { scope: QuizScope; courseId?: string }) {
  const settings = useProgress((s) => s.settings);
  const states = useProgress((s) => s.lines);
  const learned = useProgress((s) => s.learned);
  const recordMove = useProgress((s) => s.recordMove);
  const moveStats = useProgress((s) => s.moves);

  const items = useMemo<QuizItem[]>(() => {
    if (scope === 'missed') return loadMissed();
    if (scope === 'weak') return quizItemsForKeys(allLines, weakPositions(moveStats)).slice(0, settings.quizSize);
    let pool = allLines.filter((l) => states[l.id] || learned[l.id]);
    if (scope === 'course' && courseId) pool = pool.filter((l) => l.courseId === courseId);
    if (scope === 'due') pool = pool.filter((l) => isDue(states[l.id]));
    return quizItems(pool, settings.quizSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, courseId]);

  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState<'right' | 'wrong' | null>(null);
  const [marks, setMarks] = useState<Record<string, SquareMark>>({});
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [shake, setShake] = useState(0);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [missed, setMissed] = useState<QuizItem[]>([]);
  const timer = useRef<number | null>(null);
  const item = items[i];
  const done = i >= items.length;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function advance() {
    if (timer.current) clearTimeout(timer.current);
    setAnswered(null); setMarks({}); setArrows([]);
    setI((x) => x + 1);
  }

  function onMove(from: string, to: string, promotion?: string): boolean {
    if (!item || answered) return false;
    const n = item.node;
    const ok = n.from === from && n.to === to && (n.promotion ?? 'q') === (promotion ?? n.promotion ?? 'q');
    recordMove(n.parent!.key, ok, ok ? undefined : `${from}${to}`);
    if (ok) {
      sound.correct();
      setAnswered('right');
      setMarks({ [to]: 'right' });
      setScore((s) => ({ ...s, right: s.right + 1 }));
      timer.current = window.setTimeout(advance, 1100);
      return true;
    }
    sound.wrong();
    setShake((s) => s + 1);
    setAnswered('wrong');
    setMarks({ [from]: 'wrong', [to]: 'wrong' });
    setArrows([{ from: n.from!, to: n.to! }]);
    setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
    setMissed((m) => [...m, item]);
    return false;
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && answered) { e.preventDefault(); advance(); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });

  if (!items.length) {
    return (
      <div className="page narrow fade-in">
        <div className="card summary">
          <div className="big">{scope === 'missed' ? 'No missed positions saved.' : scope === 'weak' ? 'No weak positions right now.' : 'Nothing to quiz yet.'}</div>
          <p className="muted">{scope === 'missed' ? 'Positions you get wrong in a practice session show up here.' : 'The quiz only asks about lines you have already learned or drilled. Start a course first.'}</p>
          <div className="btn-row" style={{ marginTop: 10 }}><a className="btn primary" href={href.home()}>Back home</a></div>
        </div>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((100 * score.right) / items.length);
    return (
      <div className="page narrow fade-in">
        <div className="card summary">
          <div className="grade">{pct === 100 ? '★' : pct >= 70 ? '✓' : '~'}</div>
          <div className="big">{score.right} / {items.length} correct</div>
          <p className="muted">{pct === 100 ? 'Every position from memory. Come back tomorrow and it will be harder to forget.' : pct >= 70 ? 'Solid. The missed positions are the ones worth another look.' : 'Those positions need another pass — replay their lines in Learn, then quiz again.'}</p>
          {missed.length > 0 && (
            <div className="list" style={{ width: '100%', textAlign: 'left', marginTop: 8 }}>
              {missed.map((m, k) => {
                const c = getCourse(m.line.courseId)!;
                const idx = c.chapters.find((x) => x.chapter.id === m.line.chapterId)!.lines.indexOf(m.line);
                return (
                  <a key={k} className="row clickable" href={href.learn(m.line.courseId, m.line.chapterId, idx)} style={{ padding: '8px 12px' }}>
                    <span className="move-tag user" style={{ fontSize: 13 }}>{moveLabel(m.node.moveNumber, m.node.color!)}{m.node.san}</span>
                    <div className="grow s">{c.course.title} · {m.line.title}</div>
                    <span className="faint" style={{ fontSize: 12 }}>learn →</span>
                  </a>
                );
              })}
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 12 }}>
            {missed.length > 0 && <button className="btn primary" onClick={() => { saveMissed(missed.map((m) => ({ lineId: m.line.id, ply: m.node.ply }))); location.hash = href.quiz('missed'); location.reload(); }}>Retry the {missed.length} missed</button>}
            <a className="btn" href={href.quiz(scope, courseId)} onClick={() => setTimeout(() => location.reload(), 0)}>Another round</a>
            <a className="btn ghost" href={href.home()}>Home</a>
          </div>
        </div>
      </div>
    );
  }

  const course = getCourse(item.line.courseId)!;
  const parent = item.node.parent!;
  const before = item.line.nodes.slice(0, item.node.ply - 1);
  const lastMove = parent.parent ? { from: parent.from!, to: parent.to! } : null;

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <a className="btn sm ghost" href={courseId ? href.course(courseId) : href.home()}>← {courseId ? course.course.title : 'Home'}</a>
        <span className="faint">/</span>
        <span className="muted" style={{ fontSize: 14 }}>{scope === 'weak' ? 'Weak positions' : scope === 'missed' ? 'Missed positions' : 'Quick quiz'}</span>
        <span className="faint" style={{ fontSize: 13 }}>· {i + 1} of {items.length}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="chip mastered">{score.right} ✓</span>
        <span className="chip due">{score.wrong} ✗</span>
      </div>
      <div className="trainer">
        <div>
          <div className={settings.showEval ? 'board-with-eval' : ''}>
          <EvalBar fen={parent.fen} orientation={course.course.side} enabled={settings.showEval} />
          <Board key={item.node.key} fen={parent.fen} orientation={course.course.side} lastMove={lastMove} marks={marks} arrows={arrows} movable={answered ? undefined : course.course.side} onMove={onMove} theme={settings.boardTheme} showCoordinates={settings.showCoordinates} showLegalMoves={settings.showLegalMoves} animate={false} shakeKey={shake} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            {answered && <button className="btn sm primary" onClick={advance}>Next <kbd>↵</kbd></button>}
          </div>
        </div>
        <div className="panel">
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className={`move-tag ${answered === 'right' ? 'user' : answered === 'wrong' ? 'opp' : 'user'}`}>{answered ? `${moveLabel(item.node.moveNumber, item.node.color!)}${item.node.san}` : 'What do you play?'}</span>
              <span className="faint" style={{ fontSize: 13 }}>{course.course.title} · {course.chapters.find((c) => c.chapter.id === item.line.chapterId)?.chapter.title}</span>
            </div>
            {answered ? (
              <>
                <div className={`feedback ${answered === 'right' ? 'ok' : 'bad'}`}>{answered === 'right' ? 'Correct.' : 'Not the repertoire move.'}</div>
                <div className="comment small">{item.node.comment}</div>
              </>
            ) : (
              <div className="comment small">{parent.parent ? <>The opponent just played <b>{moveLabel(parent.moveNumber, parent.color!)}{parent.san}</b>.{parent.comment ? ' ' + parent.comment : ''}</> : 'Starting position.'}</div>
            )}
          </div>
          <div className="card">
            <div className="eyebrow">How we got here</div>
            <MoveList nodes={before} current={before.length} />
          </div>
        </div>
      </div>
    </div>
  );
}
