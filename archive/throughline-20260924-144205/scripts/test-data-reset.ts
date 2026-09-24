import assert from 'node:assert/strict';
import { ensureFreshData } from '../src/state/dataRevision';

const saved = new Map<string, string>([
  ['throughline.lichess.cache', '{"stale":true}'],
  ['throughline.generated-courses.v2', '{"stale":true}'],
  ['throughline.course-draft.v3', '{"stale":true}'],
  ['throughline.course-draft.v4', '{"stale":true}'],
  ['throughline.lichess.token', 'test-token'],
  ['throughline.progress', '{"lines":{}}'],
  ['unrelated-app', 'keep-me'],
]);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => saved.set(key, value),
  removeItem: (key: string) => saved.delete(key),
  get length() { return saved.size; },
  key: (index: number) => [...saved.keys()][index] ?? null,
} });
ensureFreshData();
assert.equal(saved.has('throughline.lichess.cache'), false);
assert.equal(saved.has('throughline.generated-courses.v2'), false);
assert.equal(saved.has('throughline.course-draft.v3'), false);
assert.equal(saved.has('throughline.course-draft.v4'), false);
assert.equal(saved.has('throughline.lichess.token'), false);
assert.equal(saved.has('throughline.progress'), false);
assert.equal(saved.get('unrelated-app'), 'keep-me');
saved.set('throughline.lichess.cache', '{"fresh":true}');
saved.set('throughline.course-draft.v4', '{"fresh":true}');
ensureFreshData();
assert.equal(saved.get('throughline.lichess.cache'), '{"fresh":true}');
assert.equal(saved.get('throughline.course-draft.v4'), '{"fresh":true}');
console.log('One-time full reset clears Throughline only and preserves subsequent fresh checkpoints.');
