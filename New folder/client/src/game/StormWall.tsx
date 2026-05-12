import { useMemo } from 'react'
import * as THREE from 'three'
import { useGame } from '../store/game'

/** Vertical translucent storm wall at zone radius — highly visible boundary. */
export function StormWall() {
  const zone = useGame((s) => s.snapshot?.zone)

  const geo = useMemo(() => new THREE.CylinderGeometry(1, 1, 140, 64, 1, true), [])

  if (!zone) return null

  return (
    <mesh
      position={[zone.centerX, 70, zone.centerZ]}
      rotation={[0, 0, 0]}
      geometry={geo}
      scale={[zone.radius, 1, zone.radius]}
    >
      <meshStandardMaterial
        color="#22d3ee"
        emissive="#0ea5e9"
        emissiveIntensity={0.85}
        transparent
        opacity={0.22}
        side={THREE.DoubleSide}
        depthWrite={false}
        roughness={0.25}
        metalness={0.15}
      />
    </mesh>
  )
}
