import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const file = process.argv[2];
if (!file) throw new Error('Pass a course-build export to exercise import and restore.');
const contents = await readFile(file, 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    (window as any).__name = (value: unknown) => value;
    (window as any).engineStarts = 0;
    class HeldWorker {
      onmessage: ((event: { data: string }) => void) | null = null;
      constructor() { (window as any).engineStarts++; }
      postMessage(command: string) {
        if (command === 'uci') queueMicrotask(() => this.onmessage?.({ data: 'uciok' }));
        if (command === 'isready') queueMicrotask(() => this.onmessage?.({ data: 'readyok' }));
      }
      terminate() {}
    }
    Object.defineProperty(window, 'Worker', { value: HeldWorker });
    if (!localStorage.getItem('test.seeded')) {
      localStorage.setItem('test.seeded', 'yes');
      localStorage.setItem('throughline.data-revision', 'manual-setup-2026-09-20');
      localStorage.setItem('throughline.lichess.token', 'test-token');
      localStorage.setItem('throughline.course-draft.v4', JSON.stringify({ courses: [], chosen: [], work: {} }));
      localStorage.setItem('throughline.lichess.cache', '{"migration-test":{"games":1000,"moves":{},"score":{}}}');
    }
  });
  await page.goto('http://127.0.0.1:5173/#/settings');
  await page.getByRole('button', { name: 'Resume build', exact: true }).waitFor();
  const migrated = await page.evaluate(async () => {
    const path = '/src/state/buildStorage.ts';
    const storage = await import(/* @vite-ignore */ path);
    return { draft: storage.readBuildData('throughline.course-draft.v4'), cache: storage.readBuildData('throughline.lichess.cache'), legacy: localStorage.getItem('throughline.course-draft.v4') };
  });
  assert.ok(migrated.draft);
  assert.ok(migrated.cache.includes('migration-test'));
  assert.equal(migrated.legacy, null);
  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([page.waitForEvent('load'), page.locator('input[type=file]').first().setInputFiles(file)]);
  await page.getByRole('button', { name: 'Resume build', exact: true }).waitFor();
  const saved = await page.evaluate(async () => {
    const path = '/src/lib/courseGenerator.ts';
    return (await import(/* @vite-ignore */ path)).exportCourseBuild();
  });
  assert.deepEqual(JSON.parse(saved).inProgress, JSON.parse(contents).inProgress);
  assert.equal(await page.evaluate('window.engineStarts'), 0, 'import must stay paused');
  // Larger than localStorage can hold, then read through a genuine reload.
  await page.evaluate(async () => {
    const path = '/src/state/buildStorage.ts';
    await (await import(/* @vite-ignore */ path)).writeBuildData({ 'throughline.lichess.cache': JSON.stringify({ test: { games: 1, moves: {}, score: {}, padding: 'x'.repeat(8_000_000) } }) });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Resume build', exact: true }).waitFor();
  assert.equal(await page.evaluate(async () => {
    const path = '/src/state/buildStorage.ts';
    return (await import(/* @vite-ignore */ path)).readBuildData('throughline.lichess.cache').length > 8_000_000;
  }), true);
  const invalid = JSON.parse(contents); invalid.rulesVersion = -1;
  assert.equal(await page.evaluate(async (value) => {
    const path = '/src/lib/courseGenerator.ts';
    const generator = await import(/* @vite-ignore */ path);
    const before = generator.exportCourseBuild();
    try { await generator.importCourseBuild(value); return false; } catch {
      return JSON.stringify(JSON.parse(before).inProgress) === JSON.stringify(JSON.parse(generator.exportCourseBuild()).inProgress);
    }
  }, JSON.stringify(invalid)), true);
  await page.getByRole('button', { name: 'Resume build', exact: true }).click();
  await page.waitForFunction('window.engineStarts === 1');
  await page.getByRole('button', { name: 'Pause build', exact: true }).click();
  await page.getByRole('button', { name: 'Resume build', exact: true }).waitFor();
  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Restart from scratch' }).click()]);
  await page.getByRole('button', { name: 'Start build', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Lichess API token').inputValue(), 'test-token');
  await page.reload();
  await page.getByRole('button', { name: 'Start build', exact: true }).waitFor();
  assert.equal(await page.evaluate(async () => {
    const path = '/src/state/buildStorage.ts';
    const storage = await import(/* @vite-ignore */ path);
    return storage.BUILD_KEYS.every((key: string) => storage.readBuildData(key) === null);
  }), true, 'restart must not resurrect imported or migrated data');
  assert.equal(await page.evaluate('window.engineStarts'), 0);
  assert.deepEqual(errors, []);
  const failedMigration = await browser.newPage();
  await failedMigration.addInitScript(() => {
    localStorage.setItem('throughline.data-revision', 'manual-setup-2026-09-20');
    localStorage.setItem('throughline.course-draft.v4', '{"keep":"original checkpoint"}');
    IDBObjectStore.prototype.put = function () { throw new DOMException('Simulated disk full', 'QuotaExceededError'); };
  });
  await failedMigration.goto('http://127.0.0.1:5173/');
  await failedMigration.getByText(/Storage could not be opened/).waitFor();
  assert.equal(await failedMigration.evaluate(() => localStorage.getItem('throughline.course-draft.v4')), '{"keep":"original checkpoint"}', 'failed migration must preserve the original');
  await failedMigration.close();
  console.log('Legacy migration, actual export import, large IndexedDB save/reload, validation, resume/pause and clean restart passed.');
} finally { await browser.close(); }
