import { getSocket } from '../net/clientSocket'
import { useSession } from '../store/session'
import { useGame } from '../store/game'
import { sounds } from '../audio/procedural'

export function EndScreen() {
  const end = useSession((s) => s.endMatch)
  const playerId = useSession((s) => s.playerId)
  const username = useSession((s) => s.username)
  const setUiPhase = useSession((s) => s.setUiPhase)
  const setRoom = useSession((s) => s.setRoom)
  const setPlayerId = useSession((s) => s.setPlayerId)
  const setEndMatch = useSession((s) => s.setEndMatch)
  const setSnapshot = useGame((s) => s.setSnapshot)

  const row = end?.placements.find((p) => p.id === playerId)

  const back = () => {
    sounds.uiClick()
    getSocket().emit('room:leave')
    setRoom(null)
    setPlayerId(null)
    setEndMatch(null)
    setSnapshot(null)
    setUiPhase('lobby')
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-950/95 p-10 shadow-2xl">
        <h2 className="text-center text-4xl font-black text-white">
          {end?.winnerId === playerId ? '🏆 ชนะเลิศ!' : 'จบเกม'}
        </h2>
        <p className="mt-2 text-center text-lg text-indigo-200">
          ผู้ชนะ: <span className="font-bold text-amber-300">{end?.winnerName ?? '—'}</span>
        </p>

        <div className="mt-8 rounded-2xl bg-white/5 p-6">
          <p className="text-sm uppercase tracking-widest text-slate-500">สถิติของคุณ</p>
          <p className="mt-2 text-xl font-semibold text-white">{username}</p>
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-black text-emerald-400">{row?.placement ?? '—'}</p>
              <p className="text-xs text-slate-500">อันดับ</p>
            </div>
            <div>
              <p className="text-3xl font-black text-sky-400">{row?.kills ?? 0}</p>
              <p className="text-xs text-slate-500">กำจัด</p>
            </div>
            <div>
              <p className="text-3xl font-black text-rose-400">{row?.damage ?? 0}</p>
              <p className="text-xs text-slate-500">ดาเมจ</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={back}
          className="mt-8 w-full rounded-2xl bg-indigo-500 py-4 text-lg font-bold text-white hover:bg-indigo-400"
        >
          กลับไปล็อบบี้
        </button>
      </div>
    </div>
  )
}
