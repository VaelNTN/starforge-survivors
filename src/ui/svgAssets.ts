import { GearSlot, HeroId, WeaponId, WeaponStyle } from '../types/game';

export function heroPortraitSvg(heroId: HeroId, size = 56, weaponStyle?: WeaponStyle): string {
  const palette: Record<HeroId, { c1: string; c2: string; visor: string; crest: string }> = {
    kael: { c1: '#0284c7', c2: '#38bdf8', visor: '#e0f2fe', crest: 'M32 4 L39 17 L25 17 Z' },
    nova: { c1: '#6366f1', c2: '#c084fc', visor: '#fae8ff', crest: 'M32 3 L42 15 L32 20 L22 15 Z' },
    titan: { c1: '#b45309', c2: '#fbbf24', visor: '#fef3c7', crest: 'M20 7 H44 V17 H20 Z' },
    vespera: { c1: '#9f1239', c2: '#fb7185', visor: '#ffe4e6', crest: 'M21 6 L32 18 L43 6 L40 18 L24 18 Z' },
  };
  const p = palette[heroId] || palette.kael;

  const weaponOverlay =
    weaponStyle === 'sword'
      ? `
        <g transform="translate(46, 35) rotate(-25)">
          <rect x="-2" y="-22" width="4.5" height="22" rx="1.5" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.2" />
          <rect x="-6" y="-1" width="12" height="3.2" rx="1" fill="#fbbf24" />
          <rect x="-1.8" y="2" width="3.6" height="6" rx="1" fill="#92400e" />
        </g>
      `
      : weaponStyle === 'staff'
        ? `
          <g transform="translate(48, 34) rotate(-18)">
            <rect x="-1.8" y="-14" width="3.6" height="30" rx="1.5" fill="#92400e" stroke="#f59e0b" stroke-width="0.9" />
            <circle cx="0" cy="-18" r="6" fill="#c084fc" stroke="#fef08a" stroke-width="1.6" />
            <circle cx="-1.5" cy="-19.5" r="2" fill="#ffffff" />
          </g>
        `
        : weaponStyle === 'bow'
          ? `
            <g transform="translate(47, 34)">
              <path d="M-2 -18 Q11 0 -2 18" stroke="#22c55e" stroke-width="3.2" fill="none" stroke-linecap="round" />
              <line x1="-2" y1="-17" x2="-2" y2="17" stroke="#e2e8f0" stroke-width="1.2" />
              <line x1="-6" y1="0" x2="10" y2="0" stroke="#fef08a" stroke-width="2" />
              <polygon points="10,-3 15,0 10,3" fill="#fef08a" />
            </g>
          `
          : '';

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hg_${heroId}" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${p.c2}" />
          <stop offset="100%" stop-color="${p.c1}" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#0b132b" stroke="${p.c2}" stroke-width="2" />
      <circle cx="32" cy="34" r="22" fill="url(#hg_${heroId})" opacity="0.24" />
      <!-- Cape -->
      <path d="M16 32 L11 56 L47 56 L42 32 Z" fill="${p.c1}" opacity="0.85" />
      <!-- Benen -->
      <rect x="22" y="45" width="7" height="11" rx="2.5" fill="#1e293b" stroke="${p.c2}" stroke-width="1.2" />
      <rect x="31" y="45" width="7" height="11" rx="2.5" fill="#1e293b" stroke="${p.c2}" stroke-width="1.2" />
      <!-- Pantser lijf -->
      <rect x="19" y="28" width="22" height="19" rx="6" fill="url(#hg_${heroId})" stroke="#ffffff" stroke-width="1.5" />
      <!-- Schouders & Arm -->
      <circle cx="17" cy="34" r="4.5" fill="${p.c2}" />
      <circle cx="43" cy="35" r="4.5" fill="${p.c2}" />
      <!-- Hoofd / Helm -->
      <circle cx="30" cy="20" r="11" fill="#0f172a" stroke="${p.c2}" stroke-width="2" />
      <path d="${p.crest}" fill="${p.c2}" transform="translate(-2, 0)" />
      <!-- Vizier & Ogen -->
      <rect x="22" y="17" width="16" height="6" rx="3" fill="${p.visor}" />
      <circle cx="26" cy="20" r="1.7" fill="${p.c1}" />
      <circle cx="34" cy="20" r="1.7" fill="${p.c1}" />
      ${weaponOverlay}
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
      return '⚔️';
    case 'arcane_staff':
      return '🪄';
    case 'star_bow':
      return '🏹';
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
