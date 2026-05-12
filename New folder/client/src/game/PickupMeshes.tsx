import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../store/game'
import { RARITY_COLOR, CONSUMABLE_COLOR, ARMOR_COLOR, isWeaponId, isArmorItem, parseArmorItem } from './weapons'
import { NO_PICKUPS } from './emptyRefs'
import type { ConsumableId, ArmorTier } from '../types/protocol'

const BEAM_HEIGHT = 80
const BEAM_HALF = BEAM_HEIGHT / 2

function PickupBeacon({ color, isConsumable }: { color: string; isConsumable: boolean }) {
  const boxRef = useRef<THREE.Mesh>(null!)
  const beamRef = useRef<THREE.Mesh>(null!)
  const innerRef = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (boxRef.current) {
      boxRef.current.rotation.y = t * 1.4
      if (isConsumable) {
        boxRef.current.position.y = Math.sin(t * 2.2) * 0.18
      }
    }
    if (beamRef.current) {
      const mat = beamRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.18 + Math.sin(t * 2.5) * 0.08
    }
    if (innerRef.current) {
      const mat = innerRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 + Math.sin(t * 2.5 + 1) * 0.15
    }
  })

  return (
    <>
      <mesh ref={boxRef} castShadow>
        {isConsumable
          ? <sphereGeometry args={[0.38, 12, 12]} />
          : <boxGeometry args={[0.65, 0.65, 0.65]} />
        }
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          roughness={0.3}
          metalness={isConsumable ? 0 : 0.2}
        />
      </mesh>
      <mesh ref={beamRef} position={[0, BEAM_HALF, 0]}>
        <cylinderGeometry args={[0.55, 0.55, BEAM_HEIGHT, 12, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={innerRef} position={[0, BEAM_HALF, 0]}>
        <cylinderGeometry args={[0.12, 0.12, BEAM_HEIGHT, 8, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.5, 1.1, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  )
}

/** Resolve the display color for any pickup item type */
function pickupColor(item: string, rarity: string): string {
  if (isWeaponId(item)) return RARITY_COLOR[rarity] ?? '#ffffff'
  if (isArmorItem(item)) {
    const parsed = parseArmorItem(item)
    return parsed ? (ARMOR_COLOR[parsed.tier as ArmorTier] ?? '#cfcfcf') : '#cfcfcf'
  }
  // consumable
  return CONSUMABLE_COLOR[item as ConsumableId] ?? '#4ade80'
}

export function PickupMeshes() {
  const pickups = useGame((s) => s.snapshot?.pickups ?? NO_PICKUPS)
  return (
    <group>
      {pickups.map((pk) => {
        const isConsumableOrArmor = !isWeaponId(pk.item)
        const color = pickupColor(pk.item, pk.rarity)
        return (
          <group key={pk.id} position={[pk.x, pk.y, pk.z]}>
            <PickupBeacon color={color} isConsumable={isConsumableOrArmor} />
          </group>
        )
      })}
    </group>
  )
}
