import { useEffect, useState } from 'react'
import { useSession } from '../store/session'
import { getSocket } from '../net/clientSocket'
import { sounds } from '../audio/procedural'
import { MAPS, type MapId } from '../game/maps/mapRegistry'

export function WaitingRoom() {
  const room = useSession((s) => s.room)
  const playerId = useSession((s) => s.playerId)
  const setUiPhase = useSession((s) => s.setUiPhase)
  const setRoom = useSession((s) => s.setRoom)
  const setPlayerId = useSession((s) => s.setPlayerId)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (room?.phase !== 'starting') return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [room?.phase])

  if (!room) return null

  const me = room.players.find((p) => p.id === playerId)
  const isHost = !!me?.isHost
  const countdownSec =
    room.phase === 'starting' && room.phaseEndsAt
      ? Math.max(0, Math.ceil((room.phaseEndsAt - now) / 1000))
      : 0

  const mapDef = MAPS[room.mapId as MapId]

  const leave = () => {
    sounds.uiClick()
    getSocket().emit('room:leave')
    setRoom(null)
    setPlayerId(null)
    setUiPhase('lobby')
  }

  const toggleReady = () => {
    sounds.uiClick()
    getSocket().emit('room:ready', { ready: !me?.ready })
  }

  const start = () => {
    sounds.uiClick()
    getSocket().emit('room:start')
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-950/90 p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-indigo-300">ห้อง</p>
            <h2 className="text-2xl font-bold text-white">{room.name}</h2>
            {mapDef && (
              <p className="mt-1 text-sm text-indigo-300">{mapDef.nameTH} · {mapDef.descTH}</p>
            )}
          </div>
          <button
            type="button"
            onClick={leave}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
          >
            ออก
          </button>
        </div>

        {room.phase === 'starting' && (
          <div className="mb-6 rounded-2xl bg-indigo-600/30 px-4 py-3 text-center text-lg font-bold text-white ring-1 ring-indigo-400/40">
            เกมจะเริ่มใน {countdownSec} วินาที…
          </div>
        )}

        <ul className="mb-8 max-h-52 space-y-2 overflow-auto">
          {room.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 text-white"
            >
              <span>
                {p.username}
                {p.isHost && (
                  <span className="ml-2 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                    โฮสต์
                  </span>
                )}
              </span>
              <span className={p.ready ? 'text-emerald-400' : 'text-slate-500'}>
                {p.ready ? 'พร้อม' : 'รอ…'}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={toggleReady}
            className="flex-1 rounded-2xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500"
          >
            {me?.ready ? 'ยกเลิกพร้อม' : 'พร้อมแล้ว'}
          </button>
          {isHost && (
            <button
              type="button"
              onClick={start}
              disabled={room.phase !== 'waiting'}
              className="flex-1 rounded-2xl bg-indigo-500 py-3 font-bold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              เริ่มเกม
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          โฮสต์กดเริ่มเกม · คุณจะกระโดดร่มลงมาจากท้องฟ้า
        </p>
      </div>
    </div>
  )
}
