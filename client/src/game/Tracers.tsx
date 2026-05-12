import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/game'
import type { Tracer } from '../store/game'

const matTracer = new THREE.MeshBasicMaterial({
  color: '#ffcf66',
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
})

/** Manages tracer meshes imperatively via useFrame — no React re-renders */
export function Tracers() {
  const groupRef = useRef<THREE.Group>(null!)
  // Map tracer id → mesh
  const meshMap = useRef(new Map<string, THREE.Mesh>())

  useFrame(() => {
    const now = performance.now()
    const tracers = useGame.getState().tracers
    const seen = new Set<string>()

    for (const t of tracers) {
      if (t.until <= now) continue
      seen.add(t.id)

      if (!meshMap.current.has(t.id)) {
        const mesh = new THREE.Mesh(buildTracerGeo(t), matTracer)
        groupRef.current.add(mesh)
        meshMap.current.set(t.id, mesh)
      }
    }

    // Remove expired tracers
    for (const [id, mesh] of meshMap.current) {
      if (!seen.has(id)) {
        mesh.geometry.dispose()
        groupRef.current.remove(mesh)
        meshMap.current.delete(id)
      }
    }
  })

  useEffect(() => {
    return () => {
      for (const mesh of meshMap.current.values()) {
        mesh.geometry.dispose()
      }
      meshMap.current.clear()
    }
  }, [])

  return <group ref={groupRef} />
}

function buildTracerGeo(t: Tracer): THREE.BufferGeometry {
  const start = new THREE.Vector3(t.ax, t.ay, t.az)
  const end = new THREE.Vector3(t.bx, t.by, t.bz)
  const dir = new THREE.Vector3().subVectors(end, start)
  const len = dir.length()
  if (len < 0.01) return new THREE.BufferGeometry()

  const geo = new THREE.CylinderGeometry(0.04, 0.04, len, 4, 1)
  geo.rotateX(Math.PI / 2)
  geo.translate(0, 0, len / 2)
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    dir.normalize(),
  )
  geo.applyQuaternion(q)
  geo.translate(start.x, start.y, start.z)
  return geo
}
