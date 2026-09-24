import { useEffect, useMemo, useState } from 'react';
import Board from '../components/Board/Board';
import EvalBar from '../components/EvalBar';
import { START_FEN, moveLabel } from '../lib/chessUtils';
import { pathNodes } from '../lib/tree';
import type { RepNode } from '../lib/types';
import { getCourse, stats } from '../state/courses';
import { href } from '../state/router';
import { useProgress } from '../state/store';
import { sound } from '../lib/sound';
import { formatOdds, nodeFrequency } from '../lib/frequency';

export default function Explore({ courseId, chapterId }: { courseId: string; chapterId?: string }) {
  const pc = getCourse(courseId);
  const settings = useProgress((s) => s.settings);
  const moveStats = useProgress((s) => s.moves);
  const [chId, setChId] = useState(chapterId ?? pc?.chapters[0]?.chapter.id);
  const ch = pc?.chapters.find((c) => c.chapter.id === chId) ?? pc?.chapters[0];
  const [node, setNode] = useState<RepNode | null>(null);
  const [jump, setJump] = useState(true);

  useEffect(() => { setNode(null); setJump(true); }, [chId]);

  const current = node ?? ch?.root ?? null;
  const path = useMemo(() => (current ? pathNodes(current) : []), [current]);
  const fen = current?.fen ?? START_FEN;
  const lastMove = current && current.parent ? { from: current.from!, to: current.to! } : null;

  function goTo(n: RepNode, animate = true) {
    setJump(!animate);
    if (animate && n.parent) n.san.includes('x') ? sound.capture() : sound.move();
    setNode(n === ch?.root ? null : n);
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === 'ArrowRight' && current.children[0]) { e.preventDefault(); goTo(current.children[0]); }
      if (e.key === 'ArrowLeft' && current.parent) { e.preventDefault(); goTo(current.parent); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const sib = current.parent?.children ?? [];
        const i = sib.indexOf(current);
        const j = e.key === 'ArrowDown' ? i + 1 : i - 1;
        if (sib[j]) { e.preventDefault(); goTo(sib[j], false); }
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });

  if (!pc || !ch || !current) return <div className="page"><div className="empty">Course not found.</div></div>;

  // Board-side: try the user's move by clicking on the board too.
  function onMove(from: string, to: string): boolean {
    const child = current!.children.find((c) => c.from === from && c.to === to);
    if (!child) return false;
    goTo(child);
    return true;
  }

  const posStats = stats[current.key];

  function renderTree(n: RepNode, depth: number): JSX.Element[] {
    // Renders the mainline of `n` inline, with sibling variations nested below each branch point.
    const out: JSX.Element[] = [];
    let cur = n;
    while (cur.children.length) {
      const main = cur.children[0];
      const alts = cur.children.slice(1);
      out.push(renderMove(main, cur.children.length > 1 || cur === n || main.color === 'w'));
      if (alts.length) {
        const rest = renderTree(main, depth + 1);
        out.push(
          <div key={`v-${main.key}-${main.san}`} className="var">
            {alts.map((a) => (
              <div key={a.san + a.key}>{renderMove(a, true)}{renderTree(a, depth + 1)}</div>
            ))}
          </div>,
        );
        out.push(<span key={`c-${main.key}`}>{rest}</span>);
        return out;
      }
      cur = main;
    }
    return out;
  }

  function renderMove(m: RepNode, withNumber: boolean) {
    const st = stats[m.parent!.key];
    const pct = st && !m.userMove ? st.moves[m.san] : undefined;
    const ms = m.userMove ? moveStats[m.parent!.key] : undefined;
    const isCur = m === current;
    return (
      <span key={m.key + m.san}>
        {(withNumber || m.color === 'w') && <span className="num">{moveLabel(m.moveNumber, m.color!)}</span>}
        <span className={`mv${m.userMove ? ' user' : ''}${isCur ? ' current' : ''}`} onClick={() => goTo(m, m.parent === current)} title={m.comment}>
          {m.san}{m.nag ?? ''}
        </span>
        {pct !== undefined && <span className="pct">{Math.round(pct)}%</span>}
        {ms && ms.attempts > 0 && ms.correct < ms.attempts && <span className="pct" style={{ color: 'var(--red-2)' }}>{ms.attempts - ms.correct}✗</span>}{' '}
      </span>
    );
  }

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <a className="btn sm ghost" href={href.course(courseId)}>← {pc.course.title}</a>
        <span className="faint">/</span>
        <select className="btn sm" value={ch.chapter.id} onChange={(e) => setChId(e.target.value)} style={{ background: 'var(--surface-2)' }}>
          {pc.chapters.map((c) => <option key={c.chapter.id} value={c.chapter.id}>{c.chapter.title}</option>)}
        </select>
        <span className="kbd-hint"><kbd>←</kbd> <kbd>→</kbd> along the line · <kbd>↑</kbd> <kbd>↓</kbd> between alternatives · or move pieces on the board</span>
      </div>

      <div className="trainer">
        <div>
          <div className={settings.showEval ? 'board-with-eval' : ''}>
          <EvalBar fen={fen} orientation={pc.course.side} enabled={settings.showEval} />
          <Board fen={fen} orientation={pc.course.side} lastMove={lastMove} movable={current.children.length ? (current.children[0].color as 'w' | 'b') : undefined} onMove={onMove} theme={settings.boardTheme} showCoordinates={settings.showCoordinates} showLegalMoves={false} animate={!jump} />
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn sm" onClick={() => goTo(ch.root, false)} disabled={!current.parent}>⇤ Start</button>
            <button className="btn sm" onClick={() => current.parent && goTo(current.parent)} disabled={!current.parent}>← Back</button>
            {current.children.map((c) => (
              <button key={c.san} className={`btn sm ${c.userMove ? 'primary' : ''}`} onClick={() => goTo(c)}>
                {moveLabel(c.moveNumber, c.color!)}{c.san}
                {stats[current.key]?.moves[c.san] !== undefined && !c.userMove && <span style={{ opacity: .7, fontWeight: 400 }}>{Math.round(stats[current.key].moves[c.san])}%</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="card">
            {current.parent ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`move-tag ${current.userMove ? 'user' : 'opp'}`}>{moveLabel(current.moveNumber, current.color!)}{current.san}{current.nag ?? ''}</span>
                  <span className="faint" style={{ fontSize: 13 }}>{current.userMove ? 'Your move' : 'Opponent'}</span>
                </div>
                <div className="comment">{current.comment ?? '—'}</div>
              </>
            ) : (
              <>
                <div className="eyebrow">{ch.chapter.title}</div>
                <div className="comment">{ch.chapter.summary}</div>
              </>
            )}
            {current.parent && <div className="faint" style={{ fontSize: 12 }}>You reach this position in ≈ {formatOdds(nodeFrequency(current, pc.course.id, pc.lines))} games of this opening.</div>}
            {posStats && (
              <div className="faint" style={{ fontSize: 12 }}>
                Lichess 1600–2000, {posStats.games.toLocaleString()} games from here: {Object.entries(posStats.moves).slice(0, 5).map(([san, p]) => `${san} ${Math.round(p)}%`).join(' · ')}
              </div>
            )}
          </div>
          <div className="card">
            <div className="eyebrow">Repertoire tree</div>
            <div className="tree">{renderTree(ch.root, 0)}</div>
          </div>
          {path.length > 0 && (
            <div className="card pad-s">
              <div className="eyebrow">Path</div>
              <div className="movelist">{path.map((n, i) => (
                <span key={i}>{(n.color === 'w' || i === 0) && <span className="num">{moveLabel(n.moveNumber, n.color!)}</span>}<span className={`mv${n.userMove ? ' user' : ''}${n === current ? ' current' : ''}`} onClick={() => goTo(n, false)}>{n.san}</span></span>
              ))}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
