/**
 * InventoryUI — กด [I] หรือ [Tab] เพื่อเปิด/ปิด
 * แสดงรายละเอียด: loadout, ammo, armor, consumables, ของใกล้ๆ
 */

import { useEffect, useState } from 'react'
import { useSession } from '../store/session'
import { useGame } from '../store/game'
import { getSocket } from '../net/clientSocket'
import { sounds } from '../audio/procedural'
import { WEAPON_LABEL, WEAPON_CONFIG, RARITY_COLOR, CONSUMABLE_LABEL, CONSUMABLE_COLOR, ARMOR_LABEL, ARMOR_COLOR, isWeaponId, isArmorItem, parseArmorItem } from '../game/weapons'
import type { WeaponId, ConsumableId, ArmorTier } from '../types/protocol'

const SLOT_KEYS = ['1', '2', '3', '4']

export function InventoryUI() {
  const [open, setOpen] = useState(false)
  const playerId = useSession((s) => s.playerId)
  const snapshot = useGame((s) => s.snapshot)

  const me = snapshot?.players.find((p) => p.id === playerId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault()
        setOpen((v) => !v)
        sounds.uiClick()
      }
      if (e.code === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open || !me) return null

  // Armor from PlayerState (now properly typed)
  const armor = me.armor

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-slate-950/95 p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-black text-white">🎒 กระเป๋าสัมภาระ</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
          >
            ปิด [I]
          </button>
        </div>

        {/* HP / Shield */}
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">สถานะ</p>
          <div className="flex items-center gap-3">
            <span className="w-14 text-xs font-bold text-emerald-400">❤️ เลือด</span>
            <div className="flex-1 h-3 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-[width]" style={{ width: `${me.hp}%` }} />
            </div>
            <span className="w-10 text-right text-sm font-bold text-white">{Math.round(me.hp)}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="w-14 text-xs font-bold text-sky-400">🛡️ โล่</span>
            <div className="flex-1 h-3 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-400 transition-[width]" style={{ width: `${me.shield}%` }} />
            </div>
            <span className="w-10 text-right text-sm font-bold text-white">{Math.round(me.shield)}</span>
          </div>
        </div>

        {/* Armor slots */}
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">เกราะ</p>
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl border px-3 py-2 ${armor?.helmet ? 'border-amber-400/40 bg-amber-950/30' : 'border-white/5 bg-white/[0.02] opacity-50'}`}>
              <p className="text-[10px] text-slate-500">⛑️ หมวกกันน็อก</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {armor?.helmet ? ARMOR_LABEL[armor.helmet] ?? armor.helmet : 'ไม่มี'}
              </p>
            </div>
            <div className={`rounded-xl border px-3 py-2 ${armor?.vest ? 'border-amber-400/40 bg-amber-950/30' : 'border-white/5 bg-white/[0.02] opacity-50'}`}>
              <p className="text-[10px] text-slate-500">🦺 เสื้อเกราะ</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {armor?.vest ? ARMOR_LABEL[armor.vest] ?? armor.vest : 'ไม่มี'}
              </p>
            </div>
          </div>
        </div>

        {/* Weapon slots */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">อาวุธ [1–4]</p>
          <div className="grid grid-cols-4 gap-2">
            {me.loadout.map((w, i) => {
              const isActive = i === me.weaponIndex
              const mag = w ? me.ammo[w] : 0
              const reserve = w ? me.ammoReserve[w] : 0
              const cfg = w ? WEAPON_CONFIG[w] : null
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    getSocket().emit('game:weaponIndex', i)
                    sounds.weaponSwitch()
                  }}
                  className={`relative rounded-xl border p-3 text-center transition ${
                    isActive
                      ? 'border-indigo-400 bg-indigo-600/30 ring-2 ring-indigo-400/50'
                      : w
                      ? 'border-white/10 bg-white/5 hover:bg-white/10'
                      : 'border-white/5 bg-white/[0.02] opacity-40'
                  }`}
                >
                  <p className="text-[10px] font-bold text-slate-400">[{SLOT_KEYS[i]}]</p>
                  {w ? (
                    <>
                      <p className="mt-1 text-sm font-black text-white leading-tight">{WEAPON_LABEL[w]}</p>
                      <p className="mt-1 text-xs font-semibold text-indigo-300">
                        {mag}<span className="text-slate-500">/{reserve}</span>
                      </p>
                      {cfg && (
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-700">
                          <div className="h-full bg-indigo-400" style={{ width: `${(mag / cfg.magSize) * 100}%` }} />
                        </div>
                      )}
                      {isActive && (
                        <span className="absolute -top-1 -right-1 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] font-black text-white">ถือ</span>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">ว่าง</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Consumables (grenades) */}
        {me.consumables && Object.keys(me.consumables).length > 0 && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">ของใช้ / ระเบิด</p>
            <div className="flex flex-wrap gap-2">
              {(me.consumables.grenade ?? 0) > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-950/40 px-3 py-2">
                  <span className="text-xl">💣</span>
                  <div>
                    <p className="text-xs text-orange-300 font-bold">ระเบิด</p>
                    <p className="text-lg font-black text-white">×{me.consumables.grenade}</p>
                  </div>
                  <span className="ml-1 text-[10px] text-orange-400/60">[G]</span>
                </div>
              )}
              {(me.consumables.smoke_grenade ?? 0) > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-400/40 bg-slate-800/40 px-3 py-2">
                  <span className="text-xl">💨</span>
                  <div>
                    <p className="text-xs text-slate-300 font-bold">ระเบิดควัน</p>
                    <p className="text-lg font-black text-white">×{me.consumables.smoke_grenade}</p>
                  </div>
                  <span className="ml-1 text-[10px] text-slate-400/60">[H]</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nearby pickups (read-only info) */}
        <NearbyPickups me={me} />

        <p className="mt-4 text-center text-[11px] text-slate-600">
          [I / Tab] ปิด · [1–4] เปลี่ยนอาวุธ · เดินชนของเพื่อเก็บ · [G] ขว้างระเบิด · [H] ควัน · [F] ขึ้น/ลงรถ
        </p>
      </div>
    </div>
  )
}

function NearbyPickups({ me }: { me: { x: number; z: number } }) {
  const snapshot = useGame((s) => s.snapshot)
  if (!snapshot) return null

  const nearby = snapshot.pickups.filter((pk) => Math.hypot(pk.x - me.x, pk.z - me.z) < 8)
  if (nearby.length === 0) return null

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">ของใกล้ๆ (เดินชนเพื่อเก็บ)</p>
      <div className="space-y-1.5 max-h-28 overflow-auto">
        {nearby.map((pk) => {
          const isWeapon = isWeaponId(pk.item)
          const isArmor = isArmorItem(pk.item)
          let color: string
          let label: string
          if (isWeapon) {
            color = RARITY_COLOR[pk.rarity] ?? '#fff'
            label = WEAPON_LABEL[pk.item as WeaponId] ?? pk.item
          } else if (isArmor) {
            const parsed = parseArmorItem(pk.item)
            color = parsed ? (ARMOR_COLOR[parsed.tier as ArmorTier] ?? '#cfcfcf') : '#cfcfcf'
            const slotName = parsed?.slot === 'helmet' ? '⛑️ หมวก' : '🦺 เสื้อเกราะ'
            const tierName = parsed ? (ARMOR_LABEL[parsed.tier as ArmorTier] ?? parsed.tier) : ''
            label = `${slotName} ${tierName}`
          } else {
            color = CONSUMABLE_COLOR[pk.item as ConsumableId] ?? '#4ade80'
            label = CONSUMABLE_LABEL[pk.item as ConsumableId] ?? pk.item
          }
          return (
            <div key={pk.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
              <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm font-semibold text-white">{label}</span>
              {isWeapon && (
                <span className="ml-auto text-xs font-bold capitalize" style={{ color }}>{pk.rarity}</span>
              )}
              {pk.isSupplyDrop && <span className="ml-1 text-xs font-black text-amber-400">📦</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
