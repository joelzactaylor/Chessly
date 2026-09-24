import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  let requests = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.url().includes('explorer.lichess.ovh')) requests++; });
  await page.addInitScript(() => {
    if (!localStorage.getItem('test.seeded')) {
      localStorage.setItem('test.seeded', 'keep');
      localStorage.setItem('throughline.lichess.token', 'old-token');
      localStorage.setItem('throughline.lichess.cache', '{"stale":true}');
      localStorage.setItem('throughline.progress', '{"state":{"settings":{"dailyGoal":90}}}');
      localStorage.setItem('throughline.generated-courses.v2', '{"version":4,"courses":[]}');
    }
    // Deterministically hold engine analysis so Pause must interrupt an in-flight operation.
    const w = window as unknown as { engineStarts: number; engineCloses: number; fetchMode?: string; fetchStarted?: boolean; fetchAborted?: boolean; __name: (value: unknown) => unknown };
    w.__name = (value) => value;
    w.engineStarts = 0; w.engineCloses = 0;
    class SlowWorker {
      onmessage: ((event: { data: string }) => void) | null = null;
      constructor() { w.engineStarts++; }
      postMessage(command: string) {
        if (command === 'uci') setTimeout(() => this.onmessage?.({ data: 'uciok' }), 0);
        if (command === 'isready') setTimeout(() => this.onmessage?.({ data: 'readyok' }), 0);
        if (command.startsWith('go ') && w.fetchMode) setTimeout(() => {
          this.onmessage?.({ data: 'info depth 16 score cp 0 pv b8c6' });
          this.onmessage?.({ data: 'bestmove b8c6' });
        }, 0);
      }
      terminate() { w.engineCloses++; }
    }
    Object.defineProperty(window, 'Worker', { value: SlowWorker });
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (!String(input).includes('explorer.lichess.ovh')) return originalFetch(input, init);
      w.fetchStarted = true;
      if (w.fetchMode === 'rate') return Promise.resolve(new Response('', { status: 429 }));
      return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => {
        w.fetchAborted = true;
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true }));
    };
  });
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('heading', { name: 'Course setup' }).waitFor();
  assert.equal(await page.getByLabel('Lichess API token').inputValue(), '');
  assert.equal(await page.evaluate(() => localStorage.getItem('throughline.lichess.cache')), null);
  await page.getByLabel('Lichess API token').fill('test-token');
  await page.getByRole('button', { name: 'Save connection' }).click();
  await page.reload();
  await page.getByRole('heading', { name: 'Course setup' }).waitFor();
  assert.equal(await page.evaluate('window.engineStarts'), 0, 'saved token must not start a build');
  assert.equal(requests, 0);
  await page.getByRole('button', { name: 'Start build', exact: true }).click();
  await page.getByText('Reading common opponent replies', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Pause build', exact: true }).click();
  await page.getByRole('button', { name: 'Resume build', exact: true }).waitFor();
  assert.equal(await page.evaluate('window.engineCloses'), 1, 'pause must terminate the engine');
  const pending = await page.evaluate(async () => {
    const path = '/src/state/buildStorage.ts';
    return JSON.parse((await import(/* @vite-ignore */ path)).readBuildData('throughline.course-draft.v4')).work.vienna.queue.length;
  });
  assert.equal(pending, 1, 'the interrupted position must remain queued');
  await page.reload();
  await page.getByRole('button', { name: 'Resume build', exact: true }).waitFor();
  assert.equal(await page.evaluate('window.engineStarts'), 0, 'reload must leave checkpoints paused');
  await page.getByRole('button', { name: 'Resume build', exact: true }).click();
  await page.getByRole('button', { name: 'Pause build', exact: true }).click();
  await page.getByRole('button', { name: 'Resume build', exact: true }).waitFor();
  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Restart from scratch' }).click()]);
  await page.getByRole('button', { name: 'Start build', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('throughline.course-draft.v4')), null);
  assert.equal(await page.getByLabel('Lichess API token').inputValue(), 'test-token');
  assert.equal(await page.evaluate('window.engineStarts'), 0);
  await page.evaluate('window.fetchMode = "hold"');
  await page.getByRole('button', { name: 'Start build', exact: true }).click();
  await page.waitForFunction('window.fetchStarted');
  await page.getByRole('button', { name: 'Pause build', exact: true }).click();
  await page.getByRole('button', { name: 'Resume build', exact: true }).waitFor();
  assert.equal(await page.evaluate('window.fetchAborted'), true, 'pause must abort an in-flight fetch');
  await page.evaluate('window.fetchMode = "rate"');
  await page.getByRole('button', { name: 'Resume build', exact: true }).click();
  await page.getByText(/rate limit/i).waitFor();
  await page.getByRole('button', { name: 'Pause build', exact: true }).click();
  await page.getByRole('button', { name: 'Resume build', exact: true }).waitFor({ timeout: 3000 });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: 'scripts/out/manual-setup.png', fullPage: true });
  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Clear everything', exact: true }).click()]);
  await page.getByRole('heading', { name: 'Course setup' }).waitFor();
  assert.equal(await page.getByLabel('Lichess API token').inputValue(), '');
  assert.equal(await page.evaluate(() => localStorage.getItem('throughline.lichess.token')), null);
  assert.equal(await page.evaluate(() => localStorage.getItem('test.seeded')), 'keep');
  assert.equal(await page.evaluate('window.engineStarts'), 0);
  assert.deepEqual(errors, []);
  console.log('Fresh setup, no auto-start, engine/fetch/rate-limit pause, resume, restart, mobile visualization and full reset passed.');
} finally { await browser.close(); }
