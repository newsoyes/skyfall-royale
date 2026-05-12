import { create } from 'zustand'
import type { ServerGameSnapshot } from '../types/protocol'

export type Tracer = {
  id: string
  ax: number; ay: number; az: number
  bx: number; by: number; bz: number
  until: number
}

export type SupplyDropMarker = { x: number; z: number; at: number }

export type SmokeCloud = {
  id: string
  x: number; y: number; z: number
  radius: number
  until: number
}

export type ThrowAnim = {
  playerId: string
  type: 'grenade' | 'smoke_grenade'
  at: number
}

type GameSlice = {
  snapshot: ServerGameSnapshot | null
  setSnapshot: (s: ServerGameSnapshot | null) => void
  lastHitDamage: null | { damage: number; head: boolean; at: number }
  setHit: (h: GameSlice['lastHitDamage']) => void
  emotes: Record<string, number>
  bumpEmote: (playerId: string, at: number) => void
  tracers: Tracer[]
  addTracer: (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => void
  killAnnouncement: { text: string; at: number } | null
  setKillAnnouncement: (a: GameSlice['killAnnouncement']) => void
  reloadProgress: number | null
  setReloadProgress: (p: number | null) => void
  supplyDrops: SupplyDropMarker[]
  addSupplyDrop: (pos: { x: number; z: number }) => void
  smokeClouds: SmokeCloud[]
  addSmokeCloud: (pos: { x: number; y: number; z: number; radius: number; durationMs: number }) => void
  throwAnims: ThrowAnim[]
  bumpThrow: (playerId: string, type: 'grenade' | 'smoke_grenade', at: number) => void
}

export const useGame = create<GameSlice>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  lastHitDamage: null,
  setHit: (lastHitDamage) => set({ lastHitDamage }),
  emotes: {},
  bumpEmote: (playerId, at) =>
    set((s) => ({ emotes: { ...s.emotes, [playerId]: at } })),
  tracers: [],
  addTracer: (a, b) =>
    set((s) => ({
      tracers: [
        ...s.tracers.filter((t) => t.until > performance.now()),
        {
          id: `${performance.now()}-${Math.random()}`,
          ax: a.x, ay: a.y, az: a.z,
          bx: b.x, by: b.y, bz: b.z,
          until: performance.now() + 70,
        },
      ],
    })),
  killAnnouncement: null,
  setKillAnnouncement: (killAnnouncement) => set({ killAnnouncement }),
  reloadProgress: null,
  setReloadProgress: (reloadProgress) => set({ reloadProgress }),
  supplyDrops: [],
  addSupplyDrop: (pos) =>
    set((s) => ({
      supplyDrops: [
        ...s.supplyDrops.filter((d) => performance.now() - d.at < 120_000),
        { x: pos.x, z: pos.z, at: performance.now() },
      ],
    })),
  smokeClouds: [],
  addSmokeCloud: (pos) =>
    set((s) => ({
      smokeClouds: [
        ...s.smokeClouds.filter((c) => c.until > performance.now()),
        {
          id: `smoke-${performance.now()}-${Math.random()}`,
          x: pos.x, y: pos.y, z: pos.z,
          radius: pos.radius,
          until: performance.now() + pos.durationMs,
        },
      ],
    })),
  throwAnims: [],
  bumpThrow: (playerId, type, at) =>
    set((s) => ({
      throwAnims: [
        ...s.throwAnims.filter((t) => performance.now() - t.at < 600),
        { playerId, type, at },
      ],
    })),
}))
