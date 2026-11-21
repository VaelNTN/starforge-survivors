import { PlayerSave } from '../types/game';

const CLOUD_API_BASE = 'https://arcade-highscores-worker.vaelntn.workers.dev';

export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SF-${part1}-${part2}`;
}

export async function uploadCloudSave(syncCode: string, save: PlayerSave): Promise<{ ok: boolean; message: string }> {
  const clean = syncCode.trim().toUpperCase();
  if (!clean || clean.length < 6) return { ok: false, message: 'Invalid sync code' };
  try {
    const res = await fetch(`${CLOUD_API_BASE}/api/starforge/cloud-save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncCode: clean, payload: JSON.stringify(save) }),
    });
    if (!res.ok) {
      return { ok: false, message: `Cloud sync unavailable (${res.status}) — use Export Code below` };
    }
    return { ok: true, message: `Cloud Backup saved under ${clean}!` };
  } catch {
    return { ok: false, message: 'Offline — use local Backup Code copy/paste' };
  }
}

export async function downloadCloudSave(syncCode: string): Promise<{ ok: boolean; save?: PlayerSave; message: string }> {
  const clean = syncCode.trim().toUpperCase();
  if (!clean || clean.length < 6) return { ok: false, message: 'Enter a valid Sync Code (e.g. SF-ABCD-1234)' };
  try {
    const res = await fetch(`${CLOUD_API_BASE}/api/starforge/cloud-save?code=${encodeURIComponent(clean)}`);
    if (!res.ok) {
      return { ok: false, message: res.status === 404 ? 'No cloud save found for that code' : `Cloud restore error (${res.status})` };
    }
    const data = (await res.json()) as { payload?: string };
    if (!data.payload) return { ok: false, message: 'Empty cloud save payload' };
    const parsed = JSON.parse(data.payload) as PlayerSave;
    if (!parsed || typeof parsed.coins !== 'number') return { ok: false, message: 'Corrupted save data' };
    return { ok: true, save: parsed, message: `Restored Commander ${parsed.playerName} from cloud!` };
  } catch {
    return { ok: false, message: 'Offline — unable to reach cloud server' };
  }
}

export function encodeBackupString(save: PlayerSave): string {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(save))));
  } catch {
    return '';
  }
}

export function decodeBackupString(raw: string): PlayerSave | null {
  try {
    const json = decodeURIComponent(escape(atob(raw.trim())));
    const parsed = JSON.parse(json) as PlayerSave;
    if (!parsed || typeof parsed.coins !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}
