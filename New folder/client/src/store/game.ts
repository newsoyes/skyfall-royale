import { create } from 'zustand'
import type { ServerGameSnapshot } from '../types/protocol'

export type Tracer = {
  id: string
  ax: number; ay: number; az: number
  bx: number; by: number; bz: number
  until: number
}

export type SupplyDropMarker = { x: number; z: number; at: number }

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
}))
