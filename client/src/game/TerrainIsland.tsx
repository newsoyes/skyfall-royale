import { useMemo } from 'react'
import * as THREE from 'three'
import { terrainHeight, getActiveMap } from './terrain'

/** Visual terrain — rebuilds geometry when map changes. */
export function TerrainIsland() {
  const map = getActiveMap()

  const geometry = useMemo(() => {
    const seg = 96
    const half = map.mapHalf
    const size = half * 2 - 10
    const geo = new THREE.PlaneGeometry(size, size, seg, seg)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const c = new THREE.Color()
    const colors: number[] = []
    const low = new THREE.Color(map.groundColorLow)
    const high = new THREE.Color(map.groundColorHigh)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const y = terrainHeight(x, z)
      pos.setY(i, y)
      const t = Math.max(0, Math.min(1, (y + 2) / 16))
      c.lerpColors(low, high, t)
      colors.push(c.r, c.g, c.b)
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id])

  const water = useMemo(() => {
    const g = new THREE.CircleGeometry(map.mapHalf * 2.2, 64)
    g.rotateX(-Math.PI / 2)
    return g
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh geometry={water} position={[0, -2.2, 0]} receiveShadow>
        <meshStandardMaterial
          color={map.waterColor}
          roughness={0.15}
          metalness={0.25}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}
