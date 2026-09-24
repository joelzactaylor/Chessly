import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Chess } from "chess.js";
import type { Course } from "../../src/library";
const base = process.env.CHESS_LIBRARY_URL ?? "http://127.0.0.1:5173";
const course: Course = JSON.parse(
  await readFile(
    "public/library/775a4eea-5a50-47da-b7dd-5790ef829fbe.json",
    "utf8",
  ),
);
const study = course.lessons[0];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(base) && /^https?:/.test(r.url()))
      external.push(r.url());
  });
  await page.goto(`${base}/#/courses`);
  await page.getByRole("heading", { name: "Explore your library" }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Leaderboards", exact: true }).count(),
    0,
  );
  await page
    .getByRole("button", { name: "Black Openings", exact: true })
    .click();
  const catalog = JSON.parse(
    await readFile("public/library/catalog.json", "utf8"),
  );
  assert.equal(
    await page.locator(".course-grid .course-card").count(),
    catalog.filter((c: { side: string }) => c.side === "Black").length,
  );
  await page.goto(`${base}/#/courses/${course.id}`);
  await page.getByRole("button", { name: "Add to my courses" }).click();
  await page.goto(`${base}/#/learn/${course.id}/${study.id}/0`);
  await page.getByText(study.title, { exact: true }).first().waitFor();
  await page
    .getByRole("button", { name: "Last position", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(`**/courses/${course.id}`);
  await page.goto(`${base}/#/drill/${course.id}/${study.id}/0`);
  await page.getByRole("heading", { name: "Find the course move." }).waitFor();
  async function clickSquare(sq: string) {
    const square = page.locator(`.board .sq[data-sq="${sq}"]`);
    await square.scrollIntoViewIfNeeded();
    await square.click({ force: true });
  }
  await clickSquare("d2");
  await clickSquare("d4");
  await page
    .getByText(
      "That’s a legal move, but not the move in this lesson. Try again.",
    )
    .waitFor();
  for (const drillLine of study.lines.slice(0, 1)) {
    const chess = new Chess();
    for (let i = 0; i < drillLine.sans.length; i++) {
      await page.waitForFunction(
        (n) =>
          document
            .querySelector(".board-controls>span")
            ?.textContent?.startsWith(`${n} /`),
        i,
      );
      const side = chess.turn();
      const m = chess.move(drillLine.sans[i]);
      if (side === "w") {
        await clickSquare(m.from);
        await clickSquare(m.to);
      }
    }
  }
  await page.getByRole("heading", { name: "Lesson complete!" }).waitFor();
  const progress = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("chess-library-progress-v1")!),
  );
  assert.equal(progress.reviews.length, 1);
  assert.equal(progress.reviews[0].mistakes, 1);
  assert(progress.saved.includes(course.id));
  await page.reload();
  await page.getByText(study.title, { exact: true }).first().waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("chess-library-progress-v1")!).reviews
          .length,
    ),
    1,
  );
  await page.goto(`${base}/#/learn/${course.id}/${study.id}/0?ply=6`);
  await page.reload();
  await page.waitForFunction(() =>
    document
      .querySelector(".board-controls>span")
      ?.textContent?.startsWith("6 /"),
  );
  await page.goto(`${base}/#/explore/${course.id}/${study.id}/0?ply=7`);
  await page.keyboard.press("ArrowRight");
  assert.match(
    await page.locator(".board-controls>span").innerText(),
    /^7 \/ /,
  );
  await page
    .locator(".notation-table button")
    .filter({ hasText: /^e4/ })
    .first()
    .click();
  await page.waitForURL("**?ply=1");
  await clickSquare("e7");
  await clickSquare("e5");
  await page.waitForURL("**?ply=2");
  await page.waitForTimeout(350);
  await page.screenshot({
    path: "scripts/out/improved-lesson.png",
    fullPage: true,
  });
  await page.goto(`${base}/#/courses`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "Explore your library" }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.goto(`${base}/#/learn/${course.id}/${study.id}/0`);
  await page.getByText(study.title, { exact: true }).first().waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.screenshot({
    path: "scripts/out/lesson-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "UI checks passed: course filters, saved courses, lesson navigation, complete drill, wrong-move feedback, persistent progress, mobile layout, no external requests.",
  );
} finally {
  await browser.close();
}
