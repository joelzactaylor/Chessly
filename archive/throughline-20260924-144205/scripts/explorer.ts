/**
 * Lichess opening explorer client with an on-disk cache.
 * Needs a personal API token (https://lichess.org/account/oauth/token, no scopes) in
 * the LICHESS_TOKEN env var or a `.lichess-token` file in the project root.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
}
export interface ExplorerResult {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening?: { eco: string; name: string } | null;
}

const CACHE_DIR = join(process.cwd(), 'scripts', 'cache', 'explorer');
export const RATINGS = '1600,1800,2000';
export const SPEEDS = 'blitz,rapid,classical';

export function loadToken(): string | null {
  if (process.env.LICHESS_TOKEN) return process.env.LICHESS_TOKEN.trim();
  const p = join(process.cwd(), '.lichess-token');
  if (existsSync(p)) return readFileSync(p, 'utf8').trim() || null;
  return null;
}

let lastCall = 0;
async function throttle(ms: number) {
  const wait = lastCall + ms - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

export async function explorer(fen: string, db: 'lichess' | 'masters' = 'lichess'): Promise<ExplorerResult | null> {
  const key = fen.split(' ').slice(0, 4).join(' ');
  const hash = createHash('sha1').update(`${db}|${RATINGS}|${SPEEDS}|${key}`).digest('hex');
  const cachePath = join(CACHE_DIR, `${hash}.json`);
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf8'));
  const token = loadToken();
  if (!token) return null;
  const params = new URLSearchParams({ variant: 'standard', fen: key + ' 0 1', moves: '14', topGames: '0', recentGames: '0' });
  if (db === 'lichess') {
    params.set('speeds', SPEEDS);
    params.set('ratings', RATINGS);
  }
  await throttle(700);
  const res = await fetch(`https://explorer.lichess.ovh/${db}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'throughline/0.1 (personal opening trainer)' },
  });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 60_000));
    return explorer(fen, db);
  }
  if (!res.ok) throw new Error(`Explorer ${res.status} for ${key}`);
  const data = (await res.json()) as ExplorerResult;
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, JSON.stringify(data));
  return data;
}

export function total(r: { white: number; draws: number; black: number }): number {
  return r.white + r.draws + r.black;
}
