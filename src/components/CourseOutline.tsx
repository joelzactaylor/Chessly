import { useState } from "react";
import { lineDisplayTitle, lineKey, type Course, type Progress } from "../library";
import { lessonUrl, sharedPly } from "../studyNavigation";
export default function CourseOutline({
  course,
  studyId,
  lineIndex,
  mode,
  progress,
  ply,
}: {
  course: Course;
  studyId: string;
  lineIndex: number;
  mode: string;
  progress: Progress;
  ply: number;
}) {
  const [query, setQuery] = useState("");
  const current = course.lessons.find((s) => s.id === studyId)!;
  const [expanded, setExpanded] = useState([current.chapterId]);
  const chapters = [
    ...new Map(course.lessons.map((s) => [s.chapterId, s.chapter])).entries(),
  ];
  return (
    <nav className="course-outline" aria-label="Course outline">
      <div className="outline-title">
        <h2>Course contents</h2>
        <span>
          {course.studies} studies · {course.variations} variations
        </span>
      </div>
      <input
        type="search"
        aria-label="Find a study"
        placeholder="Find a study…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="outline-scroll">
        {chapters.map(([id, title], index) => {
          const lessons = course.lessons.filter(
            (s) =>
              s.chapterId === id &&
              (!query ||
                `${s.title} ${s.chapter}`
                  .toLowerCase()
                  .includes(query.toLowerCase())),
          );
          if (!lessons.length) return null;
          const open = !!query || expanded.includes(id);
          return (
            <section key={id}>
              <button
                className="outline-chapter"
                onClick={() =>
                  setExpanded(
                    open ? expanded.filter((c) => c !== id) : [...expanded, id],
                  )
                }
                aria-expanded={open}
              >
                <span>
                  CHAPTER {index + 1}
                  <b>{title}</b>
                </span>
                <span>{open ? "−" : "+"}</span>
              </button>
              {open &&
                lessons.map((s) => (
                  <div
                    className={`outline-study ${s.id === studyId ? "current" : ""}`}
                    key={s.id}
                  >
                    <a
                      href={lessonUrl(mode, course.id, s.id, 0)}
                      aria-current={s.id === studyId ? "page" : undefined}
                    >
                      <span className="outline-status">
                        {s.lines.every(
                          (l) => progress.completed[lineKey(course.id, l.id)],
                        )
                          ? "✓"
                          : "○"}
                      </span>
                      <span>
                        {s.title}
                        <small>{s.lines.length} variations</small>
                      </span>
                    </a>
                    {s.id === studyId && (
                      <div className="outline-variations">
                        {s.lines.map((l, i) => (
                          <a
                            className={i === lineIndex ? "selected" : ""}
                            key={l.id}
                            href={lessonUrl(
                              mode,
                              course.id,
                              s.id,
                              i,
                              mode === "drill"
                                ? 0
                                : sharedPly(current.lines[lineIndex], l, ply),
                            )}
                            aria-current={i === lineIndex ? "step" : undefined}
                          >
                            {lineDisplayTitle(l)}
                            <span>
                              {progress.completed[lineKey(course.id, l.id)]
                                ? "✓"
                                : i === lineIndex
                                  ? "•"
                                  : ""}
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </section>
          );
        })}
        {!course.lessons.some((s) =>
          `${s.title} ${s.chapter}`.toLowerCase().includes(query.toLowerCase()),
        ) && <p className="outline-empty">No matching studies.</p>}
      </div>
    </nav>
  );
}
