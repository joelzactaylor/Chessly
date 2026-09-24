import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Chess } from 'chess.js';
import { learn, lookup, type Knowledge } from './repertoire';

const COURSE = 'https://chessly.com/courses/775a4eea-5a50-47da-b7dd-5790ef829fbe';
const directory = 'scripts/out/course-learning';
const defaultModel = `${directory}/repertoire.json`;
const [command, ...args] = process.argv.slice(2);

async function capture() {
  const { chromium } = await import('playwright');
  await mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ acceptDownloads: true });
  const candidates = new Set<string>();
  const pending = new Set<Promise<void>>();
  function candidate(text: string) {
    if (!/\b1\s*\.\s*(?:\.\.\s*)?(?:[KQRBN]?[a-h]|O-O)/.test(text)) return;
    try { learn(text, COURSE); candidates.add(text); } catch { /* Only save valid PGNs. */ }
  }
  function scan(value: unknown, depth = 0) {
    if (depth > 40) return;
    if (typeof value === 'string') candidate(value);
    else if (Array.isArray(value)) value.forEach(v => scan(v, depth + 1));
    else if (value && typeof value === 'object') Object.values(value).forEach(v => scan(v, depth + 1));
  }
  function track(job: Promise<void>) { pending.add(job); void job.finally(() => pending.delete(job)); }
  context.on('response', response => {
    const url = new URL(response.url());
    if (url.hostname !== 'chessly.com' && !url.hostname.endsWith('.chessly.com')) return;
    const type = response.headers()['content-type'] ?? '';
    if (!/json|text|pgn/.test(type)) return;
    track((async () => {
      try {
        const text = await response.text();
        if (text.length > 20_000_000) return;
        try { scan(JSON.parse(text)); } catch { candidate(text); }
      } catch { /* Navigation may cancel a response. */ }
    })());
  });
  context.on('page', page => page.on('download', download => {
    if (!download.suggestedFilename().toLowerCase().endsWith('.pgn')) return;
    track((async () => {
      try { const path = await download.path(); if (path) candidate(await readFile(path, 'utf8')); }
      catch { /* Failed downloads are not added. */ }
    })());
  }));
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    const page = await context.newPage();
    await page.goto(COURSE, { waitUntil: 'domcontentloaded' });
    console.log('Log in in the browser, then open the course and each lesson. Use any available PGN download.');
    console.log('Capture reads PGN strings in course responses/downloads. It does not interpret videos or arbitrary move-data formats.');
    console.log('Your login and raw network responses are not saved.');
    await terminal.question('When finished browsing lessons, press Enter here to save captured lines. ');
    await Promise.allSettled([...pending]);
    if (!candidates.size) throw new Error('No PGNs found. Export the course PGN if available, or supply lesson PGNs to the import command.');
    // Each captured document has its own game boundaries, including documents without result markers.
    const combined = [...candidates].map((s, i) => `[Event "Capture ${i + 1}"]\n${s}\n*`).join('\n\n');
    const knowledge = learn(combined, COURSE);
    await writeFile(`${directory}/captured.pgn`, combined, { mode: 0o600 });
    await writeFile(defaultModel, JSON.stringify(knowledge, null, 2), { mode: 0o600 });
    report(knowledge);
    console.log(`Saved ${directory}/captured.pgn and ${defaultModel}. Whole-course coverage is unverified.`);
  } finally { terminal.close(); await browser.close(); }
}

function report(k: Knowledge) {
  console.log(`Learned ${k.games} PGN games, ${k.lines} lines, ${Object.keys(k.positions).length} positions.`);
}

async function main() {
  if (command === 'capture') return capture();
  if (command === 'import') {
    if (!args[0]) throw new Error('Usage: npm run course -- import course.pgn [model.json]');
    const knowledge = learn(await readFile(args[0], 'utf8'), COURSE);
    await mkdir(directory, { recursive: true });
    const path = args[1] ?? defaultModel;
    await writeFile(path, JSON.stringify(knowledge, null, 2), { mode: 0o600 });
    report(knowledge); console.log(`Saved ${path}. Coverage is limited to the supplied PGN.`); return;
  }
  if (command === 'query' || command === 'play') {
    const k = JSON.parse(await readFile(args[1] ?? defaultModel, 'utf8')) as Knowledge;
    if (k.version !== 1 || !k.positions) throw new Error('Unsupported repertoire file.');
    if (command === 'query') {
      const choices = lookup(k, args[0] ?? new Chess().fen());
      console.log(choices.length ? JSON.stringify(choices, null, 2) : 'This position is not in the imported course.'); return;
    }
    const side = args[0] ?? 'white';
    if (!['white', 'black'].includes(side)) throw new Error('Choose play white or play black (your side).');
    const human = side === 'white' ? 'w' : 'b';
    const chess = new Chess();
    const terminal = createInterface({ input: stdin, output: stdout });
    console.log('The program plays imported course moves. Enter SAN or UCI; type quit to stop.');
    try {
      while (!chess.isGameOver()) {
        console.log(chess.ascii());
        if (chess.turn() === human) {
          const answer = (await terminal.question('Your move: ')).trim();
          if (answer === 'quit') break;
          try { chess.move(answer); } catch { console.log('Illegal move; try again.'); }
        } else {
          const choices = lookup(k, chess.fen());
          if (!choices.length) { console.log('Outside the imported course. Stopping without inventing a course move.'); break; }
          const move = choices[Math.floor(Math.random() * choices.length)];
          chess.move(move.san);
          console.log(`Course plays ${move.san} (${move.lessons.join(', ')})`);
          if (move.notes.length) console.log(move.notes.join('\n'));
        }
      }
      console.log(chess.pgn());
    } finally { terminal.close(); }
    return;
  }
  console.log('Usage: npm run course -- capture | import <file.pgn> [model.json] | query "<FEN>" [model.json] | play [white|black] [model.json]');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
