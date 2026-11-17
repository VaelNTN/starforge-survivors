import { GearSlot, HeroId, WeaponId } from '../types/game';

export function heroPortraitSvg(heroId: HeroId, size = 56): string {
  const palette: Record<HeroId, { c1: string; c2: string; visor: string; crest: string }> = {
    kael: { c1: '#0284c7', c2: '#38bdf8', visor: '#e0f2fe', crest: 'M32 6 L40 20 L24 20 Z' },
    nova: { c1: '#6366f1', c2: '#c084fc', visor: '#fae8ff', crest: 'M32 4 L44 18 L32 24 L20 18 Z' },
    titan: { c1: '#b45309', c2: '#fbbf24', visor: '#fef3c7', crest: 'M18 10 H46 V22 H18 Z' },
    vespera: { c1: '#9f1239', c2: '#fb7185', visor: '#ffe4e6', crest: 'M20 8 L32 22 L44 8 L40 22 L24 22 Z' },
  };
  const p = palette[heroId] || palette.kael;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hg_${heroId}" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${p.c2}" />
          <stop offset="100%" stop-color="${p.c1}" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="url(#hg_${heroId})" stroke="rgba(255,255,255,0.45)" stroke-width="2.5" />
      <path d="M16 48 C18 35, 46 35, 48 48" fill="rgba(5,8,20,0.65)" />
      <circle cx="32" cy="29" r="14" fill="#0f172a" stroke="${p.c2}" stroke-width="2" />
      <path d="${p.crest}" fill="${p.c2}" />
      <rect x="21" y="25" width="22" height="7" rx="3.5" fill="${p.visor}" />
      <circle cx="27" cy="28.5" r="2" fill="${p.c1}" />
      <circle cx="37" cy="28.5" r="2" fill="${p.c1}" />
    </svg>
  `;
}

export function gearSlotEmoji(slot: GearSlot): string {
  switch (slot) {
    case 'weapon':
      return '⚔️';
    case 'armor':
      return '🛡️';
    case 'helmet':
      return '🪖';
    case 'boots':
      return '🥾';
    case 'ring':
      return '💍';
    case 'core':
      return '⚛️';
  }
}

export function weaponEmoji(id: WeaponId): string {
  switch (id) {
    case 'plasma_blade':
      return '🗡️';
    case 'pulse_rifle':
      return '🔫';
    case 'orbital_saw':
      return '🌀';
    case 'tesla_arc':
      return '⚡';
    case 'frost_nova':
      return '❄️';
    case 'inferno_drone':
      return '🛸';
    case 'gravity_well':
      return '🕳️';
    case 'vamp_scythe':
      return '🌙';
  }
}
