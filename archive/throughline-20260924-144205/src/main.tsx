import './state/dataRevision';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeBuildStorage } from './state/buildStorage';
import './styles/global.css';

try {
  if (sessionStorage.getItem('throughline.open-setup')) {
    location.hash = '#/settings';
    sessionStorage.removeItem('throughline.open-setup');
  }
} catch { /* Private browsing may restrict storage. */ }

async function boot() {
await initializeBuildStorage();
const { refreshBuildOverview } = await import('./lib/courseGenerator');
refreshBuildOverview();
const { default: App } = await import('./App');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
}
void boot().catch((error) => {
  document.getElementById('root')!.textContent = `Storage could not be opened: ${error.message}. Your saved data has not been cleared. Close other tabs and reload; ensure this site can use browser storage.`;
});
