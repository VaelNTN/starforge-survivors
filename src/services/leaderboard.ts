import { AscensionTier, HeroId, LeaderboardEntry, LeaderboardMode, PlayerSave } from '../types/game';

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || '').replace(/\/+$/, '');

export interface OnlineLeaderboardResult {
  entries: LeaderboardEntry[];
  online: boolean;
}

export async function fetchOnlineLeaderboard(
  mode: LeaderboardMode,
  save: PlayerSave,
  limit = 25
): Promise<OnlineLeaderboardResult> {
  const local = (save.localLeaderboard?.[mode] || []).map((e, i) => ({
    ...e,
    rank: i + 1,
    isPlayer: e.deviceId === save.deviceId || e.isPlayer,
  }));

  if (!API_BASE) {
    return { entries: local, online: false };
  }

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      `${API_BASE}/api/starforge/highscores?mode=${encodeURIComponent(mode)}&limit=${limit}`,
      { signal: controller.signal }
    );
    window.clearTimeout(timer);
    if (!res.ok) return { entries: local, online: false };

    const data = (await res.json()) as {
      scores?: Array<{
        deviceId?: string;
        device_id?: string;
        playerName?: string;
        player_name?: string;
        mode?: LeaderboardMode;
        score?: number;
        wave?: number;
        kills?: number;
        heroId?: HeroId;
        hero_id?: HeroId;
        ascension?: AscensionTier;
        updatedAt?: string;
        updated_at?: string;
      }>;
      entries?: Array<Record<string, unknown>>;
    };

    const rawList = Array.isArray(data.scores) ? data.scores : Array.isArray(data.entries) ? data.entries : [];
    const parsed: LeaderboardEntry[] = rawList.map((row: Record<string, unknown>, idx: number) => {
      const devId = String(row.deviceId || row.device_id || '');
      return {
        rank: idx + 1,
        deviceId: devId,
        playerName: String(row.playerName || row.player_name || 'Commander'),
        mode,
        score: Number(row.score || 0),
        wave: Number(row.wave || 0),
        kills: Number(row.kills || 0),
        heroId: (row.heroId || row.hero_id || 'kael') as HeroId,
        ascension: (Math.max(1, Math.min(5, Number(row.ascension || 1))) as AscensionTier),
        isPlayer: devId === save.deviceId,
        updatedAt: String(row.updatedAt || row.updated_at || ''),
      };
    });

    return { entries: parsed, online: true };
  } catch {
    return { entries: local, online: false };
  }
}

export async function submitOnlineScore(payload: {
  deviceId: string;
  playerName: string;
  mode: LeaderboardMode;
  score: number;
  wave: number;
  kills: number;
  heroId: HeroId;
  ascension: AscensionTier;
}): Promise<boolean> {
  if (!API_BASE) return false;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    const res = await fetch(`${API_BASE}/api/starforge/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
