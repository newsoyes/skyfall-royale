import type { PickupState, PlayerState, ProjectileState, DamageNumber, HitFx, VehicleState } from '../types/protocol'

/**
 * Stable fallbacks for Zustand selectors.
 * Never use `snapshot?.items ?? []` inline — `[]` is a new reference each call and triggers
 * infinite re-renders with useSyncExternalStore (React 18 + R3F).
 */
export const NO_PICKUPS: PickupState[] = []
export const NO_PROJECTILES: ProjectileState[] = []
export const NO_PLAYERS: PlayerState[] = []
export const NO_DAMAGE_NUMBERS: DamageNumber[] = []
export const NO_HIT_FX: HitFx[] = []
export const NO_VEHICLES: VehicleState[] = []
