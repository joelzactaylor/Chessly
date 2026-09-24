import Board from '../components/Board/Board';
import { MasteryBar, SideChip } from '../components/shared';
import { allLines, parsedCourses, lineIndexInChapter } from '../state/courses';
import { href } from '../state/router';
import { countDueLines, countMastery, nextDue, streakDays, todayStats, totals, weakPositions } from '../state/selectors';
import { useProgress } from '../state/store';
import { formatDue } from '../components/shared';
import { lineFrequencyLabel } from '../lib/frequency';
import { hasGeneratedCourses } from '../lib/courseGenerator';
import { studyPicks } from '../lib/studyPlan';

export default function Home() {
  const states = useProgress((s) => s.lines);
  const moves = useProgress((s) => s.moves);
  const sessions = useProgress((s) => s.sessions);
  const settings = useProgress((s) => s.settings);
  const learned = useProgress((s) => s.learned);
  const generated = hasGeneratedCourses();
  const starters = studyPicks(allLines, learned, states);

  const due = countDueLines(allLines, states);
  const counts = countMastery(allLines, states);
  const streak = streakDays(sessions);
  const today = todayStats(sessions);
  const all = totals(sessions);
  const weak = weakPositions(moves);
  const next = nextDue(allLines, states);
  const started = allLines.filter((l) => states[l.id] || learned[l.id]).length;
  const accuracy = all.userMoves ? Math.round((100 * (all.userMoves - all.mistakes)) / all.userMoves) : null;
  // Next line to study: first unread line in the last course, else in the first course with unread lines.
  // Next line to study: the unread line you are most likely to meet (the last course you used gets a small bonus).
  const nextStudy = (() => {
    const pick = starters[0];
    if (!pick) return null;
    const pc = parsedCourses.find((c) => c.course.id === pick.courseId)!;
    const ch = pc.chapters.find((c) => c.chapter.id === pick.chapterId)!;
    return { pc, ch, i: ch.lines.indexOf(pick) };
  })();
  // Reviews coming up in the next 7 days.
  const upcoming = (() => {
    const out = [0, 0, 0, 0, 0, 0, 0];
    const now = Date.now();
    for (const l of allLines) {
      const st = states[l.id];
      if (!st || st.due <= now) continue;
      const d = Math.floor((st.due - now) / 86_400_000);
      if (d < 7) out[d]++;
    }
    return out;
  })();

  return (
    <div className="page fade-in">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div className="eyebrow">Throughline</div>
          <h1 className="title-xl" style={{ marginTop: 6 }}>One move per position.</h1>
          <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>
            Your repertoire has exactly one answer everywhere you are to move. Learn it, drill it, and the spaced-repetition scheduler tells you when a line needs another look.
          </p>
        </div>
        <div className="btn-row">
          {!generated ? (
            <a className="btn primary lg" href={href.settings()}>Build my courses</a>
          ) : due > 0 ? (
            <a className="btn primary lg" href={href.drillDue()}>Review {due} due {due === 1 ? 'line' : 'lines'}</a>
          ) : started === 0 ? (
            <a className="btn primary lg" href={href.course(parsedCourses[0].course.id)}>Start with {parsedCourses[0].course.title}</a>
          ) : (
            <a className="btn primary lg" href={nextStudy ? href.learn(nextStudy.pc.course.id, nextStudy.ch.chapter.id, nextStudy.i) : href.mixedAll()}>{nextStudy ? 'Study next line' : 'Mixed practice'}</a>
          )}
          {due > 0 && nextStudy && <a className="btn lg" href={href.learn(nextStudy.pc.course.id, nextStudy.ch.chapter.id, nextStudy.i)}>Study next line</a>}
          {started > 0 && (due > 0 || nextStudy) && <a className="btn lg" href={href.mixedAll()}>Mixed practice</a>}
          {started > 0 && <a className="btn lg" href={href.quiz('all')}>Quick quiz</a>}
          {weak.length > 0 && <a className="btn lg" href={href.quiz('weak')}>Fix {weak.length} weak {weak.length === 1 ? 'position' : 'positions'}</a>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="eyebrow">Prepare for your next game</div>
        <h2 className="title-m" style={{ marginTop: 6 }}>Learn one idea. Recall it. Use it.</h2>
        <p className="muted" style={{ marginTop: 8 }}>Choose one line below, read the move explanations and endpoint checklist, then play it once from memory. After a game, paste its PGN to find your next study target.</p>
        <div className="list" style={{ marginTop: 12 }}>{starters.map((line) => <a className="row clickable" key={line.id} href={href.learn(line.courseId, line.chapterId, lineIndexInChapter(line))}>
          <div className="grow"><div className="t">{parsedCourses.find((c) => c.course.id === line.courseId)?.course.title}</div><div className="s">{line.title}</div></div><span className="btn sm">Learn →</span>
        </a>)}</div>
        <div className="btn-row" style={{ marginTop: 12 }}><a className="btn primary" href={href.gameReview()}>Review my latest game</a>{due > 0 && <a className="btn" href={href.drillDue()}>Refresh due lines first</a>}</div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 26 }}>
        <div className="card pad-s stat"><span className={`v ${due ? 'accent' : ''}`}>{due}</span><span className="l">{due ? 'lines due for review' : next ? `nothing due · next ${formatDue(next)}` : 'nothing due yet'}</span></div>
        <div className="card pad-s stat"><span className="v green">{counts.mastered}<span className="faint" style={{ fontSize: 16, fontWeight: 500 }}> / {allLines.length}</span></span><span className="l">lines mastered · {counts.familiar} familiar · {counts.learning} learning</span></div>
        <div className="card pad-s stat">
          <span className="v">{streak}<span className="faint" style={{ fontSize: 16, fontWeight: 500 }}> {streak === 1 ? 'day' : 'days'}</span></span>
          <span className="l">streak · today {today.lines}/{settings.dailyGoal} lines</span>
          <div className="bar" style={{ marginTop: 6 }}><span className={today.lines >= settings.dailyGoal ? 'mastered' : 'familiar'} style={{ width: `${Math.min(100, (100 * today.lines) / settings.dailyGoal)}%` }} /></div>
        </div>
        <div className="card pad-s stat"><span className="v">{accuracy === null ? '—' : `${accuracy}%`}</span><span className="l">move accuracy · {all.lines} lines drilled</span></div>
      </div>

      {started > 0 && (
        <div className="grid cols-2" style={{ marginBottom: 26 }}>
          <div className="card pad-s">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Up next</div>
            {nextStudy ? (
              <a className="row clickable" href={href.learn(nextStudy.pc.course.id, nextStudy.ch.chapter.id, nextStudy.i)} style={{ padding: '8px 12px', borderBottom: 'none' }}>
                <div className="grow"><div className="t" style={{ fontSize: 14 }}>Learn: {nextStudy.ch.chapter.title} · line {nextStudy.i + 1}</div><div className="s">{nextStudy.pc.course.title} · {nextStudy.ch.lines[nextStudy.i].title} · {lineFrequencyLabel(nextStudy.ch.lines[nextStudy.i], nextStudy.pc.lines)}</div></div>
                <span className="faint" style={{ fontSize: 12 }}>→</span>
              </a>
            ) : <div className="muted" style={{ fontSize: 14, padding: '8px 12px' }}>Every line has been read. Keep the reviews going and use mixed practice.</div>}
          </div>
          <div className="card pad-s">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Reviews this week</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 54, padding: '0 4px' }}>
              {upcoming.map((n, d) => {
                const max = Math.max(1, ...upcoming, due);
                const v = d === 0 ? n + due : n;
                return (
                  <div key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${v} lines`}>
                    <span className="faint" style={{ fontSize: 11 }}>{v || ''}</span>
                    <div style={{ width: '100%', height: Math.max(3, (36 * v) / max), background: d === 0 && due ? 'var(--accent)' : 'var(--surface-3)', borderRadius: 3 }} />
                    <span className="faint" style={{ fontSize: 11 }}>{d === 0 ? 'today' : d === 1 ? 'tmrw' : `+${d}d`}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div className="eyebrow" style={{ marginBottom: 12 }}>Your repertoire</div>
      <div className="grid cols-2">
        {parsedCourses.map((pc) => {
          const c = pc.course;
          const cDue = countDueLines(pc.lines, states);
          const cCounts = countMastery(pc.lines, states);
          return (
            <a key={c.id} className="card hover course-card" href={generated ? href.course(c.id) : href.settings()}>
              <div className="thumb">
                <Board fen={c.thumbnailFen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'} orientation={c.side} showCoordinates={false} theme={settings.boardTheme} animate={false} />
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <SideChip side={c.side} />
                  {cDue > 0 && <span className="chip due">{cDue} due</span>}
                </div>
                <div>
                  <div className="title-m">{c.title}</div>
                  <div className="faint" style={{ fontSize: 13 }}>{c.subtitle}</div>
                </div>
                <MasteryBar lines={pc.lines} states={states} />
                <div className="faint" style={{ fontSize: 13 }}>
                  {generated ? `${pc.chapters.length} chapters · ${pc.lines.length} lines · ${cCounts.mastered} mastered${cCounts.new === pc.lines.length ? ' · not started' : ''}` : 'Ready to generate from Lichess'}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
