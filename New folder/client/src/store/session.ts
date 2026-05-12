import { create } from 'zustand'

export type UiPhase = 'login' | 'lobby' | 'waiting' | 'playing' | 'ended'

type RoomRow = {
  id: string
  name: string
  playerCount: number
  maxPlayers: number
  phase: string
}

type SessionState = {
  username: string
  setUsername: (u: string) => void
  uiPhase: UiPhase
  setUiPhase: (p: UiPhase) => void
  online: number
  setOnline: (n: number) => void
  rooms: RoomRow[]
  setRooms: (r: RoomRow[]) => void
  room: null | {
    id: string
    name: string
    maxPlayers: number
    mapId: string
    phase: string
    phaseEndsAt: number | null
    players: { id: string; username: string; isHost: boolean; ready: boolean }[]
  }
  setRoom: (r: SessionState['room']) => void
  playerId: string | null
  setPlayerId: (id: string | null) => void
  endMatch: null | {
    winnerId: string | null
    winnerName: string | null
    placements: { id: string; username: string; kills: number; damage: number; placement: number }[]
  }
  setEndMatch: (e: SessionState['endMatch']) => void
  pickupToast: null | { weapon: string; label: string; at: number }
  setPickupToast: (t: SessionState['pickupToast']) => void
}

export const useSession = create<SessionState>((set) => ({
  username: '',
  setUsername: (username) => set({ username }),
  uiPhase: 'login',
  setUiPhase: (uiPhase) => set({ uiPhase }),
  online: 0,
  setOnline: (online) => set({ online }),
  rooms: [],
  setRooms: (rooms) => set({ rooms }),
  room: null,
  setRoom: (room) => set({ room }),
  playerId: null,
  setPlayerId: (playerId) => set({ playerId }),
  endMatch: null,
  setEndMatch: (endMatch) => set({ endMatch }),
  pickupToast: null,
  setPickupToast: (pickupToast) => set({ pickupToast }),
}))
