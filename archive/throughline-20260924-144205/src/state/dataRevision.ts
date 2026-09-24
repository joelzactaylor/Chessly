/** User-requested fresh start after adding manual setup controls. */
export const DATA_REVISION = 'manual-setup-2026-09-20';
export const DATA_REVISION_KEY = 'throughline.data-revision';

export function ensureFreshData() {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(DATA_REVISION_KEY) === DATA_REVISION) return;
  resetApplicationData();
}

export function resetApplicationData() {
  // Only this application's namespace; never clear another application's storage.
  for (const store of [localStorage, ...(typeof sessionStorage === 'undefined' ? [] : [sessionStorage])]) {
    const keys = Array.from({ length: store.length }, (_, i) => store.key(i));
    for (const key of keys) if (key?.startsWith('throughline.')) store.removeItem(key);
  }
  localStorage.setItem(DATA_REVISION_KEY, DATA_REVISION);
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('throughline.open-setup', '1');
}

// Run before the progress store hydrates, including through indirect imports.
try { ensureFreshData(); } catch { /* The UI remains available if browser storage is unavailable. */ }
