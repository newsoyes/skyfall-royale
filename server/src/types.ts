/** Shared protocol types — keep in sync with client `src/types/protocol.ts` */

export type GamePhase = 'lobby' | 'waiting' | 'starting' | 'playing' | 'spectating' | 'ended'
export type TeamMode = 'solo' | 'duo' | 'squad'
export type WeaponId = 'pistol' | 'ar' | 'sniper' | 'rpg' | 'shotgun' | 'smg'
export type ConsumableId = 'medkit' | 'shield_potion' | 'mini_shield' | 'grenade' | 'smoke_grenade'
export type ArmorId = 'helmet' | 'vest'
export type ArmorTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type PickupItemId = WeaponId | ConsumableId | `${ArmorId}_${ArmorTier}`
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export type HitMaterial = 'flesh' | 'rock' | 'wood' | 'metal'

export interface Vec3 { x: number; y: number; z: number }

export interface ArmorState {
  helmet: ArmorTier | null   // null = no helmet
  vest: ArmorTier | null     // null = no vest
}

export interface PlayerState {
  id: string
  username: string
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  yaw: number; pitch: number
  hp: number; shield: number
  alive: boolean
  downed: boolean
  reviveProgress: number
  weaponIndex: number
  loadout: (WeaponId | null)[]
  ammo: Record<WeaponId, number>
  ammoReserve: Record<WeaponId, number>
  armor: ArmorState
  kills: number
  damageDealt: number
  isHost: boolean
  ready: boolean
  skydiving: boolean
  spectatingId: string | null
  teamId: string | null
  /** Vehicle id if currently driving, null otherwise */
  inVehicleId: string | null
  /** Throwable consumable counts */
  consumables: Partial<Record<ConsumableId, number>>
}

export interface PickupState {
  id: string
  x: number; y: number; z: number
  item: PickupItemId
  rarity: Rarity
  spawnTime: number
  isSupplyDrop?: boolean
}

export interface ProjectileState {
  id: string; ownerId: string
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  fuseMs: number
  /** 'rocket' | 'grenade' | 'smoke' */
  type: 'rocket' | 'grenade' | 'smoke'
}

export interface VehicleState {
  id: string
  x: number; y: number; z: number
  yaw: number
  speed: number
  hp: number
  driverId: string | null
}

export interface ZoneState {
  centerX: number; centerZ: number
  radius: number; nextShrinkAt: number; phaseIndex: number
}

export interface KillFeedEntry {
  id: string; killer: string; victim: string; weapon: WeaponId; at: number
}

export interface DamageNumber {
  id: string; x: number; y: number; z: number
  damage: number; head: boolean; at: number
}

export interface HitFx {
  id: string; x: number; y: number; z: number
  material: HitMaterial; at: number
}

export interface RoomPublic {
  id: string; name: string
  playerCount: number; maxPlayers: number
  phase: GamePhase; mapId: string; teamMode: TeamMode
}

export interface MatchStats {
  winnerId: string | null; winnerName: string | null
  placements: { id: string; username: string; kills: number; damage: number; placement: number }[]
}

export interface ServerGameSnapshot {
  t: number
  phase: GamePhase
  phaseEndsAt: number | null
  players: PlayerState[]
  pickups: PickupState[]
  projectiles: ProjectileState[]
  vehicles: VehicleState[]
  zone: ZoneState
  killFeed: KillFeedEntry[]
  remaining: number
  matchStartedAt: number | null
  damageNumbers: DamageNumber[]
  hitFx: HitFx[]
  teamMode: TeamMode
}
