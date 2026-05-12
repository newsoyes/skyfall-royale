import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getActiveMap } from './terrain'

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function InstancedTrees() {
  const map = getActiveMap()
  const { seeds, terrainHeight, mapHalf, style } = map
  const count = seeds.treeCount

  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const leafRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const rng = useMemo(() => mulberry32(seeds.trees), [seeds.trees])

  const matTrunk = useMemo(() => new THREE.MeshStandardMaterial({ color: style.trunkColor, roughness: 0.9 }), [style.trunkColor])
  const matLeaf = useMemo(() => new THREE.MeshStandardMaterial({ color: style.leafColor, roughness: 0.72 }), [style.leafColor])

  useLayoutEffect(() => {
    const tr = trunkRef.current
    const lf = leafRef.current
    if (!tr || !lf) return
    const rngLocal = mulberry32(seeds.trees)
    for (let i = 0; i < count; i++) {
      const a = rngLocal() * Math.PI * 2
      const r = 8 + rngLocal() * (mapHalf - 20)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const y = terrainHeight(x, z)
      dummy.position.set(x, y + 1.1, z)
      dummy.scale.setScalar(0.75 + rngLocal() * 0.45)
      dummy.rotation.set(0, rngLocal() * Math.PI * 2, 0)
      dummy.updateMatrix()
      tr.setMatrixAt(i, dummy.matrix)
      dummy.position.set(x, y + 3.2, z)
      dummy.scale.set(0.9 + rngLocal() * 0.35, 1.05 + rngLocal() * 0.25, 0.9 + rngLocal() * 0.35)
      dummy.rotation.set(0, rngLocal() * Math.PI * 2, 0)
      dummy.updateMatrix()
      lf.setMatrixAt(i, dummy.matrix)
    }
    tr.instanceMatrix.needsUpdate = true
    lf.instanceMatrix.needsUpdate = true
  }, [count, dummy, rng, seeds.trees, mapHalf, terrainHeight])

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, count]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.45, 2.2, 6]} />
        <primitive object={matTrunk} attach="material" />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[undefined, undefined, count]} castShadow receiveShadow>
        <coneGeometry args={[1.6, 3.2, 7]} />
        <primitive object={matLeaf} attach="material" />
      </instancedMesh>
    </group>
  )
}

export function InstancedRocks() {
  const map = getActiveMap()
  const { seeds, terrainHeight, mapHalf, style } = map
  const count = seeds.rockCount

  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const matRock = useMemo(() => new THREE.MeshStandardMaterial({ color: style.rockColor, roughness: 0.85 }), [style.rockColor])

  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const rngLocal = mulberry32(seeds.rocks)
    for (let i = 0; i < count; i++) {
      const a = rngLocal() * Math.PI * 2
      const r = 10 + rngLocal() * (mapHalf - 25)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const y = terrainHeight(x, z)
      dummy.position.set(x, y + 0.55, z)
      dummy.rotation.set(rngLocal() * 0.2, rngLocal() * Math.PI * 2, rngLocal() * 0.2)
      dummy.scale.set(0.6 + rngLocal(), 0.5 + rngLocal(), 0.6 + rngLocal())
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [count, dummy, seeds.rocks, mapHalf, terrainHeight])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[1.4, 1.1, 1.2]} />
      <primitive object={matRock} attach="material" />
    </instancedMesh>
  )
}

export function Ruins() {
  const map = getActiveMap()
  const { seeds, terrainHeight, mapHalf, style } = map
  const count = seeds.ruinCount

  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const matRuin = useMemo(() => new THREE.MeshStandardMaterial({ color: style.ruinColor, roughness: 0.9 }), [style.ruinColor])

  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    let i = 0
    const clusters = Math.ceil(count / 5)
    const rngLocal = mulberry32(seeds.ruins)
    for (let c = 0; c < clusters && i < count; c++) {
      const cx = (rngLocal() - 0.5) * mapHalf * 1.4
      const cz = (rngLocal() - 0.5) * mapHalf * 1.4
      const n = 3 + Math.floor(rngLocal() * 5)
      for (let k = 0; k < n && i < count; k++) {
        const x = cx + (rngLocal() - 0.5) * 12
        const z = cz + (rngLocal() - 0.5) * 12
        const y = terrainHeight(x, z)
        dummy.position.set(x, y + 2.25, z)
        dummy.rotation.set(0, rngLocal() * Math.PI * 2, 0)
        dummy.scale.set(0.8 + rngLocal() * 0.4, 0.6 + rngLocal() * 0.8, 0.8 + rngLocal() * 0.4)
        dummy.updateMatrix()
        m.setMatrixAt(i++, dummy.matrix)
      }
    }
    m.instanceMatrix.needsUpdate = true
  }, [count, dummy, seeds.ruins, mapHalf, terrainHeight])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[1.2, 4.5, 1.2]} />
      <primitive object={matRuin} attach="material" />
    </instancedMesh>
  )
}
