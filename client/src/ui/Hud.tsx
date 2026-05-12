import { useMemo, useState, useEffect, useRef } from 'react'
import { useSession } from '../store/session'
import { useGame } from '../store/game'
import { useCombat } from '../store/combat'
import { loadSensitivity, saveSensitivity } from '../game/InputControls'
import type { WeaponId } from '../types/protocol'

// ── Sensitivity Panel ─────────────────────────────────────────────────────────
function SensitivityPanel({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState(() => loadSensitivity())
  const handleChange = (v: number) => {
    setValue(v)
    saveSensitivity(v)
    if (window.__sensitivity) window.__sensitivity.current = v
  }
  return (
    <div className="pointer-events-auto absolute top-16 right-4 z-50 w-64 rounded-2xl border border-white/15 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-white">⚙️ ความไวเมาส์</p>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range" min={0.1} max={5.0} step={0.1} value={value}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          className="flex-1 accent-indigo-400"
        />
        <span className="w-10 text-right text-sm font-black text-indigo-300">{value.toFixed(1)}</span>
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-500">
        <span>ช้า 0.1</span><span>ปกติ 1.0</span><span>เร็ว 5.0</span>
      </div>
    </div>
  )
}

// ── Blood Vignette ────────────────────────────────────────────────────────────
function hitOpacity(damage: number): number {
  if (damage >= 50) return 0.85
  if (damage >= 20) return 0.55
  return 0.30
}

function BloodVignette({ hp, lastHit }: { hp: number; lastHit: { damage: number; at: number } | null }) {
  const [flashOpacity, setFlashOpacity] = useState(0)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (!lastHit) return
    const peak = hitOpacity(lastHit.damage)
    setFlashOpacity(peak)
    const start = performance.now()
    const duration = 600
    const animate = () => {
      const elapsed = performance.now() - start
      if (elapsed >= duration) { setFlashOpacity(0); return }
      setFlashOpacity(peak * (1 - elapsed / duration))
      animRef.current = requestAnimationFrame(animate)
    }
    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [lastHit])

  const lowHealthOpacity = hp < 30 ? 0.20 : 0
  const totalOpacity = Math.max(flashOpacity, lowHealthOpacity)
  if (totalOpacity <= 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{
        background: `radial-gradient(ellipse at center, transparent 40%, rgba(180,0,0,${totalOpacity}) 100%)`,
      }}
    />
  )
}

// ── Damage Log Panel ──────────────────────────────────────────────────────────
function DamageLogPanel({ totalDamage }: { totalDamage: number }) {
  const hitLog = useGame((s) => s.hitLog)

  // Aggregate by target
  const byTarget = useMemo(() => {
    const map = new Map<string, { username: string; hits: number; damage: number; headHits: number; bodyHits: number }>()
    for (const e of hitLog) {
      const existing = map.get(e.targetId)
      if (existing) {
        existing.hits++
        existing.damage += e.damage
        if (e.isHead) existing.headHits++
        else existing.bodyHits++
      } else {
        map.set(e.targetId, {
          username: e.targetUsername,
          hits: 1,
          damage: e.damage,
          headHits: e.isHead ? 1 : 0,
          bodyHits: e.isHead ? 0 : 1,
        })
      }
    }
    return [...map.values()]
  }, [hitLog])

  return (
    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 z-20 w-52 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-md">
      <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-slate-400">ดาเมจที่ทำได้</p>
      <p className="mb-3 text-center text-3xl font-black text-white">{Math.floor(totalDamage)}</p>

      {byTarget.length === 0 ? (
        <p className="text-center text-xs text-slate-600">ไม่มีข้อมูล</p>
      ) : (
        <div className="space-y-3">
          {byTarget.map((t) => (
            <div key={t.username} className="rounded-xl bg-white/5 p-2">
              <p className="text-xs font-bold text-white truncate">{t.username}</p>
              <div className="mt-1 flex items-center gap-2">
                {/* Body silhouette SVG */}
                <svg width="28" height="44" viewBox="0 0 28 44" className="flex-shrink-0">
                  {/* Head */}
                  <circle cx="14" cy="7" r="6" fill="#374151" />
                  {/* Body */}
                  <rect x="7" y="14" width="14" height="18" rx="3" fill="#374151" />
                  {/* Legs */}
                  <rect x="7" y="33" width="5" height="10" rx="2" fill="#374151" />
                  <rect x="16" y="33" width="5" height="10" rx="2" fill="#374151" />
                  {/* Head hit markers */}
                  {Array.from({ length: Math.min(t.headHits, 4) }).map((_, i) => (
                    <circle key={`h${i}`} cx={10 + i * 3} cy="7" r="1.8" fill="#f59e0b" />
                  ))}
                  {/* Body hit markers */}
                  {Array.from({ length: Math.min(t.bodyHits, 6) }).map((_, i) => (
                    <circle key={`b${i}`} cx={9 + (i % 3) * 5} cy={20 + Math.floor(i / 3) * 6} r="1.8" fill="#ef4444" />
                  ))}
                </svg>
                <div>
                  <p className="text-[10px] text-slate-400">{t.hits} ยิง</p>
                  <p className="text-sm font-black text-white">{Math.floor(t.damage)} dmg</p>
                  {t.headHits > 0 && <p className="text-[9px] text-amber-400">🎯 หัว ×{t.headHits}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Spectate Hint ─────────────────────────────────────────────────────────────
function GhostHint() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      <div className="rounded-2xl border border-slate-400/30 bg-black/65 px-8 py-5 text-center backdrop-blur">
        <p className="text-3xl font-black text-slate-200">👻 โหมดผี</p>
        <p className="mt-2 text-sm font-semibold text-slate-300">WASD เคลื่อนที่ · Space ขึ้น · Shift ลง</p>
        <p className="mt-1 text-xs text-slate-500">บินไปมาได้อิสระ · ผู้เล่นอื่นเห็นคุณได้</p>
      </div>
    </div>
  )
}

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
  const [showSettings, setShowSettings] = useState(false)

  const me = snapshot?.players.find((p) => p.id === playerId)

  const spectateTarget = me && !me.alive && me.spectatingId
    ? snapshot?.players.find((p) => p.id === me.spectatingId)
    : null
  const displayPlayer = spectateTarget ?? me

  const minimap = useMemo(() => {
    if (!snapshot) return null
    const z = snapshot.zone
    const players = snapshot.players.filter((p) => p.alive || p.isGhost)
    return { z, players, teamMode: snapshot.teamMode }
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

  const nearVehicle = !me.inVehicleId && snapshot.vehicles?.some(
    (v) => !v.driverId && Math.hypot(v.x - me.x, v.z - me.z) < 4
  )

  const isDead = !me.alive
  const isGhost = me.isGhost

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Blood vignette */}
      <BloodVignette hp={displayPlayer?.hp ?? 100} lastHit={hit} />

      {sniperScope && (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: 'inset 0 0 120px 40px rgba(0,0,0,0.75)',
            background: 'radial-gradient(circle at center, transparent 0%, transparent 22%, rgba(0,0,0,0.25) 28%, rgba(0,0,0,0.55) 100%)',
          }}
        />
      )}

      {/* Settings button (top-right, pointer-events-auto) */}
      {!isDead && (
        <div className="pointer-events-auto absolute top-4 right-4 z-50">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-xl bg-black/50 px-3 py-2 text-lg text-white hover:bg-black/70 border border-white/10"
            title="ตั้งค่า"
          >⚙️</button>
        </div>
      )}
      {showSettings && <SensitivityPanel onClose={() => setShowSettings(false)} />}

      {/* Storm indicator */}
      <div className="flex justify-center px-6 pt-5">
        {storm && !isDead && (
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

      {/* HP/Shield + Alive count (hide when dead) */}
      {!isDead && (
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
            </p>
            <div className="mt-2 flex items-center gap-3">
              {(me.consumables?.grenade ?? 0) > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-orange-900/60 px-2 py-1 border border-orange-500/40">
                  <span className="text-base">💣</span>
                  <span className="text-sm font-black text-orange-300">×{me.consumables?.grenade}</span>
                  <span className="text-[9px] text-orange-400/70 ml-0.5">[G]</span>
                </div>
              )}
              {(me.consumables?.smoke_grenade ?? 0) > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-slate-700/60 px-2 py-1 border border-slate-400/40">
                  <span className="text-base">💨</span>
                  <span className="text-sm font-black text-slate-300">×{me.consumables?.smoke_grenade}</span>
                  <span className="text-[9px] text-slate-400/70 ml-0.5">[H]</span>
                </div>
              )}
              {me.inVehicleId && (
                <div className="flex items-center gap-1 rounded-lg bg-green-900/60 px-2 py-1 border border-green-500/40">
                  <span className="text-base">🚙</span>
                  <span className="text-xs font-bold text-green-300">ขับรถ</span>
                  <span className="text-[9px] text-green-400/70 ml-0.5">[F] ออก</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-4xl font-black tabular-nums tracking-tight text-white drop-shadow-lg">{snapshot.remaining}</p>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">มีชีวิต</p>
            <p className="mt-1 text-sm text-slate-300">
              เวลา <span className="font-mono text-white">{formatClock(elapsed)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Pickup toast */}
      {showPickup && (
        <div className="absolute bottom-48 left-1/2 z-30 -translate-x-1/2 rounded-2xl border border-amber-400/50 bg-amber-950/90 px-8 py-3 shadow-2xl backdrop-blur">
          <p className="text-center text-xs uppercase tracking-widest text-amber-200">เก็บได้</p>
          <p className="text-center text-2xl font-black text-white">{showPickup.label}</p>
        </div>
      )}

      {/* Vehicle enter prompt */}
      {nearVehicle && !isDead && (
        <div className="absolute bottom-48 left-1/2 z-30 -translate-x-1/2 rounded-2xl border border-green-400/50 bg-green-950/90 px-8 py-3 shadow-2xl backdrop-blur">
          <p className="text-center text-xs uppercase tracking-widest text-green-200">รถอยู่ใกล้ๆ</p>
          <p className="text-center text-xl font-black text-white">กด <kbd className="rounded bg-white/20 px-2 py-0.5 font-mono">F</kbd> เพื่อขึ้นรถ</p>
        </div>
      )}

      {/* Dead overlay: GhostHint + DamageLog */}
      {isDead && snapshot.remaining > 0 && (
        <GhostHint />
      )}
      {isDead && (
        <DamageLogPanel totalDamage={me.damageDealt} />
      )}

      {/* Kill announcement + hit number */}
      <div className="absolute bottom-28 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none">
        {killAnnouncement && performance.now() - killAnnouncement.at < 2500 && (
          <div className="animate-bounce rounded-2xl border border-amber-400/60 bg-amber-950/90 px-8 py-2 text-center shadow-2xl backdrop-blur">
            <p className="text-2xl font-black text-amber-300">{killAnnouncement.text}</p>
          </div>
        )}
        {hit && performance.now() - hit.at < 600 && !isDead && (
          <div className={`rounded-xl px-5 py-2 text-3xl font-black drop-shadow ${hit.head ? 'text-amber-300' : 'text-white'}`}>
            {hit.damage}
            {hit.head && <span className="ml-2 text-sm font-bold text-amber-200">ยิงหัว!</span>}
          </div>
        )}
      </div>

      {/* Minimap */}
      <div className="absolute bottom-8 right-8 h-44 w-44 overflow-hidden rounded-full border-2 border-cyan-400/40 bg-slate-950/90 shadow-2xl backdrop-blur-md ring-2 ring-cyan-500/20">
        {minimap && playerId && (
          <MinimapDots
            zone={minimap.z}
            players={minimap.players}
            selfId={playerId}
            myTeamId={me.teamId}
            teamMode={minimap.teamMode}
          />
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

      {/* Crosshair (hide when dead) */}
      {!isDead && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-7 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
        </>
      )}
    </div>
  )
}

function formatClock(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function MinimapDots({
  zone, players, selfId, myTeamId, teamMode,
}: {
  zone: { centerX: number; centerZ: number; radius: number }
  players: { id: string; x: number; z: number; teamId?: string | null; isGhost?: boolean }[]
  selfId: string
  myTeamId: string | null
  teamMode: string
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
        const isSelf = p.id === selfId
        const isTeammate = !isSelf && teamMode !== 'solo' && myTeamId !== null && p.teamId === myTeamId
        const isGhost = p.isGhost
        const color = isSelf ? '#5eead4' : isGhost ? '#9ca3af' : isTeammate ? '#60a5fa' : '#fb7185'
        return (
          <circle
            key={p.id}
            r={isSelf ? 4 : 3}
            cx={dx} cy={dy}
            fill={color}
            opacity={isGhost ? 0.5 : 1}
          />
        )
      })}
    </svg>
  )
}
