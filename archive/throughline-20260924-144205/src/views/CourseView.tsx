import Board from '../components/Board/Board';
import { MasteryBar, MasteryChip, SideChip, formatDue } from '../components/shared';
import { isDue } from '../lib/srs';
import { sanString } from '../lib/tree';
import { getCourse } from '../state/courses';
import { href } from '../state/router';
import { countDueLines, countMastery } from '../state/selectors';
import { useProgress } from '../state/store';
import { useEffect, useState } from 'react';
import { lineFrequencyLabel, lineFrequency } from '../lib/frequency';
import { endpointLabel } from '../lib/coaching';
import { studyPicks } from '../lib/studyPlan';

export default function CourseView({ courseId }: { courseId: string }) {
  const pc = getCourse(courseId);
  const states = useProgress((s) => s.lines);
  const learned = useProgress((s) => s.learned);
  const settings = useProgress((s) => s.settings);
  const setLastCourse = useProgress((s) => s.setLastCourse);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  useEffect(() => { if (pc) setLastCourse(pc.course.id); }, [pc, setLastCourse]);
  if (!pc) return <div className="page"><div className="empty">Course not found.</div></div>;
  const c = pc.course;
  const due = countDueLines(pc.lines, states);
  const counts = countMastery(pc.lines, states);
  // First line in course order that has not been read in Learn yet.
  // Next line to study: the most common unread line in the course, not the first in the file.
  const freq = new Map(pc.lines.map((l) => [l.id, lineFrequency(l, pc.lines)]));
  const nextStudy = (() => {
    const pick = studyPicks(pc.lines, learned, states, 1)[0];
    if (!pick) return null;
    return { chapterId: pick.chapterId, index: pc.chapters.find((ch) => ch.chapter.id === pick.chapterId)!.lines.indexOf(pick) };
  })();

  return (
    <div className="page fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 28, alignItems: 'start' }} className="course-head">
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <SideChip side={c.side} />
            <span className="faint" style={{ fontSize: 13 }}>{pc.chapters.length} chapters · {pc.lines.length} lines</span>
          </div>
          <h1 className="title-xl">{c.title}</h1>
          <div className="muted" style={{ marginTop: 4, fontSize: 16 }}>{c.subtitle}</div>
          <div className="prose" style={{ marginTop: 16 }}>
            {c.description.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="btn-row" style={{ marginTop: 18 }}>
            {due > 0 && <a className="btn primary" href={href.drillCourse(c.id)}>Review {due} due</a>}
            {nextStudy && <a className={`btn ${due ? '' : 'primary'}`} href={href.learn(c.id, nextStudy.chapterId, nextStudy.index)}>{counts.new === pc.lines.length ? 'Start studying' : 'Continue studying'}</a>}
            <a className="btn" href={href.mixedCourse(c.id)}>Mixed practice</a>
            <a className="btn" href={href.quiz('course', c.id)}>Quick quiz</a>
            <a className="btn ghost" href={href.explore(c.id)}>Explore the tree</a>
          </div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <Board fen={c.thumbnailFen ?? ''} orientation={c.side} showCoordinates={false} theme={settings.boardTheme} animate={false} />
          <div style={{ marginTop: 12 }}><MasteryBar lines={pc.lines} states={states} /></div>
          <div className="faint" style={{ fontSize: 13, marginTop: 8 }}>{counts.mastered} mastered · {counts.familiar} familiar · {counts.learning} learning · {counts.new} new</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Key ideas</div>
        <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {c.ideas.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>

      <div className="eyebrow" style={{ margin: '28px 0 12px' }}>Chapters</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pc.chapters.map((ch, ci) => {
          const chDue = countDueLines(ch.lines, states);
          const chCounts = countMastery(ch.lines, states);
          const orderedLines = [...ch.lines].sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0));
          const visibleLines = expandedChapters[ch.chapter.id] ? orderedLines : orderedLines.slice(0, 50);
          return (
            <div key={ch.chapter.id} className="card">
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div className="faint" style={{ fontSize: 12, fontWeight: 600 }}>CHAPTER {ci + 1}</div>
                  <h2 className="title-m" style={{ marginTop: 2 }}>{ch.chapter.title}</h2>
                  <p className="muted" style={{ marginTop: 6 }}>{ch.chapter.summary}</p>
                  <div style={{ marginTop: 10, maxWidth: 420 }}><MasteryBar lines={ch.lines} states={states} /></div>
                  <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>{ch.lines.length} lines · {ch.lines.filter((l) => learned[l.id] || states[l.id]).length} read · {chCounts.mastered} mastered{chDue ? ` · ${chDue} due` : ''}</div>
                </div>
                <div className="btn-row">
                  {(() => {
                    let i = -1; let bestF = -1;
                    ch.lines.forEach((l, k) => { if (!learned[l.id] && !states[l.id] && (freq.get(l.id) ?? 0) > bestF) { bestF = freq.get(l.id) ?? 0; i = k; } });
                    const all = i < 0; const started = ch.lines.some((l) => learned[l.id] || states[l.id]);
                    return <a className={`btn ${all ? '' : 'primary'}`} href={href.learn(c.id, ch.chapter.id, all ? 0 : i)}>{all ? 'Re-read' : started ? 'Continue' : 'Study'}</a>;
                  })()}
                  <a className={`btn ${ch.lines.every((l) => learned[l.id] || states[l.id]) ? 'primary' : ''}`} href={href.mixedChapter(c.id, ch.chapter.id)}>Mixed practice</a>
                  <a className="btn" href={href.drillChapter(c.id, ch.chapter.id)}>All lines</a>
                  <a className="btn ghost" href={href.explore(c.id, ch.chapter.id)}>Explore</a>
                </div>
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>Lines are listed by how often you will actually face them.</div>
              <div className="list" style={{ marginTop: 4 }}>
                {visibleLines.map((l) => {
                  const li = ch.lines.indexOf(l);
                  const st = states[l.id];
                  return (
                    <div key={l.id} className="row">
                      <div className="grow">
                        <div className="t" style={{ fontSize: 14 }}>{l.title}{learned[l.id] && !st ? <span className="faint" style={{ fontWeight: 400 }}> · read</span> : ''}</div>
                        <div className="s mono">{sanString(l.nodes)}</div>
                        <div className="faint" style={{ fontSize: 12 }}>{endpointLabel(l.nodes[l.nodes.length - 1]?.comment)}</div>
                      </div>
                      <span className="chip">{lineFrequencyLabel(l, pc.lines)}</span>
                      <span className="faint" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{st ? (isDue(st) ? '' : formatDue(st.due)) : `${l.userMoveCount} moves`}</span>
                      <MasteryChip state={st} due={isDue(st)} />
                      <a className="btn sm ghost" href={href.learn(c.id, ch.chapter.id, li)}>Learn</a>
                      <a className="btn sm" href={href.drillLine(c.id, ch.chapter.id, li)}>Drill</a>
                    </div>
                  );
                })}
              </div>
              {orderedLines.length > 50 && <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setExpandedChapters((current) => ({ ...current, [ch.chapter.id]: !current[ch.chapter.id] }))}>
                {expandedChapters[ch.chapter.id] ? 'Show fewer lines' : `Show all ${orderedLines.length.toLocaleString()} lines`}
              </button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
