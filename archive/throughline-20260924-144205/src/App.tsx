import { useEffect } from 'react';
import { allLines } from './state/courses';
import { href, useRoute } from './state/router';
import { countDueLines } from './state/selectors';
import { useProgress } from './state/store';
import { setSoundEnabled } from './lib/sound';
import Home from './views/Home';
import CourseView from './views/CourseView';
import Learn from './views/Learn';
import Drill from './views/Drill';
import Explore from './views/Explore';
import Settings from './views/Settings';
import Quiz from './views/Quiz';
import ErrorBoundary from './components/ErrorBoundary';
import GameReview from './views/GameReview';
import { hasGeneratedCourses } from './lib/courseGenerator';
import { useSetup } from './state/setup';

function CourseBuilderStatus() {
  const phase = useSetup((s) => s.phase);
  const generated = hasGeneratedCourses();
  if (phase === 'running' || phase === 'pausing') return <div className="builder-banner"><span className="builder-spin" /><span>Course setup is running.</span><a href={href.settings()}>View progress / pause</a></div>;
  if (!generated) return <div className="builder-banner"><span>Manual setup · nothing starts until you choose Start.</span><a href={href.settings()}>Open setup</a></div>;
  return null;
}

export default function App() {
  const route = useRoute();
  const states = useProgress((s) => s.lines);
  const sound = useProgress((s) => s.settings.sound);
  useEffect(() => setSoundEnabled(sound), [sound]);
  const due = countDueLines(allLines, states);

  let view: JSX.Element;
  switch (route.name) {
    case 'course': view = <CourseView key={route.courseId} courseId={route.courseId} />; break;
    case 'learn': view = <Learn key={`${route.courseId}/${route.chapterId}`} courseId={route.courseId} chapterId={route.chapterId} lineIndex={route.lineIndex} />; break;
    case 'drill': view = <Drill key={location.hash} mode={route.mode} courseId={route.courseId} chapterId={route.chapterId} lineIndex={route.lineIndex} study={route.study} />; break;
    case 'quiz': view = <Quiz key={location.hash} scope={route.scope} courseId={route.courseId} />; break;
    case 'explore': view = <Explore key={route.courseId} courseId={route.courseId} chapterId={route.chapterId} />; break;
    case 'settings': view = <Settings />; break;
    case 'game-review': view = <GameReview />; break;
    default: view = <Home />;
  }

  return (
    <>
      <header className="topbar">
        <a className="brand" href={href.home()}><span className="mark">T</span>Throughline<small>one move per position</small></a>
        <nav className="nav">
          <a href={href.home()} className={route.name === 'home' ? 'active' : ''}>Repertoire</a>
          <a href={href.mixedAll()} className={route.name === 'drill' && route.mode === 'mixed' ? 'active' : ''}>Mixed practice</a>
          <a href={href.quiz('all')} className={route.name === 'quiz' ? 'active' : ''}>Quiz</a>
          <a href={href.gameReview()} className={route.name === 'game-review' ? 'active' : ''}>Review my game</a>
          <a href={href.settings()} className={route.name === 'settings' ? 'active' : ''}>Settings</a>
        </nav>
        <span className="spacer" />
        <a className={`due-pill ${due ? 'hot' : ''}`} href={href.drillDue()}>{due ? <><b>{due}</b> due</> : 'Nothing due'}</a>
      </header>
      <CourseBuilderStatus />
      <ErrorBoundary resetKey={location.hash}>{view}</ErrorBoundary>
    </>
  );
}
