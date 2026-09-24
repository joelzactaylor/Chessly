import { useEffect, useRef, useState } from 'react';
import { buildCourses, pauseBuild, clearGeneratedCourses, exportCourseBuild, importCourseBuild, refreshBuildOverview } from '../lib/courseGenerator';
import { clearBuildStorage } from '../state/buildStorage';
import { clearCache, loadCache } from '../state/lichessCache';
import { getToken, setToken } from '../lib/lichess';
import { resetApplicationData } from '../state/dataRevision';
import { useSetup } from '../state/setup';
import { useProgress } from '../state/store';
import { courseRules } from '../data/rules';
import Board from './Board/Board';

export default function SetupPanel() {
  const setup = useSetup();
  const [token, setInput] = useState(getToken);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileMessage, setFileMessage] = useState('');
  const theme = useProgress((s) => s.settings.boardTheme);
  const busy = setup.phase === 'running' || setup.phase === 'pausing';
  const completed = setup.courses.filter((c) => c.complete).length;
  const active = courseRules.find((c) => c.id === setup.courseId);
  const fetched = Object.keys(loadCache()).length;
  useEffect(() => { refreshBuildOverview(); }, []);

  async function start() {
    setToken(token); setSaved(true);
    try { await buildCourses(); } catch { /* Shared setup state contains the error or pause status. */ }
  }
  async function restart() {
    if (!confirm('Discard generated courses, unfinished work and downloaded frequencies? Your token and training progress will be kept. The new build will stay idle until you press Start.')) return;
    setResetting(true);
    await pauseBuild();
    await clearGeneratedCourses(); await clearCache();
    location.hash = '#/settings'; location.reload();
  }
  async function reset() {
    if (!confirm('Delete all Throughline data on this site, including your token, settings, progress, courses and saved build? This cannot be undone unless you have an export.')) return;
    setResetting(true);
    await pauseBuild();
    await clearBuildStorage();
    resetApplicationData();
    location.hash = '#/settings'; location.reload();
  }
  function download(contents: string, filename: string) {
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (!confirm('Replace saved courses and unfinished work with this export? Your token, frequencies and training progress stay. Importing does not start generation.')) return;
    setResetting(true); setFileMessage('Validating and importing saved work…');
    try {
      await importCourseBuild(await file.text());
      location.hash = '#/settings'; location.reload();
    } catch (error) { setFileMessage(`Import failed: ${(error as Error).message}`); setResetting(false); }
  }
  async function safely(action: () => Promise<void>) {
    try { await action(); } catch (error) { setResetting(false); setFileMessage(`Storage operation failed: ${(error as Error).message}`); }
  }

  return <section className="setup-panel card" aria-labelledby="setup-heading">
    <div className="setup-heading"><div><div className="eyebrow">You control the build</div><h2 id="setup-heading" className="title-l">Course setup</h2></div><span className={`chip ${busy ? 'learning' : setup.phase === 'complete' ? 'mastered' : ''}`}>{setup.phase}</span></div>
    <p className="muted">Save your connection and choose Start. Finished lines become available immediately while the remaining courses continue building. Reloading remembers whether you were running or paused.</p>
    <ol className="setup-stages" aria-label="Setup stages">
      <li className={getToken() ? 'done' : 'current'}><b>1</b><span>Connect<small>Save your Lichess token</small></span></li>
      <li className={setup.phase === 'complete' ? 'done' : busy ? 'current' : ''}><b>2</b><span>Build<small>Common replies · one move for you</small></span></li>
      <li className={setup.phase === 'complete' ? 'current' : ''}><b>3</b><span>Study<small>Use finished lines as they arrive</small></span></li>
    </ol>
    <div className="setup-connection">
      <label htmlFor="setup-token">Lichess API token</label>
      <div className="btn-row"><input id="setup-token" type="password" autoComplete="off" placeholder="lip_…" value={token} disabled={busy || resetting} onChange={(e) => { setInput(e.target.value); setSaved(false); }} />
        <button className="btn" disabled={busy || resetting || !token.trim()} onClick={() => { setToken(token); setSaved(true); }}>Save connection</button>{saved && <span className="muted" role="status">Saved. No build started.</span>}</div>
      <p className="faint">Create a <a href="https://lichess.org/account/oauth/token/create?description=Throughline" target="_blank" rel="noreferrer">Lichess token</a> with no scopes. It stays on this device.</p>
    </div>
    <div className="btn-row">
      <button className="btn primary" disabled={busy || resetting || !token.trim() || setup.phase === 'complete'} onClick={start}>{setup.phase === 'paused' || setup.phase === 'error' ? 'Resume build' : 'Start build'}</button>
      <button className="btn" disabled={!busy || setup.phase === 'pausing' || resetting} onClick={() => void pauseBuild()}>{setup.phase === 'pausing' ? 'Saving checkpoint…' : 'Pause build'}</button>
      <button className="btn" disabled={resetting || setup.phase === 'pausing'} onClick={() => void safely(restart)}>Restart from scratch</button>
      {setup.phase === 'complete' && <button className="btn primary" onClick={() => { location.hash = '#/'; location.reload(); }}>Open repertoire</button>}
    </div>
    <p role="status" aria-live="polite" className="muted">{setup.message}</p>
    {setup.error && <p role="alert" style={{ color: 'var(--red-2)' }}>{setup.error}</p>}
    <div className="setup-overview">
      <div className="setup-courses">
        <div className="setup-metrics"><span><b>{completed}/5</b> courses ready</span><span><b>{fetched.toLocaleString()}</b> positions fetched</span></div>
        <div className="bar" aria-label={`${completed} of 5 courses ready`}><span className="mastered" style={{ width: `${completed * 20}%` }} /></div>
        {courseRules.map((rule) => {
          const row = setup.courses.find((c) => c.id === rule.id);
          const finished = row?.finished ?? 0; const pending = row?.pending ?? 0;
          const isActive = busy && setup.courseId === rule.id;
          const width = row?.complete ? 100 : finished + pending ? Math.max(4, 100 * finished / (finished + pending)) : 0;
          return <div key={rule.id} className={`setup-course ${isActive ? 'active' : ''}`}>
            <div className="setup-heading"><span>{rule.title}</span><small className="faint">{row?.complete ? 'Ready' : isActive ? 'Working' : pending ? 'Queued' : 'Not started'}</small></div>
            <div className={`bar${isActive ? ' searching' : ''}`} aria-label={`${finished} finished lines, ${pending} pending`}><span className={row?.complete ? 'mastered' : 'familiar'} style={{ width: `${isActive ? 34 : width}%` }} /></div>
            <small className="faint">{finished.toLocaleString()} lines finished · {pending.toLocaleString()} pending · {(row?.processed ?? 0).toLocaleString()} positions examined</small>
          </div>;
        })}
        <p className="faint" style={{ fontSize: 12 }}>Branch bars compare finished and currently pending paths. They can shrink as more replies are discovered; they are not an estimated completion time.</p>
      </div>
      <div className="setup-board">
        <div className="eyebrow">{active?.title ?? 'Position preview'}</div>
        {setup.fen ? <><Board fen={setup.fen} orientation={active?.side ?? 'w'} theme={theme} animate={false} /><p className="mono faint" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{setup.path}</p></> : <div className="setup-empty">When you start, watch the position being explored here.<span>≥1% opponent replies<br />Stockfish chooses your move<br />Every branch gets an endpoint</span></div>}
      </div>
    </div>
    <div className="btn-row">
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
      <button className="btn sm" disabled={busy || resetting} onClick={() => fileRef.current?.click()}>Import course build</button>
      <button className="btn sm" onClick={() => download(exportCourseBuild(), 'throughline-course-build.json')}>Export course build</button>
      <button className="btn sm" onClick={() => download(JSON.stringify(loadCache()), 'stats.json')}>Download stats.json</button>
    </div>
    <p className="faint">Large build data is saved in IndexedDB. An imported build is optional saved work, not a permanent starting point. Restart from scratch removes it.</p>
    {fileMessage && <p role="status">{fileMessage}</p>}
    <div className="setup-reset"><div><h3 className="title-m">Fresh start</h3><p className="faint">Remove all Throughline data, including your saved connection and training progress. Download any backups you want first.</p></div><button className="btn danger" disabled={resetting} onClick={() => void safely(reset)}>{resetting ? 'Clearing…' : 'Clear everything'}</button></div>
  </section>;
}
