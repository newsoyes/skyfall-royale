/**
 * WorldPlayers — renders all players using ref-driven animation.
 *
 * ทำไมถึงไม่กระตุก:
 * - ไม่ใช้ React state/re-render เพื่อ update position
 * - useFrame() อัปเดต mesh.position โดยตรงทุก frame (60fps)
 * - snapshot เปลี่ยนทุก 50ms แต่ lerp ทำให้ smooth ระหว่าง snapshots
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/game'
import { useSession } from '../store/session'
import type { WeaponId } from '../types/protocol'
import { predictedRef } from './GameFxLoop'

// ── Shared materials (สร้างครั้งเดียว) ────────────────────────────────────────
const matSkin     = new THREE.MeshStandardMaterial({ color: '#e8b89a', roughness: 0.65 })
const matPants    = new THREE.MeshStandardMaterial({ color: '#293241', roughness: 0.6 })
const matSelf     = new THREE.MeshStandardMaterial({ color: '#5eead4', roughness: 0.45 })
const matOther    = new THREE.MeshStandardMaterial({ color: '#fb7185', roughness: 0.45 })
const matGun      = new THREE.MeshStandardMaterial({ color: '#2a2a2a', metalness: 0.6, roughness: 0.35 })
const matGunDark  = new THREE.MeshStandardMaterial({ color: '#1a1a2e', metalness: 0.7, roughness: 0.3 })
const matChute    = new THREE.MeshStandardMaterial({ color: '#f97316', transparent: true, opacity: 0.85, side: THREE.DoubleSide })
const matChuteLines = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.8 })

// ── Shared geometries (สร้างครั้งเดียว) ───────────────────────────────────────
const geoTorso    = new THREE.CapsuleGeometry(0.38, 0.55, 6, 12)
const geoHead     = new THREE.SphereGeometry(0.22, 10, 10)
const geoArm      = new THREE.CapsuleGeometry(0.09, 0.42, 4, 8)
const geoLeg      = new THREE.CapsuleGeometry(0.14, 0.55, 4, 8)
const geoChute    = new THREE.SphereGeometry(1.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)

// ── Weapon geometries ─────────────────────────────────────────────────────────
const geoGunBox   = new THREE.BoxGeometry(0.1, 0.14, 0.65)
const geoGunSmall = new THREE.BoxGeometry(0.08, 0.12, 0.22)
const geoGunSMG   = new THREE.BoxGeometry(0.1, 0.13, 0.42)
const geoGunShotgun = new THREE.BoxGeometry(0.12, 0.14, 0.55)
const geoGunSniper = new THREE.BoxGeometry(0.09, 0.12, 1.1)
const geoRPGTube  = new THREE.CylinderGeometry(0.1, 0.12, 0.85, 8)

// ── Build a complete player Object3D imperatively ─────────────────────────────
// Shared parachute line geometry (สร้างครั้งเดียว ไม่ใช่ใน loop)
const geoChuteLineShared = new THREE.CylinderGeometry(0.012, 0.012, 1.75, 3)

function buildPlayerObject(isSelf: boolean): THREE.Group {
  const root = new THREE.Group()

  const body = new THREE.Group()
  root.add(body)
  root.userData.bodyGroup = body

  const torso = new THREE.Mesh(geoTorso, isSelf ? matSelf : matOther)
  torso.castShadow = true
  torso.position.set(0, 0.95, 0)
  body.add(torso)

  const head = new THREE.Mesh(geoHead, matSkin)
  head.castShadow = true
  head.position.set(0, 1.52, 0)
  body.add(head)

  const lArm = new THREE.Mesh(geoArm, matSkin)
  lArm.castShadow = true
  lArm.position.set(-0.42, 0.95, 0)
  lArm.rotation.z = 0.2
  body.add(lArm)

  const rArm = new THREE.Mesh(geoArm, matSkin)
  rArm.castShadow = true
  rArm.position.set(0.42, 0.95, 0)
  rArm.rotation.z = -0.2
  body.add(rArm)

  const lLeg = new THREE.Mesh(geoLeg, matPants)
  lLeg.castShadow = true
  lLeg.position.set(-0.16, 0.38, 0)
  body.add(lLeg)

  const rLeg = new THREE.Mesh(geoLeg, matPants)
  rLeg.castShadow = true
  rLeg.position.set(0.16, 0.38, 0)
  body.add(rLeg)

  const weaponGroup = new THREE.Group()
  body.add(weaponGroup)
  root.userData.weaponGroup = weaponGroup

  const chuteGroup = new THREE.Group()
  chuteGroup.position.set(0, 3.5, 0)
  chuteGroup.visible = false
  body.add(chuteGroup)
  root.userData.chuteGroup = chuteGroup

  const canopy = new THREE.Mesh(geoChute, matChute)
  canopy.castShadow = true
  chuteGroup.add(canopy)

  // Use shared geometry for all lines — no per-instance allocation
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const lx = Math.cos(a) * 1.4
    const lz = Math.sin(a) * 1.4
    const line = new THREE.Mesh(geoChuteLineShared, matChuteLines)
    line.position.set(lx / 2, -1.75 / 2, lz / 2)
    chuteGroup.add(line)
  }

  return root
}

function buildWeaponMesh(w: WeaponId): THREE.Group {
  const g = new THREE.Group()
  if (w === 'pistol') {
    g.position.set(0.35, 0.95, 0.15)
    g.rotation.z = -0.15
    g.add(Object.assign(new THREE.Mesh(geoGunSmall, matGun), { castShadow: true }))
  } else if (w === 'smg') {
    g.position.set(0.33, 0.93, 0.12)
    g.rotation.z = -0.1
    g.add(Object.assign(new THREE.Mesh(geoGunSMG, matGun), { castShadow: true }))
  } else if (w === 'shotgun') {
    g.position.set(0.3, 0.9, 0.1)
    g.rotation.z = -0.08
    g.add(Object.assign(new THREE.Mesh(geoGunShotgun, matGun), { castShadow: true }))
  } else if (w === 'ar') {
    g.position.set(0.32, 0.92, 0.12)
    g.rotation.z = -0.08
    g.add(Object.assign(new THREE.Mesh(geoGunBox, matGun), { castShadow: true }))
  } else if (w === 'sniper') {
    g.position.set(0.28, 0.88, 0.1)
    g.rotation.z = -0.05
    g.add(Object.assign(new THREE.Mesh(geoGunSniper, matGun), { castShadow: true }))
  } else if (w === 'rpg') {
    g.position.set(0.3, 0.85, 0.15)
    g.rotation.z = -0.2
    g.add(Object.assign(new THREE.Mesh(geoRPGTube, matGun), { castShadow: true }))
  }
  return g
}

// ── Per-player runtime state ──────────────────────────────────────────────────
interface PlayerRuntime {
  object: THREE.Group
  smoothPos: THREE.Vector3
  currentWeapon: WeaponId | null
  isSelf: boolean
}

// ── Main component ────────────────────────────────────────────────────────────
export function WorldPlayers() {
  const playerId = useSession((s) => s.playerId)
  const groupRef = useRef<THREE.Group>(null!)
  const runtimes = useRef(new Map<string, PlayerRuntime>())
  const bobPhase = useRef(0)

  useFrame((_, dt) => {
    const snap = useGame.getState().snapshot
    if (!snap) return

    bobPhase.current += dt * 9
    const alpha = 1 - Math.exp(-dt * 18)  // lerp speed — higher = snappier

    const seen = new Set<string>()

    for (const p of snap.players) {
      if (!p.alive) {
        // Hide dead players
        const rt = runtimes.current.get(p.id)
        if (rt) rt.object.visible = false
        continue
      }

      seen.add(p.id)
      let rt = runtimes.current.get(p.id)

      // Create new player object if needed
      if (!rt) {
        const isSelf = p.id === playerId
        const obj = buildPlayerObject(isSelf)
        groupRef.current.add(obj)
        rt = {
          object: obj,
          smoothPos: new THREE.Vector3(p.x, p.y, p.z),
          currentWeapon: null,
          isSelf,
        }
        runtimes.current.set(p.id, rt)
      }

      rt.object.visible = true

      // ── Smooth position (lerp toward server position every frame) ──────────
      rt.smoothPos.x += (p.x - rt.smoothPos.x) * alpha
      rt.smoothPos.y += (p.y - rt.smoothPos.y) * alpha
      rt.smoothPos.z += (p.z - rt.smoothPos.z) * alpha

      // For local player: use predicted position instead of server position
      if (rt.isSelf) {
        const predicted = predictedRef.current
        if (predicted) {
          rt.object.position.set(predicted.x, predicted.y, predicted.z)
        } else {
          rt.object.position.copy(rt.smoothPos)
        }
      } else {
        rt.object.position.copy(rt.smoothPos)
      }

      // ── Rotation ───────────────────────────────────────────────────────────
      rt.object.rotation.y = p.yaw

      // ── Bob ────────────────────────────────────────────────────────────────
      const spd = Math.hypot(p.vx, p.vz)
      const bob = Math.abs(Math.sin(bobPhase.current + p.id.charCodeAt(0))) * Math.min(1, spd / 8)
      const bodyGroup = rt.object.userData.bodyGroup as THREE.Group
      bodyGroup.position.y = bob * 0.06

      // ── Weapon swap ────────────────────────────────────────────────────────
      const w = p.loadout[p.weaponIndex] as WeaponId | null
      if (w !== rt.currentWeapon) {
        const wg = rt.object.userData.weaponGroup as THREE.Group
        wg.clear()
        if (w) wg.add(buildWeaponMesh(w))
        rt.currentWeapon = w
      }

      // ── Parachute ──────────────────────────────────────────────────────────
      const chuteGroup = rt.object.userData.chuteGroup as THREE.Group
      chuteGroup.visible = p.skydiving
    }

    // Remove objects for players who left
    for (const [id, rt] of runtimes.current) {
      if (!seen.has(id)) {
        groupRef.current.remove(rt.object)
        runtimes.current.delete(id)
      }
    }
  })

  return <group ref={groupRef} />
}
