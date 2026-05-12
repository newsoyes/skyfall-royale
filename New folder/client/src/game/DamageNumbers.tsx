import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/game'
import { NO_DAMAGE_NUMBERS } from './emptyRefs'

const FLOAT_SPEED = 1.8
const FADE_START = 0.55
const LIFETIME = 1400

function DmgNum({
  x, y, z, damage, head, clientAt,
}: {
  x: number; y: number; z: number; damage: number; head: boolean; clientAt: number
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const { camera } = useThree()

  // Build canvas texture once per instance
  const texture = useRef<THREE.CanvasTexture | null>(null)
  if (!texture.current) {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 128, 64)
    ctx.font = `bold ${head ? 44 : 36}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 5
    ctx.strokeText(String(damage), 64, 32)
    ctx.fillStyle = head ? '#fbbf24' : '#ffffff'
    ctx.fillText(String(damage), 64, 32)
    texture.current = new THREE.CanvasTexture(canvas)
  }

  // Dispose texture when component unmounts to prevent GPU memory leak
  useEffect(() => {
    return () => {
      texture.current?.dispose()
      texture.current = null
    }
  }, [])

  useFrame(() => {
    const now = performance.now()
    const age = now - clientAt
    if (age > LIFETIME || !meshRef.current || !matRef.current) return
    const t = age / LIFETIME
    meshRef.current.position.y = y + t * FLOAT_SPEED
    meshRef.current.quaternion.copy(camera.quaternion)
    if (t > FADE_START) {
      matRef.current.opacity = 1 - (t - FADE_START) / (1 - FADE_START)
    }
  })

  return (
    <mesh ref={meshRef} position={[x, y, z]}>
      <planeGeometry args={[1.2, 0.6]} />
      <meshBasicMaterial
        ref={matRef}
        map={texture.current}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export function DamageNumbers() {
  const nums = useGame((s) => s.snapshot?.damageNumbers ?? NO_DAMAGE_NUMBERS)
  // Compute clientOffset once per render — server time → client performance.now() offset
  const serverT = useGame((s) => s.snapshot?.t ?? 0)
  const clientOffset = useRef(0)
  // Update offset only when snapshot arrives (not every render)
  if (serverT > 0) {
    clientOffset.current = performance.now() - serverT
  }

  const now = performance.now()

  return (
    <group>
      {nums
        .filter((n) => {
          const clientAt = n.at + clientOffset.current
          return now - clientAt < LIFETIME
        })
        .map((n) => (
          <DmgNum
            key={n.id}
            x={n.x}
            y={n.y + 1.8}
            z={n.z}
            damage={n.damage}
            head={n.head}
            clientAt={n.at + clientOffset.current}
          />
        ))}
    </group>
  )
}
