import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { Chess } from "chess.js";
const base = "scripts/out/course-learning";
const manifest = JSON.parse(
  await readFile(`${base}/catalog-manifest.json`, "utf8"),
);
const pathContent = JSON.parse(await readFile(`${base}/path-content.json`, "utf8"));
await mkdir("public/library", { recursive: true });
const catalog = [];
for (const entry of manifest) {
  const dir =
    entry.id === "775a4eea-5a50-47da-b7dd-5790ef829fbe"
      ? base
      : `${base}/${entry.id}`;
  const coverage = JSON.parse(await readFile(`${dir}/coverage.json`, "utf8"));
  const checkpoint = JSON.parse(
    await readFile(`${dir}/comet-checkpoint.json`, "utf8"),
  );
  const studies = checkpoint.studies.map((s: any) => {
    const raw = Object.values(s.data.studyMoves).flat() as {
      variationId: string;
      variationIndex: number;
      fen: string;
      san: string;
    }[];
    const ids = [...new Set(raw.map((m) => m.variationId))];
    const lines = ids
      .map((id) => {
        const moves = raw
          .filter((m) => m.variationId === id)
          .sort(
            (a, b) =>
              Number(a.fen.split(" ")[5]) - Number(b.fen.split(" ")[5]) ||
              (a.fen.split(" ")[1] === "w" ? -1 : 1),
          );
        return {
          id,
          title: `Variation ${moves[0].variationIndex}`,
          sans: moves.map((m) => m.san),
        };
      })
      .sort(
        (a, b) => Number(a.title.split(" ")[1]) - Number(b.title.split(" ")[1]),
      );
    const notes: Record<string, unknown[]> = {};
    for (const [fen, annotations] of Object.entries(s.data.annotationsByPosition)) {
      const key = new Chess(fen).fen();
      const merged = notes[key] ?? [];
      for (const note of annotations as unknown[]) {
        if (!merged.some(existing => JSON.stringify(existing) === JSON.stringify(note))) merged.push(note);
      }
      notes[key] = merged;
    }
    return {
      id: s.study.id,
      title: s.study.name.replace(/^Study \d+:\s*/, ""),
      chapterId: s.chapter.id,
      chapter: s.chapter.name.replace(/^Chapter \d+:\s*/, ""),
      lines,
      notes,
      tiles: [...s.study.tiles].filter((t: any) => t.kind !== "video").sort((a: any, b: any) => a.index - b.index).map((tile: any) => {
        const content = pathContent[tile.id];
        if (content && (content.tileId !== tile.id || content.kind !== tile.kind || content.index !== tile.index))
          throw Error(`Tile identity changed: ${tile.id}`);
        for (const id of [...(content?.newVariations ?? []), ...(content?.reviewVariations ?? [])]) {
          if (!lines.some(line => line.id === id)) throw Error(`Unknown variation ${id} in tile ${tile.id}`);
        }
        return { ...tile, newVariations: content?.newVariations ?? [], reviewVariations: content?.reviewVariations ?? [],
          videoIds: content?.videoIds ?? [], quizIds: content?.quizIds ?? [], verified: !!content };
      }),
    };
  });
  const item = {
    ...entry,
    chapters: coverage.chapters,
    studies: coverage.studies,
    variations: coverage.variations,
    positions: coverage.positions,
    image: `/course-art/${entry.id}.png`,
  };
  catalog.push(item);
  await writeFile(
    `public/library/${entry.id}.json`,
    JSON.stringify({ ...item, lessons: studies }),
  );
  await copyFile(
    `${dir}/${dir === base ? "vienna.pgn" : "course.pgn"}`,
    `public/library/${entry.id}.pgn`,
  );
}
await writeFile("public/library/catalog.json", JSON.stringify(catalog));
const screening = JSON.parse(
  await readFile(`${base}/catalog-screening.json`, "utf8"),
);
await writeFile(
  "public/library/coming-soon.json",
  JSON.stringify(
    screening.entries.filter((e: any) => e.availability === "coming soon"),
  ),
);
console.log(`Published ${catalog.length} courses for the local app.`);
