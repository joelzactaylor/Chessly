import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { Chess } from 'chess.js';
import { courseRules } from '../src/data/rules';

const positions: Record<string, { move: string; san: string; ply: number }> = {};
for (const rule of courseRules) for (const entry of rule.entries) {
  const c = new Chess();
  for (const word of entry.split(' ')) c.move(word.replace(/^\d+\.(\.\.)?/, ''));
  while (!c.isGameOver() && c.history().length < 40) {
    const move = c.moves({ verbose: true })[0];
    positions[c.fen().split(' ').slice(0, 4).join(' ')] = { move: move.from + move.to + (move.promotion ?? ''), san: move.san, ply: c.history().length };
    c.move(move.san);
  }
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // Isolate the generator and explicitly initialize its storage before importing it.
  await page.route('**/builder-test', (route) => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.goto('http://127.0.0.1:5173/builder-test');
  await page.evaluate('window.__name = (value) => value');
  await page.evaluate((fixtures) => {
    localStorage.clear();
    localStorage.setItem('throughline.data-revision', 'manual-setup-2026-09-20');
    localStorage.setItem('throughline.lichess.token', 'test-only');
    localStorage.setItem('throughline.lichess.cache', JSON.stringify(Object.fromEntries(Object.entries(fixtures).map(([key, f]) => [key, { games: f.ply >= 20 ? 50 : 1000, moves: { [f.san]: 100 }, score: {} }]))));
    class FakeWorker {
      onmessage: ((event: { data: string }) => void) | null = null;
      fen = '';
      postMessage(command: string) {
        const emit = (data: string) => queueMicrotask(() => this.onmessage?.({ data }));
        if (command === 'uci') emit('uciok');
        if (command === 'isready') emit('readyok');
        if (command.startsWith('position fen ')) this.fen = command.slice(13).split(' ').slice(0, 4).join(' ');
        if (command.startsWith('go ')) {
          const move = command.split(' searchmoves ')[1] ?? fixtures[this.fen]?.move;
          if (!move) throw new Error(`No fixture for ${this.fen}`);
          emit(`info depth 16 score cp ${command.includes('searchmoves') ? -500 : 0} pv ${move}`);
          emit(`bestmove ${move}`);
        }
      }
      terminate() {}
    }
    Object.defineProperty(window, 'Worker', { value: FakeWorker });
  }, positions);
  const result = await page.evaluate(async () => {
    const storagePath = '/src/state/buildStorage.ts';
    const storage = await import(/* @vite-ignore */ storagePath);
    await storage.initializeBuildStorage();
    const generatorPath = '/src/lib/courseGenerator.ts';
    const treePath = '/src/lib/tree.ts';
    const generator = await import(/* @vite-ignore */ generatorPath);
    const tree = await import(/* @vite-ignore */ treePath);
    let interrupted = false;
    try { await generator.buildCourses((p: { positions: number }) => { if (p.positions === 28) throw new Error('test interruption'); }); }
    catch { interrupted = true; }
    const draft = JSON.parse(storage.readBuildData('throughline.course-draft.v4'));
    const courses = await generator.buildCourses(() => {});
    const parsed = courses.map(tree.parseCourse);
    return { interrupted, pending: Object.values(draft.work).reduce((n: number, work: any) => n + (work.queue?.length ?? 0), 0), depths: parsed.flatMap((c: { lines: { nodes: unknown[] }[] }) => c.lines.map((l) => l.nodes.length)), errors: parsed.flatMap((c: { errors: string[] }) => c.errors), draftCleared: storage.readBuildData('throughline.course-draft.v4') === null, illustration: courses.some((c: any) => c.chapters[0].pgn.includes('Engine illustration')) };
  });
  assert.equal(result.interrupted, true);
  assert.ok(result.pending > 0);
  assert.deepEqual(result.errors, []);
  assert.ok(result.depths.some((depth: number) => depth > 12), 'branches must continue past six moves');
  assert.equal(result.draftCleared, true);
  assert.equal(result.illustration, true, 'sparse data should produce labelled practice continuations');
  console.log('Builder interruption/resume, deeper lines, and PGN validation passed:', result.depths);
} finally { await browser.close(); }
