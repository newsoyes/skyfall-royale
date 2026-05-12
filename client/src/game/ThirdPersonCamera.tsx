import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSession } from '../store/session'
import { useGame } from '../store/game'
import { useCombat } from '../store/combat'
import type { WeaponId } from '../types/protocol'
import { predictedRef } from './GameFxLoop'

const BASE_DIST = 5.2
const GHOST_SPEED = 20  // units/sec

const _eye = new THREE.Vector3()
const _look = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

export function ThirdPersonCamera() {
  const { camera } = useThree()
  const playerId = useSession((s) => s.playerId)

  useFrame((_, dt) => {
    const snap = useGame.getState().snapshot
    if (!snap || !playerId) return
    const me = snap.players.find((p) => p.id === playerId)
    if (!me) return

    // ── DEAD ─────────────────────────────────────────────────────────────────
    if (!me.alive) {
      // Ghost mode: free-fly first-person (always, no spectate)
      const inp = window.__lastInput
      const yaw = inp.yaw
      const pitch = inp.pitch
      const cosP = Math.cos(pitch)
      const sinP = Math.sin(pitch)
      const sinY = Math.sin(yaw)
      const cosY = Math.cos(yaw)
      _fwd.set(sinY * cosP, sinP, cosY * cosP).normalize()
      _right.crossVectors(_fwd, _up).normalize()

      let gp = useGame.getState().ghostPosition
      if (!gp) {
        gp = { x: me.x, y: me.y + 3, z: me.z, yaw, pitch }
        useGame.getState().setGhostPosition(gp)
      }

      const fwd = inp.fwd
      const str = inp.str
      const up = inp.jump ? 1 : inp.sprint ? -1 : 0
      const nx = gp.x + (_fwd.x * fwd - _right.x * str) * GHOST_SPEED * dt
      const ny = gp.y + up * GHOST_SPEED * dt
      const nz = gp.z + (_fwd.z * fwd - _right.z * str) * GHOST_SPEED * dt
      useGame.getState().setGhostPosition({ x: nx, y: ny, z: nz, yaw, pitch })

      camera.position.set(nx, ny + 0.5, nz)
      _look.set(nx + _fwd.x * 80, ny + 0.5 + _fwd.y * 80, nz + _fwd.z * 80)
      camera.lookAt(_look)
      camera.fov += (72 - camera.fov) * (1 - Math.exp(-8 * dt))
      camera.updateProjectionMatrix()
      return
    }

    // ── ALIVE ────────────────────────────────────────────────────────────────
    const predicted = predictedRef.current
    const posX = predicted?.x ?? me.x
    const posY = predicted?.y ?? me.y
    const posZ = predicted?.z ?? me.z

    const inp = window.__lastInput
    const yaw = inp.yaw
    const pitch = inp.pitch

    const cosP = Math.cos(pitch)
    const sinP = Math.sin(pitch)
    const sinY = Math.sin(yaw)
    const cosY = Math.cos(yaw)

    _fwd.set(sinY * cosP, sinP, cosY * cosP).normalize()

    const w = me.loadout[me.weaponIndex] as WeaponId | null
    const ads = useCombat.getState().ads
    let targetFov = 72
    let dist = BASE_DIST
    if (ads && w) {
      if (w === 'sniper') { targetFov = 26; dist = 3.25 }
      else if (w === 'ar' || w === 'smg') { targetFov = 50; dist = 4.2 }
      else { targetFov = 58; dist = 4.5 }
    }

    const k = 1 - Math.exp(-10 * dt)
    camera.fov += (targetFov - camera.fov) * k
    camera.updateProjectionMatrix()

    _eye.set(posX, posY + 1.55, posZ)
    _look.copy(_eye).addScaledVector(_fwd, 80)

    camera.position.copy(_eye).addScaledVector(_fwd, -dist)
    camera.position.y += 0.35
    camera.lookAt(_look)
  })

  return null
}
