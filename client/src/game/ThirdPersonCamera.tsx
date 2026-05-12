import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useRef } from 'react'
import { useSession } from '../store/session'
import { useGame } from '../store/game'
import { useCombat } from '../store/combat'
import type { WeaponId } from '../types/protocol'
import { predictedRef } from './GameFxLoop'

const BASE_DIST = 5.2
const DEATH_CAM_RISE_SPEED = 0.6
const DEATH_CAM_MAX_HEIGHT = 28

const _eye = new THREE.Vector3()
const _look = new THREE.Vector3()
const _fwd = new THREE.Vector3()

export function ThirdPersonCamera() {
  const { camera } = useThree()
  const playerId = useSession((s) => s.playerId)
  const deathPos = useRef<THREE.Vector3 | null>(null)
  const deathCamY = useRef(0)
  const deathCamAngle = useRef(0)

  useFrame((_, dt) => {
    const snap = useGame.getState().snapshot
    if (!snap || !playerId) return
    const me = snap.players.find((p) => p.id === playerId)
    if (!me) return

    // ── DEAD: death cam or spectate ──────────────────────────────────────────
    if (!me.alive) {
      if (me.spectatingId) {
        const target = snap.players.find((p) => p.id === me.spectatingId)
        if (target) {
          const yaw = target.yaw
          const pitch = target.pitch
          const cosP = Math.cos(pitch)
          const sinP = Math.sin(pitch)
          _fwd.set(Math.sin(yaw) * cosP, sinP, Math.cos(yaw) * cosP).normalize()
          _eye.set(target.x, target.y + 1.55, target.z)
          camera.position.copy(_eye).addScaledVector(_fwd, -BASE_DIST)
          camera.position.y += 0.35
          camera.lookAt(_eye.clone().addScaledVector(_fwd, 80))
          camera.fov += (72 - camera.fov) * (1 - Math.exp(-8 * dt))
          camera.updateProjectionMatrix()
        }
        return
      }

      if (!deathPos.current) {
        deathPos.current = new THREE.Vector3(me.x, me.y, me.z)
        deathCamY.current = me.y + 2
        deathCamAngle.current = me.yaw
      }
      deathCamY.current = Math.min(
        deathPos.current.y + DEATH_CAM_MAX_HEIGHT,
        deathCamY.current + DEATH_CAM_RISE_SPEED * dt,
      )
      deathCamAngle.current += dt * 0.35
      const radius = 6 + (deathCamY.current - deathPos.current.y) * 0.4
      camera.position.set(
        deathPos.current.x + Math.sin(deathCamAngle.current) * radius,
        deathCamY.current,
        deathPos.current.z + Math.cos(deathCamAngle.current) * radius,
      )
      camera.lookAt(deathPos.current.x, deathPos.current.y + 1, deathPos.current.z)
      camera.fov += (72 - camera.fov) * (1 - Math.exp(-4 * dt))
      camera.updateProjectionMatrix()
      return
    }

    deathPos.current = null
    deathCamY.current = 0

    // ── ALIVE ────────────────────────────────────────────────────────────────
    const predicted = predictedRef.current
    const posX = predicted?.x ?? me.x
    const posY = predicted?.y ?? me.y
    const posZ = predicted?.z ?? me.z

    // ✅ KEY FIX: ใช้ window.__lastInput.yaw/pitch โดยตรง (update ทุก frame จาก mouse)
    // แทนที่จะใช้ me.yaw/pitch ที่มาจาก server snapshot (50ms lag → กระตุก)
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
