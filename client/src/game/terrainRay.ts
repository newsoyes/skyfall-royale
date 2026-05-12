import * as THREE from 'three'
import { terrainHeight } from './terrain'

const _result = new THREE.Vector3()

/** March along ray until it hits terrain — for tracer end visuals. */
export function raycastTerrainAlong(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number,
  step = 0.65,
): THREE.Vector3 {
  const dx = dir.x
  const dy = dir.y
  const dz = dir.z
  // Normalize inline to avoid allocating a new Vector3
  const len = Math.hypot(dx, dy, dz) || 1
  const nx = dx / len
  const ny = dy / len
  const nz = dz / len

  for (let t = step; t <= maxDist; t += step) {
    const x = origin.x + nx * t
    const y = origin.y + ny * t
    const z = origin.z + nz * t
    const ground = terrainHeight(x, z) + 0.45
    if (y <= ground) {
      // Step back one step to get the last above-ground point
      const tHit = Math.max(0, t - step)
      _result.set(
        origin.x + nx * tHit,
        terrainHeight(origin.x + nx * tHit, origin.z + nz * tHit) + 0.45,
        origin.z + nz * tHit,
      )
      return _result
    }
  }
  _result.set(origin.x + nx * maxDist, origin.y + ny * maxDist, origin.z + nz * maxDist)
  return _result
}
