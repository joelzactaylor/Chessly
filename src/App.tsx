import MoveControls from "./components/MoveControls";
import CoursePractice from "./components/CoursePractice";
import PathSession from "./components/PathSession";
import { nextTile, tileAvailable, tileComplete, tileUrl } from "./pathNavigation";
import CourseOutline from "./components/CourseOutline";
import { continuations, lessonUrl } from "./studyNavigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Chess } from "chess.js";
import Board, { type Arrow, type SquareMark } from "./components/Board/Board";
import ErrorBoundary from "./components/ErrorBoundary";
import {
  completion,
  download,
  lineKey,
  loadCourse,
  percent,
  readProgress,
  storageKey,
  validProgress,
  type Course,
  type CourseCard,
  type Progress,
} from "./library";

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h5v-7h4v7h5V10" />
      </>
    ),
    courses: (
      <>
        <rect x="4" y="3" width="16" height="5" rx="2" />
        <path d="M4 12h16M4 16h16M4 20h16" />
      </>
    ),
    rank: (
      <>
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="3" width="4" height="18" rx="1" />
        <rect x="17" y="8" width="4" height="13" rx="1" />
      </>
    ),
    practice: (
      <>
        <path d="m6 4-3 3 14 14 4-4L7 3M3 17l4 4M17 3l4 4M5 15l4 4M15 5l4 4" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22z" />
        <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22z" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none" />,
    dumbbell: <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m6 9 6 6 6-6" />,
    bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    flip: (
      <>
        <path d="M4 8h15l-4-4M20 16H5l4 4" />
      </>
    ),
    star: <path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.courses}
    </svg>
  );
}
function OpeningTileIcon({ variant }: { variant: "book" | "drill" | "scholar" }) {
  return (
    <svg width="120" height="105" viewBox="0 0 120 105" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative OpeningPath_tileIcon__PA885">
      {variant === "drill" ? (
        <>
          <path d="M3.772 57.4L3.49 44.53l112.513-.8.154 15.538a8 8 0 01-3.176 6.461L70.758 97.644a16 16 0 01-19.367-.053L6.911 63.579a8 8 0 01-3.14-6.18z" fill="var(--cyan-400-600)" strokeWidth="2" />
          <path d="M113.976 39.383L70.496 7.027a16 16 0 00-18.962-.104L5.564 40.354c-2.747 1.997-2.746 6.093.001 8.089l45.359 32.955a16 16 0 0019.154-.258l43.959-33.782c2.63-2.02 2.599-5.995-.061-7.975z" fill="var(--cyan-100-900)" strokeWidth="2" />
          <path d="M71.535 38.075l.688-5.68c.16-1.324.24-1.984.102-2.534a2.84 2.84 0 00-1.248-1.738c-.46-.284-1.08-.37-2.314-.54-1.236-.174-1.854-.26-2.368-.11a2.709 2.709 0 00-1.62 1.336c-.266.494-.432 1.866-.592 3.19L51.92 30.293c.16-1.324.328-2.696.188-3.246a2.84 2.84 0 00-1.248-1.736c-.46-.284-1.08-.37-2.314-.542-1.236-.172-1.854-.26-2.366-.11a2.709 2.709 0 00-1.622 1.338c-.266.494-.346 1.154-.506 2.48l-.688 5.68c-.16 1.32-.24 1.984-.104 2.534a2.848 2.848 0 001.25 1.736c.46.284 1.08.37 2.314.54 1.236.174 1.852.26 2.366.112.684-.2 1.268-.68 1.62-1.338.266-.494.434-1.866.594-3.188l12.262 1.706c-.16 1.322-.326 2.694-.188 3.244.184.734.634 1.36 1.248 1.738.462.284 1.08.37 2.316.54 1.234.174 1.852.26 2.366.11a2.709 2.709 0 001.62-1.336c.266-.494.348-1.156.508-2.48zM54.367 60.067l-1.384-5.534c-.322-1.288-.484-1.934-.414-2.498a2.911 2.911 0 011.024-1.9c.42-.346 1.022-.518 2.226-.864 1.204-.344 1.806-.518 2.332-.442.704.1 1.34.492 1.772 1.096.324.452.66 1.788.98 3.076l11.946-3.428c-.322-1.29-.656-2.626-.588-3.19a2.92 2.92 0 011.024-1.9c.422-.346 1.024-.518 2.228-.864 1.202-.344 1.804-.518 2.332-.442.702.1 1.34.492 1.772 1.096.324.452.484 1.096.808 2.384l1.384 5.534c.32 1.288.482 1.932.414 2.498a2.915 2.915 0 01-1.024 1.898c-.42.346-1.024.52-2.226.864-1.204.346-1.806.52-2.334.444a2.64 2.64 0 01-1.772-1.096c-.324-.452-.658-1.788-.98-3.076L61.943 57.15c.32 1.288.656 2.624.586 3.19a2.913 2.913 0 01-1.022 1.898c-.422.346-1.024.52-2.228.864-1.202.344-1.804.518-2.332.444a2.64 2.64 0 01-1.772-1.096c-.324-.452-.486-1.096-.808-2.384z" fill="var(--cyan-600-300)" />
        </>
      ) : variant === "scholar" ? (
        <>
          <path d="M3.772 57.4L3.49 44.53l112.513-.8.154 15.538a8 8 0 01-3.176 6.461L70.758 97.644a16 16 0 01-19.367-.053L6.911 63.579a8 8 0 01-3.14-6.18z" fill="var(--cyan-400-600)" strokeWidth="2" />
          <path d="M113.976 39.383L70.496 7.027a16 16 0 00-18.962-.104L5.564 40.354c-2.747 1.997-2.746 6.093.001 8.089l45.359 32.955a16 16 0 0019.154-.258l43.959-33.782c2.63-2.02 2.599-5.995-.061-7.975z" fill="var(--cyan-600-300)" strokeWidth="2" />
          <path fillRule="evenodd" clipRule="evenodd" d="M78.338 44.936a98.5 98.5 0 01.936 7.473 1.8 1.8 0 01-1.006 1.774 63.706 63.706 0 00-14.233 9.48 1.8 1.8 0 01-2.38 0 63.87 63.87 0 00-7.429-5.636 16.766 16.766 0 002.604-8.283 72.001 72.001 0 012.998 1.915 5.4 5.4 0 006.035 0 71.82 71.82 0 0112.475-6.723zM51.181 56.17a63.657 63.657 0 013.043 1.856 16.856 16.856 0 01-2.3 2.867 1.8 1.8 0 01-2.545-2.546c.68-.68 1.268-1.419 1.769-2.196a63.422 63.422 0 00-3.726-1.968 1.8 1.8 0 01-1.005-1.774 98.5 98.5 0 01.935-7.473 71.64 71.64 0 015.893 2.78v1.297a13.17 13.17 0 01-2.094 7.14l.03.017zM62.04 23.378a1.801 1.801 0 011.612 0 98.548 98.548 0 0119.677 13.019 1.8 1.8 0 01-.612 3.084 75.295 75.295 0 00-18.865 9.193 1.8 1.8 0 01-2.012 0 75.654 75.654 0 00-4.994-3.09v-2.826c0-.584.278-1.11.724-1.42a85.23 85.23 0 017.933-4.88 1.8 1.8 0 00-1.714-3.165 88.818 88.818 0 00-8.27 5.087 5.317 5.317 0 00-2.273 4.378v.913a75.106 75.106 0 00-10.272-4.19 1.8 1.8 0 01-.61-3.084 98.543 98.543 0 0119.676-13.019z" fill="var(--cyan-100-900)" />
        </>
      ) : (
        <>
          <path d="M3.77179 57.3991L3.49048 44.5308L116.003 43.7305L116.157 59.2678C116.182 61.8031 115.004 64.2002 112.981 65.729L70.7576 97.6443C65.023 101.979 57.1016 101.957 51.3912 97.5905L6.91059 63.5794C4.97982 62.1031 3.82491 59.8291 3.77179 57.3991Z" fill="var(--cyan-400-600)" strokeWidth="2" />
          <path d="M113.976 39.3827L70.4967 7.02708C64.8797 2.847 57.1971 2.80476 51.5344 6.92282L5.56319 40.3541C2.81673 42.3514 2.81766 46.4469 5.56501 48.443L50.924 81.3981C56.6604 85.5658 64.4557 85.4609 70.0779 81.1404L114.037 47.3584C116.667 45.3374 116.636 41.3628 113.976 39.3827Z" fill="var(--cyan-600-300)" strokeWidth="2" />
          <path d="M64.6453 60.5808C67.5443 58.5831 71.0561 57.4141 74.8453 57.4141C76.55 57.4141 78.1966 57.6506 79.7554 58.0914C80.2981 58.2449 80.8813 58.1352 81.3311 57.795C81.7809 57.4547 82.0453 56.9234 82.0453 56.3594V29.9594C82.0453 29.1539 81.5102 28.4465 80.7352 28.2273C78.8607 27.6972 76.8846 27.4141 74.8453 27.4141C71.1579 27.4141 67.6838 28.3392 64.6453 29.9698V60.5808Z" fill="var(--cyan-100-900)" />
          <path d="M61.0453 29.9698C58.0068 28.3392 54.5326 27.4141 50.8453 27.4141C48.806 27.4141 46.8298 27.6973 44.9554 28.2273C44.1803 28.4465 43.6453 29.1539 43.6453 29.9594V56.3594C43.6453 56.9234 43.9096 57.4547 44.3594 57.795C44.8092 58.1352 45.3925 58.2449 45.9352 58.0914C47.4939 57.6506 49.1405 57.4141 50.8453 57.4141C54.6345 57.4141 58.1463 58.583 61.0453 60.5808V29.9698Z" fill="var(--cyan-100-900)" />
        </>
      )}
    </svg>
  );
}
function Logo() {
  return (
    <a className="logo" href="#/home" aria-label="Chess library home">
      <svg viewBox="0 0 72 90" width="27" height="35" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 61V37C12 22 19 12 29 8c10-5 20-3 29 3l9-7v52c0 5-5 6-8 2L45 41c-4-5-10 1-6 5l28 32v10H12v-8l7-9Z"
        />
      </svg>
      <span>chessly</span>
      <small>LOCAL</small>
    </a>
  );
}
function useRoute() {
  const [route, setRoute] = useState(location.hash.slice(2) || "courses");
  useEffect(() => {
    const handler = (event: HashChangeEvent) => {
      setRoute(location.hash.slice(2) || "courses");
      const studyPath = (url: string) =>
        new URL(url).hash.split("?")[0].split("/").slice(2, 4).join("/");
      const isLesson = /#\/(learn|explore|drill)\//;
      if (!(
        isLesson.test(event.oldURL) &&
        isLesson.test(event.newURL) &&
        studyPath(event.oldURL) === studyPath(event.newURL)
      ))
        window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return route;
}
function go(path: string) {
  location.hash = path.startsWith("#") ? path : "/" + path;
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name="courses" size={34} />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
function CourseTile({
  course,
  p,
  rank,
}: {
  course: CourseCard;
  p: Progress;
  rank?: number;
}) {
  return (
    <a className="course-card" href={`#/courses/${course.id}`}>
      <div className="card-top">
        <img src={course.image} alt="" loading="lazy" />
        {rank ? (
          <span className="rank-badge">{rank}</span>
        ) : (
          <span className="side-tag">
            {course.side === "White" ? "○" : "●"} {course.side}
          </span>
        )}
      </div>
      <h3>{course.title}</h3>
      <p className="card-description">{course.description}</p>
      <div className="card-bottom">
        {completion(course, p) > 0 ? (
          <div className="tiny-progress">
            <b>{percent(course, p)}%</b>
            <span>
              <i style={{ width: percent(course, p) + "%" }} />
            </span>
          </div>
        ) : (
          <span className="course-count">{course.studies} studies</span>
        )}
        <span className="button secondary small">
          {completion(course, p) > 0 ? "Continue Course" : "Start Course"}
        </span>
      </div>
    </a>
  );
}
function CourseRow({
  title,
  courses,
  p,
  subtitle,
}: {
  title: string;
  courses: CourseCard[];
  p: Progress;
  subtitle?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!courses.length) return null;
  return (
    <section className="course-section">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="row-arrows">
          <button
            aria-label={`Scroll ${title} left`}
            onClick={() =>
              ref.current?.scrollBy({ left: -350, behavior: "smooth" })
            }
          >
            <span className="back-icon">
              <Icon name="chevron" size={18} />
            </span>
          </button>
          <button
            aria-label={`Scroll ${title} right`}
            onClick={() =>
              ref.current?.scrollBy({ left: 350, behavior: "smooth" })
            }
          >
            <Icon name="chevron" size={18} />
          </button>
        </div>
      </div>
      <div className="course-row" ref={ref}>
        {courses.map((c) => (
          <CourseTile key={c.id} course={c} p={p} />
        ))}
      </div>
    </section>
  );
}
const categories = ["All", "White Openings", "Black Openings"];
function Catalog({ courses, p }: { courses: CourseCard[]; p: Progress }) {
  const [category, setCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [saved, setSaved] = useState(false);
  const filtered = courses.filter(
    (c) =>
      (!saved || p.saved.includes(c.id)) &&
      (!search ||
        `${c.title} ${c.description}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (category === "White Openings"
        ? c.side === "White"
        : category === "Black Openings"
          ? c.side === "Black"
          : true),
  );
  return (
    <>
      <div className="library-banner">
        <span>
          <b>Your next great move starts here.</b>{" "}
          <span>50 courses. A world of possibilities.</span>
        </span>
        <a href="#/practice" className="button banner-button">
          Let’s Practice <Icon name="arrow" size={16} />
        </a>
      </div>
      <main className="page">
        <div className="catalog-tools">
          <label className="search">
            <Icon name="search" size={20} />
            <input
              aria-label="Search courses"
              placeholder="Search courses"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Clear search">
                <Icon name="close" size={17} />
              </button>
            )}
          </label>
          <button
            className={`saved-filter ${saved ? "chosen" : ""}`}
            onClick={() => setSaved(!saved)}
            aria-pressed={saved}
          >
            <Icon name="bookmark" size={18} /> My courses
          </button>
        </div>
        <div className="category-tabs" aria-label="Course categories">
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
            >
              {c}
            </button>
          ))}
        </div>
        {!filtered.length ? (
          <Empty title="No courses found">
            {saved
              ? "Save a course using “Add to my courses” on its course page."
              : "Try another opening or clear your search."}
          </Empty>
        ) : category !== "All" || search || saved ? (
          <>
            <div className="section-heading">
              <h2>
                {saved ? "My courses" : search ? "Search results" : category}
              </h2>
              <span className="muted">{filtered.length} courses</span>
            </div>
            <div className="course-grid">
              {filtered.map((c) => (
                <CourseTile key={c.id} course={c} p={p} />
              ))}
            </div>
          </>
        ) : (
          <>
            {p.last && (
              <CourseRow
                title="Pick up where you left off"
                courses={courses.filter((c) => c.id === p.last?.course)}
                p={p}
              />
            )}
            <CourseRow
              title="Explore your library"
              subtitle="Your next favorite opening is waiting."
              courses={courses.slice(0, 10)}
              p={p}
            />
            <CourseRow
              title="White Openings"
              courses={courses.filter((c) => c.side === "White")}
              p={p}
            />
            <CourseRow
              title="Black Openings"
              courses={courses.filter((c) => c.side === "Black")}
              p={p}
            />
          </>
        )}
      </main>
    </>
  );
}
function Home({ courses, p }: { courses: CourseCard[]; p: Progress }) {
  const saved = courses.filter((c) => p.saved.includes(c.id));
  return (
    <main className="page">
      <section className="home-hero">
        <div>
          <span className="eyebrow">YOUR CHESS JOURNEY</span>
          <h1>
            A little practice.
            <br />A stronger game.
          </h1>
          <p>
            Build your repertoire, discover a new opening,
            <br className="desktop" /> and make your next move with confidence.
          </p>
          <div className="button-row">
            <a
              className="button primary"
              href={
                p.last
                  ? `#/resume/${p.last.course}`
                  : "#/courses"
              }
            >
              {p.last ? "Continue learning" : "Explore courses"}{" "}
              <Icon name="arrow" size={18} />
            </a>
            <a className="button secondary" href="#/practice">
              Practice
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-checkers" />
          <img src={`${import.meta.env.BASE_URL}pieces/neo/wn.png`} alt="" />
          <span className="hero-star">✦</span>
        </div>
      </section>
      <div className="stats-grid">
        <div>
          <Icon name="courses" />
          <b>{courses.length}</b>
          <span>Courses to explore</span>
        </div>
        <div>
          <Icon name="bookmark" />
          <b>{p.saved.length}</b>
          <span>Saved courses</span>
        </div>
        <div>
          <Icon name="check" />
          <b>{Object.keys(p.completed).length}</b>
          <span>Variations studied</span>
        </div>
        <div>
          <Icon name="practice" />
          <b>{p.reviews.length}</b>
          <span>Practice sessions</span>
        </div>
      </div>
      <CourseRow title="My courses" courses={saved} p={p} />
      {!saved.length && (
        <div className="save-callout">
          <Icon name="bookmark" />
          <div>
            <h3>Make this library yours</h3>
            <p>Save the openings you want to play. They’ll be waiting here.</p>
          </div>
          <a className="button secondary" href="#/courses">
            Find a course
          </a>
        </div>
      )}
      <CourseRow
        title="Find your next opening"
        courses={courses.slice(0, 10)}
        p={p}
      />
    </main>
  );
}
function useCourse(id: string) {
  const [course, setCourse] = useState<Course | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setCourse(null);
    setError("");
    loadCourse(id)
      .then((c) => {
        if (live) setCourse(c);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id]);
  return { course: course?.lessons.every(s => Array.isArray(s.tiles)) ? course : null, error };
}
function CoursePage({
  id,
  p,
  update,
}: {
  id: string;
  p: Progress;
  update: (fn: (p: Progress) => Progress) => void;
}) {
  const { course, error } = useCourse(id);
  const [open, setOpen] = useState<string[]>([]);
  const [activeStudies, setActiveStudies] = useState<Record<string, string>>({});
  const pageRef = useRef<HTMLElement>(null);
  const current = course ? nextTile(course, p) : null;
  const landingStudy = current?.study ?? course?.lessons.at(-1);
  const hasProgress = p.last?.course === id || Object.keys(p.tiles ?? {}).some(key => key.startsWith(id + "/")) || Object.keys(p.completed).some(key => key.startsWith(id + "/"));
  useEffect(() => {
    if (!landingStudy) return;
    setOpen([landingStudy.chapterId]);
    setActiveStudies({ [landingStudy.chapterId]: landingStudy.id });
    if (!hasProgress) return;
    // Wait for the chapter's expansion transition before measuring its tiles.
    const timer = window.setTimeout(() => {
      const target = current
        ? pageRef.current?.querySelector(`[data-tile-id="${current.tile.id}"]`)
        : pageRef.current?.querySelector(`[data-study-id="${landingStudy.id}"]`);
      target?.scrollIntoView({ block: "center", behavior: "instant" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [id, landingStudy?.id, current?.tile.id, hasProgress]);
  if (error) return <Empty title="Course unavailable">{error}</Empty>;
  if (!course) return <div className="loading">Loading your course…</div>;
  const chapters = [
    ...new Map(course.lessons.map((s) => [s.chapterId, s.chapter])).entries(),
  ];
  const saved = p.saved.includes(id);
  const first = course.lessons[0];
  const startHref = current ? tileUrl(id, current.study.id, current.tile.id) : lessonUrl("explore", id, first.id, 0);
  return (
    <main className="page course-page" ref={pageRef}>
      <a className="back-link" href="#/courses">
        ← All Courses
      </a>
      <section className="course-hero">
        <img src={course.image} alt="" />
        <div className="course-intro">
          <span className="eyebrow">{course.side.toUpperCase()} OPENINGS</span>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <div className="course-meta">
            <span>{course.chapters} chapters</span>
            <span>{course.studies} studies</span>
            <span>{course.variations} variations</span>
          </div>
        </div>
        <div className="course-hero-actions">
          <a className="button primary" href={startHref}>
            {completion(course, p) ? "Continue" : "Start Learning"} <Icon name="arrow" size={17} />
          </a>
          <a className="button secondary" href={`#/review/${id}`}><Icon name="practice" size={16} /> Practice</a>
          <a className="button secondary" href={`#/explore/${id}/${first.id}/0`}><Icon name="search" size={16} /> Course Explorer</a>
        </div>
      </section>
      <div className="course-layout">
        <div className="chapters">
          {chapters.map(([chapterId, title], i) => (
            <section className={`chapter OpeningPath_chapterContainer__Y7qJy ${open.includes(chapterId) ? "OpeningPath_expandedChapter__1FYk_" : ""}`} key={chapterId}>
              <button
                className="chapter-heading OpeningPath_chapterName__fXERu"
                aria-expanded={open.includes(chapterId)}
                onClick={() =>
                  (() => {
                    const next = open.includes(chapterId)
                      ? open.filter((c) => c !== chapterId)
                      : [...open, chapterId];
                    setOpen(next);
                    try {
                      sessionStorage.setItem(
                        `course-chapters-${id}`,
                        JSON.stringify(next),
                      );
                    } catch { }
                  })()
                }
              >
                <div>
                  <span className="eyebrow OpeningPath_chapterNumber__WataA">CHAPTER {i + 1}</span>
                  <h2>{title}</h2>
                  <span className="chapter-detail">
                    {
                      course.lessons.filter((s) => s.chapterId === chapterId)
                        .length
                    } studies · {course.lessons
                      .filter((s) => s.chapterId === chapterId)
                      .reduce((n, s) => n + s.lines.length, 0)} variations
                  </span>
                </div>
                <span className={open.includes(chapterId) ? "rotate" : ""}>
                  <Icon name="down" />
                </span>
              </button>
              <div className={`study-list ${open.includes(chapterId) ? "expanded" : ""}`}>
                {course.lessons
                  .filter((s) => s.chapterId === chapterId)
                  .map((s, index) => {
                    const done = s.tiles.filter(t => t.required).every(t => tileComplete(id, t, p));
                    return (
                      <div className="OpeningPath_studyContainer__o5dJ_" key={s.id} data-study-id={s.id}>
                        <div
                          className={`OpeningPath_studyName__9vqLG ${activeStudies[chapterId] === s.id ? "study-selected" : ""} ${done ? "OpeningPath_completedStudyName__Rli7m" : ""} pointer flex-horizontal-center flex-vertical-spaced gap-s`}
                          role="button"
                          tabIndex={0}
                          aria-pressed={activeStudies[chapterId] === s.id}
                          onClick={() => setActiveStudies((current) => ({ ...current, [chapterId]: s.id }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setActiveStudies((current) => ({ ...current, [chapterId]: s.id }));
                            }
                          }}
                        >
                          <span className={`OpeningPath_studyButton__8j3_V ${done ? "OpeningPath_studyButtonCompleted__dMlFE" : ""}`}>
                            <Icon name={done ? "check" : "book"} size={14} />
                            Study {index + 1}
                          </span>
                          <span className="Text_reset__ZWBvP semiBold13 mobile-semiBold12 ">{s.title}</span>
                          <div>
                            {done ? (
                              <svg width="16" height="16" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Completed">
                                <circle cx="12.9875" cy="12.9883" r="11.25" fill="var(--white-gray-900)" />
                                <path fillRule="evenodd" clipRule="evenodd" d="M12.8 24.8c6.627 0 12-5.372 12-12 0-6.627-5.373-12-12-12s-12 5.373-12 12c0 6.628 5.373 12 12 12zm5.785-14.713a1.125 1.125 0 00-1.82-1.323L11.54 15.95 8.72 13.13a1.125 1.125 0 10-1.59 1.591l3.75 3.75a1.125 1.125 0 001.705-.134l6-8.25z" fill="var(--cyan-600-300)" />
                              </svg>
                            ) : (
                              <span className="study-status-pending" aria-label="Not completed" />
                            )}
                          </div>
                        </div>
                        {(activeStudies[chapterId] ?? (p.last?.course === id && p.last.study)) === s.id && (
                          <div className="study-path OpeningPath_tiles__ao_T3" aria-label="Study progression">
                            {s.tiles.filter(tile => tile.kind !== "video").map(tile => {
                              const isCurrent = current?.tile.id === tile.id;
                              const complete = tileComplete(id, tile, p);
                              const unlocked = tileAvailable(course, tile, p);
                              const label = `${tile.kind === "learn" ? "Learn" : tile.kind === "review" ? "Review" : "Graduation"}: ${s.title}`;
                              return <div key={tile.id} className={`OpeningPath_tile__9fLlp ${isCurrent ? "OpeningPath_currentLessonTile" : ""} ${unlocked ? "OpeningPath_unlockedLessonTile" : "OpeningPath_lockedLessonTile"}`}>
                                <div className="relative">
                                  {isCurrent && <><span className="OpeningPath_currentTile__z0ajX" /><span className="OpeningPath_currentTileText__LSpNc"><span className="current-tile-label">YOU ARE HERE</span></span></>}
                                  <a className="OpeningPath_tileLink__ZqBwE link-reset relative" href={unlocked ? tileUrl(id, s.id, tile.id) : undefined} aria-disabled={!unlocked} tabIndex={unlocked ? undefined : -1} aria-label={label} title={`${label}${complete ? " (completed)" : unlocked ? "" : " (locked)"}`} data-tile-id={tile.id} data-tile-kind={tile.kind} />
                                  <OpeningTileIcon variant={tile.kind === "learn" ? "book" : tile.kind === "graduate" ? "scholar" : "drill"} />
                                </div>
                              </div>;
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
        <aside className="course-sidebar">
          <div className="panel">
            <h3>Your progress</h3>
            <div className="progress-label">
              <span>
                {completion(course, p)} of {course.variations} variations
              </span>
              <b>{percent(course, p)}%</b>
            </div>
            <div className="progress-track">
              <i style={{ width: percent(course, p) + "%" }} />
            </div>
            <a
              className="button primary full"
              href={startHref}
            >
              {completion(course, p) ? "Continue" : "Start Learning"}{" "}
              <Icon name="arrow" size={18} />
            </a>
            <a className="button secondary full" href={`#/review/${id}`}>
              Practice this course
            </a>
            <a
              className="button outline full"
              href={`#/explore/${id}/${first.id}/0`}
            >
              Course Explorer
            </a>
            <button
              className={`save-button ${saved ? "chosen" : ""}`}
              onClick={() =>
                update((p) => ({
                  ...p,
                  saved: saved
                    ? p.saved.filter((x) => x !== id)
                    : [...p.saved, id],
                }))
              }
            >
              <Icon name={saved ? "check" : "bookmark"} size={18} />
              {saved ? "Added to my courses" : "Add to my courses"}
            </button>
          </div>
          <section className="drill-opening-card">
            <span className="eyebrow">DRILL THIS OPENING</span>
            <h2>Drill this Opening</h2>
            <p>Practice Drills in random order</p>
            <a className="button secondary full" href={`#/drill-shuffle/${id}/setup`}>
              <Icon name="practice" size={16} />
              Drill Shuffle
            </a>
          </section>
          <div className="sidebar-note">
            <Icon name="courses" />
            <div>
              <b>Your entire opening, in one place.</b>
              <p>
                Explore every imported variation and its original move notes.
              </p>
              <a href={`${import.meta.env.BASE_URL}library/${id}.pgn`} download>
                Download PGN ↓
              </a>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
function ResumeCourse({ id, progress }: { id: string; progress: Progress }) {
  const { course, error } = useCourse(id);
  useEffect(() => {
    if (!course) return;
    const next = nextTile(course, progress);
    go(next ? tileUrl(id, next.study.id, next.tile.id) : lessonUrl("explore", id, course.lessons[0].id, 0));
  }, [course, id]);
  if (error) return <Empty title="Course unavailable">{error}</Empty>;
  return <div className="loading">Resuming your course…</div>;
}
function CoursePracticePage({ id, progress, update, review }: { id: string; progress: Progress; update: (fn: (p: Progress) => Progress) => void; review: boolean }) {
  const { course, error } = useCourse(id);
  if (error) return <Empty title="Course unavailable">{error}</Empty>;
  if (!course) return <div className="loading">Loading practice…</div>;
  return <CoursePractice course={course} progress={progress} update={update} review={review} />;
}
function PathLearning({ id, studyId, tileId, progress, update }: { id: string; studyId: string; tileId: string; progress: Progress; update: (fn: (p: Progress) => Progress) => void }) {
  const { course, error } = useCourse(id);
  if (error) return <Empty title="Unable to open lesson">{error}</Empty>;
  if (!course) return <div className="loading">Opening the lesson…</div>;
  const study = course.lessons.find(s => s.id === studyId);
  const tile = study?.tiles?.find(t => t.id === tileId);
  if (!study || !tile || tile.kind === "video") return <Empty title="Lesson not found"><a href={`#/courses/${id}`}>Back to course</a></Empty>;
  if (!tileAvailable(course, tile, progress)) return <Empty title="Lesson locked"><p>Complete the current stage to unlock this lesson.</p><a href={`#/courses/${id}`}>Back to course</a></Empty>;
  return <PathSession key={tile.id} course={course} study={study} tile={tile} update={update} />;
}
function Learning({
  id,
  studyId,
  lineIndex,
  initialPly = 0,
  mode,
  p,
  update,
}: {
  id: string;
  studyId: string;
  lineIndex: number;
  initialPly?: number;
  mode: string;
  p: Progress;
  update: (fn: (p: Progress) => Progress) => void;
}) {
  const { course, error } = useCourse(id);
  const [position, setPly] = useState(initialPly),
    [flipped, setFlipped] = useState(false),
    [hint, setHint] = useState(false),
    [feedback, setFeedback] = useState(""),
    [mistakes, setMistakes] = useState(0),
    [hints, setHints] = useState(0),
    [finished, setFinished] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(
    false,
  );
  const moveListRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);
  const study = course?.lessons.find((s) => s.id === studyId);
  const line = study?.lines[lineIndex];
  const ply = Math.min(position, line?.sans.length ?? 0);
  const drill = mode === "drill";
  const drillLines = drill
    ? study?.lines.slice(lineIndex, lineIndex + 1) ?? []
    : [];
  const [drillLineOffset, setDrillLineOffset] = useState(0);
  const activeLine = drill ? drillLines[drillLineOffset] ?? line : line;
  useEffect(() => {
    setPly(mode === "drill" ? 0 : Math.max(0, initialPly));
    setDrillLineOffset(0);
    setHint(false);
    setFeedback("");
    setMistakes(0);
    setHints(0);
    setFinished(false);
    finishedRef.current = false;
  }, [id, studyId, lineIndex, mode]);
  useEffect(() => {
    if (line)
      update((p) => ({
        ...p,
        last: {
          course: id,
          study: studyId,
          line: lineIndex,
          ply: drill ? 0 : ply,
        },
      }));
  }, [id, studyId, lineIndex, !!line, ply]);
  useEffect(() => {
    if (!activeLine || drill) return;
    const safe = Math.min(ply, activeLine.sans.length);
    if (safe !== ply) setPly(safe);
    window.history.replaceState(
      null,
      "",
      lessonUrl(mode, id, studyId, lineIndex, safe),
    );
    const list = moveListRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (list && active) {
      const bounds = list.getBoundingClientRect(),
        item = active.getBoundingClientRect();
      if (item.top < bounds.top) list.scrollTop += item.top - bounds.top;
      else if (item.bottom > bounds.bottom)
        list.scrollTop += item.bottom - bounds.bottom;
    }
  }, [ply, !!activeLine]);
  const board = new Chess();
  const history = [board.fen()];
  activeLine?.sans.forEach((s) => {
    board.move(s);
    history.push(board.fen());
  });
  const current = new Chess(history[Math.min(ply, history.length - 1)]);
  const orientation = (course?.side === "White") !== flipped ? "w" : "b";
  const learner = course?.side === "White" ? "w" : "b";
  useEffect(() => {
    if (
      mode === "explore" ||
      !activeLine ||
      ply >= activeLine.sans.length ||
      current.turn() === learner
    )
      return;
    const timer = setTimeout(() => setPly((n) => n + 1), 520);
    return () => clearTimeout(timer);
  }, [activeLine, ply, learner, mode]);
  useEffect(() => {
    if (!drill || !activeLine || ply !== activeLine.sans.length || finishedRef.current)
      return;
    if (drillLineOffset + 1 < drillLines.length) {
      setDrillLineOffset((offset) => offset + 1);
      setPly(0);
      setFeedback("");
      return;
    }
    finishedRef.current = true;
    setFinished(true);
    update((p) => ({
      ...p,
      completed: {
        ...p.completed,
        ...Object.fromEntries(
          drillLines.map((drillLine) => [
            lineKey(id, drillLine.id),
            new Date().toISOString(),
          ]),
        ),
      },
      reviews: [
        ...p.reviews,
        { course: id, line: activeLine.id, at: new Date().toISOString(), mistakes: mistakes + hints },
      ],
    }));
  }, [ply, drill, activeLine, drillLineOffset, drillLines.length]);
  useEffect(() => {
    if (drill) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key))
        e.preventDefault();
      if (e.key === "ArrowRight") {
        const choices =
          mode === "explore" && study && line
            ? continuations(study.lines, line, ply)
            : [];
        if (choices.length > 1) return;
        setPly((n) => Math.min(n + 1, line?.sans.length ?? 0));
      }
      if (e.key === "ArrowLeft") setPly((n) => Math.max(n - 1, 0));
      if (e.key === "Home") setPly(0);
      if (e.key === "End") setPly(line?.sans.length ?? 0);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drill, line, ply, mode, study]);
  if (error) return <Empty title="Unable to open lesson">{error}</Empty>;
  if (!course) return <div className="loading">Opening the board…</div>;
  if (!study || !line)
    return (
      <Empty title="Lesson not found">
        <a href={`#/courses/${id}`}>Back to course</a>
      </Empty>
    );
  const notes = study.notes[current.fen()] ?? [];
  const branches = continuations(study.lines, line, ply);
  const needsChoice = mode === "explore" && branches.length > 1;
  function chooseMove(index: number) {
    if (!study) return;
    if (index === lineIndex) setPly((p) => p + 1);
    else go(lessonUrl(mode, id, study.id, index, ply + 1));
  }

  const marks: Record<string, SquareMark> = {};
  if (!drill) for (const note of notes) {
    for (const sq of note.highlights?.opportunities ?? []) marks[sq] = "right";
    for (const sq of note.highlights?.threats ?? []) marks[sq] = "wrong";
  }
  const arrows: Arrow[] = drill
    ? []
    : notes
      .flatMap((n) => [
        ...(n.arrows?.opportunities ?? []).map((s) => ({
          s,
          color: "rgba(59,155,103,.8)",
        })),
        ...(n.arrows?.threats ?? []).map((s) => ({
          s,
          color: "rgba(233,105,96,.8)",
        })),
      ])
      .filter((a) => /^[a-h][1-8]-[a-h][1-8]$/.test(a.s))
      .map((a) => ({
        from: a.s.split("-")[0],
        to: a.s.split("-")[1],
        color: a.color,
      }));
  if (hint && activeLine && ply < activeLine.sans.length) {
    const move = new Chess(current.fen()).move(activeLine.sans[ply]);
    arrows.push({ from: move.from, to: move.to, color: "rgba(37,99,235,.9)" });
  }
  let lastMove = null;
  if (ply > 0) {
    const c = new Chess(history[ply - 1]);
    const m = c.move(activeLine!.sans[ply - 1]);
    lastMove = { from: m.from, to: m.to };
  }
  if (mode === "learn" && activeLine && ply < activeLine.sans.length && current.turn() === learner) {
    const nextMove = new Chess(current.fen()).move(activeLine.sans[ply]);
    arrows.push({ from: nextMove.from, to: nextMove.to, color: "rgba(37,99,235,.9)" });
  }
  function nextLine() {
    if (!course || !study || !line) return;
    go(`courses/${id}`);
  }
  return (
    <main
      className={`lesson-page improved-lesson ${outlineOpen ? "outline-open" : ""}`}
    >
      <div className="study-course-header">
        <a href={`#/courses/${id}`} className="study-course-link">
          <img src={course?.image ?? ""} alt="" />
          <span>
            <b>{course?.title}</b>
            <small>Chapter {[...new Set(course.lessons.map(s => s.chapterId))].indexOf(study.chapterId) + 1} · {study?.chapter}</small>
          </span>
        </a>
        <div className="study-route-label">
          <span>Study {(course?.lessons.findIndex((s) => s.id === study?.id) ?? -1) + 1}</span>
          <b>{study?.title}</b>
        </div>
      </div>
      <div className="lesson-breadcrumb">
        <a href={`#/courses/${id}`}>← {course.title}</a>
        <button
          className="button outline small"
          onClick={() => setOutlineOpen(!outlineOpen)}
          aria-expanded={outlineOpen}
        >
          <Icon name="courses" size={17} />
          {outlineOpen ? "Hide contents" : "Course contents"}
        </button>
      </div>
      <div className="lesson-layout">
        {outlineOpen && (
          <CourseOutline
            course={course}
            studyId={study.id}
            lineIndex={lineIndex}
            mode={mode}
            progress={p}
            ply={ply}
          />
        )}
        <div className="board-column">
          <div className="board-label">
            <div className="lesson-stage-context">
              <span className="lesson-stage-mode">
                {drill ? "DRILL" : mode === "explore" ? "EXPLORE" : "LEARN"}
              </span>
              <strong>{study.title}</strong>
              <span className="lesson-stage-side">{course.side} · {ply} / {activeLine?.sans.length ?? 0}</span>
            </div>
            <button
              className="icon-button"
              aria-label="Flip board"
              onClick={() => setFlipped(!flipped)}
            >
              <Icon name="flip" size={20} />
            </button>
          </div>
          <Board
            fen={current.fen()}
            orientation={orientation}
            theme="walnut"
            animate={true}
            arrows={arrows}
            marks={marks}
            lastMove={lastMove}
            movable={
              drill
                ? !finished && current.turn() === learner
                  ? learner
                  : undefined
                : activeLine && ply < activeLine.sans.length
                  ? current.turn()
                  : undefined
            }
            onMove={(from, to, promotion) => {
              let move;
              try {
                move = new Chess(current.fen()).move({ from, to, promotion });
              } catch {
                return false;
              }
              if (!drill) {
                if (mode === "learn") {
                  if (move.san !== activeLine?.sans[ply]) {
                    setFeedback("Follow the highlighted course move.");
                    return false;
                  }
                  setFeedback("");
                  setPly((n) => n + 1);
                  return true;
                }
                const choice = branches.find((b) => b.san === move.san);
                if (!choice) {
                  setFeedback(
                    "That move is not in this study. Choose one of the course continuations.",
                  );
                  return false;
                }
                setFeedback("");
                chooseMove(
                  choice.variations.includes(lineIndex)
                    ? lineIndex
                    : choice.lineIndex,
                );
                return true;
              }
              if (move.san !== activeLine?.sans[ply]) {
                setMistakes((m) => m + 1);
                setFeedback(
                  "That’s a legal move, but not the move in this lesson. Try again.",
                );
                return false;
              }
              setFeedback("Correct. Nicely played!");
              setHint(false);
              setPly((n) => n + 1);
              return true;
            }}
          />
        </div>
        <aside className="lesson-panel">
          <MoveControls ply={ply} total={activeLine?.sans.length ?? 0}
            first={!drill && ply > 0} previous={!drill && ply > 0}
            next={!drill && !needsChoice && ply < (activeLine?.sans.length ?? 0)} last={!drill && ply < (activeLine?.sans.length ?? 0)}
            onFirst={() => setPly(0)} onPrevious={() => setPly(n => n - 1)} onNext={() => setPly(n => n + 1)} onLast={() => setPly(activeLine?.sans.length ?? 0)} />
          <div className="lesson-notes">
            {mode === "explore" && branches.length > 1 && <div className="button-row" aria-label="Course continuations">
              {branches.map(branch => <button key={branch.san} className="button secondary" onClick={() => chooseMove(branch.variations.includes(lineIndex) ? lineIndex : branch.lineIndex)}>{branch.san}</button>)}
            </div>}
            {finished ? (
              <div className="lesson-success">
                <div className="success-icon">
                  <Icon name="check" size={32} />
                </div>
                <h2>Lesson complete!</h2>
                <p>
                  {mistakes === 0 && hints === 0
                    ? "Perfect recall. Well played."
                    : `${mistakes} ${mistakes === 1 ? "retry" : "retries"} · ${hints} hints used.`}
                </p>
                <button className="button primary full" onClick={nextLine}>
                  Next lesson <Icon name="arrow" size={18} />
                </button>
              </div>
            ) : drill ? (
              <>
                <span className="eyebrow">
                  {current.turn() === learner ? "YOUR TURN" : "OPPONENT’S TURN"}
                </span>
                <h2>
                  {current.turn() === learner
                    ? "Find the course move."
                    : "Watch the reply…"}
                </h2>
                <p className={`drill-feedback ${feedback ? "has-feedback" : ""}`}>
                  {feedback ||
                    "Play the move on the board. Click a piece and its destination, or drag it."}
                </p>
                <button
                  className="button secondary"
                  onClick={() => { if (!hint) setHints(n => n + 1); setHint(!hint); }}
                  disabled={current.turn() !== learner}
                >
                  {hint ? "Hide hint" : "Show hint"}
                </button>
              </>
            ) : (
              <>
                <div className="course-annotations" aria-label="Course notes">
                  {notes.filter(n => n.text.trim()).map((n, i) => <p key={i}>{n.text}</p>)}
                </div>
              </>
            )}
          </div>
          {!drill && ply > 0 && (
            <>
              <div className="notation-heading">
                <span>Move history</span>
                <small>← → to navigate · Home / End</small>
              </div>
              <div className="move-list notation-table" ref={moveListRef}>
                {Array.from(
                  { length: Math.ceil(ply / 2) },
                  (_, row) => (
                    <div className="notation-row" key={row}>
                      <span>{row + 1}.</span>
                      {[row * 2, row * 2 + 1].map((i) =>
                        line.sans[i] ? (
                          <button
                            key={i}
                            className={ply === i + 1 ? "active" : ""}
                            aria-current={ply === i + 1 ? "step" : undefined}
                            onClick={() => setPly(i + 1)}
                          >
                            <b>{line.sans[i]}</b>
                            {study.notes[history[i + 1]]?.some(
                              (n) => n.text,
                            ) && (
                                <span
                                  className="annotation-dot"
                                  title="Course note"
                                >
                                  •
                                </span>
                              )}
                          </button>
                        ) : (
                          <span key={i} />
                        ),
                      )}
                    </div>
                  ),
                )}
              </div>
              {ply === line.sans.length && mode !== "explore" ? (
                <div className="button-row">
                  <button
                    className="button primary"
                    onClick={() => {
                      update((p) => ({
                        ...p,
                        completed: {
                          ...p.completed,
                          [lineKey(id, line.id)]: new Date().toISOString(),
                        },
                      }));
                      nextLine();
                    }}
                  >
                    Continue <Icon name="arrow" size={18} />
                  </button>
                </div>
              ) : (
                <button
                  className="button primary full"
                  onClick={() => setPly((n) => n + 1)}
                  disabled={needsChoice || ply === line.sans.length}
                >
                  {needsChoice ? "Choose a move above" : "Next move"}{" "}
                  <Icon name="arrow" size={18} />
                </button>
              )}
            </>
          )}
        </aside>
      </div>
      <div className="study-pagination">
        {course.lessons.indexOf(study) > 0 ? (
          <a
            href={lessonUrl(
              mode,
              id,
              course.lessons[course.lessons.indexOf(study) - 1].id,
              0,
            )}
          >
            ← Previous study
          </a>
        ) : (
          <span />
        )}
        <span>
          Study {course.lessons.indexOf(study) + 1} of {course.lessons.length}
        </span>
        {course.lessons.indexOf(study) < course.lessons.length - 1 ? (
          <a
            href={lessonUrl(
              mode,
              id,
              course.lessons[course.lessons.indexOf(study) + 1].id,
              0,
            )}
          >
            Next study →
          </a>
        ) : (
          <a href={`#/courses/${id}`}>Back to course →</a>
        )}
      </div>
    </main>
  );
}
function Practice({
  courses,
  p,
  courseId,
}: {
  courses: CourseCard[];
  p: Progress;
  courseId?: string;
}) {
  const [selected, setSelected] = useState(
    courseId ?? p.saved[0] ?? courses[0]?.id ?? "",
  ),
    [study, setStudy] = useState(""),
    [error, setError] = useState("");
  const { course } = useCourse(selected);
  useEffect(() => setStudy(""), [selected]);
  async function start() {
    try {
      const data = await loadCourse(selected);
      const pool = data.lessons
        .filter((l) => !study || l.id === study)
        .flatMap((s) => s.lines.map((l, i) => ({ s, l, i })));
      if (!pool.length) throw Error("No variations available.");
      const unseen = pool.filter(
        (x) => !p.completed[lineKey(selected, x.l.id)],
      );
      const options = unseen.length ? unseen : pool;
      const pick = options[Math.floor(Math.random() * options.length)];
      go(`drill/${selected}/${pick.s.id}/${pick.i}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="page practice-page">
      <span className="eyebrow">TURN KNOWLEDGE INTO INSTINCT</span>
      <h1>Practice makes progress.</h1>
      <p className="lead">
        Put your opening knowledge to the test, one move at a time.
      </p>
      <div className="practice-layout">
        <div className="panel practice-config">
          <div className="practice-symbol">
            <Icon name="practice" size={34} />
          </div>
          <h2>Drill your openings</h2>
          <p>
            Choose a course and practise a variation from memory. Unstudied
            lines come first.
          </p>
          <label>
            Course
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {courses.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Study
            <select value={study} onChange={(e) => setStudy(e.target.value)}>
              <option value="">All studies</option>
              {course?.lessons.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          {error && <p role="alert">{error}</p>}
          <button
            className="button primary full"
            onClick={start}
            disabled={!course}
          >
            Start Practice <Icon name="arrow" size={18} />
          </button>
        </div>
        <div className="practice-side">
          <div className="panel">
            <Icon name="star" size={28} />
            <h2>Small sessions. Lasting progress.</h2>
            <p>
              Take your time, try to recall each move, and use a hint whenever
              you need one.
            </p>
            <div className="practice-stats">
              <div>
                <b>{p.reviews.length}</b>
                <span>Sessions completed</span>
              </div>
              <div>
                <b>{p.reviews.filter((r) => r.mistakes === 0).length}</b>
                <span>Perfect sessions</span>
              </div>
            </div>
          </div>
          <a
            className="explorer-link"
            href={
              selected && course
                ? `#/explore/${selected}/${course.lessons[0].id}/0`
                : "#/courses"
            }
          >
            <Icon name="courses" />
            <div>
              <h3>Want to explore first?</h3>
              <p>Review the moves and their explanations.</p>
            </div>
            <Icon name="chevron" />
          </a>
        </div>
      </div>
    </main>
  );
}
export default function App() {
  const route = useRoute();
  const [courses, setCourses] = useState<CourseCard[]>([]),
    [error, setError] = useState(""),
    [p, setP] = useState(readProgress),
    [menu, setMenu] = useState(false),
    [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  function update(fn: (p: Progress) => Progress) {
    setP((prev) => fn(prev));
  }
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}library/catalog.json`)
      .then((r) => {
        if (!r.ok) throw Error("The course library could not be loaded.");
        return r.json();
      })
      .then((data) => setCourses((Array.isArray(data) ? data : []).map((course) => ({
        ...course,
        image: course.image?.startsWith("/") ? `${import.meta.env.BASE_URL}${course.image.slice(1)}` : course.image,
      }))))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(p));
    } catch {
      setToast(
        "Progress could not be saved in this browser. Export a backup using the footer’s Export progress button.",
      );
    }
  }, [p]);
  useEffect(() => {
    setMenu(false);
  }, [route]);
  const [routePath, routeQuery] = route.split("?");
  const parts = routePath.split("/");
  const requestedPly = Number(
    new URLSearchParams(routeQuery ?? "").get("ply") ?? 0,
  );
  const active = parts[0];
  const isStudy = ["path", "learn", "drill", "explore"].includes(active);
  const isCourseDetail = active === "courses" && !!parts[1];
  let view: ReactNode = error ? (
    <Empty title="Library unavailable">
      {error}
      <button className="button secondary" onClick={() => location.reload()}>
        Try again
      </button>
    </Empty>
  ) : (
    <div className="loading">Loading your library…</div>
  );
  if (courses.length) {
    if (active === "home") view = <Home courses={courses} p={p} />;
    else if (active === "courses" && parts[1])
      view = <CoursePage key={parts[1]} id={parts[1]} p={p} update={update} />;
    else if (active === "resume") view = <ResumeCourse id={parts[1]} progress={p} />;
    else if (active === "path") view = <PathLearning key={route} id={parts[1]} studyId={parts[2]} tileId={parts[3]} progress={p} update={update} />;
    else if (["learn", "drill", "explore"].includes(active))
      view = (
        <Learning
          key={route}
          id={parts[1]}
          studyId={parts[2]}
          lineIndex={Number(parts[3] ?? 0)}
          initialPly={
            Number.isSafeInteger(requestedPly) && requestedPly >= 0
              ? requestedPly
              : 0
          }
          mode={active}
          p={p}
          update={update}
        />
      );
    else if (active === "drill-shuffle" || active === "review")
      view = <CoursePracticePage key={route} id={parts[1]} progress={p} update={update} review={active === "review"} />;
    else if (active === "practice") view = <Practice courses={courses} p={p} courseId={parts[1]} />;
    else view = <Catalog courses={courses} p={p} />;
  }
  return (
    <>
      <div className={`header-shell${isStudy ? " study-shell" : ""}${isCourseDetail ? " course-shell" : ""}`}>
        <header className="site-header">
          <Logo />
          <nav aria-label="Main navigation">
            <a className={active === "home" ? "active" : ""} href="#/home">
              <Icon name="home" />
              <span>Home</span>
            </a>
            <a
              className={active === "courses" ? "active" : ""}
              href="#/courses"
            >
              <Icon name="courses" />
              <span>All Courses</span>
            </a>
            <div className="nav-dropdown">
              <button
                className={
                  ["practice", "drill", "explore", "review", "drill-shuffle"].includes(active)
                    ? "active"
                    : ""
                }
                onClick={() => setMenu(!menu)}
                aria-expanded={menu}
              >
                <Icon name="practice" />
                <span>Practice</span>
                <Icon name="down" size={14} />
              </button>
              {menu && (
                <div className="dropdown">
                  <a href="#/practice">Opening drills</a>
                  <a
                    href={
                      p.last
                        ? `#/explore/${p.last.course}/${p.last.study}/${p.last.line}`
                        : "#/courses"
                    }
                  >
                    Course Explorer
                  </a>
                </div>
              )}
            </div>
          </nav>

        </header>
      </div>
      <input
        ref={importRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            if (!validProgress(data))
              throw Error("This isn’t a valid progress backup.");
            update(() => data);
            setToast("Progress imported.");
          } catch (err) {
            setToast((err as Error).message);
          }
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <ErrorBoundary resetKey={route}>{view}</ErrorBoundary>
      <footer className={isStudy ? "study-footer" : undefined}>
        <Logo />
        <div>
          <a href="#/courses">All Courses</a>
          <a href="#/practice">Practice</a>
          <button onClick={() => download("chess-library-progress.json", p)}>Export progress</button>
          <button onClick={() => importRef.current?.click()}>Import progress</button>
        </div>
        <span>Private library · Everything stays on this device</span>
      </footer>
    </>
  );
}
