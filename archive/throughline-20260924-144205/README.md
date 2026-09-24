# Throughline

## Learn an existing Chessly course

A separate command-line program imports course PGNs into a position-indexed repertoire. It preserves both sides' alternatives, lesson titles, and move comments. This is structured repertoire memory, not neural-network training or video understanding. It does not mark lessons complete on Chessly.

### Import directly from your logged-in Comet browser (macOS)

Open the requested course in the active Comet tab and enable **View → Developer → Allow JavaScript from Apple Events**, then run:

```bash
npm run course:comet -- https://chessly.com/courses/d37755a0-252e-4925-8c5f-2d2f62d6a2ab
```

This importer reads the syllabus using the page's authenticated data client, opens each study's Lines page, and extracts its move variations and position annotations. Authentication remains in Comet. It validates every move and resulting position, reconstructs each variation from the initial position, and verifies every imported move can be retrieved from the model. It restores the original page afterwards. Keep this Comet tab active while it runs.

Each new Comet import is saved separately in `scripts/out/course-learning/<course-id>/`, with `course.pgn`, `repertoire.json`, `coverage.json`, and `comet-checkpoint.json`. To play a specific course, pass its model path: `npm run course -- play white scripts/out/course-learning/<course-id>/repertoire.json`. The original Vienna files and default CLI model remain in the parent folder.

The verified September 24, 2026 Vienna import contains **4 chapters, 17 studies, 98 variations, and 656 positions**, with **1,815 move occurrences** validated. Video-only material is excluded. Outputs in `scripts/out/course-learning/` are `vienna.pgn`, `repertoire.json`, `coverage.json`, and a checkpoint containing the original study annotations, including arrows and highlights. The PGN/model retain textual move notes; the checkpoint retains introductory position notes as well. The importer depends on Chessly's current page structure and stops with an error if a study cannot be read or validated. Checkpoints preserve captured studies for inspection; rerunning starts a fresh capture.

### Local course library

[library.html](scripts/out/course-learning/library.html) is a standalone, searchable course picker. Open it in a browser, filter by color, select courses, and download your selection as JSON. Selection alone does not change your repertoire. [CATALOG.md](scripts/out/course-learning/CATALOG.md) lists downloaded opening courses with their playing side, study and variation counts, and links to the PGN and coverage report. `catalog-manifest.json` records the available-course selection; coming-soon entries are excluded. Courses remain separate from the four-course repertoire audit and from the app's generated courses.

```bash
# Resume the saved catalog download; completed courses are skipped.
npx tsx scripts/course-learning/download-catalog.ts
# Rebuild the standalone course picker.
npx tsx scripts/course-learning/build-library-page.ts
# Validate saved models and find exact responses to the original repertoire gaps.
npx tsx scripts/course-learning/library-audit.ts
```

These commands require the saved manifest; downloading additionally requires a logged-in Chessly page in the active Comet tab. The downloader records per-course logs and failures and continues with other courses. Rerunning retries incomplete courses. `library-coverage.md` compares recorded responses across the downloaded library; finding a move does not mean all alternative repertoires should be combined.

### PGN capture fallback

For the linked course, run:

```bash
npm run course -- capture
```

Log in in the opened browser, open the course lessons, and use any available PGN download. When finished, press Enter in the terminal. The capture watches Chessly responses for valid PGN strings and reads PGN downloads. It saves only validated chess content, without saving your password, browser session, or raw responses. If Chromium is missing, run `npx playwright install chromium` first.

Capture is assisted: it does not automatically discover all lessons, interpret videos, or decode proprietary move-data formats. If no PGN is found, supply a PGN file yourself. The private course has not been tested with this capture tool. The program cannot certify whole-course coverage; compare its imported lessons with the course syllabus and supply all course PGNs to cover the whole course.

```bash
npm run course -- import /path/to/course.pgn
npm run course -- query "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
npm run course -- play white
npm run course -- play black
npm run test-course-learning
```

The `play` colour is your side. The program chooses among imported moves for the other side and stops when it leaves known positions. Enter SAN (`Nf3`) or UCI (`g1f3`) moves. Queries return every known course move, its comments, and source lesson names. Unknown positions are explicitly reported.

Output is stored in the ignored `scripts/out/course-learning/` directory. Import replaces the default model; concatenate all lesson PGNs into one file before importing. An optional final model path on `import`, `query`, or `play` selects a different JSON model. Imports validate all moves before writing; malformed games and custom starting-FEN games are rejected. These imported repertoires are independent of the existing app's generated courses.

**One move per position.** A personal chess-opening trainer that builds its own courses from practical play instead of shipping a hand-authored theory database.

## How course generation works

The app contains opening rules, not prewritten lines. Generation is fully manual: when you press **Start build** in Settings, it:

1. Starts from the chosen opening seeds: Vienna, Grand Prix, Scandinavian and King's Indian, plus White's answers to the other major first moves.
2. Queries the Lichess opening explorer for 1600–2000-rated blitz, rapid and classical games.
3. Keeps every opponent reply played in at least **1%** of games at that position.
4. Preserves the chosen opening recipe where applicable, then asks browser Stockfish for exactly one move whenever it is the learner's turn.
5. Follows each branch until a stable advantage or settled middlegame, then saves the resulting PGN. An advantage requires at least +2.0 pawns over three assessments and a quiet continuation with a sheltered king. A settled middlegame requires at least 12 full moves, near-complete development, a sheltered king, a quiet four-ply continuation and an evaluation of at least −0.3 for the learner. These are practical heuristics, not guarantees of an easy win.

There is no five/six-move course cutoff or 1,200-position truncation. The 30-move safety guard is labelled unresolved. Below 200 recorded games, the builder adds an explicitly labelled engine illustration of up to eight plies, ending after a learner move. These opponent moves are not presented as measured common replies. Work is checkpointed every 25 positions and rotates to the next course after 60 positions, so White does not monopolize generation. Deeper branching at 1% can require substantial time and storage; generation stops with an error if browser storage fills, preserving its last checkpoint. Existing courses remain usable while new rules rebuild them.

There is no bundled frequency snapshot. The manual-setup revision clears all previous Throughline browser data once, including the token, settings and training progress, and opens Settings idle. Unrelated browser data and downloaded files are untouched. Newly fetched data is retained for manually resumed builds.

Saved courses load on later visits, but generation never starts or resumes automatically. Settings provides **Start build**, **Pause build**, **Resume build**, and **Restart from scratch**. Pausing checkpoints the current branch and interrupts engine/network work. Restart discards courses, checkpoints and downloaded frequencies while keeping the token and training progress; it does not start a build. **Clear everything** also removes the token, settings and progress. Both destructive controls ask for confirmation.

Settings visualizes each course's finished and pending branches, positions examined, and the board currently being analysed. Branch bars show the currently known work, not a completion forecast: new replies can expand the queue.

The rule set lives in `src/data/rules.ts`; the compiler lives in `src/lib/courseGenerator.ts`. Change `OPPONENT_REPLY_THRESHOLD`, `GENERATED_MAX_PLY`, entry paths or an opening recipe there—no course PGN needs to be edited.

## First run

```bash
npm install
npm run dev
```

Open Settings, add a Lichess API token with no scopes, and choose **Save connection**. The token stays in the browser. Press **Start build** when ready; saving a token or reloading does not start anything. After completion, choose **Open repertoire** to load the new lessons.

Generation time depends on discovered branches, device speed and API rate limits; deep 1% coverage can take substantial time. Pause and resume as needed. Resumed builds reuse saved positions and checkpoints.

## Training

- **Learn** shows and explains the single generated move before you play it.
- **Drill** tests the line from memory and schedules it with spaced repetition.
- **Mixed practice** chooses opponent branches using their real Lichess frequencies.
- **Quick quiz** tests individual positions.
- **Explore** shows the generated tree, frequencies and browser-engine evaluation.
- **Prepare for your next game** recommends lessons by the common new decisions they teach, discounting shared positions already studied. Deep lines are not penalized solely for having many opponent turns.
- **Move explanations and position checklists** describe observable board features (captures, development, attacked pieces, king shelter and material). They do not pretend to know the engine's full strategic reasoning.
- **Review my game** compares a pasted PGN with your repertoire and links the first deviation to a lesson. It distinguishes missing coverage from deviations and does not call every different move a blunder. PGNs are not uploaded.
- **Export course build** in Settings saves the actual lessons, endpoint explanations and unfinished work for auditing; it excludes the API token. The frequency export alone cannot establish course quality.

Generated courses, checkpoints and move-frequency data are stored in IndexedDB, avoiding localStorage's small quota. Existing localStorage builds migrate on load; the old copy is removed only after a successful database commit. Progress, the token and settings remain in localStorage. Browser storage is still finite: export important work as a backup.

Use **Import course build** in Settings to restore an optional exported checkpoint. Imports validate the rules version and saved moves, replace the saved build only after validation, and stay paused until you choose Resume. No export is bundled or automatically imported. **Restart from scratch** removes imported work and frequencies, so later builds start from the opening rules alone. **Clear everything** also removes progress, settings and the token. Progress has its own export/import controls.

## Checks

```bash
npm run build
npm run validate
```

`validate` checks PGN legality and enforces the core rule: at every learner position there is exactly one move.

## Credits

Chess piece images are the *cburnett* set from Wikimedia Commons (CC BY-SA 3.0). Move generation is powered by chess.js; analysis by Stockfish; practical move frequencies by the Lichess opening explorer.
