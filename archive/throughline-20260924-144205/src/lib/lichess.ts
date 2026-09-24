/**
 * Client-side Lichess opening-explorer sync. With a personal API token (no scopes needed)
 * the app fetches, for every position in the repertoire where the opponent is to move, what
 * 1600–2000 rated players actually reply, and caches it in localStorage. Mixed practice uses
 * the numbers to weight the opponent's choices, and Explore shows them.
 */
import { parsedCourses, type PosStats } from '../state/courses';
import { loadCache, saveCache, clearCache } from '../state/lichessCache';
export { clearCache };
import { walk } from './tree';
import type { RepNode } from './types';
import { OPPONENT_REPLY_THRESHOLD } from '../data/rules';

const TOKEN_KEY = 'throughline.lichess.token';
export const RATINGS = '1600,1800,2000';
export const SPEEDS = 'blitz,rapid,classical';

export function getToken(): string { try { return localStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; } }
export function setToken(t: string) { try { localStorage.setItem(TOKEN_KEY, t.trim()); } catch { /* ignore */ } }

export function cacheSize(): number { return Object.keys(loadCache()).length; }

/** All opponent-to-move positions in the repertoire (deduplicated by position). */
export function opponentPositions(): RepNode[] {
  const seen = new Set<string>();
  const out: RepNode[] = [];
  for (const pc of parsedCourses) for (const ch of pc.chapters) walk(ch.root, (n) => {
    if (n.children.length && !n.children[0].userMove && !seen.has(n.key)) { seen.add(n.key); out.push(n); }
  });
  return out;
}

async function fetchOne(fen: string, token: string): Promise<PosStats | null> {
  const key = fen.split(' ').slice(0, 4).join(' ');
  const params = new URLSearchParams({ variant: 'standard', fen: key + ' 0 1', speeds: SPEEDS, ratings: RATINGS, moves: '14', topGames: '0', recentGames: '0' });
  const res = await fetch(`https://explorer.lichess.ovh/lichess?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 61_000)); return fetchOne(fen, token); }
  if (res.status === 401) throw new Error('Lichess rejected the token (401). Check it and try again.');
  if (!res.ok) throw new Error(`Lichess explorer error ${res.status}`);
  const d = await res.json();
  const total = d.white + d.draws + d.black;
  if (total < 30) return { games: total, moves: {}, score: {} };
  const moves: Record<string, number> = {};
  const score: Record<string, number> = {};
  for (const m of d.moves) {
    const mt = m.white + m.draws + m.black;
    moves[m.san] = Math.round((1000 * mt) / total) / 10;
    score[m.san] = Math.round((1000 * (m.white + m.draws / 2)) / mt) / 10;
  }
  return { games: total, moves, score };
}

export interface SyncProgress { done: number; total: number; error?: string; finished: boolean }

/** Fetch stats for every uncached opponent position. Resolves when finished or on error. */
export async function syncAll(onProgress: (p: SyncProgress) => void, signal?: { cancelled: boolean }): Promise<void> {
  const token = getToken();
  if (!token) { onProgress({ done: 0, total: 0, error: 'No token saved.', finished: true }); return; }
  const c = loadCache();
  const todo = opponentPositions().filter((n) => !c[n.key]);
  const total = todo.length;
  let done = 0;
  onProgress({ done, total, finished: total === 0 });
  for (const n of todo) {
    if (signal?.cancelled) { onProgress({ done, total, finished: true }); return; }
    try {
      const st = await fetchOne(n.fen, token);
      if (st) c[n.key] = st;
    } catch (e) {
      await saveCache();
      onProgress({ done, total, error: (e as Error).message, finished: true });
      return;
    }
    done++;
    if (done % 10 === 0) await saveCache();
    onProgress({ done, total, finished: false });
    await new Promise((r) => setTimeout(r, 350)); // stay well under the rate limit
  }
  await saveCache();
  onProgress({ done, total, finished: true });
}

/** Coverage summary: how much of what people play is answered by the repertoire. */
export function coverageReport(): { positions: number; avgCovered: number; gaps: Array<{ node: RepNode; san: string; pct: number; games: number }> } {
  const c = loadCache();
  let sum = 0;
  let count = 0;
  const gaps: Array<{ node: RepNode; san: string; pct: number; games: number }> = [];
  // Merge the replies covered anywhere in the repertoire for the same position (other
  // chapters and courses of the same colour frequently transpose into each other).
  const coveredByKey = new Map<string, Set<string>>();
  for (const pc of parsedCourses) for (const ch of pc.chapters) walk(ch.root, (n) => {
    if (!n.children.length || n.children[0].userMove) return;
    if (!coveredByKey.has(n.key)) coveredByKey.set(n.key, new Set());
    for (const x of n.children) coveredByKey.get(n.key)!.add(x.san);
  });
  const seenKey = new Set<string>();
  for (const n of opponentPositions()) {
    const st = c[n.key];
    if (!st || st.games < 200 || seenKey.has(n.key)) continue;
    seenKey.add(n.key);
    const covered = coveredByKey.get(n.key) ?? new Set(n.children.map((x) => x.san));
    let cov = 0;
    for (const [san, pct] of Object.entries(st.moves)) {
      if (covered.has(san)) cov += pct;
      else if (pct >= OPPONENT_REPLY_THRESHOLD) gaps.push({ node: n, san, pct, games: st.games });
    }
    sum += Math.min(100, cov);
    count++;
  }
  gaps.sort((a, b) => b.pct * b.games - a.pct * a.games);
  return { positions: count, avgCovered: count ? sum / count : 0, gaps };
}
