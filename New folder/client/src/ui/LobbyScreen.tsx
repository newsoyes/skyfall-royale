import { useEffect, useState } from 'react'
import { getSocket } from '../net/clientSocket'
import { useSession } from '../store/session'
import { sounds } from '../audio/procedural'
import { MAPS, type MapId } from '../game/maps/mapRegistry'
import type { TeamMode } from '../types/protocol'

const MAP_LIST = Object.values(MAPS)

const TEAM_MODES: { id: TeamMode; label: string; desc: string }[] = [
  { id: 'solo', label: '🎯 โซโล่', desc: 'ทุกคนต่อสู้กันเอง' },
  { id: 'duo',  label: '👥 ดูโอ้',  desc: 'ทีม 2 คน' },
  { id: 'squad',label: '👨‍👩‍👧‍👦 สควอด', desc: 'ทีม 4 คน' },
]

export function LobbyScreen() {
  const username = useSession((s) => s.username)
  const online = useSession((s) => s.online)
  const rooms = useSession((s) => s.rooms)
  const setUiPhase = useSession((s) => s.setUiPhase)
  const setRoom = useSession((s) => s.setRoom)
  const setPlayerId = useSession((s) => s.setPlayerId)
  const [selectedMap, setSelectedMap] = useState<MapId>('island')
  const [selectedTeam, setSelectedTeam] = useState<TeamMode>('solo')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    const sock = getSocket()
    sock.emit('lobby:listRooms', undefined, () => {})
  }, [])

  const createRoom = () => {
    sounds.uiClick()
    const sock = getSocket()
    sock.emit('room:create', {
      name: `ห้องของ ${username}`,
      maxPlayers: 24,
      mapId: selectedMap,
      teamMode: selectedTeam,
    }, (res: RoomCb) => {
      if (res?.ok && res.room && res.playerId) {
        setPlayerId(res.playerId)
        setRoom(res.room)
        setUiPhase('waiting')
      }
    })
  }

  const join = (roomId: string) => {
    sounds.uiClick()
    const sock = getSocket()
    sock.emit('room:join', { roomId }, (res: RoomCb) => {
      if (res?.ok && res.room && res.playerId) {
        setPlayerId(res.playerId)
        setRoom(res.room)
        setUiPhase('waiting')
      }
    })
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      <header className="flex items-center justify-between border-b border-white/10 px-8 py-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-indigo-300">เข้าสู่ระบบแล้ว</p>
          <p className="text-xl font-bold text-white">{username}</p>
        </div>
        <div className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
          ออนไลน์: {online}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-8 py-8 lg:flex-row">
        {/* Create room panel */}
        <section className="flex flex-1 flex-col gap-4">
          <h2 className="text-2xl font-bold text-white">เล่นเกม</h2>

          {!showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 py-4 text-lg font-bold shadow-lg transition hover:brightness-110"
            >
              สร้างห้อง
            </button>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur">
              <p className="mb-3 font-semibold text-white">เลือกแมพ</p>
              <div className="grid grid-cols-1 gap-2">
                {MAP_LIST.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMap(m.id)}
                    className={`rounded-xl px-4 py-3 text-left transition ${
                      selectedMap === m.id
                        ? 'bg-indigo-600 ring-2 ring-indigo-400'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-bold text-white">{m.nameTH}</p>
                    <p className="text-xs text-slate-400">{m.descTH}</p>
                  </button>
                ))}
              </div>
              <p className="mt-4 mb-2 font-semibold text-white">โหมดทีม</p>
              <div className="grid grid-cols-3 gap-2">
                {TEAM_MODES.map((tm) => (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => setSelectedTeam(tm.id)}
                    className={`rounded-xl px-3 py-2 text-center transition ${
                      selectedTeam === tm.id
                        ? 'bg-violet-600 ring-2 ring-violet-400'
                        : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <p className="font-bold text-white text-sm">{tm.label}</p>
                    <p className="text-xs text-slate-400">{tm.desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={createRoom}
                  className="flex-1 rounded-xl bg-indigo-500 py-3 font-bold text-white hover:bg-indigo-400"
                >
                  สร้างห้อง
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl bg-white/10 px-4 py-3 text-white hover:bg-white/15"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Room list */}
        <section className="flex-[2] rounded-2xl border border-white/10 bg-black/25 p-6 backdrop-blur">
          <h3 className="mb-4 text-lg font-semibold text-white">เข้าร่วมห้อง</h3>
          <div className="max-h-[55vh] space-y-2 overflow-auto pr-2">
            {rooms.length === 0 && <p className="text-slate-400">ยังไม่มีห้อง — สร้างห้องใหม่ได้เลย!</p>}
            {rooms.map((r) => {
              const mapDef = MAPS[(r as { mapId?: string }).mapId as MapId]
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => join(r.id)}
                  className="flex w-full items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                >
                  <div>
                    <span className="font-semibold text-white">{r.name}</span>
                    {mapDef && (
                      <span className="ml-2 text-xs text-indigo-300">{mapDef.nameTH}</span>
                    )}
                  </div>
                  <span className="text-sm text-indigo-200">
                    {r.playerCount}/{r.maxPlayers}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

type RoomCb =
  | {
      ok: true
      room: {
        id: string
        name: string
        maxPlayers: number
        mapId: string
        phase: string
        phaseEndsAt: number | null
        players: { id: string; username: string; isHost: boolean; ready: boolean }[]
      }
      playerId: string
    }
  | { ok: false; error?: string }
