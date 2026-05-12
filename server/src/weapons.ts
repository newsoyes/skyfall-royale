import type { WeaponId, ConsumableId, PickupItemId, ArmorTier } from './types.js'

export const WEAPON_CONFIG: Record<WeaponId, {
  damage: number; headshotMult: number; fireRateMs: number; reloadMs: number
  magSize: number; range: number; spread: number; recoil: number
  pellets?: number; projectile?: boolean; rocketSpeed?: number
  explosionRadius?: number; explosionDamage?: number
}> = {
  pistol:  { damage: 18, headshotMult: 2,    fireRateMs: 220,  reloadMs: 1400, magSize: 12, range: 80,  spread: 0.02,  recoil: 0.012 },
  ar:      { damage: 14, headshotMult: 1.75, fireRateMs: 95,   reloadMs: 2100, magSize: 30, range: 120, spread: 0.035, recoil: 0.022 },
  smg:     { damage: 10, headshotMult: 1.5,  fireRateMs: 70,   reloadMs: 1800, magSize: 35, range: 60,  spread: 0.055, recoil: 0.018 },
  shotgun: { damage: 18, headshotMult: 1.5,  fireRateMs: 650,  reloadMs: 2400, magSize: 8,  range: 30,  spread: 0.12,  recoil: 0.08, pellets: 8 },
  sniper:  { damage: 95, headshotMult: 2.25, fireRateMs: 900,  reloadMs: 2800, magSize: 5,  range: 300, spread: 0.001, recoil: 0.06 },
  rpg:     { damage: 0,  headshotMult: 1,    fireRateMs: 1200, reloadMs: 3200, magSize: 1,  range: 200, spread: 0.005, recoil: 0.04,
             projectile: true, rocketSpeed: 55, explosionRadius: 12, explosionDamage: 95 },
}

export const CONSUMABLE_CONFIG: Record<ConsumableId, {
  healHp: number; healShield: number; useMs: number
  isThrowable?: boolean; fuseMs?: number; blastRadius?: number; blastDamage?: number
  smokeRadius?: number; smokeDurationMs?: number
}> = {
  medkit:         { healHp: 75,  healShield: 0,  useMs: 3000 },
  shield_potion:  { healHp: 0,   healShield: 50, useMs: 2000 },
  mini_shield:    { healHp: 0,   healShield: 25, useMs: 1000 },
  grenade:        { healHp: 0,   healShield: 0,  useMs: 0, isThrowable: true, fuseMs: 3000, blastRadius: 8, blastDamage: 80 },
  smoke_grenade:  { healHp: 0,   healShield: 0,  useMs: 0, isThrowable: true, fuseMs: 1500, smokeRadius: 6, smokeDurationMs: 15000 },
}

/** Armor damage reduction per tier (applied to body damage, not headshots) */
export const ARMOR_REDUCTION: Record<ArmorTier, number> = {
  common:    0.10,
  uncommon:  0.18,
  rare:      0.28,
  epic:      0.38,
  legendary: 0.50,
}

export function randomRarity(): import('./types.js').Rarity {
  const r = Math.random()
  if (r < 0.40) return 'common'
  if (r < 0.65) return 'uncommon'
  if (r < 0.82) return 'rare'
  if (r < 0.94) return 'epic'
  return 'legendary'
}

export function randomWeapon(): WeaponId {
  const w: WeaponId[] = ['pistol', 'pistol', 'ar', 'ar', 'smg', 'smg', 'shotgun', 'sniper', 'rpg']
  return w[Math.floor(Math.random() * w.length)]!
}

export function randomPickupItem(): PickupItemId {
  const r = Math.random()
  if (r < 0.08) return 'mini_shield'
  if (r < 0.14) return 'shield_potion'
  if (r < 0.19) return 'medkit'
  if (r < 0.23) return 'grenade'
  if (r < 0.26) return 'smoke_grenade'
  // 5% chance armor
  if (r < 0.31) {
    const tier = randomRarity()
    return Math.random() < 0.5 ? `helmet_${tier}` : `vest_${tier}`
  }
  return randomWeapon()
}

export function isWeapon(item: PickupItemId): item is WeaponId {
  return item in WEAPON_CONFIG
}

export function isConsumable(item: PickupItemId): item is ConsumableId {
  return item in CONSUMABLE_CONFIG
}

export function isArmor(item: PickupItemId): item is `${'helmet' | 'vest'}_${ArmorTier}` {
  return item.startsWith('helmet_') || item.startsWith('vest_')
}

export function parseArmor(item: string): { slot: 'helmet' | 'vest'; tier: ArmorTier } | null {
  const [slot, tier] = item.split('_') as ['helmet' | 'vest', ArmorTier]
  if ((slot === 'helmet' || slot === 'vest') && tier) return { slot, tier }
  return null
}
