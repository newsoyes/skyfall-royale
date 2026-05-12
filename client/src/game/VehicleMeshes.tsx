/**
 * VehicleMeshes — renders all vehicles (jeep-style) using ref-driven animation.
 * รถตกลงมาจากฟ้า (falling=true จาก server) แล้วจอดบนพื้น
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/game'
import { NO_VEHICLES } from './emptyRefs'

// ── Shared materials ──────────────────────────────────────────────────────────
const matBody   = new THREE.MeshStandardMaterial({ color: '#4a7c59', roughness: 0.55, metalness: 0.3 })
const matWheel  = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 })
const matGlass  = new THREE.MeshStandardMaterial({ color: '#7ec8e3', transparent: true, opacity: 0.45, roughness: 0.1 })
const matMetal  = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.4, metalness: 0.7 })
const matDamage = new THREE.MeshStandardMaterial({ color: '#8b4513', roughness: 0.8 })

// ── Shared geometries ─────────────────────────────────────────────────────────
const geoBody    = new THREE.BoxGeometry(2.0, 0.7, 3.8)
const geoCabin   = new THREE.BoxGeometry(1.7, 0.65, 1.8)
const geoWheel   = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14)
const geoGlass   = new THREE.BoxGeometry(1.55, 0.5, 0.08)
const geoHood    = new THREE.BoxGeometry(1.9, 0.12, 1.2)
const geoBumper  = new THREE.BoxGeometry(2.0, 0.25, 0.18)
const geoExhaust = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6)

function buildVehicleObject(): THREE.Group {
  const root = new THREE.Group()

  // Main body
  const body = new THREE.Mesh(geoBody, matBody)
  body.castShadow = true
  body.position.set(0, 0.35, 0)
  root.add(body)

  // Hood
  const hood = new THREE.Mesh(geoHood, matBody)
  hood.castShadow = true
  hood.position.set(0, 0.76, -1.3)
  root.add(hood)

  // Cabin
  const cabin = new THREE.Mesh(geoCabin, matBody)
  cabin.castShadow = true
  cabin.position.set(0, 1.05, 0.4)
  root.add(cabin)

  // Windshield
  const windshield = new THREE.Mesh(geoGlass, matGlass)
  windshield.position.set(0, 1.05, -0.52)
  root.add(windshield)

  // Rear glass
  const rearGlass = new THREE.Mesh(geoGlass, matGlass)
  rearGlass.position.set(0, 1.05, 1.32)
  root.add(rearGlass)

  // Front bumper
  const bumperF = new THREE.Mesh(geoBumper, matMetal)
  bumperF.position.set(0, 0.22, -1.95)
  root.add(bumperF)

  // Rear bumper
  const bumperR = new THREE.Mesh(geoBumper, matMetal)
  bumperR.position.set(0, 0.22, 1.95)
  root.add(bumperR)

  // Exhaust pipe
  const exhaust = new THREE.Mesh(geoExhaust, matMetal)
  exhaust.rotation.z = Math.PI / 2
  exhaust.position.set(1.05, 0.28, 1.6)
  root.add(exhaust)

  // 4 wheels
  const wheelPositions = [
    [-1.05, 0, -1.2],
    [ 1.05, 0, -1.2],
    [-1.05, 0,  1.2],
    [ 1.05, 0,  1.2],
  ] as const
  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(geoWheel, matWheel)
    wheel.castShadow = true
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(wx, wy, wz)
    root.add(wheel)
  }

  return root
}

// ── HP bar (billboard) ────────────────────────────────────────────────────────
const geoBarBg  = new THREE.PlaneGeometry(2.2, 0.22)
const geoBarFg  = new THREE.PlaneGeometry(1, 0.16)
const matBarBg  = new THREE.MeshBasicMaterial({ color: '#1a1a1a', transparent: true, opacity: 0.7, depthWrite: false })
const matBarFg  = new THREE.MeshBasicMaterial({ color: '#4ade80', depthWrite: false })

function buildHpBar(): THREE.Group {
  const g = new THREE.Group()
  const bg = new THREE.Mesh(geoBarBg, matBarBg)
  bg.position.set(0, 0, 0)
  g.add(bg)
  const fg = new THREE.Mesh(geoBarFg, matBarFg.clone())
  fg.position.set(0, 0, 0.001)
  g.add(fg)
  g.userData.fg = fg
  return g
}

// ── Runtime state ─────────────────────────────────────────────────────────────
interface VehicleRuntime {
  object: THREE.Group
  hpBar: THREE.Group
  smoothPos: THREE.Vector3
  smoothYaw: number
}

export function VehicleMeshes() {
  const groupRef = useRef<THREE.Group>(null!)
  const runtimes = useRef(new Map<string, VehicleRuntime>())

  useFrame((state, dt) => {
    const snap = useGame.getState().snapshot
    const vehicles = snap?.vehicles ?? NO_VEHICLES
    const alpha = 1 - Math.exp(-dt * 14)

    const seen = new Set<string>()

    for (const v of vehicles) {
      seen.add(v.id)
      let rt = runtimes.current.get(v.id)

      if (!rt) {
        const obj = buildVehicleObject()
        const hpBar = buildHpBar()
        hpBar.position.set(0, 2.2, 0)
        obj.add(hpBar)
        groupRef.current.add(obj)
        rt = {
          object: obj,
          hpBar,
          smoothPos: new THREE.Vector3(v.x, v.y, v.z),
          smoothYaw: v.yaw,
        }
        runtimes.current.set(v.id, rt)
      }

      // Smooth position
      rt.smoothPos.x += (v.x - rt.smoothPos.x) * alpha
      rt.smoothPos.y += (v.y - rt.smoothPos.y) * alpha
      rt.smoothPos.z += (v.z - rt.smoothPos.z) * alpha
      rt.object.position.copy(rt.smoothPos)

      // Smooth yaw (handle wrap-around)
      let dyaw = v.yaw - rt.smoothYaw
      if (dyaw > Math.PI) dyaw -= Math.PI * 2
      if (dyaw < -Math.PI) dyaw += Math.PI * 2
      rt.smoothYaw += dyaw * alpha
      rt.object.rotation.y = rt.smoothYaw

      // HP bar — billboard toward camera
      const hpPct = Math.max(0, v.hp / 400)
      const fg = rt.hpBar.userData.fg as THREE.Mesh
      fg.scale.x = hpPct
      fg.position.x = (hpPct - 1) * 1.1  // left-align
      const mat = fg.material as THREE.MeshBasicMaterial
      mat.color.setStyle(hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#facc15' : '#ef4444')
      rt.hpBar.lookAt(state.camera.position)

      // Wheel spin based on speed
      const speed = Math.abs(v.speed)
      if (speed > 0.1) {
        const spinDelta = (v.speed / 0.42) * dt
        rt.object.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.geometry === geoWheel) {
            child.rotation.x += spinDelta
          }
        })
      }
    }

    // Remove stale vehicles — dispose geometries and clone materials
    for (const [id, rt] of runtimes.current) {
      if (!seen.has(id)) {
        rt.object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose()
            // Dispose cloned materials (HP bar fg uses cloned material)
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose())
            } else {
              child.material?.dispose()
            }
          }
        })
        groupRef.current.remove(rt.object)
        runtimes.current.delete(id)
      }
    }
  })

  return <group ref={groupRef} />
}
