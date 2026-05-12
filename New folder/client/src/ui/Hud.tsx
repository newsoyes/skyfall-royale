import { useMemo } from 'react'
import { useSession } from '../store/session'
import { useGame } from '../store/game'
import { useCombat } from '../store/combat'
import type { WeaponId } from '../types/protocol'

const W_LABEL: Record<WeaponId, string> = {
  pistol:  'ปืนพก',
  ar:      'ไรเฟิลจู่โจม',
  smg:     'ปืนกลมือ',
  shotgun: 'ปืนลูกซอง',
  sniper:  'ปืนซุ่มยิง',
  rpg:     'RPG',
}

export function Hud() {
  const playerId = useSession((s) => s.playerId)
  const pickupToast = useSession((s) => s.pickupToast)
  const snapshot = useGame((s) => s.snapshot)
  const hit = useGame((s) => s.lastHitDamage)
  const ads = useCombat((s) => s.ads)
  const reloadProgress = useGame((s) => s.reloadProgress)
  const killAnnouncement = useGame((s) => s.killAnnouncement)

  const me = snapshot?.players.find((p) => p.id === playerId)

  const spectateTarget = me && !me.alive && me.spectatingId
    ? snapshot?.players.find((p) => p.id === me.spectatingId)
    : null
  const displayPlayer = spectateTarget ?? me

  const minimap = useMemo(() => {
    if (!snapshot) return null
    const z = snapshot.zone
    const players = snapshot.players.filter((p) => p.alive)
    return { z, players }
  }, [snapshot])

  const storm = useMemo(() => {
    if (!snapshot || !me) return null
    const z = snapshot.zone
    const dx = me.x - z.centerX
    const dz = me.z - z.centerZ
    const dist = Math.hypot(dx, dz)
    const margin = dist - z.radius
    const inSafe = margin <= 0
    const shrinkIn = Math.max(0, Math.round((z.nextShrinkAt - snapshot.t) / 1000))
    return { margin, inSafe, shrinkIn, radius: z.radius }
  }, [snapshot, me])

  const showPickup = pickupToast && performance.now() - pickupToast.at < 2800 ? pickupToast : null

  if (!snapshot || !me) return null

  const w = displayPlayer ? displayPlayer.loadout[displayPlayer.weaponIndex] as WeaponId | null : null
  const mag = w && displayPlayer ? displayPlayer.ammo[w] : 0
  const reserve = w && displayPlayer ? displayPlayer.ammoReserve[w] : 0

  const started = snapshot.matchStartedAt ?? snapshot.t
  const elapsed = Math.max(0, Math.floor((snapshot.t - started) / 1000))
  const sniperScope = ads && w === 'sniper'

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {sniperScope && (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: 'inset 0 0 120px 40px rgba(0,0,0,0.75)',
            background: 'radial-gradient(circle at center, transparent 0%, transparent 22%, rgba(0,0,0,0.25) 28%, rgba(0,0,0,0.55) 100%)',
          }}
        />
      )}

      {/* Storm indicator */}
      <div className="flex justify-center px-6 pt-5">
        {storm && (
          <div className={`flex max-w-xl flex-col items-center rounded-2xl border px-8 py-3 shadow-lg backdrop-blur-md ${
            storm.inSafe ? 'border-cyan-400/30 bg-cyan-950/50' : 'border-rose-500/60 bg-rose-950/70 ring-2 ring-rose-500/40'
          }`}>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">พายุ</p>
            <p className="text-lg font-bold text-white">
              {storm.inSafe ? 'อยู่ในเขตปลอดภัย' : `อยู่นอกเขต +${storm.margin.toFixed(0)}ม.`}
            </p>
            <p className="text-xs text-slate-300">
              รัศมีวง ~{Math.round(storm.radius)}ม. · หดอีก ~{storm.shrinkIn}วิ
            </p>
          </div>
        )}
      </div>

      {/* HP/Shield + Alive count */}
      <div className="flex justify-between p-6 pt-3">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/80 px-5 py-4 shadow-xl backdrop-blur-md">
          <div className="flex h-3.5 w-60 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-[width]" style={{ width: `${displayPlayer?.hp ?? 0}%` }} />
          </div>
          <div className="mt-2.5 flex h-3.5 w-60 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10">
            <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-[width]" style={{ width: `${displayPlayer?.shield ?? 0}%` }} />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400">
            เลือด {Math.round(displayPlayer?.hp ?? 0)} · โล่ {Math.round(displayPlayer?.shield ?? 0)}
            {spectateTarget && <span className="ml-2 text-amber-300">👁 {spectateTarget.username}</span>}
          </p>
        </div>

        <div className="text-right">
          <p className="text-4xl font-black tabular-nums tracking-tight text-white drop-shadow-lg">{snapshot.remaining}</p>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">มีชีวิต</p>
          <p className="mt-1 text-sm text-slate-300">
            เวลา <span className="font-mono text-white">{formatClock(elapsed)}</span>
          </p>
        </div>
      </div>

      {/* Pickup toast */}
      {showPickup && (
        <div className="absolute bottom-48 left-1/2 z-30 -translate-x-1/2 rounded-2xl border border-amber-400/50 bg-amber-950/90 px-8 py-3 shadow-2xl backdrop-blur">
          <p className="text-center text-xs uppercase tracking-widest text-amber-200">เก็บได้</p>
          <p className="text-center text-2xl font-black text-white">{showPickup.label}</p>
        </div>
      )}

      {/* Dead / spectate overlay */}
      {me && !me.alive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="rounded-2xl border border-white/20 bg-black/60 px-8 py-4 text-center backdrop-blur">
            <p className="text-2xl font-black text-rose-400">คุณถูกกำจัด</p>
            <p className="mt-1 text-sm text-slate-300">
              {me.spectatingId ? 'กด [Space] เพื่อเปลี่ยนเป้าหมายดู' : 'กำลังดูผู้เล่นอื่น…'}
            </p>
          </div>
        </div>
      )}

      {/* Kill announcement + hit number — ลอยอยู่กลางจอด้านล่าง */}
      <div className="absolute bottom-28 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none">
        {killAnnouncement && performance.now() - killAnnouncement.at < 2500 && (
          <div className="animate-bounce rounded-2xl border border-amber-400/60 bg-amber-950/90 px-8 py-2 text-center shadow-2xl backdrop-blur">
            <p className="text-2xl font-black text-amber-300">{killAnnouncement.text}</p>
          </div>
        )}
        {hit && performance.now() - hit.at < 600 && (
          <div className={`rounded-xl px-5 py-2 text-3xl font-black drop-shadow ${hit.head ? 'text-amber-300' : 'text-white'}`}>
            {hit.damage}
            {hit.head && <span className="ml-2 text-sm font-bold text-amber-200">ยิงหัว!</span>}
          </div>
        )}
      </div>

      {/* Minimap */}
      <div className="absolute bottom-8 right-8 h-44 w-44 overflow-hidden rounded-full border-2 border-cyan-400/40 bg-slate-950/90 shadow-2xl backdrop-blur-md ring-2 ring-cyan-500/20">
        {minimap && playerId && (
          <MinimapDots zone={minimap.z} players={minimap.players} selfId={playerId} />
        )}
      </div>

      {/* Kill feed */}
      <div className="absolute left-8 top-36 max-w-sm space-y-1.5">
        {snapshot.killFeed.slice(0, 6).map((k) => (
          <div key={k.id} className="rounded-lg border border-white/5 bg-black/50 px-3 py-1.5 text-sm text-white shadow backdrop-blur">
            <span className="font-semibold text-rose-300">{k.killer}</span>
            <span className="text-slate-500"> ➜ </span>
            <span className="font-semibold text-sky-200">{k.victim}</span>
          </div>
        ))}
      </div>

      {/* Crosshair */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-7 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
    </div>
  )
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function MinimapDots({
  zone, players, selfId,
}: {
  zone: { centerX: number; centerZ: number; radius: number }
  players: { id: string; x: number; z: number }[]
  selfId: string
}) {
  const scale = 2.4
  const self = players.find((p) => p.id === selfId)
  if (!self) return null
  return (
    <svg viewBox="-95 -95 190 190" className="h-full w-full">
      <circle
        r={zone.radius / scale}
        cx={(zone.centerX - self.x) / scale}
        cy={-(zone.centerZ - self.z) / scale}
        fill="none" stroke="#22d3ee" strokeWidth="2.5" opacity={0.65}
      />
      {players.map((p) => {
        const dx = (p.x - self.x) / scale
        const dy = -(p.z - self.z) / scale
        return <circle key={p.id} r={p.id === selfId ? 4 : 3} cx={dx} cy={dy} fill={p.id === selfId ? '#5eead4' : '#fb7185'} />
      })}
    </svg>
  )
}
