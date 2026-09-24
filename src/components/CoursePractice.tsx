import { useRef, useState } from 'react';
import { SessionBoard } from './PathSession';
import { lineKey, type Course, type Lesson, type Progress } from '../library';
import { shuffled } from '../pathNavigation';
type Pick = { study: Lesson; variationId: string };
export default function CoursePractice({ course, progress, update, review = false }: {
  course: Course; progress: Progress; update: (fn: (p: Progress) => Progress) => void; review?: boolean;
}) {
  const chapters = [...new Map(course.lessons.map(s => [s.chapterId, s.chapter])).entries()];
  const [selected, setSelected] = useState<string[]>([]);
  const [learnedOnly, setLearnedOnly] = useState(false);
  const eligible = course.lessons.flatMap(study => study.lines
    .filter(line => !learnedOnly || !!progress.completed[lineKey(course.id, line.id)])
    .map(line => ({ study, variationId: line.id })));
  const availableChapters = chapters.filter(([id]) => eligible.some(pick => pick.study.chapterId === id));
  const allSelected = availableChapters.length > 0 && availableChapters.every(([id]) => selected.includes(id));
  const [queue, setQueue] = useState<Pick[] | null>(() => review ? shuffled(course.lessons.flatMap(study => study.lines.filter(line => progress.completed[lineKey(course.id, line.id)]).map(line => ({ study, variationId: line.id })))) : null);
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const recorded = useRef(new Set<number>());
  if (finished) return <main className="page"><h1>Practice complete!</h1><p>{queue!.length} variations reviewed.</p><a className="button primary" href={`#/courses/${course.id}`}>Back to course</a></main>;
  if (queue?.length) {
    const pick = queue[index];
    const record = ({ mistakes, hints }: { mistakes: number; hints: number }) => {
      if (recorded.current.has(index)) return;
      recorded.current.add(index);
      const at = new Date().toISOString();
      update(p => ({ ...p, completed: { ...p.completed, [lineKey(course.id, pick.variationId)]: at },
        reviews: [...p.reviews, { course: course.id, line: pick.variationId, at, mistakes: mistakes + hints }] }));
    };
    return <SessionBoard key={`${index}/${pick.variationId}`} course={course} study={pick.study} step={{ variationId: pick.variationId, guided: false }}
      label={review ? 'PRACTICE' : 'DRILL SHUFFLE'} index={index} count={queue.length} nextLabel={index === queue.length - 1 ? 'Finish' : 'Next Drill'}
      onCompleted={record}
      onNext={(result) => {
        record(result);
        if (index < queue.length - 1) setIndex(index + 1); else setFinished(true);
      }} />;
  }
  if (review) return <main className="page"><a className="back-link" href={`#/courses/${course.id}`}>← {course.title}</a><h1>Course practice</h1><p>Complete a lesson to add variations to your local practice queue.</p><a className="button primary" href={`#/drill-shuffle/${course.id}/setup`}>Drill any chapter</a></main>;
  const selectedQueue = eligible.filter(pick => selected.includes(pick.study.chapterId));
  const count = selectedQueue.length;
  return <main className="page practice-page shuffle-page">
    <a className="back-link" href={`#/courses/${course.id}`}>← {course.title}</a>
    <div className="shuffle-heading"><img src={course.image} alt="" /><div><span className="eyebrow">{course.title}</span>
      <h1>Drill Shuffle</h1><p>Select chapters and practise their variations in random order.</p></div></div>
    <div className="panel practice-config shuffle-config">
      <div className="shuffle-filter"><label className="shuffle-option"><input type="checkbox" checked={learnedOnly} onChange={e => setLearnedOnly(e.target.checked)} />
        <span>Only learned variations<small>Include variations you have successfully reviewed in lessons or drills.</small></span>
      </label>
      {learnedOnly && !eligible.length && <p role="status">No learned variations yet. Complete a lesson or turn off this filter to practise any variation.</p>}
      </div>
      <div className="shuffle-chapters"><h2>Choose chapters</h2>
      <label className="shuffle-option shuffle-select-all"><input type="checkbox" checked={allSelected}
        ref={element => { if (element) element.indeterminate = !allSelected && availableChapters.some(([id]) => selected.includes(id)); }}
        disabled={!availableChapters.length}
        onChange={() => setSelected(allSelected ? [] : availableChapters.map(([id]) => id))} />
        <span>Select All Chapters<small>{eligible.length} {learnedOnly ? 'learned ' : ''}{eligible.length === 1 ? 'variation' : 'variations'} available</small></span>
      </label>
      {chapters.map(([id, title], i) => {
        const chapterCount = eligible.filter(pick => pick.study.chapterId === id).length;
        return <label className="shuffle-option" key={id}>
          <input type="checkbox" checked={chapterCount > 0 && selected.includes(id)} disabled={!chapterCount}
            onChange={() => setSelected(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id])} />
          <span className="shuffle-chapter-title"><small>Chapter {i + 1}</small><strong>{title}</strong></span>
          <span className="shuffle-count">{chapterCount}<small>{learnedOnly ? 'learned' : chapterCount === 1 ? 'variation' : 'variations'}</small></span>
        </label>;
      })}
      </div>
      <div className="shuffle-start"><p role="status"><strong>{count}</strong> {count === 1 ? 'variation' : 'variations'} selected</p>
      <button className="button primary" disabled={!count} onClick={() => setQueue(shuffled(selectedQueue))}>Start Drill Shuffle · {count} {count === 1 ? 'variation' : 'variations'}</button></div>
    </div>
  </main>;
}
