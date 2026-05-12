import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGame } from '../store/game'
import { terrainHeight } from './terrain'

const SEGS = 128
const TUBE_R = 0.35

/**
 * Storm boundary ring — geometry rebuilt only when zone center/radius changes
 * meaningfully (>0.5 units), not every snapshot tick.
 * Old geometry is disposed to prevent GPU memory leak.
 */
export function ZoneRing() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const lastZone = useRef<{ cx: number; cz: number; r: number } | null>(null)

  useFrame(() => {
    const zone = useGame.getState().snapshot?.zone
    if (!zone || !meshRef.current) return

    const prev = lastZone.current
    const moved =
      !prev ||
      Math.abs(prev.cx - zone.centerX) > 0.5 ||
      Math.abs(prev.cz - zone.centerZ) > 0.5 ||
      Math.abs(prev.r - zone.radius) > 0.5

    if (!moved) return

    lastZone.current = { cx: zone.centerX, cz: zone.centerZ, r: zone.radius }

    // Dispose old geometry
    meshRef.current.geometry?.dispose()

    const positions: number[] = []
    const indices: number[] = []

    for (let i = 0; i <= SEGS; i++) {
      const a = (i / SEGS) * Math.PI * 2
      const cx = zone.centerX + Math.cos(a) * zone.radius
      const cz = zone.centerZ + Math.sin(a) * zone.radius
      const cy = terrainHeight(cx, cz) + 0.25
      const nx = Math.cos(a)
      const nz = Math.sin(a)
      positions.push(cx - nx * TUBE_R, cy, cz - nz * TUBE_R)
      positions.push(cx + nx * TUBE_R, cy, cz + nz * TUBE_R)
      positions.push(cx - nx * TUBE_R, cy + 0.7, cz - nz * TUBE_R)
      positions.push(cx + nx * TUBE_R, cy + 0.7, cz + nz * TUBE_R)
    }

    for (let i = 0; i < SEGS; i++) {
      const b = i * 4
      const n = (i + 1) * 4
      indices.push(b, n, b + 1, n, n + 1, b + 1)
      indices.push(b + 2, b + 3, n + 2, n + 2, b + 3, n + 3)
      indices.push(b, b + 2, n, n, b + 2, n + 2)
      indices.push(b + 1, n + 1, b + 3, n + 1, n + 3, b + 3)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    meshRef.current.geometry = geo
  })

  // Dispose on unmount
  useEffect(() => {
    return () => { meshRef.current?.geometry?.dispose() }
  }, [])

  return (
    <mesh ref={meshRef}>
      <bufferGeometry />
      <meshBasicMaterial
        color="#38bdf8"
        transparent
        opacity={0.55}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}
