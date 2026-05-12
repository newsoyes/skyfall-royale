/**
 * WeaponBar — แถบอาวุธ 4 slot แสดงตลอดเวลาที่ด้านล่างจอ
 * แสดงชื่ออาวุธ, กระสุนในแม็ก, กระสุนสำรอง, ammo bar และ reload bar
 */

import { useSession } from '../store/session'
import { useGame } from '../store/game'
import { WEAPON_LABEL, WEAPON_CONFIG } from '../game/weapons'
import type { WeaponId } from '../types/protocol'

const SLOT_ICONS: Record<WeaponId, string> = {
  pistol:  '🔫',
  ar:      '⚔️',
  smg:     '💨',
  shotgun: '💥',
  sniper:  '🎯',
  rpg:     '🚀',
}

export function WeaponBar() {
  const playerId = useSession((s) => s.playerId)
  const snapshot = useGame((s) => s.snapshot)
  const reloadProgress = useGame((s) => s.reloadProgress)

  const me = snapshot?.players.find((p) => p.id === playerId)
  if (!me || !me.alive) return null

  const isReloading = reloadProgress !== null

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
      {me.loadout.map((w, i) => {
        const isActive = i === me.weaponIndex
        const mag = w ? me.ammo[w] : 0
        const reserve = w ? me.ammoReserve[w] : 0
        const cfg = w ? WEAPON_CONFIG[w] : null
        const magPct = cfg ? mag / cfg.magSize : 0
        const showReload = isActive && isReloading

        return (
          <div
            key={i}
            className={`relative flex flex-col items-center rounded-xl border px-3 py-2 transition-all ${
              isActive
                ? 'border-white/40 bg-black/80 shadow-[0_0_12px_rgba(255,255,255,0.15)] scale-105'
                : w
                ? 'border-white/10 bg-black/50'
                : 'border-white/5 bg-black/30 opacity-40'
            }`}
            style={{ minWidth: 72 }}
          >
            {/* Slot number */}
            <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-500'}`}>
              [{i + 1}]
            </span>

            {w ? (
              <>
                {/* Icon + name */}
                <span className="text-lg leading-none mt-0.5">{SLOT_ICONS[w]}</span>
                <span className={`mt-0.5 text-[10px] font-bold leading-tight text-center ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {WEAPON_LABEL[w]}
                </span>

                {/* Ammo count — dim when reloading */}
                <span className={`mt-1 text-sm font-black tabular-nums transition-opacity ${
                  isActive ? 'text-white' : 'text-slate-400'
                } ${showReload ? 'opacity-40' : ''}`}>
                  {mag}
                  <span className="text-[10px] font-normal text-slate-500">/{reserve}</span>
                </span>

                {/* Reload bar (replaces ammo bar when reloading) */}
                {showReload ? (
                  <div className="mt-1.5 w-full">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-700 ring-1 ring-amber-400/30">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-none"
                        style={{ width: `${(reloadProgress ?? 0) * 100}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-center text-[9px] font-bold text-amber-300 animate-pulse">
                      รีโหลด…
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5 w-full h-1 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className={`h-full rounded-full transition-[width] ${
                        magPct > 0.5 ? 'bg-emerald-400' :
                        magPct > 0.2 ? 'bg-amber-400' : 'bg-rose-500'
                      }`}
                      style={{ width: `${magPct * 100}%` }}
                    />
                  </div>
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-white" />
                )}
              </>
            ) : (
              <span className="mt-2 text-[10px] text-slate-600">ว่าง</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
