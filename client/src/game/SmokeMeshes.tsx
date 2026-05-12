/**
 * SmokeMeshes — renders smoke clouds from smoke grenades.
 * ใช้ semi-transparent sphere หลายลูกซ้อนกัน เพื่อให้ดูเป็นควัน
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/game'

const matSmoke = new THREE.MeshStandardMaterial({
  color: '#94a3b8',
  transparent: true,
  opacity: 0.55,
  roughness: 1,
  depthWrite: false,
  side: THREE.DoubleSide,
})

// Offsets for sub-puffs to make it look volumetric
const PUFF_OFFSETS: [number, number, number, number][] = [
  [0,    0,    0,    1.0],
  [0.8,  0.4,  0.3,  0.75],
  [-0.7, 0.6, -0.2,  0.7],
  [0.2,  0.9,  0.5,  0.65],
  [-0.3, 0.3, -0.8,  0.8],
  [0.5,  0.7, -0.4,  0.6],
  [-0.5, 1.1,  0.3,  0.55],
]

export function SmokeMeshes() {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const clouds = useGame.getState().smokeClouds
    const now = performance.now()

    // Remove old children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]!)
    }

    for (const cloud of clouds) {
      if (cloud.until < now) continue
      const age = (now - (cloud.until - 15000)) / 15000  // 0→1 over lifetime
      const expand = Math.min(1, age * 3)  // expand quickly at start
      const fade = age > 0.7 ? 1 - (age - 0.7) / 0.3 : 1  // fade out last 30%

      const cloudGroup = new THREE.Group()
      cloudGroup.position.set(cloud.x, cloud.y, cloud.z)

      for (const [ox, oy, oz, scale] of PUFF_OFFSETS) {
        const puffR = cloud.radius * scale * expand
        const geo = new THREE.SphereGeometry(puffR, 8, 6)
        const mat = matSmoke.clone()
        mat.opacity = 0.45 * fade * (0.8 + Math.sin(t * 0.5 + ox) * 0.2)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(
          ox * cloud.radius * 0.4,
          oy * cloud.radius * 0.3,
          oz * cloud.radius * 0.4,
        )
        cloudGroup.add(mesh)
      }

      groupRef.current.add(cloudGroup)
    }
  })

  return <group ref={groupRef} />
}
