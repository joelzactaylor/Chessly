# Chessly local library

- Keep streak/XP counters and profile/XP avatar symbols out of the header; progress backup controls belong in the footer.
- Keep videos, video tiles/buttons, leaderboards, and the AI Levi bot/buttons out of the local UI. These are deliberate user exclusions even when present in scraped metadata.
- Preserve the existing main color palette. Get confirmation for visual redesigns; directly requested visual fixes are authorized.
- Course path tiles must use the original IDs, ordering, kinds, and explicit variation assignments. Never synthesize lessons by dividing the variation count or treat a graduation tile as the last variation.
- Learn tiles teach each assigned variation and then review it. Review and graduation tiles use their recorded review sets. Use Chessly’s per-study unlocking, which the user explicitly accepted: the first stage of every study is available, while later stages within that study are faded and disabled until its preceding stages are completed. Do not impose a course-wide lock.
- Keep the “YOU ARE HERE” badge above adjacent elements and leave space below study headings. Chapter titles must align consistently across the full heading width.
- Preserve imported course data and user progress. Original metadata is in `scripts/out/course-learning/`; app assets are generated in `public/library/`.
- See `docs/COURSE_DATA.md` for data sources, publishing, and fidelity checks. Authenticated source inspection must remain read-only; do not mark lessons complete on Chessly.
