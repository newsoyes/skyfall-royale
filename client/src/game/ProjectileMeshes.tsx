import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/game'
import { NO_PROJECTILES } from './emptyRefs'

const matRocket = new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ff6b35', emissiveIntensity: 0.8 })
const matGrenade = new THREE.MeshStandardMaterial({ color: '#4a5568', roughness: 0.6, metalness: 0.4 })
const matSmokePill = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.8 })

const geoRocket  = new THREE.SphereGeometry(0.35, 12, 12)
const geoGrenade = new THREE.SphereGeometry(0.22, 10, 10)
const geoSmoke   = new THREE.CylinderGeometry(0.15, 0.15, 0.35, 8)

export function ProjectileMeshes() {
  const groupRef = useRef<THREE.Group>(null!)
  const meshRefs = useRef(new Map<string, THREE.Mesh>())

  useFrame(() => {
    const projectiles = useGame.getState().snapshot?.projectiles ?? NO_PROJECTILES
    const seen = new Set<string>()

    for (const pr of projectiles) {
      seen.add(pr.id)
      let mesh = meshRefs.current.get(pr.id)
      if (!mesh) {
        let geo: THREE.BufferGeometry
        let mat: THREE.MeshStandardMaterial
        if (pr.type === 'rocket') { geo = geoRocket; mat = matRocket }
        else if (pr.type === 'grenade') { geo = geoGrenade; mat = matGrenade }
        else { geo = geoSmoke; mat = matSmokePill }
        mesh = new THREE.Mesh(geo, mat)
        mesh.castShadow = true
        groupRef.current.add(mesh)
        meshRefs.current.set(pr.id, mesh)
      }
      mesh.position.set(pr.x, pr.y, pr.z)
      // Spin grenades
      if (pr.type === 'grenade' || pr.type === 'smoke') {
        mesh.rotation.x += 0.15
        mesh.rotation.z += 0.08
      }
    }

    // Remove stale
    for (const [id, mesh] of meshRefs.current) {
      if (!seen.has(id)) {
        groupRef.current.remove(mesh)
        meshRefs.current.delete(id)
      }
    }
  })

  return <group ref={groupRef} />
}
