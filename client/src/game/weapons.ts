import type { WeaponId, ConsumableId, ArmorTier } from '../types/protocol'

export const WEAPON_CONFIG: Record<
  WeaponId,
  { fireRateMs: number; reloadMs: number; magSize: number; range: number; projectile?: boolean; pellets?: number }
> = {
  pistol:  { fireRateMs: 220,  reloadMs: 1400, magSize: 12, range: 80 },
  ar:      { fireRateMs: 95,   reloadMs: 2100, magSize: 30, range: 120 },
  smg:     { fireRateMs: 70,   reloadMs: 1800, magSize: 35, range: 60 },
  shotgun: { fireRateMs: 650,  reloadMs: 2400, magSize: 8,  range: 30, pellets: 8 },
  sniper:  { fireRateMs: 900,  reloadMs: 2800, magSize: 5,  range: 300 },
  rpg:     { fireRateMs: 1200, reloadMs: 3200, magSize: 1,  range: 200, projectile: true },
}

export const WEAPON_LABEL: Record<WeaponId, string> = {
  pistol:  'ปืนพก',
  ar:      'ไรเฟิลจู่โจม',
  smg:     'ปืนกลมือ',
  shotgun: 'ปืนลูกซอง',
  sniper:  'ปืนซุ่มยิง',
  rpg:     'RPG',
}

export const CONSUMABLE_LABEL: Record<ConsumableId, string> = {
  medkit:         'ชุดปฐมพยาบาล',
  shield_potion:  'น้ำยาเติมโล่',
  mini_shield:    'น้ำยาเติมโล่เล็ก',
  grenade:        'ระเบิด',
  smoke_grenade:  'ระเบิดควัน',
}

export const CONSUMABLE_COLOR: Record<ConsumableId, string> = {
  medkit:         '#4ade80',
  shield_potion:  '#60a5fa',
  mini_shield:    '#93c5fd',
  grenade:        '#f97316',
  smoke_grenade:  '#94a3b8',
}

export const ARMOR_LABEL: Record<ArmorTier, string> = {
  common:    'สามัญ',
  uncommon:  'ไม่สามัญ',
  rare:      'หายาก',
  epic:      'มหากาพย์',
  legendary: 'ตำนาน',
}

export const ARMOR_COLOR: Record<ArmorTier, string> = {
  common:    '#cfcfcf',
  uncommon:  '#4cd964',
  rare:      '#4aa3ff',
  epic:      '#b266ff',
  legendary: '#ffb020',
}

export const RARITY_COLOR: Record<string, string> = {
  common:    '#cfcfcf',
  uncommon:  '#4cd964',
  rare:      '#4aa3ff',
  epic:      '#b266ff',
  legendary: '#ffb020',
}

export function isWeaponId(id: string): id is WeaponId {
  return id in WEAPON_CONFIG
}

export function isArmorItem(id: string): boolean {
  return id.startsWith('helmet_') || id.startsWith('vest_')
}

export function parseArmorItem(id: string): { slot: 'helmet' | 'vest'; tier: ArmorTier } | null {
  const parts = id.split('_')
  if (parts.length !== 2) return null
  const [slot, tier] = parts as ['helmet' | 'vest', ArmorTier]
  if (slot !== 'helmet' && slot !== 'vest') return null
  return { slot, tier }
}
