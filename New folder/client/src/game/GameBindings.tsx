import { useEffect } from 'react'
import { getSocket } from '../net/clientSocket'
import { sounds } from '../audio/procedural'
import { useGame } from '../store/game'
import { useSession } from '../store/session'
import { WEAPON_CONFIG } from './weapons'
import { reloadState } from './GameFxLoop'
import type { WeaponId } from '../types/protocol'

/** Weapon slots, reload, emote — gameplay keys while the canvas is mounted. */
export function GameBindings() {
  const playerId = useSession((s) => s.playerId)

  useEffect(() => {
    const sock = getSocket()
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      switch (e.code) {
        case 'Digit1': sock.emit('game:weaponIndex', 0); sounds.weaponSwitch(); break
        case 'Digit2': sock.emit('game:weaponIndex', 1); sounds.weaponSwitch(); break
        case 'Digit3': sock.emit('game:weaponIndex', 2); sounds.weaponSwitch(); break
        case 'Digit4': sock.emit('game:weaponIndex', 3); sounds.weaponSwitch(); break
        case 'KeyR': {
          const snap = useGame.getState().snapshot
          const pid = useSession.getState().playerId
          const me = snap?.players.find((p) => p.id === pid)
          if (!me?.alive) break
          const w = me.loadout[me.weaponIndex] as WeaponId | null
          if (!w) break
          const cfg = WEAPON_CONFIG[w]
          const mag = me.ammo[w] ?? 0
          const reserve = me.ammoReserve[w] ?? 0
          if (mag >= cfg.magSize || reserve <= 0) break
          if (reloadState.startAt !== null) break
          sock.emit('game:reload')
          sounds.reload(w)
          reloadState.startAt = performance.now()
          reloadState.duration = cfg.reloadMs
          useGame.getState().setReloadProgress(0)
          break
        }
        case 'KeyB': sock.emit('game:emote'); sounds.uiClick(); break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playerId])
  return null
}
