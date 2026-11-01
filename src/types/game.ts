export type MapType = 'de_dust2' | 'de_mirage' | 'de_inferno' | 'de_cache' | 'cyber_city' | 'jungle_outpost' | 'desert_canyon';

export interface WeaponDef {
  id: string;
  name: string;
  type: 'pistol' | 'ar' | 'shotgun' | 'smg' | 'sniper';
  damage: number;
  fireRateMs: number;
  magSize: number;
  reserveMax?: number;
  reloadTimeMs: number;
  spread: number;
  recoil: number;
  pellets: number;
  range: number;
  adsFov: number;
  description: string;
  cost: number;
  unlocked: boolean;
  color: string;
}

export interface WeaponSkin {
  id: string;
  name: string;
  weaponId: string;
  color: string;
  emissive: string;
  metalness: number;
  roughness: number;
  cost: number;
  unlocked: boolean;
}

export interface PlayerNetState {
  id: string;
  name: string;
  room: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotationY: number;
  pitch: number;
  health: number;
  shield: number;
  weapon: string;
  isFiring: boolean;
  isSprinting: boolean;
  isJetpacking?: boolean;
  isCrouching?: boolean;
  isAiming: boolean;
  kills: number;
  deaths: number;
  score: number;
  skin: string;
  color: string;
  ping: number;
  isBot?: boolean;
  team?: 'CT' | 'T';
}

export interface RoomSummary {
  id: string;
  name: string;
  map: MapType;
  playerCount: number;
  humanCount: number;
  maxPlayers: number;
  isPrivate: boolean;
  scoreLimit: number;
}

export interface KillfeedEntry {
  id: string;
  killerName: string;
  victimName: string;
  weapon: string;
  isHeadshot: boolean;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  color: string;
  text: string;
  isSystem?: boolean;
  timestamp: number;
}
