# Private Chess Library

A standalone local chess course library combining Chessly-style course layouts with Chess.com-style charcoal navigation, green actions and Neo pieces. Browse 50 downloaded opening courses, save favorites, read annotated variations, and practise moves on an interactive board.

## Run

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The server binds only to the local machine. Course data, artwork, fonts, and chess pieces are served locally; browsing and practice do not require a Chessly login or external API.

## Navigation

- **Home**: saved courses, recent learning, and personal progress.
- **All Courses**: searchable course library, White/Black filters, and saved courses.
- **Course pages**: original lesson/review/graduation tiles, chapter accordions, study lists, course progress, and PGN download. Videos are intentionally excluded.
- **Learn / Explore**: step through any variation with the buttons or arrow keys, read course annotations, and view instructional arrows.
- **Practice**: review learned variations, practise a single variation, or shuffle all variations from selected chapters. Path lessons teach and then review their exact assigned variations. The opponent replies automatically during training; the explorer stays at your selected position. Progress and mistakes are recorded locally.

The footer exports and imports progress backups. Progress uses the browser's `chess-library-progress-v1` localStorage key. Different browser profiles or server ports have separate progress. There are no accounts, leaderboards, subscriptions, analytics, or automatic cloud sync. Course completion here is independent of Chessly.

## Data and architecture

The new React app loads a small catalog and fetches individual course files on demand. The previous generator, engine setup, Lichess connection, routing, and state architecture have been removed from the running app. Its source and associated scripts are archived under `archive/throughline-20260924-144205/`.

- `src/App.tsx`: navigation, catalog, course pages, lesson board, and practice flows.
- `src/library.ts`: course types, lazy course loading, and local progress helpers.
- `src/components/Board/`: reusable chess board with legal moves and promotion.
- `public/library/`: static app catalog, course JSON, and PGNs.
- `public/course-art/`, `public/fonts/`, `public/pieces/`: local visual assets.
- `scripts/out/course-learning/`: original validated imports, coverage reports, standalone course picker, and audit results. These remain intact and are excluded from Git.

To rebuild the website's course data from the original imports:

```bash
npm run library:publish
```

Only recorded move variations and written annotations are included; video-only content is not downloaded. Course artwork and text originate from Chessly for this private library. The active Neo piece artwork originates from Chess.com for this private library; the retained cburnett SVG set is CC BY-SA 3.0. Inter is licensed under the SIL Open Font License.

## Course import tools

The existing command-line repertoire program remains available:

```bash
npm run course -- query "<FEN>" scripts/out/course-learning/<course-id>/repertoire.json
npm run course -- play white scripts/out/course-learning/<course-id>/repertoire.json
npm run course:comet -- https://chessly.com/courses/<course-id>
```

Comet imports require a logged-in Chessly tab and **View → Developer → Allow JavaScript from Apple Events**. The helper finds a Chessly tab, so unrelated tabs do not need to be foregrounded. Login credentials are not exported. Importing changes local files only, not course completion on Chessly.

```bash
npx tsx scripts/course-learning/download-catalog.ts
npx tsx scripts/course-learning/library-audit.ts
npx tsx scripts/course-learning/build-library-page.ts
```

The catalog downloader uses the saved manifest and skips completed courses. The audit checks exact move coverage, not engine quality or popularity. The standalone `scripts/out/course-learning/library.html` remains available for selecting course sets separately from this app.

## Checks

```bash
npm run build
npm run validate
npm run test-ui
```

Course source locations, tile mapping rules, and fidelity checks are documented in [docs/COURSE_DATA.md](docs/COURSE_DATA.md).
