/** Large data lives in IndexedDB; the synchronous mirror is hydrated before App imports. */
export const BUILD_KEYS = ['throughline.generated-courses.v2', 'throughline.course-draft.v4', 'throughline.lichess.cache'] as const;
const mirror = new Map<string, string>();
let database: Promise<IDBDatabase> | undefined;
function open() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('throughline-builds', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('data');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other Throughline tabs and reload to upgrade storage.'));
  });
}
export function readBuildData(key: string) { return mirror.get(key) ?? null; }
export async function writeBuildData(values: Record<string, string | null>) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('data', 'readwrite');
    const store = tx.objectStore('data');
    try {
      for (const [key, value] of Object.entries(values)) {
        if (value === null) store.delete(key); else store.put(value, key);
      }
    } catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Build data could not be saved. Export your last checkpoint before clearing anything.'));
    tx.onerror = () => { /* onabort reports transaction failure */ };
  });
  for (const [key, value] of Object.entries(values)) {
    if (value === null) mirror.delete(key); else mirror.set(key, value);
  }
}
export async function initializeBuildStorage() {
  const db = await open();
  const stored = await new Promise<(string | undefined)[]>((resolve, reject) => {
    const tx = db.transaction('data', 'readonly');
    const requests = BUILD_KEYS.map((key) => tx.objectStore('data').get(key));
    tx.oncomplete = () => resolve(requests.map((request) => request.result));
    tx.onabort = () => reject(tx.error);
  });
  const migrate: Record<string, string> = {};
  BUILD_KEYS.forEach((key, i) => {
    if (stored[i] !== undefined) mirror.set(key, stored[i]!);
    else {
      const legacy = localStorage.getItem(key);
      if (legacy !== null) migrate[key] = legacy;
    }
  });
  // Commit first. A failed migration never deletes the existing checkpoint.
  if (Object.keys(migrate).length) await writeBuildData(migrate);
  for (const key of BUILD_KEYS) localStorage.removeItem(key);
}
export async function clearBuildStorage() {
  await writeBuildData(Object.fromEntries(BUILD_KEYS.map((key) => [key, null])));
  for (const key of BUILD_KEYS) localStorage.removeItem(key);
}
