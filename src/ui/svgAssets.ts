import { BossArchetype, GearSlot, HeroId, RelicId, WeaponId, WeaponStyle } from '../types/game';

export function uiIconSvg(name: string, size = 16, color = 'currentColor'): string {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"`;
  switch (name) {
    case 'sword':
    case 'battle':
      return `<svg ${s}><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/></svg>`;
    case 'heroes':
      return `<svg ${s}><path d="M12 2 5 6v6c0 5 3.2 8.4 7 10 3.8-1.6 7-5 7-10V6l-7-4z"/><circle cx="12" cy="10" r="2.5"/><path d="M8.5 16c.8-1.8 2.1-2.5 3.5-2.5s2.7.7 3.5 2.5"/></svg>`;
    case 'armory':
    case 'shield':
      return `<svg ${s}><path d="M12 3 4 7v5c0 5.2 3.4 8.7 8 10 4.6-1.3 8-4.8 8-10V7l-8-4z"/><path d="M12 8v8"/><path d="M8.5 11.5h7"/></svg>`;
    case 'mastery':
    case 'crown':
      return `<svg ${s}><path d="M3 18h18"/><path d="M4 15 2.5 7l5 4L12 4l4.5 7 5-4L20 15H4z"/></svg>`;
    case 'vault':
    case 'codex':
      return `<svg ${s}><polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2"/><circle cx="12" cy="12" r="3"/><path d="M12 2v7"/><path d="M12 15v7"/></svg>`;
    case 'coin':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><circle cx="12" cy="12" r="9.5" fill="#f59e0b" stroke="#fef08a" stroke-width="1.8"/><circle cx="12" cy="12" r="5.5" stroke="#fef3c7" stroke-width="1.4"/><path d="M12 8.5v7M10 10.5h4M10 13.5h4" stroke="#fffbeb" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    case 'shard':
    case 'gem':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><polygon points="12 2 20 9 16 21 8 21 4 9 12 2" fill="#38bdf8" stroke="#e0f2fe" stroke-width="1.6" stroke-linejoin="round"/><polygon points="12 2 15 9 12 21 9 9 12 2" fill="#bae6fd" opacity="0.55"/></svg>`;
    case 'blueprint':
      return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><rect x="3" y="4" width="18" height="16" rx="2.5" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.7"/><path d="M7 9h10M7 13h6M7 17h8" stroke="#bfdbfe" stroke-width="1.6" stroke-linecap="round"/><circle cx="16.5" cy="15" r="2" stroke="#38bdf8" stroke-width="1.5"/></svg>`;
    case 'key':
      return `<svg ${s}><circle cx="8" cy="14" r="4"/><path d="M11 11l9-9"/><path d="M17 5l3 3"/><path d="M14.5 7.5 17 10"/></svg>`;
    case 'bolt':
      return `<svg ${s}><polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2" fill="${color}" fill-opacity="0.2"/></svg>`;
    case 'heart':
      return `<svg ${s}><path d="M12 20.5s-7.5-4.7-9.2-9C1.6 8.3 3.7 5 7 5c2 0 3.7 1.1 5 2.8C13.3 6.1 15 5 17 5c3.3 0 5.4 3.3 4.2 6.5-1.7 4.3-9.2 9-9.2 9z" fill="${color}" fill-opacity="0.22"/></svg>`;
    case 'target':
      return `<svg ${s}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.2" fill="${color}"/></svg>`;
    case 'timer':
      return `<svg ${s}><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/></svg>`;
    case 'skull':
      return `<svg ${s}><path d="M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.6 3 5.6V19h8v-3.4c1.7-1 3-3 3-5.6a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10.5" r="1.2" fill="${color}"/><circle cx="14.5" cy="10.5" r="1.2" fill="${color}"/><path d="M10 19v-2M14 19v-2"/></svg>`;
    case 'trophy':
      return `<svg ${s}><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4v2a3 3 0 0 0 3 3"/><path d="M17 6h3v2a3 3 0 0 1-3 3"/></svg>`;
    case 'flame':
      return `<svg ${s}><path d="M12 2c2.5 3 5 6.2 5 10a5 5 0 1 1-10 0c0-2 .8-3.8 2-5.2.3 1.5 1.2 2.4 2 2.4-.5-2.5 0-5.2 1-7.2z" fill="${color}" fill-opacity="0.25"/></svg>`;
    case 'dash':
      return `<svg ${s}><path d="M4 12h11"/><path d="M11 7l5 5-5 5"/><path d="M4 7h4M4 17h6"/></svg>`;
    case 'pause':
      return `<svg ${s}><rect x="6" y="5" width="4" height="14" rx="1" fill="${color}"/><rect x="14" y="5" width="4" height="14" rx="1" fill="${color}"/></svg>`;
    case 'play':
      return `<svg ${s}><polygon points="6 4 20 12 6 20 6 4" fill="${color}"/></svg>`;
    case 'settings':
      return `<svg ${s}><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 .9-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5.9H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z"/></svg>`;
    case 'wheel':
      return `<svg ${s}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3v6.5M12 14.5V21M3 12h6.5M14.5 12H21M5.6 5.6l4.6 4.6M13.8 13.8l4.6 4.6M18.4 5.6l-4.6 4.6M10.2 13.8l-4.6 4.6"/></svg>`;
    case 'patrol':
      return `<svg ${s}><circle cx="12" cy="12" r="4"/><path d="M4.9 19.1a10 10 0 0 1 0-14.2"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/><path d="M7.8 16.2a6 6 0 0 1 0-8.4"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4"/></svg>`;
    case 'calendar':
      return `<svg ${s}><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M9 15l2 2 4-4"/></svg>`;
    case 'crate':
    case 'chest':
      return `<svg ${s}><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 11h18"/><path d="M10 11v3h4v-3"/></svg>`;
    case 'magnet':
      return `<svg ${s}><path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M4 4h4M16 4h4"/></svg>`;
    case 'reroll':
      return `<svg ${s}><path d="M21 12a9 9 0 0 0-15.4-6.4L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.4 6.4L21 16"/><path d="M21 21v-5h-5"/></svg>`;
    case 'banish':
      return `<svg ${s}><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>`;
    case 'shrine':
      return `<svg ${s}><polygon points="12 2 17 10 12 22 7 10 12 2" fill="${color}" fill-opacity="0.2"/><path d="M4 20h16"/></svg>`;
    case 'star':
      return `<svg ${s}><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.7 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2" fill="${color}" fill-opacity="0.25"/></svg>`;
    case 'check':
      return `<svg ${s}><path d="M5 13l4 4L19 7"/></svg>`;
    case 'close':
      return `<svg ${s}><path d="M18 6 6 18M6 6l12 12"/></svg>`;
    case 'lock':
      return `<svg ${s}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
    case 'salvage':
      return `<svg ${s}><path d="M7 19H4.8a2 2 0 0 1-1.7-3l2.2-3.8"/><path d="M11 19h8.2a2 2 0 0 0 1.7-3l-2.2-3.8"/><path d="m14 5-1.1-2a2 2 0 0 0-3.4 0L7.3 6.8"/><path d="M14 16l-3 3 3 3"/></svg>`;
    case 'merge':
      return `<svg ${s}><path d="M12 3v18"/><path d="m5 10 7-7 7 7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>`;
    case 'alert':
      return `<svg ${s}><path d="M12 3 2.5 19.5h19L12 3z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="0.8" fill="${color}"/></svg>`;
    case 'chart':
      return `<svg ${s}><path d="M4 19h16"/><rect x="6" y="11" width="3" height="8" rx="0.5"/><rect x="11" y="7" width="3" height="12" rx="0.5"/><rect x="16" y="4" width="3" height="15" rx="0.5"/></svg>`;
    case 'gift':
      return `<svg ${s}><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M7.5 8a2.5 2.5 0 1 1 4.5-1.5A2.5 2.5 0 1 1 16.5 8"/></svg>`;
    default:
      return `<svg ${s}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="${color}"/></svg>`;
  }
}

export function gearSlotIconSvg(slot: GearSlot, size = 20, color = 'currentColor'): string {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"`;
  switch (slot) {
    case 'weapon':
      return `<svg ${s}><path d="M15 17 4 6V3h3l11 11"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/></svg>`;
    case 'armor':
      return `<svg ${s}><path d="M12 3 4 7v5c0 5 3.3 8.4 8 9.8 4.7-1.4 8-4.8 8-9.8V7l-8-4z" fill="${color}" fill-opacity="0.16"/><path d="M12 7v10"/></svg>`;
    case 'helmet':
      return `<svg ${s}><path d="M4 14a8 8 0 0 1 16 0v3H4v-3z" fill="${color}" fill-opacity="0.16"/><path d="M7 13h10"/><path d="M12 4v4"/></svg>`;
    case 'boots':
      return `<svg ${s}><path d="M7 4v9l-2 4v3h14v-3l-5-2V4H7z" fill="${color}" fill-opacity="0.16"/><path d="M5 17h14"/></svg>`;
    case 'ring':
      return `<svg ${s}><circle cx="12" cy="14" r="6"/><polygon points="12 3 15 7 12 9 9 7 12 3" fill="${color}" fill-opacity="0.35"/></svg>`;
    case 'core':
      return `<svg ${s}><polygon points="12 2 20 7 20 17 12 22 4 17 4 7 12 2" fill="${color}" fill-opacity="0.18"/><circle cx="12" cy="12" r="3.2" fill="${color}"/></svg>`;
  }
}

export function weaponIconSvg(id: WeaponId, size = 20): string {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"`;
  switch (id) {
    case 'plasma_blade':
      return `<svg ${s} stroke="#38bdf8"><path d="M5 19 19 5"/><path d="M14 4h6v6"/><path d="M8 12l4 4" stroke="#fbbf24"/></svg>`;
    case 'arcane_staff':
      return `<svg ${s} stroke="#c084fc"><path d="M5 19 15 9" stroke="#f59e0b"/><circle cx="17" cy="7" r="4" fill="#c084fc" fill-opacity="0.35"/><circle cx="17" cy="7" r="1.4" fill="#ffffff" stroke="none"/></svg>`;
    case 'star_bow':
      return `<svg ${s} stroke="#22c55e"><path d="M7 4c6 4 6 12 0 16"/><line x1="7" y1="4" x2="7" y2="20" stroke="#e2e8f0" stroke-width="1.3"/><path d="M4 12h15" stroke="#fef08a"/><path d="m16 9 3 3-3 3" stroke="#fef08a"/></svg>`;
    case 'orbital_turret':
      return `<svg ${s} stroke="#14b8a6"><rect x="6" y="7" width="12" height="10" rx="2.5" fill="#14b8a6" fill-opacity="0.22"/><path d="M18 10h4M18 14h4" stroke="#5eead4"/><circle cx="12" cy="12" r="2" fill="#e0f2fe" stroke="none"/><path d="M8 19h8"/></svg>`;
    case 'solar_lance':
      return `<svg ${s} stroke="#f97316"><path d="M4 20 18 6" stroke="#fde047"/><polygon points="20 4 19 11 13 5 20 4" fill="#f97316" stroke="#fef08a" stroke-width="1.5"/><path d="M8 12l4 4" stroke="#fb923c"/></svg>`;
    case 'pulse_rifle':
      return `<svg ${s} stroke="#22d3ee"><rect x="3" y="9" width="13" height="5" rx="1.5" fill="#22d3ee" fill-opacity="0.2"/><path d="M16 11.5h5"/><path d="M7 14v5"/><path d="M11 9V6"/></svg>`;
    case 'orbital_saw':
      return `<svg ${s} stroke="#f59e0b"><circle cx="12" cy="12" r="5" fill="#f59e0b" fill-opacity="0.22"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>`;
    case 'tesla_arc':
      return `<svg ${s} stroke="#a855f7"><polyline points="13 2 5 13 11 13 10 22 19 10 13 10 13 2" fill="#c084fc" fill-opacity="0.3"/></svg>`;
    case 'frost_nova':
      return `<svg ${s} stroke="#60a5fa"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1"/><circle cx="12" cy="12" r="3" fill="#bae6fd" stroke="none"/></svg>`;
    case 'inferno_drone':
      return `<svg ${s} stroke="#fb7185"><polygon points="12 4 20 16 12 13 4 16 12 4" fill="#fb7185" fill-opacity="0.28"/><circle cx="12" cy="11" r="1.8" fill="#fef08a" stroke="none"/></svg>`;
    case 'gravity_well':
      return `<svg ${s} stroke="#c084fc"><circle cx="12" cy="12" r="8" stroke-dasharray="4 3"/><circle cx="12" cy="12" r="4" fill="#1e1b4b"/><circle cx="12" cy="12" r="1.5" fill="#f0abfc" stroke="none"/></svg>`;
    case 'vamp_scythe':
      return `<svg ${s} stroke="#ef4444"><path d="M7 20 17 6" stroke="#94a3b8"/><path d="M17 6c-4-3-10-2-12 3 3-1 7 0 9 2" fill="#ef4444" fill-opacity="0.35"/></svg>`;
  }
}

export function relicIconSvg(id: RelicId, size = 22): string {
  const s = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;"`;
  switch (id) {
    case 'plasma_mines':
      return `<svg ${s} stroke="#38bdf8"><circle cx="12" cy="12" r="5" fill="#38bdf8" fill-opacity="0.25"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2"/></svg>`;
    case 'chain_crit':
      return `<svg ${s} stroke="#a855f7"><polyline points="4 14 10 5 11 11 19 4 14 15 20 15 11 21" fill="none"/></svg>`;
    case 'nova_burst':
      return `<svg ${s} stroke="#fbbf24"><circle cx="12" cy="12" r="3" fill="#fef08a"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`;
    case 'vampiric_core':
      return `<svg ${s} stroke="#ef4444"><path d="M12 3c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11z" fill="#ef4444" fill-opacity="0.3"/></svg>`;
    case 'overclock_shield':
      return `<svg ${s} stroke="#22d3ee"><polygon points="12 2 20 6 20 13 12 22 4 13 4 6 12 2" fill="#22d3ee" fill-opacity="0.24"/><path d="M9 12l2 2 4-5"/></svg>`;
    case 'mag_singularity':
      return `<svg ${s} stroke="#f59e0b"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`;
    case 'frost_retaliation':
      return `<svg ${s} stroke="#60a5fa"><polygon points="12 2 16 9 22 12 16 15 12 22 8 15 2 12 8 9 12 2" fill="#60a5fa" fill-opacity="0.26"/></svg>`;
    case 'executioner_mark':
      return `<svg ${s} stroke="#f43f5e"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="2" fill="#f43f5e"/></svg>`;
    case 'solar_afterburn':
      return `<svg ${s} stroke="#f97316"><path d="M12 2c3 4 6 7 6 11a6 6 0 1 1-12 0c0-2.5 1.2-4.8 3-6.8 0 2 1.2 3 2.2 3-.6-2.8 0-5 0.8-7.2z" fill="#f97316" fill-opacity="0.3"/></svg>`;
    case 'quantum_accel':
      return `<svg ${s} stroke="#10b981"><polygon points="5 5 13 12 5 19 5 5" fill="#10b981" fill-opacity="0.28"/><polygon points="12 5 20 12 12 19 12 5" fill="#10b981" fill-opacity="0.28"/></svg>`;
  }
}

export function bossEmblemSvg(archetype: BossArchetype, size = 34): string {
  const colors: Record<BossArchetype, string> = {
    1: '#38bdf8',
    2: '#f59e0b',
    3: '#60a5fa',
    4: '#ef4444',
    5: '#a855f7',
    6: '#14b8a6',
  };
  const c = colors[archetype];
  let inner = '';
  if (archetype === 1) {
    inner = `<rect x="12" y="14" width="24" height="20" rx="4" fill="${c}" fill-opacity="0.25" stroke="${c}" stroke-width="2"/><rect x="6" y="18" width="6" height="10" rx="2" fill="${c}"/><rect x="36" y="18" width="6" height="10" rx="2" fill="${c}"/><rect x="17" y="20" width="14" height="4" rx="2" fill="#fef08a"/>`;
  } else if (archetype === 2) {
    inner = `<ellipse cx="24" cy="27" rx="12" ry="9" fill="${c}" fill-opacity="0.28" stroke="${c}" stroke-width="2"/><path d="M24 18 C24 8 34 8 34 15" stroke="#fef08a" stroke-width="3" fill="none"/><circle cx="34" cy="15" r="3" fill="#ef4444"/><path d="M12 24 L6 16 M36 24 L42 16" stroke="${c}" stroke-width="2.5"/>`;
  } else if (archetype === 3) {
    inner = `<polygon points="24,6 37,20 32,39 16,39 11,20" fill="${c}" fill-opacity="0.28" stroke="#e0f2fe" stroke-width="2"/><polygon points="24,13 30,24 24,34 18,24" fill="#bae6fd"/>`;
  } else if (archetype === 4) {
    inner = `<circle cx="24" cy="26" r="12" fill="${c}" fill-opacity="0.32" stroke="#fde047" stroke-width="2"/><path d="M14 17 L9 7 L19 14 M34 17 L39 7 L29 14" fill="#f97316"/><circle cx="19" cy="24" r="2.5" fill="#fef08a"/><circle cx="29" cy="24" r="2.5" fill="#fef08a"/>`;
  } else if (archetype === 5) {
    inner = `<circle cx="24" cy="24" r="15" stroke="${c}" stroke-width="2" stroke-dasharray="6 4" fill="none"/><polygon points="24,10 35,24 24,38 13,24" fill="${c}" fill-opacity="0.35" stroke="#f5d0fe" stroke-width="2"/><circle cx="24" cy="24" r="4" fill="#ffffff"/>`;
  } else {
    inner = `<polygon points="24,8 38,16 38,32 24,40 10,32 10,16" fill="${c}" fill-opacity="0.28" stroke="${c}" stroke-width="2"/><circle cx="24" cy="24" r="6" fill="#fef08a"/><circle cx="9" cy="14" r="3" fill="#38bdf8"/><circle cx="39" cy="14" r="3" fill="#38bdf8"/><circle cx="24" cy="42" r="3" fill="#38bdf8"/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" style="display:inline-block;flex-shrink:0;"><rect x="2" y="2" width="44" height="44" rx="12" fill="#091024" stroke="${c}" stroke-opacity="0.55" stroke-width="1.5"/>${inner}</svg>`;
}

export function heroPortraitSvg(heroId: HeroId, size = 56, weaponStyle?: WeaponStyle): string {
  const palette: Record<HeroId, { c1: string; c2: string; visor: string; crest: string; extra?: string }> = {
    kael: { c1: '#0284c7', c2: '#38bdf8', visor: '#e0f2fe', crest: 'M32 4 L39 17 L25 17 Z' },
    nova: { c1: '#6366f1', c2: '#c084fc', visor: '#fae8ff', crest: 'M32 3 L42 15 L32 20 L22 15 Z' },
    titan: { c1: '#b45309', c2: '#fbbf24', visor: '#fef3c7', crest: 'M18 6 H42 V16 H18 Z' },
    aegis: {
      c1: '#0f766e',
      c2: '#14b8a6',
      visor: '#ccfbf1',
      crest: 'M22 6 H38 V13 H22 Z',
      extra: '<circle cx="14" cy="20" r="5" fill="#0f172a" stroke="#5eead4" stroke-width="1.6"/><circle cx="14" cy="20" r="2" fill="#5eead4"/>',
    },
    pyro: {
      c1: '#c2410c',
      c2: '#f97316',
      visor: '#fef08a',
      crest: 'M18 7 L30 16 L42 7 L37 18 L23 18 Z',
      extra: '<path d="M16 32 L5 18 L12 36 Z M44 32 L55 18 L48 36 Z" fill="#fb923c" opacity="0.85"/>',
    },
    vespera: { c1: '#9f1239', c2: '#fb7185', visor: '#ffe4e6', crest: 'M19 5 L30 17 L41 5 L38 18 L22 18 Z' },
  };
  const p = palette[heroId] || palette.kael;

  const effectiveStyle =
    !weaponStyle || weaponStyle === 'signature'
      ? heroId === 'nova'
        ? 'staff'
        : heroId === 'vespera'
          ? 'bow'
          : heroId === 'aegis'
            ? 'turret'
            : heroId === 'pyro'
              ? 'lance'
              : heroId === 'titan'
                ? 'saw'
                : 'sword'
      : weaponStyle;

  const weaponOverlay =
    effectiveStyle === 'sword'
      ? `<g transform="translate(47, 35) rotate(-25)"><rect x="-2" y="-22" width="4.5" height="22" rx="1.5" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.2"/><rect x="-6" y="-1" width="12" height="3.2" rx="1" fill="#fbbf24"/><rect x="-1.8" y="2" width="3.6" height="6" rx="1" fill="#92400e"/></g>`
      : effectiveStyle === 'staff'
        ? `<g transform="translate(48, 34) rotate(-18)"><rect x="-1.8" y="-14" width="3.6" height="30" rx="1.5" fill="#92400e" stroke="#f59e0b" stroke-width="0.9"/><circle cx="0" cy="-18" r="6" fill="#c084fc" stroke="#fef08a" stroke-width="1.6"/><circle cx="-1.5" cy="-19.5" r="2" fill="#ffffff"/></g>`
        : effectiveStyle === 'bow'
          ? `<g transform="translate(47, 34)"><path d="M-2 -18 Q11 0 -2 18" stroke="#22c55e" stroke-width="3.2" fill="none" stroke-linecap="round"/><line x1="-2" y1="-17" x2="-2" y2="17" stroke="#e2e8f0" stroke-width="1.2"/><line x1="-6" y1="0" x2="10" y2="0" stroke="#fef08a" stroke-width="2"/><polygon points="10,-3 15,0 10,3" fill="#fef08a"/></g>`
          : effectiveStyle === 'turret'
            ? `<g transform="translate(48, 32)"><rect x="-6" y="-6" width="12" height="10" rx="2.5" fill="#14b8a6" stroke="#ccfbf1" stroke-width="1.3"/><rect x="5" y="-3" width="6" height="2.4" fill="#fef08a"/><rect x="5" y="1" width="6" height="2.4" fill="#fef08a"/></g>`
            : effectiveStyle === 'lance'
              ? `<g transform="translate(47, 34) rotate(-22)"><rect x="-1.6" y="-16" width="3.2" height="32" fill="#fde047"/><polygon points="0,-26 5,-14 -5,-14" fill="#f97316" stroke="#fef08a" stroke-width="1.2"/></g>`
              : `<g transform="translate(48, 36)"><circle cx="0" cy="0" r="8" fill="#f59e0b" stroke="#fef08a" stroke-width="1.6"/><circle cx="0" cy="0" r="3" fill="#0f172a"/></g>`;

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0;">
      <defs>
        <linearGradient id="hg_${heroId}" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${p.c2}" />
          <stop offset="100%" stop-color="${p.c1}" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#0b132b" stroke="${p.c2}" stroke-width="2" />
      <circle cx="32" cy="34" r="22" fill="url(#hg_${heroId})" opacity="0.24" />
      ${p.extra || ''}
      <path d="M16 32 L11 56 L47 56 L42 32 Z" fill="${p.c1}" opacity="0.85" />
      <rect x="22" y="45" width="7" height="11" rx="2.5" fill="#1e293b" stroke="${p.c2}" stroke-width="1.2" />
      <rect x="31" y="45" width="7" height="11" rx="2.5" fill="#1e293b" stroke="${p.c2}" stroke-width="1.2" />
      <rect x="19" y="28" width="22" height="19" rx="6" fill="url(#hg_${heroId})" stroke="#ffffff" stroke-width="1.5" />
      <circle cx="17" cy="34" r="4.5" fill="${p.c2}" />
      <circle cx="43" cy="35" r="4.5" fill="${p.c2}" />
      <circle cx="30" cy="20" r="11" fill="#0f172a" stroke="${p.c2}" stroke-width="2" />
      <path d="${p.crest}" fill="${p.c2}" transform="translate(-2, 0)" />
      <rect x="22" y="17" width="16" height="6" rx="3" fill="${p.visor}" />
      <circle cx="26" cy="20" r="1.7" fill="${p.c1}" />
      <circle cx="34" cy="20" r="1.7" fill="${p.c1}" />
      ${weaponOverlay}
    </svg>
  `;
}
