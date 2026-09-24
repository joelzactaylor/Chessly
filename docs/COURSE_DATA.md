# Course content and path fidelity

The source of truth is **not** the PGN alone. The PGN preserves chess variations, but not the original learning-path assignments.

## Sources

- `scripts/out/course-learning/catalog-manifest.json`: the 50 imported courses.
- `<course-id>/comet-checkpoint.json`: original chapter/study IDs, names, order, and `study.tiles` with tile IDs, kind, index, and required status. `data.studyMoves` contains variation IDs, SAN, before/after FEN, and variation index. `data.annotationsByPosition` contains the written notes, arrows, and highlights.
- `scripts/out/course-learning/path-content.json`: read-only responses from Chessly’s `/beta/openings/tiles/<tile-id>` endpoint. These provide the explicit `newVariations` and `reviewVariations` assignments. Capturing is resumable.
- The Vienna course (`775a4eea-5a50-47da-b7dd-5790ef829fbe`) has its original checkpoint directly in `scripts/out/course-learning/`, rather than its UUID subdirectory.

Videos, leaderboard features, and the AI Levi bot are intentionally excluded, including their buttons. Keep video metadata in the original import if present, but do not publish video tiles in the local course path.

## Behavior

`src/pathNavigation.ts` maps real tile IDs to sessions. A learn tile produces **guided variation A → review A → guided variation B → review B**, using its assigned variation IDs. A review tile can include previously taught variations, not just the immediately preceding lesson. Graduation uses its recorded review set. Review order is shuffled as on the source site.

Tile completion is stored separately from variation completion in the existing progress record. Each successful review is saved immediately, including when the user ends the session before clicking Next or Finish. A path tile is completed only after its entire session is finished. Existing saved courses, learned variations, and reviews are retained. They are not sufficient evidence that a particular path tile was completed. Unlocking follows Chessly’s per-study rule, explicitly accepted by the user: each study starts with its first stage available, and its later stages remain locked until the study progresses. Studies do not impose course-wide prerequisites.

`src/components/PathSession.tsx` runs path sessions. `CoursePractice.tsx` runs chapter-based Drill Shuffle and course practice from locally completed variations. Source-site spaced-repetition scheduling and account progress are not synchronized. Single-variation off-path URLs use a variation index directly, never a pair/batch index. The explorer does not autoplay opponent replies.

The publisher merges annotations when equivalent FENs normalize to the same position, avoiding the previous overwrite loss. It rejects tile assignments that reference a variation absent from that study. Missing tile content must be reported as unavailable, never filled with guessed variation assignments.

## Commands

```sh
# Requires an already logged-in Chessly tab in Comet; only reads source content.
npx tsx scripts/course-learning/capture-path-content.ts
npm run library:publish
npm run build
npm run validate
npm run test-ui
npm run test-path-ui
npm run test-practice-progress
npm run test-path-parity
```

The parity check compares every published move, annotation, tile identity, and session assignment against the saved source data. `--complete` requires every non-video tile to have an exact captured assignment. UI tests cover teaching/review order, locked stages, completion, shuffle, hints, and excluded controls.

The local app runs at `http://127.0.0.1:5173`; browser tests can use another address via `CHESS_LIBRARY_URL`. Original source snapshots and audit artifacts are under `scripts/out/parity/`. Styling proposals in that directory are previews, not approved app CSS.
