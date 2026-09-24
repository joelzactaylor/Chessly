import { useRef, useState } from 'react';
import Board from '../components/Board/Board';
import { exportState, useProgress, type Settings as S } from '../state/store';

import SetupPanel from '../components/SetupPanel';

export default function Settings() {
  const settings = useProgress((s) => s.settings);
  const setSettings = useProgress((s) => s.setSettings);
  const resetAll = useProgress((s) => s.resetAll);
  const importState = useProgress((s) => s.importState);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  function flash(t: string) { setToast(t); setTimeout(() => setToast(null), 2200); }

  function download() {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `throughline-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ok = importState(await f.text());
    flash(ok ? 'Progress imported.' : 'That file could not be read.');
    e.target.value = '';
  }

  const Toggle = ({ k, label, d }: { k: keyof S; label: string; d?: string }) => (
    <div className="toggle">
      <div><label>{label}</label>{d && <div className="d">{d}</div>}</div>
      <button className={`switch ${settings[k] ? 'on' : ''}`} onClick={() => setSettings({ [k]: !settings[k] } as Partial<S>)} aria-label={label} />
    </div>
  );

  return (
    <div className="page narrow fade-in">
      <h1 className="title-l">Settings</h1>
      <SetupPanel />
      <div className="grid cols-2" style={{ marginTop: 18, alignItems: 'start' }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Board</div>
          <div className="toggle">
            <div><label>Theme</label></div>
            <select value={settings.boardTheme} onChange={(e) => setSettings({ boardTheme: e.target.value as S['boardTheme'] })}>
              <option value="walnut">Walnut</option><option value="slate">Slate</option><option value="moss">Moss</option><option value="paper">Paper</option>
            </select>
          </div>
          <Toggle k="showCoordinates" label="Coordinates" />
          <Toggle k="showLegalMoves" label="Legal move dots" d="Shown while a piece is selected in drills." />
          <Toggle k="sound" label="Sounds" />
          <Toggle k="showEval" label="Engine eval bar" d="Stockfish 17 runs in your browser (7 MB, loaded once). Eval is from White's side." />
          <div style={{ marginTop: 14 }}>
            <Board fen="r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2NP4/PPP2PPP/R1BQK1NR b KQkq - 0 4" orientation="w" theme={settings.boardTheme} showCoordinates={settings.showCoordinates} animate={false} lastMove={{ from: 'd2', to: 'd3' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 6 }}>Drilling</div>
            <div className="toggle">
              <div><label>Opponent delay</label><div className="d">Milliseconds before the opponent's reply appears.</div></div>
              <input type="number" min={0} max={3000} step={50} value={settings.opponentDelayMs} onChange={(e) => setSettings({ opponentDelayMs: Math.max(0, +e.target.value || 0) })} style={{ width: 90 }} />
            </div>
            <div className="toggle">
              <div><label>Auto-advance</label><div className="d">Pause after a completed line before the next one starts. 0 = wait for you.</div></div>
              <input type="number" min={0} max={10000} step={100} value={settings.autoAdvanceMs} onChange={(e) => setSettings({ autoAdvanceMs: Math.max(0, +e.target.value || 0) })} style={{ width: 90 }} />
            </div>
            <Toggle k="learnGuided" label="Play the moves in Learn" d="Off: click through the line and just read." />
            <div className="toggle">
              <div><label>Daily goal</label><div className="d">Lines drilled per day to keep the streak.</div></div>
              <input type="number" min={1} max={200} value={settings.dailyGoal} onChange={(e) => setSettings({ dailyGoal: Math.max(1, +e.target.value || 1) })} style={{ width: 90 }} />
            </div>
            <div className="toggle">
              <div><label>Mixed practice length</label><div className="d">Lines per mixed session.</div></div>
              <input type="number" min={3} max={60} value={settings.mixedSize} onChange={(e) => setSettings({ mixedSize: Math.max(3, +e.target.value || 3) })} style={{ width: 90 }} />
            </div>
            <div className="toggle">
              <div><label>Quiz length</label><div className="d">Positions per quick quiz.</div></div>
              <input type="number" min={5} max={60} value={settings.quizSize} onChange={(e) => setSettings({ quizSize: Math.max(5, +e.target.value || 5) })} style={{ width: 90 }} />
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>Practice follows every generated branch to its endpoint. The 1% threshold applies to each opponent reply, not the probability of the entire line.</p>
            <div className="toggle">
              <div><label>Show the answer after</label><div className="d">Wrong attempts before an arrow reveals the move.</div></div>
              <select value={settings.hintAfterMistakes} onChange={(e) => setSettings({ hintAfterMistakes: +e.target.value })}>
                <option value={1}>1 mistake</option><option value={2}>2 mistakes</option><option value={3}>3 mistakes</option><option value={99}>never</option>
              </select>
            </div>
          </div>
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 6 }}>Progress data</div>
            <p className="muted" style={{ fontSize: 14 }}>Everything is stored in this browser. Export a backup before clearing site data or moving to another machine.</p>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={download}>Export JSON</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImport} />
              <button className="btn danger" onClick={() => { if (confirm('Delete all progress? This cannot be undone.')) { resetAll(); flash('Progress cleared.'); } }}>Reset progress</button>
            </div>
          </div>
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 6 }}>How scheduling works</div>
            <p className="muted" style={{ fontSize: 14 }}>
              Each line is a flashcard. A perfect run schedules it further out (1 day, 3 days, then roughly ×2.5 each time); one slip shortens the gap; two or more slips reset it and bring the line back in ten minutes. Lines you have not drilled yet never show up as due — start them from a course page.
            </p>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
