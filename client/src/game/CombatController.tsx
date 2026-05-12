import { useCallback, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getSocket } from '../net/clientSocket'
import { useSession } from '../store/session'
import { useGame } from '../store/game'
import { useCombat } from '../store/combat'
import { WEAPON_CONFIG } from './weapons'
import { sounds } from '../audio/procedural'
import type { WeaponId } from '../types/protocol'
import { raycastTerrainAlong } from './terrainRay'
import { closestPropHit } from './worldColliders'

const _end = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _muzzle = new THREE.Vector3()

function aimFromPlayer(me: { x: number; y: number; z: number; yaw: number; pitch: number }) {
  const cosP = Math.cos(me.pitch)
  const sinP = Math.sin(me.pitch)
  const sinY = Math.sin(me.yaw)
  const cosY = Math.cos(me.yaw)
  _fwd.set(sinY * cosP, sinP, cosY * cosP).normalize()
  _muzzle.set(me.x, me.y + 1.42, me.z)
  _muzzle.addScaledVector(_fwd, 0.55)
  /** slight shoulder offset */
  const right = new THREE.Vector3(cosY, 0, -sinY).multiplyScalar(0.22)
  _muzzle.add(right)
  return { origin: _muzzle.clone(), dir: _fwd.clone() }
}

export function CombatController({ active }: { active: boolean }) {
  const { camera } = useThree()
  const playerId = useSession((s) => s.playerId)
  const addTracer = useGame((s) => s.addTracer)
  const setAds = useCombat((s) => s.setAds)
  const holding = useRef(false)
  const lastFire = useRef(0)

  useEffect(() => {
    if (!active) return
    const down = (e: MouseEvent) => {
      if (e.button === 0) holding.current = true
      if (e.button === 2) setAds(true)
    }
    const up = (e: MouseEvent) => {
      if (e.button === 0) holding.current = false
      if (e.button === 2) setAds(false)
    }
    const noCtx = (e: MouseEvent) => e.preventDefault()
    window.addEventListener('mousedown', down)
    window.addEventListener('mouseup', up)
    window.addEventListener('contextmenu', noCtx)
    return () => {
      window.removeEventListener('mousedown', down)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('contextmenu', noCtx)
    }
  }, [active, setAds])

  const tryFire = useCallback(() => {
    if (!playerId) return
    const snap = useGame.getState().snapshot
    if (!snap) return
    const me = snap.players.find((p) => p.id === playerId)
    if (!me?.alive) return
    const w = me.loadout[me.weaponIndex] as WeaponId | null
    if (!w) return
    const cfg = WEAPON_CONFIG[w]
    const mag = me.ammo[w] ?? 0
    if (mag <= 0) return
    const now = performance.now()
    if (now - lastFire.current < cfg.fireRateMs) return
    lastFire.current = now

    const { origin } = aimFromPlayer({
      x: me.x, y: me.y, z: me.z,
      // ใช้ yaw/pitch จาก window.__lastInput (real-time) แทน me.yaw/pitch (50ms lag)
      // เพื่อให้ origin ของกระสุนตรงกับทิศที่กล้องชี้อยู่จริงๆ
      yaw: window.__lastInput.yaw,
      pitch: window.__lastInput.pitch,
    })
    _dir.copy(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)).normalize()

    getSocket().emit('game:fire', {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      dir: { x: _dir.x, y: _dir.y, z: _dir.z },
    })

    const range = cfg.range
    const endGround = raycastTerrainAlong(origin, _dir, w === 'rpg' ? 12 : range)
    const tp = closestPropHit(origin.x, origin.y, origin.z, _dir.x, _dir.y, _dir.z, range)
    let end = endGround
    if (tp != null) {
      _end.copy(origin).addScaledVector(_dir, tp)
      if (_end.distanceToSquared(origin) < endGround.distanceToSquared(origin)) end = _end.clone()
    }
    addTracer(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: end.x, y: end.y, z: end.z },
    )
    sounds.shoot(w)
  }, [playerId, camera, addTracer])

  useEffect(() => {
    if (!active) return
    const md = (e: MouseEvent) => {
      if (e.button !== 0) return
      const snap = useGame.getState().snapshot
      if (!snap || !playerId) return
      const me = snap.players.find((p) => p.id === playerId)
      const w = me?.loadout[me?.weaponIndex ?? 0] as WeaponId | null
      // AR and SMG fire via useFrame (auto), all other weapons fire on click
      if (!w || w === 'ar' || w === 'smg') return
      tryFire()
    }
    window.addEventListener('mousedown', md)
    return () => window.removeEventListener('mousedown', md)
  }, [active, playerId, tryFire])

  useFrame(() => {
    if (!active || !playerId || !holding.current) return
    const snap = useGame.getState().snapshot
    const me = snap?.players.find((p) => p.id === playerId)
    const w = me?.loadout[me?.weaponIndex ?? 0] as WeaponId | null
    // Auto-fire weapons
    if (w !== 'ar' && w !== 'smg') return
    tryFire()
  })

  return null
}
