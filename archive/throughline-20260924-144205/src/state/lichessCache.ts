import type { PosStats } from './courses';
import { ensureFreshData } from './dataRevision';
import { readBuildData, writeBuildData } from './buildStorage';

const CACHE_KEY = 'throughline.lichess.cache';
let cache: Record<string, PosStats> | null = null;

export function loadCache(): Record<string, PosStats> {
  if (cache) return cache;
  try { ensureFreshData(); cache = JSON.parse(readBuildData(CACHE_KEY) ?? '{}'); } catch { cache = {}; }
  cache ??= {};
  return cache!;
}
export async function saveCache() { await writeBuildData({ [CACHE_KEY]: JSON.stringify(cache ?? {}) }); }
export async function clearCache() { await writeBuildData({ [CACHE_KEY]: null }); cache = {}; }
