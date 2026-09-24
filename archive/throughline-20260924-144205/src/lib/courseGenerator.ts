import { Chess } from 'chess.js';
import type { Course } from './types';
import { posKey } from './chessUtils';
import { parseCourse } from './tree';
import { assessEndpoint, type BuildEval } from './courseStopping';
import { explainMove, positionBrief } from './coaching';
import { loadCache, saveCache } from '../state/lichessCache';
import { ensureFreshData } from '../state/dataRevision';
import { useSetup } from '../state/setup';
import { buildDelay, interruptible } from './buildCancellation';
import { readBuildData, writeBuildData } from '../state/buildStorage';
import {
  COURSE_RULES_VERSION,
  GENERATED_MAX_PLY,
  OPPONENT_REPLY_THRESHOLD,
  STOP_RULES,
  courseRules,
  seedCourses,
  type CourseRule,
} from '../data/rules';

const GENERATED_KEY = 'throughline.generated-courses.v2';
const TOKEN_KEY = 'throughline.lichess.token';
const ENGINE_DEPTH = 16;
const DRAFT_KEY = 'throughline.course-draft.v4';
const REFRESH_AFTER_MS = 7 * 86_400_000;
let generatedCoursesCache: Course[] | null | undefined;

interface StoredCourses { version: number; builtAt: number; courses: Course[] }
export interface BuildProgress { course: string; courseIndex: number; courses: number; positions: number; message: string; pending?: number; finished?: number; fen?: string; path?: string }
interface PathMove { san: string; comment?: string }
interface QueueItem { chess: Chess; path: PathMove[]; stable?: number; exampleLeft?: number; priority: number }
type BuildIntent = 'running' | 'paused';
interface Draft {
  courses: Course[];
  intent?: BuildIntent;
  rulesVersion?: number;
  queue?: { path: PathMove[]; stable?: number; exampleLeft?: number; priority?: number }[];
  leaves?: PathMove[][];
  chosen: [string, string][];
  processed?: number;
  work?: Record<string, { queue?: Draft['queue']; leaves?: Draft['leaves']; processed?: number }>;
}

function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function loadGeneratedCourses(): Course[] | null {
  if (generatedCoursesCache !== undefined) return generatedCoursesCache;
  try {
    ensureFreshData();
    const raw = readBuildData(GENERATED_KEY);
    if (!raw) return generatedCoursesCache = null;
    const parsed = JSON.parse(raw) as StoredCourses;
    // Keep existing lessons usable while a newer rule set builds in the background.
    generatedCoursesCache = parsed.version >= 3 && parsed.version <= COURSE_RULES_VERSION && Array.isArray(parsed.courses) ? parsed.courses : null;
    return generatedCoursesCache;
  } catch { return generatedCoursesCache = null; }
}

export function generatedCoursesAreStale(): boolean {
  try {
    ensureFreshData();
    const raw = readBuildData(GENERATED_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as StoredCourses;
    return parsed.version !== COURSE_RULES_VERSION || Date.now() - parsed.builtAt > REFRESH_AFTER_MS;
  } catch { return true; }
}

export async function clearGeneratedCourses() {
  if (activeBuild) throw new Error('Pause the build before clearing its data.');
  await writeBuildData({ [GENERATED_KEY]: null, [DRAFT_KEY]: null });
  generatedCoursesCache = null;
  useSetup.setState({ phase: 'idle', message: 'Ready when you are.', error: undefined, fen: undefined, path: undefined, courseId: undefined, courses: [] });
}
export function hasGeneratedCourses() { return loadGeneratedCourses() !== null; }
export function hasGeneratorToken() { return token().length > 0; }

export function exportCourseBuild(): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(), rulesVersion: COURSE_RULES_VERSION,
    completed: JSON.parse(readBuildData(GENERATED_KEY) ?? 'null'),
    inProgress: JSON.parse(readBuildData(DRAFT_KEY) ?? 'null')
  }, null, 2);
}

function token(): string { return storage()?.getItem(TOKEN_KEY)?.trim() ?? ''; }

/** Optional user-selected checkpoint, never a bundled fallback or automatic seed. */
export async function importCourseBuild(contents: string) {
  if (activeBuild) throw new Error('Pause the build before importing.');
  const data = JSON.parse(contents);
  if (data.rulesVersion !== COURSE_RULES_VERSION) throw new Error('This export uses incompatible opening rules.');
  if (!data.completed && !data.inProgress) throw new Error('This file contains no saved build.');
  const validateCourses = (courses: Course[]) => {
    if (!Array.isArray(courses)) throw new Error('Invalid course list.');
    const ids = new Set<string>();
    for (const course of courses) {
      if (!courseRules.some((rule) => rule.id === course.id) || ids.has(course.id)) throw new Error('Unknown or duplicate course.');
      ids.add(course.id);
      if (parseCourse(course).errors.length) throw new Error('The export contains invalid course moves.');
    }
  };
  if (data.completed) {
    if (data.completed.version !== COURSE_RULES_VERSION) throw new Error('Incompatible completed courses.');
    validateCourses(data.completed.courses);
    if (data.completed.courses.length !== courseRules.length) throw new Error('Incomplete finished repertoire.');
  }
  if (data.inProgress) {
    const draft = data.inProgress as Draft;
    validateCourses(draft.courses);
    if (!Array.isArray(draft.chosen) || !draft.work || typeof draft.work !== 'object') throw new Error('Invalid checkpoint.');
    for (const [fen, uci] of draft.chosen) {
      const chess = new Chess(fen.split(' ').slice(0, 4).join(' ') + ' 0 1');
      if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Invalid saved move.');
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    for (const [id, work] of Object.entries(draft.work)) {
      const rule = courseRules.find((r) => r.id === id);
      if (!rule) throw new Error('Unknown checkpoint course.');
      if (work.processed !== undefined && (!Number.isSafeInteger(work.processed) || work.processed < 0)) throw new Error('Invalid position count.');
      const paths = [...(work.queue ?? []).map((item) => {
        if (item.stable !== undefined && (!Number.isFinite(item.stable) || item.stable < 0)) throw new Error('Invalid endpoint counter.');
        if (item.exampleLeft !== undefined && (!Number.isInteger(item.exampleLeft) || item.exampleLeft < -1 || item.exampleLeft > 8)) throw new Error('Invalid continuation counter.');
        return item.path;
      }), ...(work.leaves ?? [])];
      const seeds = rule.entries.map((entry) => parseEntry(entry).path.map((m) => m.san));
      for (const path of paths) {
        if (!Array.isArray(path) || !path.length || path.length > GENERATED_MAX_PLY) throw new Error('Invalid saved path.');
        const chess = new Chess();
        for (const move of path) {
          if (typeof move.san !== 'string' || (move.comment !== undefined && typeof move.comment !== 'string')) throw new Error('Invalid path move.');
          chess.move(move.san);
        }
        if (!seeds.some((seed) => seed.every((san, i) => path[i]?.san === san))) throw new Error('Saved path does not match its opening.');
      }
    }
  }
  // Validate everything before replacing anything; both records commit atomically.
  await writeBuildData({
    [GENERATED_KEY]: data.completed ? JSON.stringify(data.completed) : null,
    [DRAFT_KEY]: data.inProgress ? JSON.stringify(data.inProgress) : null
  });
  generatedCoursesCache = undefined;
  refreshBuildOverview();
}

async function fetchStats(chess: Chess, signal: AbortSignal): Promise<{ games: number; moves: Record<string, number> }> {
  signal.throwIfAborted();
  const key = posKey(chess.fen());
  const cached = loadCache()[key];
  if (cached) return cached;
  const auth = token();
  if (!auth) throw new Error('Add a Lichess token in Settings so the course builder can read move frequencies.');
  const fen = chess.fen().split(' ').slice(0, 4).join(' ') + ' 0 1';
  const params = new URLSearchParams({ variant: 'standard', fen, speeds: 'blitz,rapid,classical', ratings: '1600,1800,2000', moves: '100', topGames: '0', recentGames: '0' });
  const res = await interruptible(fetch(`https://explorer.lichess.ovh/lichess?${params}`, { signal, headers: { Authorization: `Bearer ${auth}` } }), signal);
  if (res.status === 429) {
    useSetup.setState({ message: 'Lichess rate limit: waiting one minute. Pause remains available.' });
    await buildDelay(61_000, signal); return fetchStats(chess, signal);
  }
  if (res.status === 401) throw new Error('Lichess rejected the saved token. Update it in Settings.');
  if (!res.ok) throw new Error(`Lichess explorer error ${res.status}`);
  const data = await interruptible(res.json(), signal);
  signal.throwIfAborted();
  const games = data.white + data.draws + data.black;
  const moves: Record<string, number> = {};
  for (const move of data.moves ?? []) {
    const n = move.white + move.draws + move.black;
    moves[move.san] = games ? 100 * n / games : 0;
  }
  loadCache()[key] = { games, moves, score: {} };
  await saveCache();
  await buildDelay(350, signal);
  return { games, moves };
}

class BuilderEngine {
  private worker = new Worker('/engine/stockfish.js');
  private ready: Promise<void>;
  private resolveBest: ((evaluation: BuildEval) => void) | null = null;
  private latest: BuildEval = { move: '', cp: null, mate: null, pv: [] };

  constructor() {
    this.ready = new Promise((resolve) => {
      this.worker.onmessage = (event: MessageEvent) => {
        const line = String(event.data);
        if (line === 'uciok') { this.worker.postMessage('setoption name UCI_AnalyseMode value true'); this.worker.postMessage('isready'); }
        else if (line === 'readyok') resolve();
        else if (line.startsWith('info ') && line.includes(' pv ') && !/lowerbound|upperbound/.test(line)) {
          const cp = line.match(/score cp (-?\d+)/);
          const mate = line.match(/score mate (-?\d+)/);
          this.latest = { move: '', cp: cp ? +cp[1] : null, mate: mate ? +mate[1] : null, pv: line.split(' pv ')[1].trim().split(/\s+/) };
        }
        else if (line.startsWith('bestmove ')) { this.resolveBest?.({ ...this.latest, move: line.split(/\s+/)[1] }); this.resolveBest = null; }
      };
      this.worker.postMessage('uci');
    });
  }

  async analyse(fen: string, signal: AbortSignal, searchmove?: string): Promise<BuildEval> {
    await interruptible(this.ready, signal, 45_000);
    return interruptible(new Promise<BuildEval>((resolve) => {
      this.resolveBest = resolve;
      this.latest = { move: '', cp: null, mate: null, pv: [] };
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${ENGINE_DEPTH}${searchmove ? ` searchmoves ${searchmove}` : ''}`);
    }), signal);
  }

  close() { this.worker.terminate(); }
}

function parseEntry(entry: string, priority = 1): QueueItem {
  const chess = new Chess();
  const path: PathMove[] = [];
  for (const raw of entry.split(/\s+/)) {
    const san = raw.replace(/^\d+\.(\.\.)?/, '');
    if (!san) continue;
    const move = chess.move(san);
    if (!move) throw new Error(`Invalid course entry: ${entry}`);
    path.push({ san: move.san });
  }
  return { chess, path, priority };
}

interface MoveTrie { move?: PathMove; children: Map<string, MoveTrie> }

/** Compact all leaf paths into one PGN tree instead of repeating every prefix per line. */
export function pathsToPgn(paths: PathMove[][]): string {
  const root: MoveTrie = { children: new Map() };
  for (const path of paths) {
    let node = root;
    for (const move of path) {
      let child = node.children.get(move.san);
      if (!child) { child = { move, children: new Map() }; node.children.set(move.san, child); }
      else if (!child.move?.comment && move.comment) child.move = move;
      node = child;
    }
  }
  const head = (move: PathMove, ply: number, numberBlack = false) => {
    const num = Math.floor(ply / 2) + 1;
    const prefix = ply % 2 === 0 ? `${num}.` : numberBlack ? `${num}...` : '';
    const comment = move.comment ? ` {${move.comment.replace(/[{}]/g, '')}}` : '';
    return `${prefix}${move.san}${comment}`;
  };
  const render = (node: MoveTrie, ply: number): string => {
    const children = [...node.children.values()];
    if (!children.length) return '';
    const [main, ...alternatives] = children;
    let out = head(main.move!, ply);
    for (const alt of alternatives) {
      const tail = render(alt, ply + 1);
      out += ` (${head(alt.move!, ply, true)}${tail ? ` ${tail}` : ''})`;
    }
    const continuation = render(main, ply + 1);
    if (continuation) out += ` ${continuation}`;
    return out;
  };
  return render(root, 0);
}

function recipeMove(rule: CourseRule, chess: Chess): string | null {
  const history = chess.history().map((s) => s.replace(/[+#]/g, ''));
  for (const san of rule.recipe ?? []) {
    if (history.includes(san)) continue;
    try {
      const clone = new Chess(chess.fen());
      const move = clone.move(san);
      if (move) return move.from + move.to + (move.promotion ?? '');
    } catch { /* try the next recipe move */ }
  }
  return null;
}

async function buildRule(rule: CourseRule, engine: BuilderEngine, chosenMoves: Map<string, string>, report: (p: BuildProgress) => void, courseIndex: number, draft: Draft, saveDraft: () => Promise<void>, signal: AbortSignal): Promise<Course | null> {
  const queue = draft.queue ? draft.queue.map((item) => ({ ...parseEntry(item.path.map((m) => m.san).join(' '), item.priority ?? 1), path: item.path, stable: item.stable, exampleLeft: item.exampleLeft })) : rule.entries.map((entry) => parseEntry(entry)).reverse();
  const leaves: PathMove[][] = draft.leaves ?? [];
  const processedBefore = draft.processed ?? 0;
  const checkpoint = async () => {
    draft.queue = queue.map(({ path, stable, exampleLeft, priority }) => ({ path, stable, exampleLeft, priority }));
    draft.leaves = leaves;
    draft.chosen = [...chosenMoves];
    draft.processed = processedBefore + positions;
    draft.intent = buildIntent;
    await saveDraft();
    await publishPartialCourse(rule, leaves, draft.courses);
  };
  const finish = (item: QueueItem, reason: string) => {
    const path = item.path.map((move) => ({ ...move }));
    const last = path[path.length - 1];
    last.comment = `${last.comment ?? ''} ${reason} Next-game checklist: ${positionBrief(item.chess.fen(), rule.side).priorities.join(' ')}`.trim();
    leaves.push(path);
  };
  let positions = 0;
  let inFlight: QueueItem | undefined;
  try {
    // Rotate between courses so Black's preparation receives work on every pass.
    while (queue.length && positions < 60) {
      inFlight = undefined;
      signal.throwIfAborted();
      // Checkpoint BEFORE removing work: interruption never marks an unfinished path complete.
      if (positions % 25 === 0) await checkpoint();
      // Best-first traversal keeps the build focused on the lines most likely to occur.
      const itemIndex = queue.reduce((best, candidate, index) => candidate.priority > queue[best].priority ? index : best, 0);
      const [item] = queue.splice(itemIndex, 1);
      inFlight = item;
      if (item.chess.isGameOver()) { finish(item, item.chess.isCheckmate() ? 'Checkmate. The line is complete.' : 'Drawn position. No winning advantage is claimed.'); continue; }
      if (item.path.length >= GENERATED_MAX_PLY) { finish(item, 'Unresolved: 15-move analysis safety limit reached. No stable advantage or settled position was established.'); continue; }
      if (item.exampleLeft !== undefined && item.exampleLeft <= 0 && item.chess.turn() !== rule.side) {
        finish(item, 'Practical continuation: this engine illustration shows one way forward beyond reliable game data. It is not a measured common line or proof of an advantage.'); continue;
      }
      positions++;
      report({
        course: rule.title, courseIndex, courses: courseRules.length, positions: processedBefore + positions, pending: queue.length + 1, finished: leaves.length,
        fen: item.chess.fen(), path: item.path.map((move) => move.san).join(' '), message: item.chess.turn() === rule.side ? 'Choosing your move with Stockfish' : 'Reading common opponent replies'
      });
      if (item.chess.turn() === rule.side) {
        const next = parseEntry(item.path.map((m) => m.san).join(' ')).chess;
        const key = posKey(next.fen());
        const cachedMove = chosenMoves.get(key);
        let uci = cachedMove;
        let source = cachedMove ? 'Same repertoire move' : `Stockfish depth ${ENGINE_DEPTH}`;
        if (!uci) {
          const best = await engine.analyse(next.fen(), signal);
          uci = best.move;
          // A legal recipe move is not necessarily sound. Keep it only if it is
          // within 0.35 pawns of the engine move and neither line contains mate.
          const recipe = recipeMove(rule, next);
          if (recipe && recipe !== uci && best.cp !== null) {
            const candidate = await engine.analyse(next.fen(), signal, recipe);
            if (candidate.cp !== null && candidate.cp >= best.cp - 35) { uci = recipe; source = 'Engine-checked opening recipe'; }
          }
        }
        const move = next.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        if (!move) { leaves.push(item.path); continue; }
        chosenMoves.set(key, move.from + move.to + (move.promotion ?? ''));
        const path = [...item.path, { san: move.san, comment: `${explainMove(item.chess.fen(), move.san)} ${source}: your repertoire move.` }];
        queue.push({
          chess: next, stable: item.stable, priority: item.priority, exampleLeft: item.exampleLeft === undefined ? undefined : item.exampleLeft - 1,
          path
        });
      } else {
        const evaluation = await engine.analyse(item.chess.fen(), signal);
        const endpoint = assessEndpoint(item.chess, rule.side, evaluation, item.path.length, item.stable ?? 0);
        if (endpoint.reason) { finish(item, endpoint.reason); continue; }
        if (item.exampleLeft !== undefined) {
          const next = parseEntry(item.path.map((m) => m.san).join(' ')).chess;
          const uci = evaluation.move;
          const move = next.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
          queue.push({
            chess: next, stable: endpoint.stable, priority: item.priority, exampleLeft: item.exampleLeft - 1,
            path: [...item.path, { san: move.san, comment: `Engine illustration, not a measured opponent frequency. ${explainMove(item.chess.fen(), move.san)}` }]
          });
          continue;
        }
        const stats = await fetchStats(item.chess, signal);
        if (stats.games < STOP_RULES.minimumGames) {
          const path = item.path.map((move) => ({ ...move }));
          path[path.length - 1].comment = `${path[path.length - 1].comment ?? ''} Frequency evidence ends here (${stats.games} games). The following moves are a clearly labelled engine illustration.`;
          queue.push({ ...item, path, exampleLeft: 1 });
          continue;
        }
        const replies = Object.entries(stats.moves)
          .filter(([, pct]) => pct >= OPPONENT_REPLY_THRESHOLD)
          .sort((a, b) => b[1] - a[1]);
        if (!replies.length) { queue.push({ ...item, exampleLeft: 1 }); continue; }
        for (const [san, pct] of replies) {
          const next = parseEntry(item.path.map((m) => m.san).join(' ')).chess;
          const move = next.move(san);
          if (move) {
            queue.push({ chess: next, stable: endpoint.stable, priority: item.priority * pct / 100, path: [...item.path, { san: move.san, comment: `${pct.toFixed(1)}% of ${stats.games.toLocaleString()} Lichess games.` }] });
          }
        }
      }
    }
  } catch (error) {
    // Put the interrupted position back before persisting. No partial move is lost.
    if (inFlight) queue.push(inFlight);
    await checkpoint();
    throw error;
  }
  if (queue.length) { await checkpoint(); return null; }
  draft.processed = processedBefore + positions;
  const seed = seedCourses().find((c) => c.id === rule.id)!;
  return {
    ...seed,
    chapters: [{
      id: 'generated',
      title: 'Most common opponent responses',
      summary: `Opponent replies at least ${OPPONENT_REPLY_THRESHOLD}%. Each selected branch teaches the next learner move, then hands off so common decisions are practiced without deep rare sidelines.`,
      pgn: pathsToPgn(leaves),
    }],
  };
}

let activeBuild: Promise<Course[]> | null = null;
let controller: AbortController | null = null;
let buildIntent: BuildIntent = 'paused';

function partialCourse(rule: CourseRule, leaves: PathMove[][]): Course {
  const seed = seedCourses().find((course) => course.id === rule.id)!;
  return {
    ...seed,
    chapters: [{
      id: 'generated',
      title: 'Most common opponent responses',
      summary: `Build in progress. ${leaves.length} finished lines are available to study and drill after learning.`,
      pgn: pathsToPgn(leaves),
    }],
  };
}

async function publishPartialCourse(rule: CourseRule, leaves: PathMove[][], completed: Course[]) {
  const { refreshCourses } = await import('../state/courses');
  const existing = completed.length ? completed : loadGeneratedCourses() ?? [];
  const next = [...existing.filter((course) => course.id !== rule.id), partialCourse(rule, leaves)];
  refreshCourses(next);
  await writeBuildData({ [GENERATED_KEY]: JSON.stringify({ version: COURSE_RULES_VERSION, builtAt: Date.now(), courses: next }) });
  generatedCoursesCache = next;
}

export function refreshBuildOverview() {
  if (activeBuild) return;
  try {
    const draft: Draft | null = JSON.parse(readBuildData(DRAFT_KEY) ?? 'null');
    const completed = draft?.courses ?? loadGeneratedCourses() ?? [];
    useSetup.setState({
      phase: draft ? (draft.intent === 'running' ? 'running' : 'paused') : completed.length ? 'complete' : 'idle',
      message: draft ? (draft.intent === 'running' ? 'Saved build is resuming.' : 'Saved work is ready. Choose Resume to continue.') : completed.length ? 'Your courses are ready.' : 'Nothing runs until you choose Start.',
      courses: courseRules.map((rule) => {
        const course = completed.find((c) => c.id === rule.id);
        const work = draft?.work?.[rule.id];
        return { id: rule.id, processed: work?.processed ?? 0, pending: work?.queue?.length ?? 0, finished: course ? parseCourse(course).lines.length : work?.leaves?.length ?? 0, complete: !!course };
      })
    });
    if (draft?.intent === 'running') void buildCourses();
  } catch { useSetup.setState({ phase: 'error', error: 'Saved build data could not be read. Choose Restart to discard it.' }); }
}

export async function pauseBuild(): Promise<void> {
  if (!activeBuild) return;
  buildIntent = 'paused';
  useSetup.setState({ phase: 'pausing', message: 'Pausing and saving your place…' });
  controller?.abort();
  try { await activeBuild; } catch { /* The start caller also receives the interruption. */ }
  if (useSetup.getState().phase === 'paused') refreshBuildOverview();
}

export function buildCourses(report: (p: BuildProgress) => void = () => { }): Promise<Course[]> {
  if (!activeBuild) {
    buildIntent = 'running';
    controller = new AbortController();
    useSetup.setState({ phase: 'running', error: undefined, message: 'Starting course setup…' });
    activeBuild = runBuild((p) => {
      const id = courseRules[p.courseIndex].id;
      useSetup.setState((state) => ({
        message: p.message, courseId: id, fen: p.fen, path: p.path,
        courses: courseRules.map((rule) => rule.id === id
          ? { id, processed: p.positions, pending: p.pending ?? 0, finished: p.finished ?? 0, complete: false }
          : state.courses.find((c) => c.id === rule.id) ?? { id: rule.id, processed: 0, pending: 0, finished: 0, complete: false })
      }));
      report(p);
    }, controller.signal).then((courses) => {
      useSetup.setState({ phase: 'complete', message: 'Setup complete. Open your repertoire when you are ready.' });
      return courses;
    }).catch((error) => {
      const paused = controller?.signal.aborted && (error as Error).name === 'AbortError';
      useSetup.setState({ phase: paused ? 'paused' : 'error', message: paused ? 'Paused. Your place is saved.' : 'Build stopped. Your last checkpoint is saved.', error: paused ? undefined : (error as Error).message });
      throw error;
    }).finally(() => { activeBuild = null; controller?.abort(); controller = null; });
  }
  return activeBuild;
}

async function runBuild(report: (p: BuildProgress) => void, signal: AbortSignal): Promise<Course[]> {
  ensureFreshData();
  if (!storage()) throw new Error('Browser storage is unavailable. Enable site storage before starting a build.');
  if (!token()) throw new Error('Add a Lichess token in Settings before generating courses.');
  const engine = new BuilderEngine();
  try {
    const saved = readBuildData(DRAFT_KEY);
    const savedDraft = saved ? JSON.parse(saved) as Draft : null;
    // A changed targeting policy must not inherit an oversized pre-policy tree.
    const draft: Draft = savedDraft?.rulesVersion === COURSE_RULES_VERSION
      ? savedDraft
      : { rulesVersion: COURSE_RULES_VERSION, courses: [], chosen: [] };
    const courses = draft.courses;
    draft.work ??= {};
    const chosenMoves = new Map<string, string>(draft.chosen);
    while (courses.length < courseRules.length) {
      for (let i = 0; i < courseRules.length; i++) {
        const rule = courseRules[i];
        if (courses.some((course) => course.id === rule.id)) continue;
        const work: Draft = { courses: [], chosen: [], ...draft.work[rule.id] };
        const saveDraft = async () => {
          draft.rulesVersion = COURSE_RULES_VERSION;
          draft.work![rule.id] = { queue: work.queue, leaves: work.leaves, processed: work.processed };
          draft.chosen = [...chosenMoves];
          await writeBuildData({ [DRAFT_KEY]: JSON.stringify(draft) });
        };
        signal.throwIfAborted();
        const course = await buildRule(rule, engine, chosenMoves, report, i, work, saveDraft, signal);
        if (course) {
          courses.push(course); work.queue = undefined; work.leaves = undefined; await saveDraft();
          useSetup.setState((state) => ({ courses: state.courses.map((c) => c.id === rule.id ? { ...c, complete: true, pending: 0, finished: parseCourse(course).lines.length } : c) }));
        }
      }
    }
    courses.sort((a, b) => courseRules.findIndex((r) => r.id === a.id) - courseRules.findIndex((r) => r.id === b.id));
    const errors = courses.flatMap((course) => parseCourse(course).errors.map((error) => `${course.title}: ${error}`));
    if (errors.length) throw new Error(`Generated course validation failed: ${errors.slice(0, 3).join(' · ')}`);
    const stored: StoredCourses = { version: COURSE_RULES_VERSION, builtAt: Date.now(), courses };
    await writeBuildData({ [GENERATED_KEY]: JSON.stringify(stored), [DRAFT_KEY]: null });
    generatedCoursesCache = courses;
    return courses;
  } finally { engine.close(); }
}
