import { WeaponDef, WeaponSkin } from '../types/game';

export const WEAPONS: Record<string, WeaponDef> = {
  deagle: {
    id: 'deagle',
    name: 'Desert Eagle .50 AE',
    type: 'pistol',
    damage: 53, // 1-shot headshot (106 dmg)
    fireRateMs: 260,
    magSize: 7,
    reserveMax: 35,
    reloadTimeMs: 2200,
    spread: 0.016,
    recoil: 0.07,
    pellets: 1,
    range: 90,
    adsFov: 60,
    description: 'Pistola pesada de gran calibre .50 Action Express. Daño masivo a la cabeza y penetración de blindaje.',
    cost: 0,
    unlocked: true,
    color: '#e2e8f0'
  },
  ak47: {
    id: 'ak47',
    name: 'AK-47 Kalashnikov',
    type: 'ar',
    damage: 36, // 1-shot headshot through helmet (72+ dmg)
    fireRateMs: 100, // 600 RPM
    magSize: 30,
    reserveMax: 90,
    reloadTimeMs: 2400,
    spread: 0.022,
    recoil: 0.038,
    pellets: 1,
    range: 140,
    adsFov: 55,
    description: 'Rifle de asalto de alta potencia. Muy letal y preciso en los primeros disparos; requiere control de ráfaga.',
    cost: 2700,
    unlocked: true,
    color: '#eab308'
  },
  m4a4: {
    id: 'm4a4',
    name: 'M4A4 Tactical Carbine',
    type: 'ar',
    damage: 33,
    fireRateMs: 90, // 666 RPM
    magSize: 30,
    reserveMax: 90,
    reloadTimeMs: 2300,
    spread: 0.018,
    recoil: 0.028,
    pellets: 1,
    range: 150,
    adsFov: 55,
    description: 'Rifle táctico de la fuerza antiterrorista con cadencia acelerada y retroceso controlable en ráfagas largas.',
    cost: 3100,
    unlocked: false,
    color: '#38bdf8'
  },
  awp: {
    id: 'awp',
    name: 'AWP Magnum Sniper',
    type: 'sniper',
    damage: 115, // One-shot kill to chest and head
    fireRateMs: 1350,
    magSize: 10,
    reserveMax: 30,
    reloadTimeMs: 3200,
    spread: 0.002,
    recoil: 0.16,
    pellets: 1,
    range: 280,
    adsFov: 20, // High zoom scope
    description: 'Rifle de cerrojo de calibre pesado .338 Lapua. Letal de un solo impacto en torso o cabeza.',
    cost: 4750,
    unlocked: false,
    color: '#10b981'
  },
  shotgun: {
    id: 'shotgun',
    name: 'Nova 12 Gauge',
    type: 'shotgun',
    damage: 16, // x 8 pellets = 128 potential close-up
    fireRateMs: 750,
    magSize: 8,
    reserveMax: 32,
    reloadTimeMs: 2500,
    spread: 0.08,
    recoil: 0.09,
    pellets: 8,
    range: 45,
    adsFov: 58,
    description: 'Escopeta de bombeo táctica de 12 perdigones, devastadora en esquinas cerradas y asaltos.',
    cost: 1200,
    unlocked: false,
    color: '#f97316'
  }
};

export const SKINS: WeaponSkin[] = [
  {
    id: 'standard',
    name: 'Vanilla Tactical',
    weaponId: 'all',
    color: '#334155',
    emissive: '#0f172a',
    metalness: 0.85,
    roughness: 0.35,
    cost: 0,
    unlocked: true
  },
  {
    id: 'asiimov',
    name: 'Asiimov Pro',
    weaponId: 'all',
    color: '#f97316',
    emissive: '#ffffff',
    metalness: 0.4,
    roughness: 0.3,
    cost: 1500,
    unlocked: false
  },
  {
    id: 'case_hardened',
    name: 'Case Hardened Blue Gem',
    weaponId: 'all',
    color: '#38bdf8',
    emissive: '#818cf8',
    metalness: 0.95,
    roughness: 0.15,
    cost: 2500,
    unlocked: false
  },
  {
    id: 'dragon_lore',
    name: 'Dragon Lore Gold',
    weaponId: 'all',
    color: '#eab308',
    emissive: '#ef4444',
    metalness: 0.85,
    roughness: 0.25,
    cost: 5000,
    unlocked: false
  }
];

export interface PlayerEconomy {
  credits: number;
  unlockedWeapons: string[];
  unlockedSkins: string[];
  selectedWeapon: string;
  selectedSkin: string;
}

const STORAGE_KEY = 'apex_striker_csgo_economy';

export function loadEconomy(): PlayerEconomy {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.unlockedWeapons)) {
        return data;
      }
    }
  } catch {
    // fallback
  }

  return {
    credits: 16000, // CS:GO default max money for plenty of loadout choices
    unlockedWeapons: ['deagle', 'ak47'],
    unlockedSkins: ['standard'],
    selectedWeapon: 'deagle',
    selectedSkin: 'standard'
  };
}

export function saveEconomy(economy: PlayerEconomy): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(economy));
  } catch {
    // ignore
  }
}
